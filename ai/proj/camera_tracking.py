import cv2
import numpy as np
import time

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

            lower_gray = 188 - 15
            upper_gray = 188 + 15
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
        # 先检测场地
        self.detector = FieldDetector(video_source)
        frame = self.detector.detect_field_once()
        if self.detector.corner_points is None:
            raise Exception("未检测到球场角点")
        self.corners = self.detector.corner_points

        # 重用视频流
        self.cap = self.detector.cap

        # 初始化轨迹
        self.puck_trace = []
        self.paddle1_trace = []
        self.paddle2_trace = []
        self.max_trace_len = 50

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

        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # 蓝色球
        lower_blue = np.array([103,90,130])
        upper_blue = np.array([123,255,255])
        mask_ball = cv2.inRange(hsv, lower_blue, upper_blue)

        ball_pos = None
        ball_uv = None
        ball_contours, _ = cv2.findContours(mask_ball, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if ball_contours:
            c = max(ball_contours, key=cv2.contourArea)
            (x,y),radius = cv2.minEnclosingCircle(c)
            ball_pos = (int(x),int(y))
            ball_uv = self.compute_normalized(ball_pos)
            cv2.circle(frame, ball_pos, int(radius), (255,0,0),2)
            self.puck_trace.append(ball_pos)
            if len(self.puck_trace) > self.max_trace_len:
                self.puck_trace.pop(0)

        # 红色球拍
        lower_red1 = np.array([0,120,70])
        upper_red1 = np.array([10,255,255])
        lower_red2 = np.array([170,120,70])
        upper_red2 = np.array([180,255,255])
        mask_r1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_r2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_paddle = cv2.bitwise_or(mask_r1, mask_r2)

        paddle_positions = []
        paddle_uvs = []
        paddle_contours, _ = cv2.findContours(mask_paddle, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        paddle_contours = sorted(paddle_contours, key=cv2.contourArea, reverse=True)[:2]

        for i, cnt in enumerate(paddle_contours):
            (x,y),radius = cv2.minEnclosingCircle(cnt)
            center = (int(x),int(y))
            uv = self.compute_normalized(center)
            paddle_positions.append(center)
            paddle_uvs.append(uv)
            cv2.circle(frame, center, int(radius), (0,0,255),2)
            cv2.putText(frame, f"Paddle {i+1}", (center[0]+5, center[1]-5),
                        cv2.FONT_HERSHEY_SIMPLEX,0.6,(0,0,255),2)
            if i==0:
                self.paddle1_trace.append(center)
                if len(self.paddle1_trace) > self.max_trace_len:
                    self.paddle1_trace.pop(0)
            elif i==1:
                self.paddle2_trace.append(center)
                if len(self.paddle2_trace) > self.max_trace_len:
                    self.paddle2_trace.pop(0)

        # 轨迹线
        #for i in range(1,len(self.puck_trace)):
            #cv2.line(frame, self.puck_trace[i-1], self.puck_trace[i], (255,0,0),2)
        #for i in range(1,len(self.paddle1_trace)):
            #cv2.line(frame, self.paddle1_trace[i-1], self.paddle1_trace[i], (0,0,255),2)
        #for i in range(1,len(self.paddle2_trace)):
            #cv2.line(frame, self.paddle2_trace[i-1], self.paddle2_trace[i], (0,0,255),2)

        # 显示相对位置
        y_offset = 20
        if ball_uv is not None:
            text = f"Ball (u,v): ({ball_uv[0]:.2f},{ball_uv[1]:.2f})"
            cv2.putText(frame, text, (10,y_offset), cv2.FONT_HERSHEY_SIMPLEX,0.6,(0,255,255),2)
            y_offset += 25
        for idx, uv in enumerate(paddle_uvs):
            text = f"Paddle {idx+1} (u,v): ({uv[0]:.2f},{uv[1]:.2f})"
            cv2.putText(frame, text, (10,y_offset), cv2.FONT_HERSHEY_SIMPLEX,0.6,(0,255,255),2)
            y_offset +=25

        cv2.imshow("Tracking", frame)
        cv2.waitKey(1)
        return True

    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    tracker = CameraTracker("/home/mkbk/code/nus/proj/videos/video1.mp4")
    try:
        while True:
            if not tracker.process_frame():
                break
    finally:
        tracker.release()
