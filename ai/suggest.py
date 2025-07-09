import pandas as pd
import numpy as np

def analyze_csv(csv_path, window_sec=1.0):
    df = pd.read_csv(csv_path)

    if len(df) == 0:
        raise ValueError("CSV文件为空")

    # 取最新时间
    max_time = df["timestamp"].max()
    min_time = max_time - window_sec

    # 取窗口内数据
    window_df = df[(df["timestamp"] >= min_time) & (df["timestamp"] <= max_time)]

    if len(window_df) == 0:
        raise ValueError("窗口内没有数据")

    report = {}

    # Paddle速度
    report["avg_p1_speed"] = window_df["paddle1_speed"].mean()
    report["avg_p2_speed"] = window_df["paddle2_speed"].mean()

    # 球与球拍距离
    report["avg_dist_ball_p1"] = window_df["dist_ball_paddle1"].mean()
    report["avg_dist_ball_p2"] = window_df["dist_ball_paddle2"].mean()

    # 球拍之间距离
    report["avg_dist_paddles"] = window_df["dist_paddle1_paddle2"].mean()

    # 球最大速度
    report["max_ball_speed"] = window_df["ball_speed"].max()

    # 球运动方向
    report["avg_ball_dir"] = window_df["ball_dir"].mean()

    # 球场分布
    upper_half_frames = window_df[window_df["ball_v"] < 0.5]
    upper_half_ratio = len(upper_half_frames) / len(window_df)
    report["upper_half_ratio"] = upper_half_ratio

    return report

def generate_suggestions(report):
    suggestions = []

    # Paddle速度
    if report["avg_p1_speed"] < 0.02:
        suggestions.append("Paddle1移动不足，容易被对手突破，建议保持适度的摆动来干扰对手进攻。")
    if report["avg_p2_speed"] < 0.02:
        suggestions.append("Paddle2移动不足，缺乏进攻压力，建议更积极地进行拦截和抢攻。")

    # 球与球拍距离
    if report["avg_dist_ball_p1"] > 0.2:
        suggestions.append("Paddle1离球较远，难以及时防守，建议更多停留在球正前方进行封堵。")
    if report["avg_dist_ball_p2"] > 0.2:
        suggestions.append("Paddle2与球距离偏大，建议尽可能贴近球体以便快速反击。")

    # 球拍之间距离
    if report["avg_dist_paddles"] > 0.5:
        suggestions.append("两球拍相距过大，容易形成空档，建议保持相对距离来封锁对手通道。")

    # 球速度
    if report["max_ball_speed"] > 0.05:
        suggestions.append("对手发力击球速度较快，建议提前调整拍面角度缓冲或引导球偏离正中。")

    # 球场分布
    if report["upper_half_ratio"] > 0.8:
        suggestions.append("球大多在上半区活动，Paddle1需加强拦截和反击准备。")
    elif report["upper_half_ratio"] < 0.2:
        suggestions.append("球主要在下半区，Paddle2需保持拍面前置以应对突袭。")

    # 球方向
    if abs(report["avg_ball_dir"]) < 10:
        suggestions.append("球运动方向较直，适合利用侧拍击打斜线进行反击。")
    elif abs(report["avg_ball_dir"]) > 70:
        suggestions.append("球方向变化较大，建议控制球速以降低对方反应速度。")

    return suggestions

if __name__ == "__main__":
    csv_path = "tracking_data.csv"   # 修改为你的CSV路径
    report = analyze_csv(csv_path, window_sec=1.0)

    print("=== 量化指标 ===")
    for k, v in report.items():
        print(f"{k}: {v:.4f}")

    suggestions = generate_suggestions(report)

    print("\n=== 建议 ===")
    for s in suggestions:
        print("-", s)
