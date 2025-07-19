import cv2
import numpy as np
import time
import math
import csv

class FieldDetector:
    def __init__(self, video_source):
        self.cap = cv2.VideoCapture(video_source)
        if not self.cap.isOpened():
            raise IOError("无法打开摄像头或视频源")
        self.corner_points = None

    def detect_field_once(self):
        while True:
            ret, frame = self.cap.read()
            frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
            if not ret:
                return None

            h, w = frame.shape[:2]

            # 直接手动设定角点（顺序：左上、右上、右下、左下）
            margin_side = 30
            margin_bottom = 20
            margin_top = 20

            top_left = [margin_side, margin_top]
            top_right = [h - margin_side, margin_top]
            bottom_right = [h - margin_side, w - margin_bottom]
            bottom_left = [margin_side, w - margin_bottom]

            self.corner_points = np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.int32)

            print("已手动设置四个角点：", self.corner_points)
            return frame

    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()

class CameraTracker:
    def __init__(self, video_source):
        self.detector = FieldDetector(video_source)
        frame = self.detector.detect_field_once()
        if self.detector.corner_points is None:
            raise Exception("未检测到球场角点")
        self.corners = self.detector.corner_points
        self.cap = self.detector.cap

        self.prev_ball_uv = None
        self.prev_time = None
        self.prev_ball_speed = None

        self.prev_paddle_uvs = [None, None]
        self.prev_paddle_speeds = [None, None]
        self.prev_paddle_accs = [None, None]

        self.last_goal_time = 0
        self.goal_cooldown = 2

        self.score_player1 = 0
        self.score_player2 = 0

        self.csv_file = open("5.csv", mode="w", newline="")
        self.csv_writer = csv.writer(self.csv_file)
        self.csv_writer.writerow([
            "timestamp",
            "ball_u", "ball_v", "ball_speed", "ball_angle",
            "paddle1_u", "paddle1_v", "paddle1_speed", "paddle1_angle",
            "paddle2_u", "paddle2_v", "paddle2_speed", "paddle2_angle",
            "in_goal",
            "scorer"
        ])

    def compute_normalized(self, pt):
        TL, TR, BR, BL = self.corners
        src_quad = np.array([TL, TR, BR, BL], dtype=np.float32)
        dst_quad = np.array([[0,0],[1,0],[1,1],[0,1]], dtype=np.float32)
        M = cv2.getPerspectiveTransform(src_quad, dst_quad)
        uv = cv2.perspectiveTransform(np.array([[[pt[0], pt[1]]]], dtype=np.float32), M)
        return uv[0,0]

    def process_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return False

        curr_time = time.time()
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        cv2.polylines(frame, [self.corners.reshape((-1,1,2))], isClosed=True, color=(156,85,43), thickness=3)

        # 球检测
        '''lower_ball1 = np.array([0, 70, 70])
        upper_ball1 = np.array([10, 255, 255])
        lower_ball2 = np.array([170, 70, 70])
        upper_ball2 = np.array([179, 255, 255])

        mask1 = cv2.inRange(hsv, lower_ball1, upper_ball1)
        mask2 = cv2.inRange(hsv, lower_ball2, upper_ball2)
        mask_ball = cv2.bitwise_or(mask1, mask2)'''
        # 蓝色 HSV 范围
        lower_blue = np.array([100, 150, 50])
        upper_blue = np.array([140, 255, 255])
        mask_ball = cv2.inRange(hsv, lower_blue, upper_blue)

        ball_uv = None
        ball_speed = None
        ball_acc = None
        ball_dir = None

        ball_contours, _ = cv2.findContours(mask_ball, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        ball_candidates = []
        for c in ball_contours:
            (x, y), radius = cv2.minEnclosingCircle(c)
            if radius <= 100 and radius >= 60:
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
                    if speed < 0.01:
                        dir_angle = 0
                    else:
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
        ''''lower_paddle = np.array([14,24,172])
        upper_paddle = np.array([34,255,255])
        mask_paddle = cv2.inRange(hsv, lower_paddle, upper_paddle)'''
        # 黄色 HSV 范围（典型值）
        lower_yellow = np.array([20, 100, 100])
        upper_yellow = np.array([30, 255, 255])
        mask_paddle = cv2.inRange(hsv, lower_yellow, upper_yellow)

        paddle_uvs = [None, None]
        paddle_speeds = [None, None]
        paddle_accs = [None, None]
        paddle_dirs = [None, None]

        dt = curr_time - self.prev_time if self.prev_time else 1e-5

        paddle_contours, _ = cv2.findContours(mask_paddle, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        left_half = []
        right_half = []

        for c in paddle_contours:
            (x,y), radius = cv2.minEnclosingCircle(c)
            uv = self.compute_normalized((int(x), int(y)))
            if uv[0] < 0.5:
                left_half.append((c, uv, (x,y,radius)))
            else:
                right_half.append((c, uv, (x,y,radius)))

        if left_half:
            c, uv, (x,y,radius) = max(left_half, key=lambda t: cv2.contourArea(t[0]))
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

            cv2.circle(frame, (int(x), int(y)), int(radius), (0,0,255), 2)
            cv2.putText(frame, "Paddle1", (int(x)+5, int(y)-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)

        if right_half:
            c, uv, (x,y,radius) = max(right_half, key=lambda t: cv2.contourArea(t[0]))
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

            cv2.circle(frame, (int(x), int(y)), int(radius), (0,165,255), 2)
            cv2.putText(frame, "Paddle2", (int(x)+5, int(y)-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,165,255), 2)

        self.prev_time = curr_time

        in_goal = False
        scorer = 0
        if ball_uv is not None:
            if 0.3 < ball_uv[1] < 0.7 and (ball_uv[0] < 0.05 or ball_uv[0] > 0.95) and (curr_time - self.last_goal_time > self.goal_cooldown):
                in_goal = True
                scorer = 2 if ball_uv[0] < 0.05 else 1
                if scorer == 1:
                    self.score_player1 += 1
                else:
                    self.score_player2 += 1
                self.last_goal_time = curr_time

        # 只有当所有关键数据都存在才写入csv
        must_have = [
            ball_uv is not None,
            ball_speed is not None,
            ball_dir is not None,
            paddle_uvs[0] is not None,
            paddle_speeds[0] is not None,
            paddle_dirs[0] is not None,
            paddle_uvs[1] is not None,
            paddle_speeds[1] is not None,
            paddle_dirs[1] is not None
        ]

        if all(must_have):
            self.csv_writer.writerow([
                curr_time,
                ball_uv[0],
                ball_uv[1],
                ball_speed,
                ball_dir,
                paddle_uvs[0][0],
                paddle_uvs[0][1],
                paddle_speeds[0],
                paddle_dirs[0],
                paddle_uvs[1][0],
                paddle_uvs[1][1],
                paddle_speeds[1],
                paddle_dirs[1],
                int(in_goal),
                scorer
            ])

        h,w,_ = frame.shape
        extended = np.ones((h, w+300, 3), dtype=np.uint8)*255
        extended[:, 300:] = frame
        frame = extended

        y = 20
        def put(text):
            nonlocal y
            cv2.putText(frame, text, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0,0,0), 2)
            y += 25

        put(f"Score: P1 {self.score_player1} - P2 {self.score_player2}")
        put(f"Timestamp: {curr_time:.2f}")
        if ball_uv is not None:
            put(f"Ball (u,v): ({ball_uv[0]:.2f},{ball_uv[1]:.2f})")
        if ball_speed is not None:
            put(f"Ball Speed: {ball_speed:.3f}")
        if ball_acc is not None:
            put(f"Ball Acc: {ball_acc:.3f}")
        if ball_dir is not None:
            put(f"Ball Dir: {ball_dir:.1f}")
        if paddle_uvs[0] is not None:
            put(f"Paddle1 (u,v): ({paddle_uvs[0][0]:.2f},{paddle_uvs[0][1]:.2f})")
            if paddle_speeds[0] is not None:
                put(f"Paddle1 Speed: {paddle_speeds[0]:.3f}")
            if paddle_accs[0] is not None:
                put(f"Paddle1 Acc: {paddle_accs[0]:.3f}")
            if paddle_dirs[0] is not None:
                put(f"Paddle1 Dir: {paddle_dirs[0]:.1f}")
        else:
            put(f"Paddle1 not detected")
        if paddle_uvs[1] is not None:
            put(f"Paddle2 (u,v): ({paddle_uvs[1][0]:.2f},{paddle_uvs[1][1]:.2f})")
            if paddle_speeds[1] is not None:
                put(f"Paddle2 Speed: {paddle_speeds[1]:.3f}")
            if paddle_accs[1] is not None:
                put(f"Paddle2 Acc: {paddle_accs[1]:.3f}")
            if paddle_dirs[1] is not None:
                put(f"Paddle2 Dir: {paddle_dirs[1]:.1f}")
        else:
            put(f"Paddle2 not detected")

        if in_goal:
            put("GOAL!")
        scale = 0.5  # 根据需要设置缩放因子
        frame = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
        cv2.imshow("Tracking", frame)
        cv2.waitKey(1)
        return True

    def release(self):
        self.cap.release()
        self.csv_file.close()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    video_path = "C:\\Users\\cxlou\\Desktop\\5.mp4"
    tracker = CameraTracker(video_path)
    try:
        while True:
            if not tracker.process_frame():
                break
    finally:
        tracker.release()
