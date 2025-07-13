import pandas as pd
import numpy as np
import json

def angle_diff(a, b):
    diff = abs(a - b) % 360
    return min(diff, 360 - diff)

GOAL_DIRECTION = {
    "paddle1": 180,
    "paddle2": 0
}

def judge_status(row, player, speed_threshold=10):
    ball_speed = row["ball_speed_mean"]
    ball_dir = row["ball_angle_mean"]
    goal_dir = GOAL_DIRECTION[player]

    if ball_speed <= speed_threshold:
        return "Neutral"
    diff = angle_diff(ball_dir, goal_dir)
    return "Offense" if diff > 90 else "Defense"

def judge_keywords_and_advice(row, player):
    result = {"problems": [], "advices": []}

    speed_max = row[f"{player}_speed_max"]
    speed_mean = row[f"{player}_speed_mean"]
    direction = row[f"{player}_angle_mean"]
    ball_dir = row["ball_angle_mean"]

    if speed_max < 3 and speed_mean < 1:
        result["problems"].append("reaction_slow")
        result["advices"].append("Try to react more quickly and move with greater urgency.")
    elif angle_diff(ball_dir, direction) > 60:
        result["problems"].append("bad_prediction")
        result["advices"].append("Improve your prediction of the ball’s movement and align better.")
    elif speed_mean < 0.5:
        result["problems"].append("not_engaged")
        result["advices"].append("Stay more active and keep moving even when the ball is far.")

    if (row["in_goal_max"] == 1 and
        row["scorer_mode"] != player and
        speed_mean < 1):
        result["problems"].append("missed_defense")
        result["advices"].append("Improve your defense to better protect your goal when under threat.")

    return result

def summarize_data(df):
    row = {
        "ball_speed_max": df["ball_speed"].max(),
        "ball_speed_mean": df["ball_speed"].mean(),
        "ball_angle_mean": df["ball_angle"].mean(),
        "paddle1_speed_max": df["paddle1_speed"].max(),
        "paddle1_speed_mean": df["paddle1_speed"].mean(),
        "paddle2_speed_max": df["paddle2_speed"].max(),
        "paddle2_speed_mean": df["paddle2_speed"].mean(),
        "paddle1_angle_mean": df["paddle1_angle"].mean(),
        "paddle2_angle_mean": df["paddle2_angle"].mean(),
        "in_goal_max": df["in_goal"].max(),
        "scorer_mode": df["scorer"].mode().iat[0] if not df["scorer"].mode().empty else None
    }
    return row

def analyze_round(df_all, game_id, round_id):
    df = df_all[(df_all["game_id"] == game_id) & (df_all["round_id"] == round_id)]
    if df.empty:
        return {"error": f"No data found for game {game_id}, round {round_id}"}

    row = summarize_data(df)
    return {
        "game_id": int(game_id),
        "round_id": int(round_id),
        "paddle1": {
            **judge_keywords_and_advice(row, "paddle1"),
            "status": judge_status(row, "paddle1")
        },
        "paddle2": {
            **judge_keywords_and_advice(row, "paddle2"),
            "status": judge_status(row, "paddle2")
        }
    }

def analyze_game(df_all, game_id):
    df = df_all[df_all["game_id"] == game_id]
    if df.empty:
        return {"error": f"No data found for game {game_id}"}

    row = summarize_data(df)
    return {
        "game_id": int(game_id),
        "paddle1": {
            **judge_keywords_and_advice(row, "paddle1"),
            "status": judge_status(row, "paddle1")
        },
        "paddle2": {
            **judge_keywords_and_advice(row, "paddle2"),
            "status": judge_status(row, "paddle2")
        }
    }

def get_round_report_dict(df_all, game_id, round_id):
    df = df_all[(df_all["game_id"] == game_id) & (df_all["round_id"] == round_id)]
    if df.empty:
        return {"error": f"No data found for game {game_id}, round {round_id}"}

    row = summarize_data(df)
    return {
        "game_id": int(game_id),
        "round_id": int(round_id),
        "paddle1": {
            **judge_keywords_and_advice(row, "paddle1"),
            "status": judge_status(row, "paddle1")
        },
        "paddle2": {
            **judge_keywords_and_advice(row, "paddle2"),
            "status": judge_status(row, "paddle2")
        }
    }

def get_game_report_dict(df_all, game_id):
    df = df_all[df_all["game_id"] == game_id]
    if df.empty:
        return {"error": f"No data found for game {game_id}"}

    row = summarize_data(df)
    return {
        "game_id": int(game_id),
        "paddle1": {
            **judge_keywords_and_advice(row, "paddle1"),
            "status": judge_status(row, "paddle1")
        },
        "paddle2": {
            **judge_keywords_and_advice(row, "paddle2"),
            "status": judge_status(row, "paddle2")
        }
    }

# 示例调用方式
if __name__ == "__main__":
    df_all = pd.read_csv("tracking_data.csv")

    # 分析某 round
    result_round = analyze_round(df_all, game_id=1, round_id=3)
    with open("round_g1_r3.json", "w", encoding="utf-8") as f:
        json.dump(result_round, f, ensure_ascii=False, indent=2)

    # 分析整个 game
    result_game = analyze_game(df_all, game_id=1)
    with open("game_g1.json", "w", encoding="utf-8") as f:
        json.dump(result_game, f, ensure_ascii=False, indent=2)

    print("✅ round / game 分析结果已保存")
