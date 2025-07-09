import cv2
import numpy as np
import time
import math
import csv
import pandas as pd

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

    # 速度阈值由0.02调高到0.05
    if report["avg_p1_speed"] < 0.05:
        suggestions.append("Paddle1 movement too low; increase dynamic movement to apply pressure and unpredictability.")
    if report["avg_p2_speed"] < 0.05:
        suggestions.append("Paddle2 movement too low; consider more active positioning and aggressive strikes.")

    # 速度标准差由0.1调高到0.15
    if report["std_p1_speed"] > 5:
        suggestions.append("Paddle1 speed variability high; try to maintain smoother movements for better control.")
    if report["std_p2_speed"] > 5:
        suggestions.append("Paddle2 speed variability high; smooth out motion to reduce unnecessary energy loss.")

    # 加速度阈值由0.05调高到0.1
    if report["avg_p1_acc"] and abs(report["avg_p1_acc"]) > 0.1:
        suggestions.append("Paddle1 shows frequent acceleration changes; good for quick attacks but avoid overexertion.")
    if report["avg_p2_acc"] and abs(report["avg_p2_acc"]) > 0.1:
        suggestions.append("Paddle2 acceleration variability high; use controlled bursts to surprise opponent.")

    # 球拍距离由0.4调高到0.6
    if report["avg_dist_ball_p1"] > 0.6:
        suggestions.append("Paddle1 too far from ball; improve anticipation and closer positioning to seize control.")
    if report["avg_dist_ball_p2"] > 0.6:
        suggestions.append("Paddle2 too distant from ball; reduce reaction time by staying closer.")

    # 拍间距由0.7调高到0.9
    if report["avg_dist_paddles"] > 0.9:
        suggestions.append("Distance between paddles large; reduce gap to block opponent’s direct shots.")

    # 球速阈值由0.25调高到0.35
    if report["max_ball_speed"] > 8:
        suggestions.append("Ball speed high; improve paddle angle adjustments for better interception and deflection.")

    # 控球时间比例由0.3调高到0.4
    if report["p1_possession_ratio"] < 0.1:
        suggestions.append("Paddle1 lacks ball control; increase aggression to gain possession.")
    if report["p2_possession_ratio"] < 0.1:
        suggestions.append("Paddle2 needs to improve control time; anticipate shots and secure possession.")

    # 球门防守距离由0.3调高到0.5
    if report["avg_p1_goal_dist"] and report["avg_p1_goal_dist"] > 0.5:
        suggestions.append("Paddle1 often far from goal; consider defensive positioning closer to goal to block shots.")
    if report["avg_p2_goal_dist"] and report["avg_p2_goal_dist"] > 0.5:
        suggestions.append("Paddle2 too far from own goal; adjust defense posture to reduce opponent scoring chances.")

    # 球方向阈值不变，但你可以根据需要调大
    if report["avg_ball_dir"] is not None:
        if abs(report["avg_ball_dir"]) < 10:
            suggestions.append("Ball trajectory straight; apply angled shots to disrupt opponent’s rhythm.")
        elif abs(report["avg_ball_dir"]) > 70:
            suggestions.append("Ball direction changes frequently; focus on controlling shot speed and placement.")

    # 球在上半场比例阈值不变
    if report["upper_half_ratio"] > 0.8:
        suggestions.append("Ball mostly in upper half; Paddle1 should enhance active interceptions and offensive positioning.")
    elif report["upper_half_ratio"] < 0.2:
        suggestions.append("Ball mostly in lower half; Paddle2 needs to maintain forward posture to prevent opponent breakthroughs.")

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
            "ball_u","ball_v","ball_speed","ball_acc","ball_dir",
            "paddle1_u","paddle1_v","paddle1_speed","paddle1_acc","paddle1_dir",
            "paddle2_u","paddle2_v","paddle2_speed","paddle2_acc","paddle2_dir",
            "dist_ball_paddle1","dist_ball_paddle2",
            "dist_paddle1_paddle2",
            "dist_ball_goal",
            "in_goal",
            "scorer"
        ])

        self.analysis_interval = 1.0  # 每3秒分析一次
        self.last_analysis_time = 0
        self.current_suggestions = []
        

    def compute_normalized(self, pt):
        TL, TR, BR, BL = self.corners
        src_quad = np.array([TL, TR, BR, BL], dtype=np.float32)
        dst_quad = np.array([[0,0],[1,0],[1,1],[0,1]], dtype=np.float32)
        M = cv2.getPerspectiveTransform(src_quad, dst_quad)
        uv = cv2.perspectiveTransform(np.array([[[pt[0], pt[1]]]], dtype=np.float32), M)
        return uv[0,0]

    def update_suggestions(self, curr_time):
        if curr_time - self.last_analysis_time > self.analysis_interval:
            try:
                report = analyze_csv(self.csv_path, window_sec=self.analysis_interval)
                self.current_suggestions = generate_suggestions(report)
            except Exception as e:
                self.current_suggestions = [f"分析异常: {str(e)}"]
            self.last_analysis_time = curr_time

    def process_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            return False

        curr_time = time.time()
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        cv2.polylines(frame, [self.corners.reshape((-1,1,2))], isClosed=True, color=(156,85,43), thickness=3)

        # 球检测
        # 红色在0附近，两个区间覆盖红色环绕
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

        # 先找到所有候选
        ball_contours, _ = cv2.findContours(mask_ball, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        ball_candidates = []
        for c in ball_contours:
            (x, y), radius = cv2.minEnclosingCircle(c)
            uv = self.compute_normalized((int(x), int(y)))
            ball_candidates.append((c, uv, (x, y, radius)))

        # 如果有候选，再选面积最大的
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

        # 更新分析建议（每3秒）
        self.update_suggestions(curr_time)

        h,w,_ = frame.shape
        extended = np.ones((h, w+300, 3), dtype=np.uint8)*255  # 右侧扩展宽度改300，留建议显示区
        extended[:, 300:] = frame
        frame = extended

        y = 20
        def put(text):
            nonlocal y
            cv2.putText(frame, text, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 2)
            y += 30

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

        # 显示分析建议
        put("=== Suggestions ===")
        if self.current_suggestions:
            for sug in self.current_suggestions:
                put("- " + sug)
        else:
            put("No suggestions")

        cv2.imshow("Tracking", frame)
        cv2.waitKey(1)
        return True

    def release(self):
        self.cap.release()
        self.csv_file.close()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    video_path = "/home/mkbk/code/nus/proj/videos/final1.mp4"  # 请改成你的视频路径
    tracker = CameraTracker(video_path)
    try:
        while True:
            if not tracker.process_frame():
                break
    finally:
        tracker.release()
