import pandas as pd
import numpy as np
import torch
from torch.nn.utils.rnn import pad_sequence
from model import LSTMClassifier
import json

# ---------- 配置 ----------
csv_path = "tracking_data.csv"
model_path = "lstm_model.pt"
window_sec = 2.0
step_sec = 0.5
feature_cols = [
    "ball_u", "ball_v", "ball_speed", "ball_angle",
    "paddle1_u", "paddle1_v", "paddle1_speed", "paddle1_angle",
    "paddle2_u", "paddle2_v", "paddle2_speed", "paddle2_angle"
]

# ---------- 定义主函数 ----------
def get_prediction_dict():
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=feature_cols)
    timestamps = df["timestamp"].values

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LSTMClassifier(input_size=len(feature_cols)).to(device)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()

    t0 = timestamps[0]
    t_end = timestamps[-1]
    curr_time = t0 + window_sec

    results = []
    results_dict = {}

    while curr_time <= t_end:
        window_df = df[(df["timestamp"] >= curr_time - window_sec) & (df["timestamp"] < curr_time)]

        if len(window_df) == 0:
            curr_time += step_sec
            continue

        seq_data = torch.tensor(window_df[feature_cols].values, dtype=torch.float32)
        seq_padded = pad_sequence([seq_data], batch_first=True).to(device)
        lengths = torch.tensor([len(seq_data)]).to(device)

        with torch.no_grad():
            output = model(seq_padded, lengths)
            probs = torch.softmax(output, dim=1).cpu().numpy()[0]  # [p1_win, p2_win]

        results.append((curr_time, probs[0], probs[1]))
        results_dict[round(float(curr_time), 2)] = {
            "paddle1": round(float(probs[0]), 4),
            "paddle2": round(float(probs[1]), 4)
        }

        print(f"[{curr_time:.2f}s] P1: {probs[0]:.4f}, P2: {probs[1]:.4f}")
        curr_time += step_sec

    # 保存 JSON
    with open("prediction_result.json", "w") as f:
        json.dump(results_dict, f, indent=2)
    print("✅ 已保存 prediction_result.json")

    return results_dict

# ---------- 如果直接运行，就执行预测 ----------
if __name__ == "__main__":
    prediction_dict = get_prediction_dict()
    # 你也可以在这里用 prediction_dict 做其他事情
