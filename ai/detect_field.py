import cv2
import numpy as np

class FieldDetector:
    def __init__(self, video_source="/home/mkbk/code/nus/proj/videos/video1.mp4"):
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

            lower_gray = 197 - 15
            upper_gray = 197 + 15

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
                print("未找到足够的符合灰度条件的点")
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

    def draw_fixed_field(self, frame):
        if self.corner_points is not None:
            # 画场地
            cv2.polylines(frame, [self.corner_points], isClosed=True, color=(0,255,0), thickness=3)

            labels = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"]
            for i, pt in enumerate(self.corner_points):
                cv2.circle(frame, tuple(pt), 5, (0,0,255), -1)
                cv2.putText(frame, labels[i], (pt[0]+5, pt[1]-5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)

            # 球门线（占40%居中）
            TL, TR, BR, BL = self.corner_points

            # 上边
            top_vec = (TR - TL).astype(np.float32)
            top_len = np.linalg.norm(top_vec)
            gate_len = top_len * 0.32
            top_center = (TL + TR) / 2
            top_dir = top_vec / top_len
            top_left_gate = top_center - top_dir * (gate_len / 2)
            top_right_gate = top_center + top_dir * (gate_len / 2)
            cv2.line(frame, tuple(top_left_gate.astype(int)), tuple(top_right_gate.astype(int)), (255,0,0), 3)
            cv2.putText(frame, "Top Goal", tuple(top_center.astype(int)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,0,0), 2)

            # 下边
            bottom_vec = (BR - BL).astype(np.float32)
            bottom_len = np.linalg.norm(bottom_vec)
            gate_len_b = bottom_len * 0.32
            bottom_center = (BL + BR) / 2
            bottom_dir = bottom_vec / bottom_len
            bottom_left_gate = bottom_center - bottom_dir * (gate_len_b / 2)
            bottom_right_gate = bottom_center + bottom_dir * (gate_len_b / 2)
            cv2.line(frame, tuple(bottom_left_gate.astype(int)), tuple(bottom_right_gate.astype(int)), (255,0,0), 3)
            cv2.putText(frame, "Bottom Goal", tuple(bottom_center.astype(int)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,0,0), 2)

        return frame

    def release(self):
        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    detector = FieldDetector()

    frame = detector.detect_field_once()
    if frame is None:
        print("未检测到四个角点")
    else:
        print("检测到四个角点，后续帧直接绘制")

        try:
            while True:
                ret, frame = detector.cap.read()
                if not ret:
                    break

                frame = detector.draw_fixed_field(frame)

                cv2.imshow("Field Corners and Goals", frame)
                if cv2.waitKey(1) & 0xFF == 27:
                    break
        finally:
            detector.release()
