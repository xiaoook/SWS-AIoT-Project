import paho.mqtt.client as mqtt

import cv2
import numpy as np
import time
import math
import csv
import mediapipe as mp
import random

MQTT_BROKER_URL = "127.0.0.1"
MQTT_BROKER_PORT = 45679

client = mqtt.Client()
client.connect(MQTT_BROKER_URL, MQTT_BROKER_PORT, 60)

class FieldDetector:
    def __init__(self, video_source):
        self.cap = cv2.VideoCapture(video_source)
        self.cap.set(cv2.CAP_PROP_FPS, 60)
        print("实际帧率：", self.cap.get(cv2.CAP_PROP_FPS))

        if not self.cap.isOpened():
            raise IOError("无法打开摄像头或视频源")
        self.corner_points = None

    def detect_field(self):
        ret, frame = self.cap.read()
        if not ret:
            return None

        h, w, _ = frame.shape  # 获取图像尺寸

        # 顶部：居中、缩短
        shrink_top_ratio = 0.65  # 顶部宽度为画面宽度的 80%
        top_width = int(w * shrink_top_ratio)
        top_left_x = (w - top_width) // 2
        top_right_x = top_left_x + top_width
        top_y = int(h * 0.27)  # 顶部稍微向下

        # 底部：贴边
        bottom_y = h - 15
        bottom_left_x = 50
        bottom_right_x = w - 50

        # 四个角点：顺时针
        top_left = [top_left_x, top_y]
        top_right = [top_right_x, top_y]
        bottom_right = [bottom_right_x, bottom_y]
        bottom_left = [bottom_left_x, bottom_y]

        self.corner_points = np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.int32)
        print("✅ 使用固定角点（顶部缩短，底部贴边）")

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

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    # 先闭操作填充物体间隙
    mask_red = cv2.morphologyEx(mask_red, cv2.MORPH_CLOSE, kernel, iterations=2)
    # 再开操作去噪
    mask_red = cv2.morphologyEx(mask_red, cv2.MORPH_OPEN, kernel, iterations=1)

    # 去掉高斯模糊或减小内核尺寸
    # blurred = cv2.GaussianBlur(mask_red, (3, 3), 0)
    # contours, _ = cv2.findContours(blurred, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    contours, _ = cv2.findContours(mask_red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

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
        if circularity < 0.4:
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
    if speed< 0.01:
        angle = 0.0
    else:
        angle = math.degrees(math.atan2(dy, dx))
    return speed, angle

