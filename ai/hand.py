import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import os

# 初始化 MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.6)
mp_draw = mp.solutions.drawing_utils

prev_index_tips = {}
raw_data = []

# 动作分类
def classify_speed(speed, low_thresh=0.005, high_thresh=0.02):
    if speed < low_thresh:
        return "Idle"
    elif speed < high_thresh:
        return "Prepare"
    else:
        return "Swing"

# 三点计算夹角
def calculate_angle(A, B, C):
    AB = np.array([A[0] - B[0], A[1] - B[1]])
    CB = np.array([C[0] - B[0], C[1] - B[1]])
    cosine_angle = np.dot(AB, CB) / (np.linalg.norm(AB) * np.linalg.norm(CB) + 1e-6)
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
    return np.degrees(angle)

# 每秒分析每只手
def analyze_by_second_multi(df):
    result_rows = []
    df["second"] = df["Frame"] // df["FPS"]

    for (sec, hand_id), group in df.groupby(["second", "HandID"]):
        avg_speed = group["Speed"].mean()
        main_action = group["Action"].value_counts().idxmax()
        label = group["Label"].iloc[0]

        stability = {}
        for f in [8, 12, 16]:
            dx = group[f"L{f}_x"] - group["L0_x"]
            dy = group[f"L{f}_y"] - group["L0_y"]
            dist = np.sqrt(dx**2 + dy**2)
            stability[f"L{f}"] = np.std(dist)

        vx = group["L8_x"].diff().dropna()
        vy = group["L8_y"].diff().dropna()
        velocity = np.sqrt(vx**2 + vy**2)
        smoothness = np.std(velocity)

        angles = []
        for _, row in group.iterrows():
            try:
                A = (row["L8_x"], row["L8_y"])
                B = (row["L12_x"], row["L12_y"])
                C = (row["L16_x"], row["L16_y"])
                angle = calculate_angle(A, B, C)
                angles.append(angle)
            except:
                continue
        angle_mean = np.nanmean(angles)
        angle_std = np.nanstd(angles)

        result_rows.append({
            "Second": sec,
            "HandID": hand_id,
            "Label": label,
            "Avg_Speed": avg_speed,
            "Main_Action": main_action,
            "Stability_L8": stability["L8"],
            "Stability_L12": stability["L12"],
            "Stability_L16": stability["L16"],
            "Smoothness_L8": smoothness,
            "Angle_Mean": angle_mean,
            "Angle_Std": angle_std
        })

    return pd.DataFrame(result_rows)

# 主函数
def main():
    global prev_index_tips

    cap = cv2.VideoCapture("/home/mkbk/code/nus/proj/Test 1.mp4")
    if not cap.isOpened():
        print("❌ 无法打开视频")
        return

    fps = int(cap.get(cv2.CAP_PROP_FPS))
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        h, w = frame.shape[:2]
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(img_rgb)

        if results.multi_hand_landmarks and results.multi_handedness:
            for hand_idx, (hand_landmarks, hand_handedness) in enumerate(zip(results.multi_hand_landmarks, results.multi_handedness)):
                label = hand_handedness.classification[0].label  # 'Left' or 'Right'
                hand_id = f"{label}_{hand_idx}"
                mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

                landmarks = []
                for lm in hand_landmarks.landmark:
                    landmarks.extend([lm.x * w, lm.y * h])

                cx, cy = hand_landmarks.landmark[8].x * w, hand_landmarks.landmark[8].y * h
                speed = 0
                if hand_id in prev_index_tips:
                    speed = np.linalg.norm(np.array([cx, cy]) - np.array(prev_index_tips[hand_id]))
                prev_index_tips[hand_id] = (cx, cy)
                action = classify_speed(speed)

                cv2.putText(frame, f"{hand_id}: {action}", (10, 40 + 30 * hand_idx),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

                raw_data.append({
                    "Frame": frame_idx,
                    "FPS": fps,
                    "HandID": hand_id,
                    "Label": label,
                    "Speed": speed,
                    "Action": action,
                    **{f"L{i}_{axis}": landmarks[i * 2 + (0 if axis == "x" else 1)]
                       for i in range(21) for axis in ["x", "y"]}
                })

        cv2.imshow("Multi-Hand Tracking", frame)
        if cv2.waitKey(1) & 0xFF == 27:
            break

    cap.release()
    cv2.destroyAllWindows()

    # 保存分析结果
    df = pd.DataFrame(raw_data)
    second_df = analyze_by_second_multi(df)

    os.makedirs("output_csv", exist_ok=True)
    for hand_id, group in second_df.groupby("HandID"):
        filename = f"output_csv/{hand_id}.csv"
        group.to_csv(filename, index=False)
        print(f"✅ 已保存：{filename}")

if __name__ == "__main__":
    main()
