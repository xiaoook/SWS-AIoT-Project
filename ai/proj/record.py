import cv2
import numpy as np
import time
import math
import csv
import pandas as pd
import torch
import torch.nn.functional as F
from model import LSTMClassifier
import collections
import json
from datetime import datetime


def analyze_csv(csv_path, window_sec=3.0):
    df = pd.read_csv(csv_path)
    if len(df) == 0:
        raise ValueError("CSV文件为空")
    max_time = df["timestamp"].max()
    min_time = max_time - window_sec
    window_df = df[(df["timestamp"] >= min_time) & (df["timestamp"] <= max_time)]
    if len(window_df) == 0:
        raise ValueError("窗口内没有数据")

    report = {}
    report["avg_p1_speed"] = window_df["paddle1_speed"].mean()
    report["avg_p2_speed"] = window_df["paddle2_speed"].mean()
    report["std_p1_speed"] = window_df["paddle1_speed"].std()
    report["std_p2_speed"] = window_df["paddle2_speed"].std()
    report["avg_p1_acc"] = np.mean(np.diff(window_df["paddle1_speed"]))
    report["avg_p2_acc"] = np.mean(np.diff(window_df["paddle2_speed"]))
    report["avg_ball_acc"] = np.mean(np.diff(window_df["ball_speed"]))
    report["avg_dist_ball_p1"] = window_df["dist_ball_paddle1"].mean()
    report["avg_dist_ball_p2"] = window_df["dist_ball_paddle2"].mean()
    report["avg_dist_paddles"] = window_df["dist_paddle1_paddle2"].mean()
    report["max_ball_speed"] = window_df["ball_speed"].max()
    report["avg_ball_dir"] = window_df["ball_dir"].mean()
    upper_half_frames = window_df[window_df["ball_v"] < 0.5]
    report["upper_half_ratio"] = len(upper_half_frames) / len(window_df)
    report["avg_p1_goal_dist"] = window_df["paddle1_goal_dist"].mean() if "paddle1_goal_dist" in window_df else None
    report["avg_p2_goal_dist"] = window_df["paddle2_goal_dist"].mean() if "paddle2_goal_dist" in window_df else None
    ball_p1_close = window_df["dist_ball_paddle1"] < 0.2
    ball_p2_close = window_df["dist_ball_paddle2"] < 0.2
    report["p1_possession_ratio"] = ball_p1_close.sum() / len(window_df)
    report["p2_possession_ratio"] = ball_p2_close.sum() / len(window_df)
    return report


def generate_suggestions(report):
    suggestions = []
    if report["avg_p1_speed"] < 0.05:
        suggestions.append("Paddle1 movement too low; increase activity.")
    if report["avg_p2_speed"] < 0.05:
        suggestions.append("Paddle2 movement too low; increase activity.")
    if report["avg_dist_ball_p1"] > 0.6:
        suggestions.append("Paddle1 too far from ball; improve positioning.")
    if report["avg_dist_ball_p2"] > 0.6:
        suggestions.append("Paddle2 too far from ball; improve positioning.")
    return suggestions


class FieldDetector:
    def __init__(self, video_source):
        self.cap = cv2.VideoCapture(video_source)
        if not self.cap.isOpened():
            raise IOError("无法打开摄像头或视频源")
        self.corner_points = None

    def detect_field_once(self):
        while True:
            ret, frame = self.cap.read()
            if not ret:
                return None
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            lower_gray = 200
            upper_gray = 240
            mask = cv2.inRange(gray, lower_gray, upper_gray)
            kernel = np.ones((5, 5), np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            all_points = []
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > 500:
                    for pt in cnt:
                        all_points.append(pt[0])
            if len(all_points) < 4:
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    return None
                continue

            all_points = np.array(all_points)
            sum_coords = all_points.sum(axis=1)
            diff_coords = np.diff(all_points, axis=1).reshape(-1)

            top_left = all_points[np.argmin(sum_coords)]
            bottom_right = all_points[np.argmax(sum_coords)]
            top_right = all_points[np.argmin(diff_coords)]
            bottom_left = all_points[np.argmax(diff_coords)]

            self.corner_points = np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.int32)
            return frame

    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()


