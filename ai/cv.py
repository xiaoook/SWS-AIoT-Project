import cv2
import numpy as np
import time
import math
import csv
import mediapipe as mp
import random

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

            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            lower_hsv = np.array([0, 0, 170])
            upper_hsv = np.array([180, 30, 255])
            mask = cv2.inRange(hsv, lower_hsv, upper_hsv)

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
            top_k = 50  # 7%或至少20个点

            def select_corner(points, key_func, top_k, x_extreme, y_extreme, largest=False):
                keys = key_func(points)
                if largest:
                    idx = np.argsort(keys)[-top_k:]  # 取 keys 最大的top_k个点
                else:
                    idx = np.argsort(keys)[:top_k]   # 取 keys 最小的top_k个点
                selected = points[idx]
                x_val = selected[:, 0].min() if x_extreme == 'min' else selected[:, 0].max()
                y_val = selected[:, 1].min() if y_extreme == 'min' else selected[:, 1].max()
                return np.array([x_val, y_val])

            top_left = select_corner(all_points, lambda pts: pts[:, 0] + pts[:, 1], top_k, 'min', 'min', largest=False)
            bottom_right = select_corner(all_points, lambda pts: pts[:, 0] + pts[:, 1], top_k, 'max', 'max', largest=True)
            top_right = select_corner(all_points, lambda pts: pts[:, 0] - pts[:, 1], top_k, 'min', 'max', largest=False)
            bottom_left = select_corner(all_points, lambda pts: pts[:, 0] - pts[:, 1], top_k, 'max', 'min', largest=True)


            self.corner_points = np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.int32)
            print("检测到四个角点")
            return frame

    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()
def estimate_position(prev_uv, speed, angle_deg, dt):
    if prev_uv is None or speed is None or angle_deg is None:
        return None, None
    angle_rad = math.radians(angle_deg)
    du = speed * math.cos(angle_rad) * dt
    dv = speed * math.sin(angle_rad) * dt
    return prev_uv[0] + du, prev_uv[1] + dv
