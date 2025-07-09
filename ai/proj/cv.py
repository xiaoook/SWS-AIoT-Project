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
            if not ret:
                return None

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            lower_gray = 210 - 10
            upper_gray = 230 + 10
            mask = cv2.inRange(gray, lower_gray, upper_gray)
            kernel = np.ones((5,5), np.uint8)
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
        self.goal_cooldown = 0.5

        self.score_player1 = 0
        self.score_player2 = 0

        self.csv_file = open("tracking_data.csv", mode="w", newline="")
        self.csv_writer = csv.writer(self.csv_file)
        self.csv_writer.writerow([
            "timestamp",
            "ball_u","ball_v","ball_speed","ball_acc","ball_dir",
            "paddle1_u","paddle1_v","paddle1_speed","paddle1_acc","paddle1_dir",
            "paddle2_u","paddle2_v","paddle2_speed","paddle2_acc","paddle2_dir",
            "dist_ball_paddle1","dist_ball_paddle2",
            "dist_paddle1_paddle2",
            "dist_ball_goal",
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

        # 球检测（结合颜色、边缘、RGB阈值）
        # 先用HSV筛选颜色范围
        lower_ball_hsv = np.array([160, 100, 100])
        upper_ball_hsv = np.array([180, 255, 255])
        mask_color = cv2.inRange(hsv, lower_ball_hsv, upper_ball_hsv)

        # 在mask上做高斯模糊+边缘检测
        blurred = cv2.GaussianBlur(mask_color, (5, 5), 0)
        edges = cv2.Canny(blurred, threshold1=50, threshold2=150)

        ball_uv = None
        ball_speed = None
        ball_acc = None
        ball_dir = None

        ball_contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        ball_candidates = []
        for c in ball_contours:
            area = cv2.contourArea(c)
            if area < 50:
                continue
            (x, y), radius = cv2.minEnclosingCircle(c)
            if radius < 5 or radius > 50:
                continue

            # 检查中心RGB是否接近 #c7010d
            b, g, r = frame[int(y), int(x)]
            # 方式1: RGB阈值
            if not (r >= 150 and g <= 30 and b <= 50):
                continue
            # 方式2: RGB色差
            target_rgb = np.array([199,1,13])
            pixel_rgb = np.array([r,g,b])
            color_distance = np.linalg.norm(pixel_rgb - target_rgb)
            if color_distance > 80:
                continue

            uv = self.compute_normalized((int(x), int(y)))
            ball_candidates.append((c, uv, (x, y, radius)))

        if ball_candidates:
            c, uv, (x, y, radius) = max(ball_candidates, key=lambda t: cv2.contourArea(t[0]))
            ball_uv = uv
            cv2.circle(frame, (int(x), int(y)), int(radius), (255,0,0), 2)

            if self.prev_ball_uv is not None and self.prev_time is not None:
                dt = curr_time - self.prev_time
                dxdy = ball_uv - self.prev_ball_uv
                dist = np.linalg.norm(dxdy)
                if dt > 0:
                    ball_speed = dist / dt
                    if self.prev_ball_speed is not None:
                        ball_acc = (ball_speed - self.prev_ball_speed) / dt
                    ball_dir = math.degrees(math.atan2(dxdy[1], dxdy[0]))
            self.prev_ball_uv = ball_uv
            self.prev_ball_speed = ball_speed

        # Paddle检测
        lower_paddle = np.array([14,24,172])
        upper_paddle = np.array([34,255,255])
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
            (x,y), radius = cv2.minEnclosingCircle(c)
            uv = self.compute_normalized((int(x), int(y)))
            if uv[1] < 0.5:
                upper_half.append((c, uv, (x,y,radius)))
            else:
                lower_half.append((c, uv, (x,y,radius)))

        if upper_half:
            c, uv, (x,y,radius) = max(upper_half, key=lambda t: cv2.contourArea(t[0]))
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

        if lower_half:
            c, uv, (x,y,radius) = max(lower_half, key=lambda t: cv2.contourArea(t[0]))
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

        dist_ball_p1 = np.linalg.norm(ball_uv - paddle_uvs[0]) if ball_uv is not None and paddle_uvs[0] is not None else None
        dist_ball_p2 = np.linalg.norm(ball_uv - paddle_uvs[1]) if ball_uv is not None and paddle_uvs[1] is not None else None

        dist_paddle_paddle = np.linalg.norm(paddle_uvs[0] - paddle_uvs[1]) if paddle_uvs[0] is not None and paddle_uvs[1] is not None else None
        dist_ball_goal = min(abs(ball_uv[1] - 0.0), abs(ball_uv[1] - 1.0)) if ball_uv is not None else None

        in_goal = False
        scorer = 0
        if ball_uv is not None:
            if 0.3 < ball_uv[0] < 0.7 and (ball_uv[1] < 0.05 or ball_uv[1] > 0.95) and (curr_time - self.last_goal_time > self.goal_cooldown):
                in_goal = True
                scorer = 2 if ball_uv[1] < 0.05 else 1
                if scorer == 1:
                    self.score_player1 += 1
                else:
                    self.score_player2 += 1
                self.last_goal_time = curr_time

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
            dist_ball_p1,
            dist_ball_p2,
            dist_paddle_paddle,
            dist_ball_goal,
            int(in_goal),
            scorer
        ])

        h,w,_ = frame.shape
        extended = np.ones((h, w+200, 3), dtype=np.uint8)*255
        extended[:, 200:] = frame
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
        if dist_ball_goal is not None:
            put(f"Dist Ball-Goal: {dist_ball_goal:.3f}")
        if dist_ball_p1 is not None:
            put(f"Dist Ball-P1: {dist_ball_p1:.3f}")
        if dist_ball_p2 is not None:
            put(f"Dist Ball-P2: {dist_ball_p2:.3f}")
        if dist_paddle_paddle is not None:
            put(f"Dist Paddle1-Paddle2: {dist_paddle_paddle:.3f}")

        for idx in [0,1]:
            if paddle_uvs[idx] is not None:
                put(f"Paddle{idx+1} (u,v): ({paddle_uvs[idx][0]:.2f},{paddle_uvs[idx][1]:.2f})")
                if paddle_speeds[idx] is not None:
                    put(f"Paddle{idx+1} Speed: {paddle_speeds[idx]:.3f}")
                if paddle_accs[idx] is not None:
                    put(f"Paddle{idx+1} Acc: {paddle_accs[idx]:.3f}")
                if paddle_dirs[idx] is not None:
                    put(f"Paddle{idx+1} Dir: {paddle_dirs[idx]:.1f}")
            else:
                put(f"Paddle{idx+1} not detected")

        if in_goal:
            put("GOAL!")

        cv2.imshow("Tracking", frame)
        cv2.waitKey(1)
        return True

    def release(self):
        self.cap.release()
        self.csv_file.close()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    video_path = "/home/mkbk/code/nus/proj/videos/final1.mp4"
    tracker = CameraTracker(video_path)
    try:
        while True:
            if not tracker.process_frame():
                break
    finally:
        tracker.release()
