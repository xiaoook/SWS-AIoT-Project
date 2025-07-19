import math

def sigmoid(x, k=10):
    return 1 / (1 + math.exp(-k * x))

def predict_both_scores(
    ball_u, ball_v, ball_speed, ball_angle,
    paddle1_u, paddle1_v, paddle1_speed, 
    paddle2_u, paddle2_v, paddle2_speed,
    goal_v_min=0.33, goal_v_max=0.66,
    paddle_radius=0.08,
    field_width=1.0, field_height=1.0,
    max_time=10.0,
    dt=0.01
):
    x, y = ball_u, ball_v
    angle_rad = math.radians(ball_angle)
    vx = ball_speed * math.cos(angle_rad)
    vy = ball_speed * math.sin(angle_rad)
    time_elapsed = 0.0

    intercept_found = False
    intercept_x = None
    intercept_y = None
    goal_side = None  # "left" or "right"

    while time_elapsed < max_time:
        x += vx * dt
        y += vy * dt
        time_elapsed += dt

        # 上下反弹
        if y <= 0:
            y = -y
            vy = -vy
        elif y >= field_height:
            y = 2 * field_height - y
            vy = -vy

        # 判断球是否到达左右边界
        if ball_angle <= 0 and goal_v_min <= y <= goal_v_max:
            intercept_x, intercept_y = 0, y
            goal_side = "left"
            intercept_found = True
            break
        elif ball_angle > 0 and goal_v_min <= y <= goal_v_max:
            intercept_x, intercept_y = field_width, y
            goal_side = "right"
            intercept_found = True
            break

    if not intercept_found:
        # 球不射门，双方得分概率都很低
        return {"player1_score_prob": 0.0, "player2_score_prob": 0.0}

    # 计算防守方和进攻方
    if goal_side == "left":
        attacker = 2  # 球往左门，player2进攻，player1防守
        defender_u, defender_v, defender_speed = paddle1_u, paddle1_v, paddle1_speed
    else:
        attacker = 1  # 球往右门，player1进攻，player2防守
        defender_u, defender_v, defender_speed = paddle2_u, paddle2_v, paddle2_speed

    dist_to_intercept = math.hypot(intercept_x - defender_u, intercept_y - defender_v)
    max_reach = defender_speed * time_elapsed
    delta = (dist_to_intercept - max_reach) / paddle_radius
    prob_score = sigmoid(delta, k=2)
    prob_score = min(max(prob_score, 0.0), 1.0)

    if attacker == 1:
        return {
            "player1_score_prob": prob_score,
            "player2_score_prob": 1 - prob_score
        }
    else:
        return {
            "player1_score_prob": 1 - prob_score,
            "player2_score_prob": prob_score
        }