def extract_red_objects(frame, hsv, lower_red1, upper_red1, lower_red2, upper_red2):
    mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask_red = cv2.bitwise_or(mask_red1, mask_red2)

    blurred = cv2.GaussianBlur(mask_red, (5, 5), 0)
    contours, _ = cv2.findContours(blurred, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    red_objects = []
    for c in contours:
        (x, y), radius = cv2.minEnclosingCircle(c)
        contour_area = cv2.contourArea(c)
        circle_area = math.pi * radius * radius

        if contour_area < 150:
            continue
        if radius < 10 or radius > 100:
            continue
        if circle_area <= 0:
            continue
        circularity = contour_area / circle_area
        if circularity < 0.5:
            continue

        b, g, r = frame[int(y), int(x)]
        if r < 80 or r < g or r < b:
            continue

        red_objects.append((contour_area, (x, y), radius, c))

    return red_objects
def compute_speed_and_angle(prev_uv, curr_uv, dt):
    if prev_uv is None or curr_uv is None or dt == 0:
        return 0.0, 0.0
    dx = curr_uv[0] - prev_uv[0]
    dy = curr_uv[1] - prev_uv[1]
    speed = math.sqrt(dx**2 + dy**2) / dt
    angle = math.degrees(math.atan2(dy, dx))
    return speed, angle

class CameraTracker:
    def __init__(self, video_source):
        self.detector = FieldDetector(video_source)
        frame = self.detector.detect_field_once()
        if self.detector.corner_points is None:
            raise Exception("未检测到球场角点")
        self.corners = self.detector.corner_points
        self.cap = self.detector.cap

        self.prev_ball_uv = None
        self.prev_paddle_uvs = [None, None]

        self.ball_radius_fixed = None
        self.paddle_radii_fixed = [None, None]

        self.prev_time = None
        self.last_goal_time = 0
        self.goal_cooldown = 2

        self.score_player1 = 0
        self.score_player2 = 0

        self.csv_file = open("tracking_data.csv", mode="w", newline="")
        self.csv_writer = csv.writer(self.csv_file)
        self.game_id = 1
        self.round_id = 1
        self.last_goal_time = time.time()
        self.last_round_time = time.time()
        self.last_game_time = time.time()
        self.latest_data = None

        self.csv_writer.writerow([
            "timestamp",
            "ball_u", "ball_v", "ball_speed", "ball_angle",
            "paddle1_u", "paddle1_v", "paddle1_speed", "paddle1_angle",
            "paddle2_u", "paddle2_v", "paddle2_speed", "paddle2_angle",
            "in_goal", "scorer", "round_id", "game_id"
        ])

        self.ball_lower_red1 = np.array([160, 150, 150])
        self.ball_upper_red1 = np.array([180, 255, 255])
        self.ball_lower_red2 = np.array([0, 150, 150])
        self.ball_upper_red2 = np.array([10, 255, 255])

        self.paddle_lower_red1 = np.array([160, 100, 100])
        self.paddle_upper_red1 = np.array([180, 255, 255])
        self.paddle_lower_red2 = np.array([0, 100, 100])
        self.paddle_upper_red2 = np.array([10, 255, 255])

        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.hands = self.mp_hands.Hands(static_image_mode=False,
                                        max_num_hands=4,
                                        min_detection_confidence=0.1,
                                        min_tracking_confidence=0.1)
        self.wrist_history = [[], []]  # 两只手腕位置历史（像素）
        self.max_history_len = 15  # 取最近15帧（大概0.5秒）
        self.ball_radius_fixed = 40
        self.paddle_radii_fixed = [45, 45]
        self.in_goal = 0
        self.scorer = 0
        self.round_id = 1
        self.game_id = 1


    def compute_normalized(self, pt):
        TL, TR, BR, BL = self.corners
        src_quad = np.array([TL, TR, BR, BL], dtype=np.float32)
        dst_quad = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float32)
        M = cv2.getPerspectiveTransform(src_quad, dst_quad)
        uv = cv2.perspectiveTransform(np.array([[[pt[0], pt[1]]]], dtype=np.float32), M)
        return uv[0, 0]
    
    def update_game_state(self, in_goal=None, scorer=None, round_id=None, game_id=None):
        if in_goal is not None:
            self.in_goal = int(in_goal)
        if scorer is not None:
            self.scorer = scorer
        if round_id is not None:
            self.round_id = round_id
        if game_id is not None:
            self.game_id = game_id


    def process_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return False

        curr_time = time.time()
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        cv2.polylines(frame, [self.corners.reshape((-1, 1, 2))], isClosed=True, color=(156, 85, 43), thickness=3)

        red_objects = extract_red_objects(
            frame, hsv,
            self.ball_lower_red1, self.ball_upper_red1,
            self.ball_lower_red2, self.ball_upper_red2
        )
        red_objects = sorted(red_objects, key=lambda x: -x[0])  # 按面积降序
        used_indices = set()

        h, w, _ = frame.shape

        # 手部检测及有效性判断
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self.hands.process(rgb_frame)

        paddle_uvs = [None, None]
        paddle_centers_px = [None, None]

        if result.multi_hand_landmarks:
            for hand_landmarks in result.multi_hand_landmarks:
                # 判断手有效点数量
                valid_points_count = 0
                for lm in hand_landmarks.landmark:
                    x_px = int(lm.x * w)
                    y_px = int(lm.y * h)
                    uv = self.compute_normalized((x_px, y_px))
                    if 0 <= uv[0] <= 1 and 0 <= uv[1] <= 1:
                        valid_points_count += 1
                        if valid_points_count >= 5:
                            break
                if valid_points_count < 3:
                    continue

                # 画手部连接线
                self.mp_drawing.draw_landmarks(
                    frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=2),
                    self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2)
                )

                # 取食指中间关节坐标 landmark 8
                lm = hand_landmarks.landmark[8]
                x_f = int(lm.x * w)
                y_f = int(lm.y * h)
                uv_f = self.compute_normalized((x_f, y_f))

                # 按u坐标划分左右半场，分别赋值给paddle1和paddle2
                if uv_f[1] < 0.5:
                    if paddle_uvs[0] is None:
                        paddle_uvs[0] = uv_f
                        paddle_centers_px[0] = (x_f, y_f)
                else:
                    if paddle_uvs[1] is None:
                        paddle_uvs[1] = uv_f
                        paddle_centers_px[1] = (x_f, y_f)

        MIN_DIST_TO_PADDLE = 40  # 球与拍子的最小距离阈值，防止球被误判为拍子附近物体

        # 球的检测：半径不能超过固定球半径
        ball_uv = None
        for idx, (area, (x, y), radius, contour) in enumerate(red_objects):
            if radius > self.ball_radius_fixed:
                continue  # 排除半径过大的物体

            # 球不能靠近拍子
            too_close = False
            for paddle_center in paddle_centers_px:
                if paddle_center is not None:
                    dist_to_paddle = math.hypot(x - paddle_center[0], y - paddle_center[1])
                    if dist_to_paddle < MIN_DIST_TO_PADDLE:
                        too_close = True
                        break
            if too_close:
                continue
            if ball_uv is None:
                ball_uv = self.prev_ball_uv
            if paddle_uvs[0] is None:
                paddle_uvs[0] = self.prev_paddle_uvs[0]
                paddle_centers_px[0] = None  # 无像素坐标时保持None或上次坐标自己保存
            if paddle_uvs[1] is None:
                paddle_uvs[1] = self.prev_paddle_uvs[1]
                paddle_centers_px[1] = None
            ball_uv = self.compute_normalized((x, y))
            # 画球，半径固定
            cv2.circle(frame, (int(x), int(y)), int(self.ball_radius_fixed), (255, 0, 0), 2)
            used_indices.add(idx)
            break

        # 画拍子，使用固定半径
        for i in [0, 1]:
            if paddle_centers_px[i] is not None:
                color = (0, 0, 255) if i == 0 else (0, 165, 255)
                cv2.circle(frame, paddle_centers_px[i], int(self.paddle_radii_fixed[i]), color, 2)
                cv2.putText(frame, f"Paddle{i+1}", (paddle_centers_px[i][0] + 5, paddle_centers_px[i][1] - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # 速度和角度计算
        dt = curr_time - self.prev_time if self.prev_time else 0.033
        ball_speed, ball_angle = compute_speed_and_angle(self.prev_ball_uv, ball_uv, dt)
        paddle1_speed, paddle1_angle = compute_speed_and_angle(self.prev_paddle_uvs[0], paddle_uvs[0], dt)
        paddle2_speed, paddle2_angle = compute_speed_and_angle(self.prev_paddle_uvs[1], paddle_uvs[1], dt)
        self.prev_time = curr_time
        self.prev_ball_uv = ball_uv
        self.prev_paddle_uvs = paddle_uvs

        # 判定进球
        #in_goal = False
        #scorer = 0
        #if ball_uv is not None and 0.4 < ball_uv[0] < 0.6 and (ball_uv[1] < 0.03 or ball_uv[1] > 0.97) and (curr_time - self.last_goal_time > self.goal_cooldown):
        #    in_goal = True
        #    scorer = 2 if ball_uv[1] < 0.03 else 1
        #    if scorer == 1:
        #        self.score_player1 += 1
        #    else:
        #        self.score_player2 += 1
        #    self.last_goal_time = curr_time
        # 模拟进球信号（每5秒进1球）



        # 写入CSV
        row_data = [
            curr_time,
            ball_uv[0] if ball_uv is not None else None,
            ball_uv[1] if ball_uv is not None else None,
            ball_speed,
            ball_angle,
            paddle_uvs[0][0] if paddle_uvs[0] is not None else None,
            paddle_uvs[0][1] if paddle_uvs[0] is not None else None,
            paddle1_speed,
            paddle1_angle,
            paddle_uvs[1][0] if paddle_uvs[1] is not None else None,
            paddle_uvs[1][1] if paddle_uvs[1] is not None else None,
            paddle2_speed,
            paddle2_angle,
            int(self.in_goal),
            self.scorer,
            self.round_id,
            self.game_id
        ]

        # 只有全部字段非 None 时才写入
        if all(val is not None for val in row_data):
            self.csv_writer.writerow(row_data)


        # 扩展画布，画分数信息
        extended = np.ones((h, w + 250, 3), dtype=np.uint8) * 255
        extended[:, 250:] = frame
        frame = extended

        y = 20

        def put(text):
            nonlocal y
            cv2.putText(frame, text, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
            y += 25

        put(f"Timestamp: {curr_time:.2f}")
        if ball_uv is not None:
            put(f"Ball (u,v): ({ball_uv[0]:.2f},{ball_uv[1]:.2f})")
        put(f"Ball speed: {ball_speed:.3f} / angle: {ball_angle:.1f}")
        for i in [0, 1]:
            if paddle_uvs[i] is not None:
                speed = paddle1_speed if i == 0 else paddle2_speed
                angle = paddle1_angle if i == 0 else paddle2_angle
                put(f"Paddle{i+1} speed: {speed:.3f} / angle: {angle:.1f}")

        for i in [0, 1]:
            if paddle_uvs[i] is not None:
                put(f"Paddle{i+1} (u,v): ({paddle_uvs[i][0]:.2f},{paddle_uvs[i][1]:.2f}) Radius: {self.paddle_radii_fixed[i]:.1f}")
        if self.in_goal:
            put("GOAL!")
        put(f"Round: {self.round_id} / Game: {self.game_id}")
        put(f"Scorer (sim): {self.scorer} / Goal: {self.in_goal}")
        cv2.imshow("Tracking", frame)
        cv2.waitKey(1)
        ball_u, ball_v = (ball_uv[0], ball_uv[1]) if ball_uv is not None else estimate_position(self.prev_ball_uv, ball_speed, ball_angle, dt)
        p1_u, p1_v = (paddle_uvs[0][0], paddle_uvs[0][1]) if paddle_uvs[0] is not None else estimate_position(self.prev_paddle_uvs[0], paddle1_speed, paddle1_angle, dt)
        p2_u, p2_v = (paddle_uvs[1][0], paddle_uvs[1][1]) if paddle_uvs[1] is not None else estimate_position(self.prev_paddle_uvs[1], paddle2_speed, paddle2_angle, dt)


        self.latest_data = {
            "timestamp": float(curr_time),
            "ball": {
                "u": float(ball_u) if ball_u is not None else None,
                "v": float(ball_v) if ball_v is not None else None
            },
            "paddle1": {
                "u": float(p1_u) if p1_u is not None else None,
                "v": float(p1_v) if p1_v is not None else None
            },
            "paddle2": {
                "u": float(p2_u) if p2_u is not None else None,
                "v": float(p2_v) if p2_v is not None else None
            }
        }


        return True

    def release(self):
        self.cap.release()
        self.csv_file.close()
        cv2.destroyAllWindows()

def main():
    video_source = "rtsp://172.22.116.251:8554/stream_in"# 或者替换为视频路径，例如 "sample.mp4"
    tracker = CameraTracker(video_source)

    try:
        while True:
            # 模拟传入游戏状态参数
            curr_time = time.time()
            if curr_time - tracker.last_goal_time > 5:
                in_goal = True
                scorer = 1 if int(curr_time) % 2 == 0 else 2
                tracker.round_id += 1
                if tracker.round_id > 5:
                    tracker.round_id = 1
                    tracker.game_id += 1
                tracker.last_goal_time = curr_time
            else:
                in_goal = False
                scorer = 0

            # 传入参数
            tracker.update_game_state(
                in_goal=in_goal,
                scorer=scorer,
                round_id=tracker.round_id,
                game_id=tracker.game_id
            )

            # 处理当前帧
            if not tracker.process_frame():
                break

    except KeyboardInterrupt:
        print("退出程序")
    finally:
        tracker.release()

if __name__ == "__main__":
    main()
