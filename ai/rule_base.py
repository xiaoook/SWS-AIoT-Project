import pandas as pd
import numpy as np

# 1. 读数据，改成你自己的文件名
df = pd.read_csv("/home/mkbk/code/nus/proj/tracking_data_clean.csv")  # <-- 修改这里

# 2. 按时间戳取整做时间窗口（1秒一组）
df["time_block"] = (df["timestamp"] // 1).astype(int)

# 3. 聚合计算，每秒统计关键特征的 max、min、mean
agg_df = df.groupby("time_block").agg({
    "dist_ball_paddle1": ["min", "mean"],
    "paddle1_speed": ["max", "mean"],
    "ball_acc": ["max", "mean"],
    "ball_speed": ["max", "mean"],
    "ball_dir": lambda x: np.mean(x),   # 简单平均角度（后续可改更精准）
    "paddle1_dir": lambda x: np.mean(x),
    "in_goal": "max",
    "scorer": lambda x: x.mode().iat[0] if not x.mode().empty else None,
    "dist_ball_goal": ["min", "mean"]
})

# 4. 扁平化多级列名
agg_df.columns = ['_'.join(col).strip() for col in agg_df.columns.values]
agg_df = agg_df.reset_index()

# 5. 计算方向差函数（角度差0~180度）
def angle_diff(a, b):
    diff = abs(a - b) % 360
    return np.minimum(diff, 360 - diff)

# 6. 用聚合值判断关键词
def judge_keywords(row):
    flags = {}

    # reaction_slow: 球很近时，球拍速度不够快
    flags["reaction_slow"] = (row["dist_ball_paddle1_min"] < 10) and (row["paddle1_speed_max"] < 5)

    # bad_prediction: 球拍方向和球方向偏差大于60°
    flags["bad_prediction"] = angle_diff(row["ball_dir_<lambda>"], row["paddle1_dir_<lambda>"]) > 60

    # chase_fail: 球靠近但球拍速度非常慢
    flags["chase_fail"] = (row["dist_ball_paddle1_min"] < 10) and (row["paddle1_speed_mean"] < 1)

    # control_bad: 球加速度或球速变化剧烈（用max ball_acc和max-min ball_speed）
    speed_var = row["ball_speed_max"] - row["ball_speed_mean"]
    flags["control_bad"] = (row["ball_acc_max"] > 1000) or (speed_var / (row["ball_speed_mean"] + 1e-6) > 0.5)

    # miss_defense: 有进球且非paddle1得分，球接近己方球门时球拍速度低
    flags["miss_defense"] = False
    if (row["in_goal_max"] == 1) and (row["scorer_<lambda>"] != "paddle1") and (row["dist_ball_goal_min"] < 10) and (row["paddle1_speed_mean"] < 1):
        flags["miss_defense"] = True

    return pd.Series(flags)

# 7. 应用关键词判断函数
result_flags = agg_df.apply(judge_keywords, axis=1)

# 8. 状态判断函数：进攻 / 中性 / 防守
def judge_state(row):
    GOAL_DIRECTION = 0  # 球门方向，假设0度，需根据实际调整
    dir_diff = angle_diff(row["paddle1_dir_<lambda>"], GOAL_DIRECTION)

    # 阈值
    SPEED_FAST = 10
    DIST_BALL_NEAR_GOAL = 100
    DIST_BALL_NEAR_PADDLE = 50

    # 进攻条件：球拍方向朝球门且速度快
    if row["paddle1_speed_mean"] > SPEED_FAST:
        return "attack"

    # 防守条件：球靠近己方球门且球拍靠近球且速度快
    if (row["dist_ball_goal_min"] < DIST_BALL_NEAR_GOAL) and (row["dist_ball_paddle1_min"] < DIST_BALL_NEAR_PADDLE) and (row["paddle1_speed_mean"] > SPEED_FAST):
        return "defense"

    # 其余视为中性
    return "neutral"

# 9. 应用状态判断
final_df = pd.concat([agg_df[["time_block"]], result_flags], axis=1)
final_df["paddle1_state"] = agg_df.apply(judge_state, axis=1)

# 10. 保存结果
final_df.to_csv("keyword_issue_and_state_analysis.csv", index=False)
print("关键词及状态分析完成，结果保存在 keyword_issue_and_state_analysis.csv")
