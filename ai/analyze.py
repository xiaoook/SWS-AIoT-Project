import pandas as pd
import numpy as np

# 计算连续True最大长度
def max_consecutive_true(arr):
    max_len = cur_len = 0
    for v in arr:
        if v:
            cur_len += 1
            max_len = max(max_len, cur_len)
        else:
            cur_len = 0
    return max_len

# 计算路径曲折度（轨迹弯曲程度，越大越曲折）
def trajectory_curvature(x, y):
    # 简单近似，计算方向变化绝对值和总距离比
    if len(x) < 3:
        return 0
    vectors = np.diff(np.vstack((x, y)), axis=1)
    norms = np.linalg.norm(vectors, axis=0)
    directions = vectors / norms
    angle_changes = []
    for i in range(len(directions[0]) - 1):
        v1 = directions[:, i]
        v2 = directions[:, i+1]
        cos_angle = np.clip(np.dot(v1, v2), -1, 1)
        angle = np.arccos(cos_angle)
        angle_changes.append(angle)
    total_angle_change = np.sum(np.abs(angle_changes))
    total_dist = np.sum(norms)
    if total_dist == 0:
        return 0
    return total_angle_change / total_dist

# 反应延迟估计：球方向变化时间 到 球拍有效移动时间的时间差（秒）
def estimate_reaction_delay(df_window, ball_dir_col, paddle_speed_col, speed_threshold=0.02, dir_change_threshold=15):
    # 找球方向发生明显变化的帧索引
    ball_dir = df_window[ball_dir_col].values
    paddle_speed = df_window[paddle_speed_col].fillna(0).values
    timestamps = df_window['timestamp'].values
    
    # 球方向变化点（超过阈值）
    dir_changes = np.abs(np.diff(ball_dir))
    change_frames = np.where(dir_changes > dir_change_threshold)[0] + 1
    if len(change_frames) == 0:
        return None  # 无明显方向变化
    
    first_change_frame = change_frames[0]
    change_time = timestamps[first_change_frame]
    
    # 找球拍开始加速超过阈值的时间
    for i in range(first_change_frame, len(paddle_speed)):
        if paddle_speed[i] > speed_threshold:
            reaction_time = timestamps[i]
            return reaction_time - change_time
    return None

# 读取数据
df = pd.read_csv("tracking_data.csv")

# 每秒帧数（根据实际视频帧率调整）
fps = 30
analysis_window_sec = 1  # 分析窗口1秒
window_frames = int(fps * analysis_window_sec)

# 进球帧索引
goal_indices = df.index[df['in_goal'] == True].tolist()

results = []

for goal_idx in goal_indices:
    start_idx = max(0, goal_idx - window_frames)
    window = df.loc[start_idx:goal_idx-1].reset_index(drop=True)
    
    scorer = int(df.loc[goal_idx, 'scorer'])
    
    # 球拍距离
    dist_col = 'dist_ball_paddle1' if scorer == 1 else 'dist_ball_paddle2'
    paddle_speed_col = 'paddle1_speed' if scorer == 1 else 'paddle2_speed'
    paddle_acc_col = 'paddle1_acc' if scorer == 1 else 'paddle2_acc'
    paddle_u_col = 'paddle1_u' if scorer == 1 else 'paddle2_u'
    paddle_v_col = 'paddle1_v' if scorer == 1 else 'paddle2_v'
    
    ball_speed_col = 'ball_speed'
    ball_acc_col = 'ball_acc'
    ball_dir_col = 'ball_dir'
    
    # 计算指标
    dist_vals = window[dist_col].dropna().values
    paddle_speed_vals = window[paddle_speed_col].dropna().values
    paddle_acc_vals = window[paddle_acc_col].dropna().values
    paddle_u_vals = window[paddle_u_col].dropna().values
    paddle_v_vals = window[paddle_v_col].dropna().values
    ball_speed_vals = window[ball_speed_col].dropna().values
    ball_acc_vals = window[ball_acc_col].dropna().values
    
    # 距离峰值和平均距离
    dist_max = np.max(dist_vals) if len(dist_vals) > 0 else np.nan
    dist_mean = np.mean(dist_vals) if len(dist_vals) > 0 else np.nan
    
    # 球拍速度和加速度平均值
    speed_mean = np.mean(paddle_speed_vals) if len(paddle_speed_vals) > 0 else np.nan
    acc_mean = np.mean(paddle_acc_vals) if len(paddle_acc_vals) > 0 else np.nan
    
    # 连续失误次数（距离大于0.3）
    fail_mask = dist_vals > 0.3
    max_consec_fails = max_consecutive_true(fail_mask)
    
    # 进球前追踪时间（距离大于阈值的总时间）
    total_fail_time = np.sum(fail_mask) / fps
    
    # 反应延迟估计
    reaction_delay = estimate_reaction_delay(window, ball_dir_col, paddle_speed_col)
    
    # 球速度变化率（简化用速度方差）
    ball_speed_var = np.var(ball_speed_vals) if len(ball_speed_vals) > 0 else np.nan
    
    # 球拍运动轨迹曲折度
    curvature = trajectory_curvature(paddle_u_vals, paddle_v_vals)
    
    results.append({
        'goal_index': goal_idx,
        'scorer': scorer,
        'dist_max': dist_max,
        'dist_mean': dist_mean,
        'speed_mean': speed_mean,
        'acc_mean': acc_mean,
        'max_consec_fails': max_consec_fails,
        'total_fail_time_s': total_fail_time,
        'reaction_delay_s': reaction_delay,
        'ball_speed_var': ball_speed_var,
        'paddle_trajectory_curvature': curvature,
    })

# 转成DataFrame打印或保存
df_results = pd.DataFrame(results)
print(df_results)
df_results.to_csv("goal_analysis_results.csv", index=False)
