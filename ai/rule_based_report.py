# analysis.py
import pandas as pd
import numpy as np
import json
import time
import requests
import json
import random
def angle_diff(a, b):
    diff = abs(a - b) % 360
    return diff

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
    """判断问题类型和建议，返回前端期望的错误类型和建议"""
    problems = []
    advices = []

    # 安全获取数据，避免KeyError
    speed_max = row.get(f"{player}_speed_max", 0)
    speed_mean = row.get(f"{player}_speed_mean", 0)
    direction = row.get(f"{player}_angle_mean", 0)
    ball_dir = row.get("ball_angle_mean", 0)
    u_std = row.get(f"{player}_u_std", 0)
    v_std = row.get(f"{player}_v_std", 0)
    in_goal = row.get("in_goal_max", 0)
    scorer = row.get("scorer_mode", None)

    # 前端期望的5种错误类型和对应建议
    error_mapping = {
        "Slow Reaction": "Try to react more quickly to incoming plays.",
        "Low Activity": "Move more actively to stay engaged in the game.",
        "Weak Defense": "Improve your defense to prevent goals when under threat.",
        "Poor Alignment": "Align your movement better with the direction of the ball.",
        "Coverage Gap": "Increase your coverage area to better influence the game."
    }

    # 分析规则（与前端期望的错误类型匹配）
    if speed_max < 0.5:
        problems.append("Slow Reaction")
        advices.append(error_mapping["Slow Reaction"])

    if speed_mean < 0.05:
        problems.append("Low Activity")
        advices.append(error_mapping["Low Activity"])

    if u_std < 0.0005 and v_std < 0.0005:
            problems.append("Coverage Gap")
            advices.append(error_mapping["Coverage Gap"])
    if scorer != player and speed_mean < 0.05:
        problems.append("Weak Defense")
        advices.append(error_mapping["Weak Defense"])

    if abs(ball_dir- direction) > 0.1:
        problems.append("Poor Alignment")
        advices.append(error_mapping["Poor Alignment"])

    

    # 如果没有发现问题，返回空列表（前端会显示"No major issues identified"）
    return problems, advices

def summarize_data(df):
    """汇总数据帧的统计信息"""
    if df.empty:
        return {}
    
    summary = {}
    
    # 球拍1数据
    if 'paddle1_speed' in df.columns:
        summary['paddle1_speed_max'] = df['paddle1_speed'].max()
        summary['paddle1_speed_mean'] = df['paddle1_speed'].mean()
        summary['paddle1_angle_mean'] = df['paddle1_angle'].mean() 
        summary['paddle1_u_std'] = df['paddle1_u'].std() if 'paddle1_u' in df.columns else 0
        summary['paddle1_v_std'] = df['paddle1_v'].std() if 'paddle1_v' in df.columns else 0
    
    # 球拍2数据
    if 'paddle2_speed' in df.columns:
        summary['paddle2_speed_max'] = df['paddle2_speed'].max()
        summary['paddle2_speed_mean'] = df['paddle2_speed'].mean()
        summary['paddle2_angle_mean'] = df['paddle2_angle'].mean() 
        summary['paddle2_u_std'] = df['paddle2_u'].std() if 'paddle2_u' in df.columns else 0
        summary['paddle2_v_std'] = df['paddle2_v'].std() if 'paddle2_v' in df.columns else 0
    
    # 球数据
    if 'ball_speed' in df.columns:
        summary['ball_speed_mean'] = df['ball_speed'].mean()
    if 'ball_dir' in df.columns:
        summary['ball_angle_mean'] = df['ball_angle'].mean()
    
    # 进球数据
    if 'in_goal' in df.columns:
        summary['in_goal_max'] = df['in_goal'].max()
    
    # 得分者数据
    if 'scorer' in df.columns:
        summary['scorer_mode'] = df['scorer'].mode().iloc[0] if not df['scorer'].mode().empty else None
    
    return summary


def analyze_recent_round(game_id, round_id, round_history, seconds=5):
    """分析指定游戏和回合的最近数据（使用传入数据而非 CSV），返回前端期望格式"""
    try:
        # 直接使用传入的历史数据，转为 DataFrame，不做筛选
        df_all = pd.DataFrame(round_history)

        if df_all.empty:
            return {
                "gid": int(game_id),
                "rid": int(round_id),
                "A_type": [],
                "A_analysis": [],
                "B_type": [],
                "B_analysis": []
            }

        # 使用最后一条的 timestamp 作为 now（不使用系统时间）
        now = df_all["timestamp"].iloc[-1]
        df_recent = df_all[df_all["timestamp"] >= now - seconds]

        if df_recent.empty:
            return {"error": f"No recent data (last {seconds}s) for game {game_id}, round {round_id}"}

        # 汇总最近数据
        row = summarize_data(df_recent)

        # 根据 paddle1、paddle2 分别打分
        p1_problems, p1_advices = judge_keywords_and_advice(row, "paddle1")
        p2_problems, p2_advices = judge_keywords_and_advice(row, "paddle2")

        # 选一个随机下标（确保配对）
        if p1_problems and p1_advices:
            idx1 = random.randint(0, min(len(p1_problems), len(p1_advices)) - 1)
            a_type = p1_problems[idx1]
            a_analysis = p1_advices[idx1]
        else:
            a_type = ""
            a_analysis = ""

        if p2_problems and p2_advices:
            idx2 = random.randint(0, min(len(p2_problems), len(p2_advices)) - 1)
            b_type = p2_problems[idx2]
            b_analysis = p2_advices[idx2]
        else:
            b_type = ""
            b_analysis = ""

        return {
            "gid": int(game_id),
            "rid": int(round_id),
            "A_type": a_type,
            "A_analysis": a_analysis,
            "B_type": b_type,
            "B_analysis": b_analysis
        }


    except Exception as e:
        return {
            "gid": int(game_id),
            "rid": int(round_id),
            "A_type": [],
            "A_analysis": [],
            "B_type": [],
            "B_analysis": []
        }


def analyze_recent_game(game_id, result_game):
    a_types = []
    a_analyses = []
    b_types = []
    b_analyses = []

    for result in result_game:
        a_types.append(result["A_type"])
        a_analyses.append(result["A_analysis"])
        b_types.append(result["B_type"])
        b_analyses.append(result["B_analysis"])

    # 去重并保持顺序
    def dedup(seq):
        seen = set()
        result = []
        for item in seq:
            if item not in seen:
                seen.add(item)
                result.append(item)
        return result

    return {
        "gid": int(game_id),
        "A_type": dedup(a_types),
        "A_analysis": dedup(a_analyses),
        "B_type": dedup(b_types),
        "B_analysis": dedup(b_analyses)
    }



import json



if __name__ == "__main__":
    data = analyze_recent_game(game_id=0)  # 或者指定 round_id=0
    print(data)
    response = requests.post('http://172.20.10.2:45678/analysis/game/new', json=data)
    print(response)