class CameraTracker:
    def __init__(self, video_source):
        self.detector = FieldDetector(video_source)
        frame = self.detector.detect_field_once()
        if self.detector.corner_points is None:
            raise Exception("No corner detected")
        self.corners = self.detector.corner_points
        self.cap = self.detector.cap

        self.prev_ball_uv = None
        self.prev_time = None

        self.score_player1 = 0
        self.score_player2 = 0

        self.csv_path = "tracking_data.csv"
        self.csv_file = open(self.csv_path, mode="w", newline="")
        self.csv_writer = csv.writer(self.csv_file)
        self.csv_writer.writerow([
            "timestamp", "ball_u", "ball_v", "in_goal", "scorer"
        ])

        self.analysis_interval = 1.0
        self.last_analysis_time = 0
        self.current_suggestions = []

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = LSTMClassifier(input_size=19, hidden_size=64, num_layers=1, num_classes=2)
        self.model.load_state_dict(torch.load("/home/mkbk/code/nus/proj/lstm_model.pt", map_location=self.device))
        self.model.to(self.device)
        self.model.eval()

        # 帧缓存与JSON
        self.frame_buffer = collections.deque(maxlen=60)
        self.events = []
        self.json_path = "goal_events.json"

    def compute_normalized(self, pt):
        TL, TR, BR, BL = self.corners
        src_quad = np.array([TL, TR, BR, BL], dtype=np.float32)
        dst_quad = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
        M = cv2.getPerspectiveTransform(src_quad, dst_quad)
        uv = cv2.perspectiveTransform(np.array([[[pt[0], pt[1]]]], dtype=np.float32), M)
        return uv[0, 0]

    def save_goal_event(self, scorer):
        event = {
            "timestamp": datetime.now().isoformat(),
            "scorer": f"Player {scorer}",
            "suggestions": self.current_suggestions
        }
        self.events.append(event)
        with open(self.json_path, "w") as f:
            json.dump(self.events, f, indent=2, ensure_ascii=False)

        if self.frame_buffer:
            now = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"recording/goal_{now}_player{scorer}.mp4"
            h, w = self.frame_buffer[0].shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(filename, fourcc, 30, (w, h))
            for frame in self.frame_buffer:
                out.write(frame)
            out.release()
            print(f"Saved goal video: {filename}")

    def process_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return False

        self.frame_buffer.append(frame.copy())

        curr_time = time.time()
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        cv2.polylines(frame, [self.corners.reshape((-1, 1, 2))], isClosed=True, color=(156, 85, 43), thickness=3)

        # Ball detection
        lower_ball1 = np.array([0, 100, 100])
        upper_ball1 = np.array([10, 255, 255])
        lower_ball2 = np.array([170, 100, 100])
        upper_ball2 = np.array([179, 255, 255])
        mask1 = cv2.inRange(hsv, lower_ball1, upper_ball1)
        mask2 = cv2.inRange(hsv, lower_ball2, upper_ball2)
        mask_ball = cv2.bitwise_or(mask1, mask2)

        ball_uv = None
        ball_contours, _ = cv2.findContours(mask_ball, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        ball_candidates = []
        for c in ball_contours:
            (x, y), radius = cv2.minEnclosingCircle(c)
            uv = self.compute_normalized((int(x), int(y)))
            ball_candidates.append((c, uv, (x, y, radius)))

        if ball_candidates:
            _, uv, _ = max(ball_candidates, key=lambda t: cv2.contourArea(t[0]))
            ball_uv = uv

        in_goal = False
        scorer = None
        if ball_uv is not None:
            if 0.3 < ball_uv[0] < 0.7:
                if ball_uv[1] < 0.05:
                    if time.time() - self.last_time > 0.5:
                        self.score_player2 += 1
                        self.save_goal_event(2)
                        self.last_time = time.time()
                elif ball_uv[1] > 0.95:
                    if time.time() - self.last_time > 0.5:
                        self.score_player1 += 1
                        self.save_goal_event(1)
                        self.last_time = time.time()

        # Create overlay only for SCORE
        h, w = frame.shape[:2]
        expanded = np.ones((h, w + 200, 3), dtype=np.uint8) * 255
        expanded[:, :w] = frame
        overlay = expanded[:, w:]
        cv2.putText(overlay, "=== SCORE ===", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        cv2.putText(overlay, f"Player1: {self.score_player1}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        cv2.putText(overlay, f"Player2: {self.score_player2}", (10, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

        cv2.imshow("Tracking", expanded)
        cv2.waitKey(1)

        self.prev_time = curr_time
        return True

    def run(self):
        self.last_time = time.time()
        while True:
            if not self.process_frame():
                break
        self.cap.release()
        self.csv_file.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    video_path = "/home/mkbk/code/nus/proj/videos/final1.mp4"
    tracker = CameraTracker(video_path)
    tracker.run()