class CameraTracker:
    def __init__(self, video_source):
        self.detector = FieldDetector(video_source)
        frame = self.detector.detect_field()
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

        # 更精准的“纯红”色区间，避免误检棕色/粉色/暗红
        self.ball_lower_red1 = np.array([165, 110, 110])   # H 165~180，S≥70，V≥70
        self.ball_upper_red1 = np.array([180, 255, 255])

        self.ball_lower_red2 = np.array([0, 120, 120])     # H 0~10，S≥70，V≥70
        self.ball_upper_red2 = np.array([8, 255, 255])



        self.paddle_lower_red1 = np.array([160, 100, 100])
        self.paddle_upper_red1 = np.array([180, 255, 255])
        self.paddle_lower_red2 = np.array([0, 100, 100])
        self.paddle_upper_red2 = np.array([10, 255, 255])

        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.hands = self.mp_hands.Hands(static_image_mode=False,
                                        max_num_hands=4,
                                        min_detection_confidence=0.06,
                                        min_tracking_confidence=0.06,
                                        model_complexity=0)
        self.wrist_history = [[], []]  # 两只手腕位置历史（像素）
        self.max_history_len = 15  # 取最近15帧（大概0.5秒）
        self.ball_radius_fixed = 18
        self.paddle_radii_fixed = [25, 25]
        self.in_goal = 0
        self.scorer = 0
        self.round_id = 1
        self.game_id = 1
        self.last_corner_update_time = 0  # 上次更新角点的时间
        self.prev_ball_center_px = [0,0]  # 添加在 __init__ 里
        
    def validate_displacement(self, prev_uv, new_uv, max_disp=0.9):
        if prev_uv is None or new_uv is None:
            return True
        du = new_uv[0] - prev_uv[0]
        dv = new_uv[1] - prev_uv[1]
        dist = math.sqrt(du * du + dv * dv)
        return dist < max_disp

    def smooth_uv(self, history, new_uv, max_len=15):
        if new_uv is not None:
            history.append(new_uv)
            if len(history) > max_len:
                history.pop(0)
            avg_u = sum(pt[0] for pt in history) / len(history)
            avg_v = sum(pt[1] for pt in history) / len(history)
            return (avg_u, avg_v)
        return None
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
        ball_center_px = self.prev_ball_center_px  # 初始化ball_center_px
        ball_uv = self.prev_ball_uv  # 初始化ball_uv
  
        # 每1秒尝试更新一次场地角点
        '''if curr_time - self.last_corner_update_time > 1.0:
            self.detector.detect_field()  # 提供当前帧进行检测
            new_corners = self.detector.corner_points
            if new_corners is not None:
                new_area = cv2.contourArea(new_corners.astype(np.float32))
                old_area = cv2.contourArea(self.corners.astype(np.float32)) if self.corners is not None else new_area
                area_ratio = abs(new_area - old_area) / (old_area + 1e-5)

                if area_ratio < 0.02:  # 允许最多30%的面积变化
                    self.corners = new_corners
                    self.last_corner_update_time = curr_time
'''
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
        paddle_detected_by_hand = [False, False]
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
                if valid_points_count < 1:
                    continue

                # 画手部连接线
                self.mp_drawing.draw_landmarks(
                    frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=2),
                    self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2)
                )

                # 获取手腕位置 landmark 0
                wrist_lm = hand_landmarks.landmark[0]
                wrist_u = self.compute_normalized((int(wrist_lm.x * w), int(wrist_lm.y * h)))[0]

                if wrist_u < 0.5:
                    # 左半区：使用中指前两关节 landmark 11 和 12 的中点
                    paddle_detected_by_hand[0] = True  # 左半场
                    lm11 = hand_landmarks.landmark[8]
                    lm12 = hand_landmarks.landmark[4]
                    lm13 = hand_landmarks.landmark[12]
                    x_m = int(((lm11.x + lm12.x+ lm13.x) / 3) * w)
                    y_m = int(((lm11.y + lm12.y+ lm13.y) / 3) * h)
                    uv_m = self.compute_normalized((x_m, y_m))
                    if paddle_uvs[0] is None:
                        if self.validate_displacement(self.prev_paddle_uvs[0], uv_m):
                            paddle_uvs[0] = uv_m
                            paddle_centers_px[0] = (x_m, y_m)
                        else:
                            paddle_uvs[0] = self.prev_paddle_uvs[0]
                            paddle_centers_px[0] =  paddle_centers_px[0]   # 或保留上一帧像素位置（取决于你是否要画）
                        paddle_centers_px[0] = (x_m, y_m)

                else:
                    paddle_detected_by_hand[1] = True  # 右半场
                    # 右半区：使用食指尖 (8) 和拇指尖 (4) 中点
                    lm1 = hand_landmarks.landmark[8]
                    lm2 = hand_landmarks.landmark[4]
                    lm3 = hand_landmarks.landmark[12]
                    x_avg = int((lm1.x + lm2.x+ lm3.x) / 3 * w)
                    y_avg = int((lm1.y + lm2.y+ lm3.y) / 3 * h)
                    uv_avg = self.compute_normalized((x_avg, y_avg))
                    if paddle_uvs[1] is None:
                        if self.validate_displacement(self.prev_paddle_uvs[1], uv_avg):
                            paddle_uvs[1] = uv_avg
                            paddle_centers_px[1] = (x_avg, y_avg)
                        else:
                            paddle_uvs[1] = self.prev_paddle_uvs[1]
                            paddle_centers_px[1] =  paddle_centers_px[1]   # 或保留上一帧像素位置（取决于你是否要画）
                        paddle_centers_px[1] = (x_avg, y_avg)

        for idx, (area, (x, y), radius, contour) in enumerate(red_objects):
            if idx in used_indices:
                continue  # 已被用作球，不重复用
            if radius > 40:
                continue
            uv = self.compute_normalized((x, y))
            if 0 <= uv[0] <= 1 and 0 <= uv[1] <= 1:
                if uv[0] < 0.5 and not paddle_detected_by_hand[0]:  # 左半场
                    paddle_uvs[0] = self.smooth_uv(self.wrist_history[0], uv, self.max_history_len)
                    paddle_centers_px[0] = (x, y)
                    used_indices.add(idx)
                    paddle_detected_by_hand[0] = True
                elif uv[0] >= 0.5 and not paddle_detected_by_hand[1]:  # 右半场
                    paddle_uvs[1] = self.smooth_uv(self.wrist_history[1], uv, self.max_history_len)
                    paddle_centers_px[1] = (x, y)
                    used_indices.add(idx)
                    paddle_detected_by_hand[1] = True
        MIN_DIST_TO_PADDLE = 20  # 球与拍子的最小距离阈值，防止球被误判为拍子附近物体

        # 球的检测：半径不能超过固定球半径
        
        if paddle_uvs[0] is not None and paddle_uvs[1] is not None:
            for idx, (area, (x, y), radius, contour) in enumerate(red_objects):
                if radius > 30:
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
                if paddle_uvs[0] is None:
                    paddle_uvs[0] = self.prev_paddle_uvs[0]
                    paddle_centers_px[0] = None  # 无像素坐标时保持None或上次坐标自己保存
                if paddle_uvs[1] is None:
                    paddle_uvs[1] = self.prev_paddle_uvs[1]
                    paddle_centers_px[1] = None
                candidate_ball_uv = self.compute_normalized((x, y))
                if self.validate_displacement(self.prev_ball_uv, candidate_ball_uv) or (0.03<ball_uv[0]<0.97 and 0.03<ball_uv[1]<0.97):
                    ball_uv = candidate_ball_uv
                    ball_center_px = (x, y)  # ✅ 使用当前帧的像素位置

                else:
                    ball_uv = self.prev_ball_uv
                    ball_center_px = self.prev_ball_center_px  # ✅ 保留上一帧像素位置
                   
                # 画球，半径固定
                (x,y) = ball_center_px
                cv2.circle(frame, (int(x), int(y)), int(self.ball_radius_fixed), (255, 0, 0), 2)
                used_indices.add(idx)
                break
              
        # 画拍子，使用固定半径
        for i in [0, 1]:
            if paddle_centers_px[i] is not None and None not in paddle_centers_px[i]:
                color = (0, 0, 255) if i == 0 else (0, 165, 255)
                center = (int(paddle_centers_px[i][0]), int(paddle_centers_px[i][1]))
                radius = int(self.paddle_radii_fixed[i])
                cv2.circle(frame, center, radius, color, 2)
                cv2.putText(frame, f"Paddle{i+1}", (center[0] + 5, center[1] - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # 速度和角度计算
        dt = curr_time - self.prev_time if self.prev_time else 0.033
        ball_speed, ball_angle = compute_speed_and_angle(self.prev_ball_uv, ball_uv, dt)
        paddle1_speed, paddle1_angle = compute_speed_and_angle(self.prev_paddle_uvs[0], paddle_uvs[0], dt)
        paddle2_speed, paddle2_angle = compute_speed_and_angle(self.prev_paddle_uvs[1], paddle_uvs[1], dt)
        self.prev_time = curr_time
        self.prev_ball_uv = ball_uv
        self.prev_ball_center_px = ball_center_px
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
        put(f"Ball speed: {ball_speed:.3f}")
        put(f"Ball angle: {ball_angle:.1f}")
        for i in [0, 1]:
            if paddle_uvs[i] is not None:
                speed = paddle1_speed if i == 0 else paddle2_speed
                angle = paddle1_angle if i == 0 else paddle2_angle
                put(f"Paddle{i+1} speed: {speed:.3f}")
                put(f"Paddle{i+1} angle: {angle:.1f}")

        for i in [0, 1]:
            if paddle_uvs[i] is not None:
                put(f"Paddle{i+1} (u,v): ({paddle_uvs[i][0]:.2f},{paddle_uvs[i][1]:.2f})")
        if self.in_goal:
            put("GOAL!")
        put(f"Round: {self.round_id} / Game: {self.game_id}")
        put(f"Scorer (sim): {self.scorer} / Goal: {self.in_goal}")
        # 缩放比例，例如放大 2 倍
        scale = 1.3

        # 获取原始尺寸
        h, w = frame.shape[:2]

        # 调整尺寸
        frame_resized = cv2.resize(frame, (int(w * scale), int(h * scale)))

        # 显示放大后的图像
        cv2.imshow("Tracking", frame_resized)
        cv2.waitKey(30)
        ball_u, ball_v = (ball_uv[0], ball_uv[1]) if ball_uv is not None else estimate_position(self.prev_ball_uv, ball_speed, ball_angle, dt)
        p1_u, p1_v = (paddle_uvs[0][0], paddle_uvs[0][1]) if paddle_uvs[0] is not None else estimate_position(self.prev_paddle_uvs[0], paddle1_speed, paddle1_angle, dt)
        p2_u, p2_v = (paddle_uvs[1][0], paddle_uvs[1][1]) if paddle_uvs[1] is not None else estimate_position(self.prev_paddle_uvs[1], paddle2_speed, paddle2_angle, dt)


        self.latest_data = {
            "timestamp": float(curr_time),
            "ball": {
                "u": float(ball_u) if ball_u is not None else None,
                "v": float(ball_v) if ball_v is not None else None,
                "speed": float(ball_speed),
                "angle": float(ball_angle)
            },
            "paddle1": {
                "u": float(p1_u) if p1_u is not None else None,
                "v": float(p1_v) if p1_v is not None else None,
                "speed": float(paddle1_speed),
                "angle": float(paddle1_angle)
            },
            "paddle2": {
                "u": float(p2_u) if p2_u is not None else None,
                "v": float(p2_v) if p2_v is not None else None,
                "speed": float(paddle2_speed),
                "angle": float(paddle2_angle)
            }
        }



        return True

    def release(self):
        self.cap.release()
        self.csv_file.close()
        cv2.destroyAllWindows()

def main():
    video_source = "/home/mkbk/code/nus/proj/SWS-AIoT-Project/ai/f2.mp4"# 或者替换为视频路径，例如 "sample.mp4"
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
