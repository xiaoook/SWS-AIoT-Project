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

    # 平均速度
    report["avg_p1_speed"] = window_df["paddle1_speed"].mean()
    report["avg_p2_speed"] = window_df["paddle2_speed"].mean()

    # 速度标准差 - 动作连贯性指标
    report["std_p1_speed"] = window_df["paddle1_speed"].std()
    report["std_p2_speed"] = window_df["paddle2_speed"].std()

    # 加速度（速度一阶差分）
    report["avg_p1_acc"] = np.mean(np.diff(window_df["paddle1_speed"]))
    report["avg_p2_acc"] = np.mean(np.diff(window_df["paddle2_speed"]))
    report["avg_ball_acc"] = np.mean(np.diff(window_df["ball_speed"]))

    # 与球距离
    report["avg_dist_ball_p1"] = window_df["dist_ball_paddle1"].mean()
    report["avg_dist_ball_p2"] = window_df["dist_ball_paddle2"].mean()

    # 与对手距离
    report["avg_dist_paddles"] = window_df["dist_paddle1_paddle2"].mean()

    # 球速最大值
    report["max_ball_speed"] = window_df["ball_speed"].max()

    # 球方向平均值（绝对值表示角度变化幅度）
    report["avg_ball_dir"] = window_df["ball_dir"].mean()

    # 球垂直位置比例 - 比如上半场比例
    upper_half_frames = window_df[window_df["ball_v"] < 0.5]
    report["upper_half_ratio"] = len(upper_half_frames) / len(window_df)

    # 拍与己方球门距离（假设paddle1球门为0，paddle2球门为1）
    report["avg_p1_goal_dist"] = window_df["paddle1_goal_dist"].mean() if "paddle1_goal_dist" in window_df else None
    report["avg_p2_goal_dist"] = window_df["paddle2_goal_dist"].mean() if "paddle2_goal_dist" in window_df else None

    # 控球时间估算：球与拍距离<阈值的比例（近距离视为控球）
    ball_p1_close = window_df["dist_ball_paddle1"] < 0.2
    ball_p2_close = window_df["dist_ball_paddle2"] < 0.2
    report["p1_possession_ratio"] = ball_p1_close.sum() / len(window_df)
    report["p2_possession_ratio"] = ball_p2_close.sum() / len(window_df)

    return report


