import cv2
import numpy as np
import mediapipe as mp

def rgb_to_hsv_bounds(rgb, h_tol=10, s_tol=80, v_tol=80):
    color = np.uint8([[rgb]])
    hsv = cv2.cvtColor(color, cv2.COLOR_RGB2HSV)[0][0]
    h, s, v = hsv
    lower = np.array([max(h - h_tol, 0), max(s - s_tol, 0), max(v - v_tol, 0)])
    upper = np.array([min(h + h_tol, 179), min(s + s_tol, 255), min(v + v_tol, 255)])
    return lower, upper

def is_arc_like(cnt, min_len=10):
    if len(cnt) < 5:
        return False
    arc_len = cv2.arcLength(cnt, False)
    if arc_len < min_len:
        return False
    (x, y), r = cv2.minEnclosingCircle(cnt)
    if r < 3 or r > 80:
        return False
    coverage = arc_len / (2 * np.pi * r + 1e-6)
    return 0.3 < coverage < 0.95

# 手指尖关键点编号
fingertip_ids = [8, 12, 16, 20]
target_rgb = (222, 223, 76)
lower_yellow, upper_yellow = rgb_to_hsv_bounds(target_rgb)

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.5
)
mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture("/home/mkbk/code/nus/proj/Test 1.mp4")  # 或 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    h, w = frame.shape[:2]
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    results = hands.process(img_rgb)

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            for idx in fingertip_ids:
                pt = hand_landmarks.landmark[idx]
                cx, cy = int(pt.x * w), int(pt.y * h)

                # 指尖区域
                box_size = 40
                x1, y1 = max(cx - box_size // 2, 0), max(cy - box_size // 2, 0)
                x2, y2 = min(cx + box_size // 2, w), min(cy + box_size // 2, h)
                roi = frame[y1:y2, x1:x2]
                hsv_roi = hsv[y1:y2, x1:x2]

                mask_yellow = cv2.inRange(hsv_roi, lower_yellow, upper_yellow)
                masked = cv2.bitwise_and(roi, roi, mask=mask_yellow)

                gray = cv2.cvtColor(masked, cv2.COLOR_BGR2GRAY)
                blur = cv2.GaussianBlur(gray, (3, 3), 0)
                edges = cv2.Canny(blur, 50, 150)

                contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)

                # 只保留最大的圆（半径最大）
                max_radius = 0
                best_circle = None

                for cnt in contours:
                    if not is_arc_like(cnt):
                        continue
                    (x, y), radius = cv2.minEnclosingCircle(cnt)
                    if radius > max_radius:
                        max_radius = radius
                        best_circle = (x + x1, y + y1, radius)

                if best_circle:
                    cx, cy, r = best_circle
                    cv2.circle(frame, (int(cx), int(cy)), int(r), (0, 255, 0), 2)
                    cv2.putText(frame, "Ball", (int(cx)-10, int(cy)-10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

    cv2.imshow("Biggest Yellow Ball Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