def generate_suggestions(report):
    suggestions = []

    if report["avg_p1_speed"] < 0.05:
        suggestions.append({
            "issue": "Paddle1 movement too low",
            "suggestion": "Increase dynamic movement to apply pressure and unpredictability."
        })
    if report["avg_p2_speed"] < 0.05:
        suggestions.append({
            "issue": "Paddle2 movement too low",
            "suggestion": "Consider more active positioning and aggressive strikes."
        })

    if report["std_p1_speed"] > 5:
        suggestions.append({
            "issue": "Paddle1 speed variability high",
            "suggestion": "Try to maintain smoother movements for better control."
        })
    if report["std_p2_speed"] > 5:
        suggestions.append({
            "issue": "Paddle2 speed variability high",
            "suggestion": "Smooth out motion to reduce unnecessary energy loss."
        })

    if report["avg_p1_acc"] and abs(report["avg_p1_acc"]) > 0.1:
        suggestions.append({
            "issue": "Paddle1 frequent acceleration changes",
            "suggestion": "Good for quick attacks but avoid overexertion."
        })
    if report["avg_p2_acc"] and abs(report["avg_p2_acc"]) > 0.1:
        suggestions.append({
            "issue": "Paddle2 acceleration variability high",
            "suggestion": "Use controlled bursts to surprise opponent."
        })

    if report["avg_dist_ball_p1"] > 0.6:
        suggestions.append({
            "issue": "Paddle1 too far from ball",
            "suggestion": "Improve anticipation and closer positioning to seize control."
        })
    if report["avg_dist_ball_p2"] > 0.6:
        suggestions.append({
            "issue": "Paddle2 too distant from ball",
            "suggestion": "Reduce reaction time by staying closer."
        })

    if report["avg_dist_paddles"] > 0.9:
        suggestions.append({
            "issue": "Distance between paddles large",
            "suggestion": "Reduce gap to block opponent’s direct shots."
        })

    if report["max_ball_speed"] > 8:
        suggestions.append({
            "issue": "Ball speed high",
            "suggestion": "Improve paddle angle adjustments for better interception and deflection."
        })

    if report["p1_possession_ratio"] < 0.1:
        suggestions.append({
            "issue": "Paddle1 lacks ball control",
            "suggestion": "Increase aggression to gain possession."
        })
    if report["p2_possession_ratio"] < 0.1:
        suggestions.append({
            "issue": "Paddle2 needs to improve control time",
            "suggestion": "Anticipate shots and secure possession."
        })

    if report["avg_p1_goal_dist"] and report["avg_p1_goal_dist"] > 0.5:
        suggestions.append({
            "issue": "Paddle1 often far from goal",
            "suggestion": "Consider defensive positioning closer to goal to block shots."
        })
    if report["avg_p2_goal_dist"] and report["avg_p2_goal_dist"] > 0.5:
        suggestions.append({
            "issue": "Paddle2 too far from own goal",
            "suggestion": "Adjust defense posture to reduce opponent scoring chances."
        })

    if report["avg_ball_dir"] is not None:
        if abs(report["avg_ball_dir"]) < 10:
            suggestions.append({
                "issue": "Ball trajectory too straight",
                "suggestion": "Apply angled shots to disrupt opponent’s rhythm."
            })
        elif abs(report["avg_ball_dir"]) > 70:
            suggestions.append({
                "issue": "Ball direction changes frequently",
                "suggestion": "Focus on controlling shot speed and placement."
            })

    if report["upper_half_ratio"] > 0.8:
        suggestions.append({
            "issue": "Ball mostly in upper half",
            "suggestion": "Paddle1 should enhance active interceptions and offensive positioning."
        })
    elif report["upper_half_ratio"] < 0.2:
        suggestions.append({
            "issue": "Ball mostly in lower half",
            "suggestion": "Paddle2 needs to maintain forward posture to prevent opponent breakthroughs."
        })

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
                print("未找到足够的灰度点，按q退出或等待检测")
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
            print("检测到四个角点")
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
        self.prev_ball_speed = None

        self.prev_paddle_uvs = [None, None]
        self.prev_paddle_speeds = [None, None]
        self.prev_paddle_accs = [None, None]

        self.last_goal_time = 0
        self.goal_cooldown = 0.5

        self.score_player1 = 0
        self.score_player2 = 0

        self.csv_path = "tracking_data.csv"
        self.csv_file = open(self.csv_path, mode="w", newline="")
        self.csv_writer = csv.writer(self.csv_file)
        self.csv_writer.writerow([
            "timestamp",
            "ball_u", "ball_v", "ball_speed", "ball_acc", "ball_dir",
            "paddle1_u", "paddle1_v", "paddle1_speed", "paddle1_acc", "paddle1_dir",
            "paddle2_u", "paddle2_v", "paddle2_speed", "paddle2_acc", "paddle2_dir",
            "dist_ball_paddle1", "dist_ball_paddle2",
            "dist_paddle1_paddle2",
            "dist_ball_goal",
            "in_goal",
            "scorer"
        ])

        self.analysis_interval = 1.0  # 分析间隔秒
        self.last_analysis_time = 0
        self.current_suggestions = []

        # 加载LSTM模型
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = LSTMClassifier(input_size=19, hidden_size=64, num_layers=1, num_classes=2)
        self.model.load_state_dict(torch.load("/home/mkbk/code/nus/proj/lstm_model.pt", map_location=self.device))
        self.model.to(self.device)
        self.model.eval()

        self.pred_interval = 0.5  # 每1秒预测一次
        self.last_pred_time = 0
        self.pred_prob = None  # 预测概率存储
        self.frame_buffer = []
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30  # 默认30fps防止0
        self.max_buffer_len = int(self.fps * 3)  # 缓存3秒帧

        self.events = []
        self.goal_event_file = open("goal_events.json", "a", encoding="utf-8")

    def save_goal_clip(self, scorer, timestamp):
        if len(self.frame_buffer) == 0:
            return

        filename = f"recording/goal_clip_{scorer}_{int(timestamp)}.mp4"
        height, width = self.frame_buffer[0].shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(filename, fourcc, self.fps, (width, height))

        for frame in self.frame_buffer:
            out.write(frame)
        out.release()
        print(f"Saved goal clip to {filename}")

    def compute_normalized(self, pt):
        TL, TR, BR, BL = self.corners
        src_quad = np.array([TL, TR, BR, BL], dtype=np.float32)
        dst_quad = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
        M = cv2.getPerspectiveTransform(src_quad, dst_quad)
        uv = cv2.perspectiveTransform(np.array([[[pt[0], pt[1]]]], dtype=np.float32), M)
        return uv[0, 0]

    def update_suggestions(self, curr_time):
        if curr_time - self.last_analysis_time > self.analysis_interval:
            try:
                report = analyze_csv(self.csv_path, window_sec=self.analysis_interval)
                self.current_suggestions = generate_suggestions(report)
            except Exception as e:
                self.current_suggestions = [f"分析异常: {str(e)}"]
            self.last_analysis_time = curr_time

    def load_recent_data(self, window_sec=1.0):
        df = pd.read_csv(self.csv_path)
        if df.empty:
            return None

        max_time = df["timestamp"].max()
        min_time = max_time - window_sec
        window_df = df[(df["timestamp"] >= min_time) & (df["timestamp"] <= max_time)]

        if len(window_df) == 0:
            return None

        feature_cols = [
            "ball_u","ball_v","ball_speed","ball_acc","ball_dir",
            "paddle1_u","paddle1_v","paddle1_speed","paddle1_acc","paddle1_dir",
            "paddle2_u","paddle2_v","paddle2_speed","paddle2_acc","paddle2_dir",
            "dist_ball_paddle1","dist_ball_paddle2",
            "dist_paddle1_paddle2",
            "dist_ball_goal"
        ]

        data = window_df[feature_cols].fillna(0).values  # (T, features)
        x = torch.tensor(data, dtype=torch.float32).unsqueeze(0).to(self.device)  # (1, T, input_size)
        lengths = torch.tensor([data.shape[0]], dtype=torch.long).to(self.device)
        return x, lengths

    def predict(self):
        inputs = self.load_recent_data(self.pred_interval)
        if inputs is None:
            return None

        x, lengths = inputs
        with torch.no_grad():
            logits = self.model(x, lengths)  # (1, num_classes)
            probs = F.softmax(logits, dim=1)[0].cpu().numpy()
        return probs

    def process_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return False

        curr_time = time.time()
        # 帧缓冲维护
        self.frame_buffer.append(frame.copy())
        if len(self.frame_buffer) > self.max_buffer_len:
            self.frame_buffer.pop(0)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        cv2.polylines(frame, [self.corners.reshape((-1, 1, 2))], isClosed=True, color=(156, 85, 43), thickness=3)

        # 球检测
        lower_ball1 = np.array([0, 100, 100])
        upper_ball1 = np.array([10, 255, 255])
        lower_ball2 = np.array([170, 100, 100])
        upper_ball2 = np.array([179, 255, 255])
        mask1 = cv2.inRange(hsv, lower_ball1, upper_ball1)
        mask2 = cv2.inRange(hsv, lower_ball2, upper_ball2)
        mask_ball = cv2.bitwise_or(mask1, mask2)

        ball_uv = None
        ball_speed = None
        ball_acc = None
        ball_dir = None

        ball_contours, _ = cv2.findContours(mask_ball, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        ball_candidates = []
        for c in ball_contours:
            (x, y), radius = cv2.minEnclosingCircle(c)
            uv = self.compute_normalized((int(x), int(y)))
            ball_candidates.append((c, uv, (x, y, radius)))

        if ball_candidates:
            c, uv, (x, y, radius) = max(ball_candidates, key=lambda t: cv2.contourArea(t[0]))
            ball_uv = uv

            prev_uv = self.prev_ball_uv
            prev_speed = self.prev_ball_speed

            if prev_uv is not None and self.prev_time is not None:
                dt = curr_time - self.prev_time
                dxdy = uv - prev_uv
                dist = np.linalg.norm(dxdy)
                if dt > 0:
                    speed = dist / dt
                    if prev_speed is not None:
                        acc = (speed - prev_speed) / dt
                    else:
                        acc = None
                    dir_angle = math.degrees(math.atan2(dxdy[1], dxdy[0]))
                else:
                    speed = acc = dir_angle = None
            else:
                speed = acc = dir_angle = None

            ball_speed = speed
            ball_acc = acc
            ball_dir = dir_angle

            self.prev_ball_uv = uv
            self.prev_ball_speed = speed

            cv2.circle(frame, (int(x), int(y)), int(radius), (255, 0, 0), 2)

        # Paddle检测
        lower_paddle = np.array([14, 24, 172])
        upper_paddle = np.array([34, 255, 255])
        mask_paddle = cv2.inRange(hsv, lower_paddle, upper_paddle)

        paddle_uvs = [None, None]
        paddle_speeds = [None, None]
        paddle_accs = [None, None]
        paddle_dirs = [None, None]

        dt = curr_time - self.prev_time if self.prev_time else 1e-5

        paddle_contours, _ = cv2.findContours(mask_paddle, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        upper_half = []
        lower_half = []

        for c in paddle_contours:
            (x, y), radius = cv2.minEnclosingCircle(c)
            uv = self.compute_normalized((int(x), int(y)))
            if uv[1] < 0.5:
                upper_half.append((c, uv, (x, y, radius)))
            else:
                lower_half.append((c, uv, (x, y, radius)))

        if upper_half:
            c, uv, (x, y, radius) = max(upper_half, key=lambda t: cv2.contourArea(t[0]))
            paddle_uvs[0] = uv

            prev_uv = self.prev_paddle_uvs[0]
            prev_speed = self.prev_paddle_speeds[0]
            prev_acc = self.prev_paddle_accs[0]

            if prev_uv is not None:
                speed = np.linalg.norm(uv - prev_uv) / dt
                if prev_speed is not None:
                    acc = (speed - prev_speed) / dt
                else:
                    acc = None
                dir_angle = math.degrees(math.atan2((uv - prev_uv)[1], (uv - prev_uv)[0]))
            else:
                speed = acc = dir_angle = None

            paddle_speeds[0] = speed
            paddle_accs[0] = acc
            paddle_dirs[0] = dir_angle
            self.prev_paddle_uvs[0] = uv
            self.prev_paddle_speeds[0] = speed
            self.prev_paddle_accs[0] = acc

            cv2.circle(frame, (int(x), int(y)), int(radius), (0, 0, 255), 2)

        if lower_half:
            c, uv, (x, y, radius) = max(lower_half, key=lambda t: cv2.contourArea(t[0]))
            paddle_uvs[1] = uv

            prev_uv = self.prev_paddle_uvs[1]
            prev_speed = self.prev_paddle_speeds[1]
            prev_acc = self.prev_paddle_accs[1]

            if prev_uv is not None:
                speed = np.linalg.norm(uv - prev_uv) / dt
                if prev_speed is not None:
                    acc = (speed - prev_speed) / dt
                else:
                    acc = None
                dir_angle = math.degrees(math.atan2((uv - prev_uv)[1], (uv - prev_uv)[0]))
            else:
                speed = acc = dir_angle = None

            paddle_speeds[1] = speed
            paddle_accs[1] = acc
            paddle_dirs[1] = dir_angle
            self.prev_paddle_uvs[1] = uv
            self.prev_paddle_speeds[1] = speed
            self.prev_paddle_accs[1] = acc

            cv2.circle(frame, (int(x), int(y)), int(radius), (0, 255, 0), 2)

        # 给Player 1球拍加标签
        height, width = frame.shape[:2]
        if paddle_uvs[0] is not None:
            px1 = int(paddle_uvs[0][0] * width)
            py1 = int(paddle_uvs[0][1] * height)
            cv2.putText(frame, "Player 1", (px1 + 10, py1), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # 给Player 2球拍加标签
        if paddle_uvs[1] is not None:
            px2 = int(paddle_uvs[1][0] * width)
            py2 = int(paddle_uvs[1][1] * height)
            cv2.putText(frame, "Player 2", (px2 + 10, py2), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # 计算距离
        dist_ball_paddle1 = np.linalg.norm(ball_uv - paddle_uvs[0]) if ball_uv is not None and paddle_uvs[0] is not None else None
        dist_ball_paddle2 = np.linalg.norm(ball_uv - paddle_uvs[1]) if ball_uv is not None and paddle_uvs[1] is not None else None
        dist_paddle1_paddle2 = np.linalg.norm(paddle_uvs[0] - paddle_uvs[1]) if paddle_uvs[0] is not None and paddle_uvs[1] is not None else None

        # 球门判断
        in_goal = False
        scorer = None
        if ball_uv is not None:
            if 0.3<ball_uv[0]<0.7:
                if ball_uv[1] < 0.05:
                    if time.time() - self.last_goal_time > self.goal_cooldown:
                        self.score_player2 += 1
                        self.last_goal_time = time.time()
                        in_goal = True
                        scorer = 2
                elif ball_uv[1] > 0.95:
                    if time.time() - self.last_goal_time > self.goal_cooldown:
                        self.score_player1 += 1
                        self.last_goal_time = time.time()
                        in_goal = True
                        scorer = 1

        # 记录数据
        self.csv_writer.writerow([
            curr_time,
            ball_uv[0] if ball_uv is not None else None,
            ball_uv[1] if ball_uv is not None else None,
            ball_speed,
            ball_acc,
            ball_dir,
            paddle_uvs[0][0] if paddle_uvs[0] is not None else None,
            paddle_uvs[0][1] if paddle_uvs[0] is not None else None,
            paddle_speeds[0],
            paddle_accs[0],
            paddle_dirs[0],
            paddle_uvs[1][0] if paddle_uvs[1] is not None else None,
            paddle_uvs[1][1] if paddle_uvs[1] is not None else None,
            paddle_speeds[1],
            paddle_accs[1],
            paddle_dirs[1],
            dist_ball_paddle1,
            dist_ball_paddle2,
            dist_paddle1_paddle2,
            ball_uv[0] if ball_uv is not None else None,
            in_goal,
            scorer
        ])
        self.csv_file.flush()

        # 更新建议
        self.update_suggestions(curr_time)
        if in_goal:
            # 分析进球前三秒
            try:
                report_3s = analyze_csv(self.csv_path, window_sec=3.0)
                suggestions_3s = generate_suggestions(report_3s)
                issues_list = [s["issue"] for s in suggestions_3s]
                suggestions_list = [s["suggestion"] for s in suggestions_3s]
            except Exception as e:
                issues_list = [f"Analysis error: {str(e)}"]
                suggestions_list = [""]

            # 记录进球事件
            event_data = {
                "timestamp": curr_time,
                "scorer": scorer,
                "score_player1": self.score_player1,
                "score_player2": self.score_player2,
                "issues": issues_list,
                "suggestions": suggestions_list
            }
            self.goal_event_file.write(json.dumps(event_data, ensure_ascii=False, indent=4) + "\n")
            self.goal_event_file.flush()

            # 保存进球事件和视频片段
            self.save_goal_clip(scorer, curr_time)
        # LSTM预测
        if curr_time - self.last_pred_time > self.pred_interval:
            probs = self.predict()
            if probs is not None:
                self.pred_prob = probs
            self.last_pred_time = curr_time

        # 显示
        height, width = frame.shape[:2]
        overlay_width = 400  # 右侧扩展宽度

        
        # 新建一个更宽的白底画布
        expanded_frame = np.ones((height, width + overlay_width, 3), dtype=np.uint8) * 255
        expanded_frame[:, :width] = frame

        overlay = expanded_frame[:, width:width + overlay_width]
        # 得分显示
        cv2.putText(overlay, "=== SCORE ===", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        cv2.putText(overlay, f"Player 1: {self.score_player1}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        cv2.putText(overlay, f"Player 2: {self.score_player2}", (10, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        y = 110  # 把y往下移，避免和后面重叠
        line_height = 25
        
        # 写标题
        cv2.putText(overlay, "=== Suggestions ===", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        y += 35

        # 写建议内容
        if self.current_suggestions:
            for suggestion in self.current_suggestions[:12]:  # 最多显示12条
                cv2.putText(overlay, suggestion["issue"], (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
                y += line_height
        else:
            cv2.putText(overlay, "No issue", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
            y += line_height

        # 显示LSTM预测概率
        y += 20
        cv2.putText(overlay, "=== LSTM Prediction ===", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        y += 35

        if self.pred_prob is not None:
            cv2.putText(overlay, f"Player 1: {self.pred_prob[0]:.3f}", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
            y += line_height
            cv2.putText(overlay, f"Player 2: {self.pred_prob[1]:.3f}", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        else:
            cv2.putText(overlay, "Waiting for prediction...", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)

        cv2.imshow("Tracking", expanded_frame)
        cv2.waitKey(1)

        self.prev_time = curr_time
        return True

    def run(self):
        while True:
            if not self.process_frame():
                break

        self.cap.release()
        self.csv_file.close()
        self.goal_event_file.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    video_path = "/home/mkbk/code/nus/proj/videos/final1.mp4"  # 摄像头设备，或者改成视频路径字符串
    tracker = CameraTracker(video_path)
    tracker.run()
