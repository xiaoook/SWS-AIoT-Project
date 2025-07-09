import pygame
import cv2
import numpy as np
import sys
import math
import random

# 初始化
pygame.init()
width, height = 640, 480
screen = pygame.display.set_mode((width, height))
clock = pygame.time.Clock()

# 球
ball_pos = [width//2, height//2]
ball_vel = [8,7]  # 更快
ball_radius = 15

# 球拍
paddle_radius = 25
top_paddle_pos = [width//2, paddle_radius+20]
bottom_paddle_pos = [width//2, height - paddle_radius-20]

# 球门
goal_x_min = width * 0.33
goal_x_max = width * 0.67

# 分数
score_p1 = 0
score_p2 = 0

# 视频
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
video_out = cv2.VideoWriter('airhockey_tracking.mp4', fourcc, 30, (width, height))

# 滞后逻辑
reaction_delay = 3  # 帧
frame_count_top = 0
frame_count_bottom = 0
last_predicted_top = (width//2, paddle_radius+20)
last_predicted_bottom = (width//2, height - paddle_radius-20)

# 游戏循环
while True:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            video_out.release()
            pygame.quit()
            sys.exit()

    # 球运动
    ball_pos[0] += ball_vel[0]
    ball_pos[1] += ball_vel[1]

    # 碰撞左右边界
    if ball_pos[0]-ball_radius<=0 or ball_pos[0]+ball_radius>=width:
        ball_vel[0] = -ball_vel[0]

    # 碰撞上下边界（如果没进球门）
    if ball_pos[1]-ball_radius<=0:
        if goal_x_min < ball_pos[0] < goal_x_max:
            score_p2 += 1
            ball_pos = [width//2, height//2]
            ball_vel = [random.choice([-8,8]),7]
        else:
            ball_vel[1] = abs(ball_vel[1])
    if ball_pos[1]+ball_radius>=height:
        if goal_x_min < ball_pos[0] < goal_x_max:
            score_p1 +=1
            ball_pos = [width//2, height//2]
            ball_vel = [random.choice([-8,8]),-7]
        else:
            ball_vel[1] = -abs(ball_vel[1])

    # 顶部球拍AI
    if ball_vel[1] != 0:
        frames_to_reach = (top_paddle_pos[1] - ball_pos[1]) / ball_vel[1]
        predicted_x = ball_pos[0] + ball_vel[0] * frames_to_reach
        predicted_y = top_paddle_pos[1]
        while predicted_x < 0 or predicted_x > width:
            if predicted_x < 0:
                predicted_x = -predicted_x
            elif predicted_x > width:
                predicted_x = 2*width - predicted_x
    else:
        predicted_x = ball_pos[0]
        predicted_y = top_paddle_pos[1]

    # 球拍纵向目标:尽量和球同Y(但限制在上半场)
    target_y_top = min(height//2 - paddle_radius, max(paddle_radius, ball_pos[1]))

    if frame_count_top % reaction_delay == 0:
        last_predicted_top = (predicted_x, target_y_top)

    # 自适应速度
    adaptive_speed = min(8, max(3, abs(ball_vel[1])*0.6))

    # X
    if last_predicted_top[0] > top_paddle_pos[0]:
        top_paddle_pos[0] += adaptive_speed
    else:
        top_paddle_pos[0] -= adaptive_speed

    # Y
    if last_predicted_top[1] > top_paddle_pos[1]:
        top_paddle_pos[1] += adaptive_speed
    else:
        top_paddle_pos[1] -= adaptive_speed

    frame_count_top +=1

    # 底部球拍AI
    if ball_vel[1] != 0:
        frames_to_reach = (bottom_paddle_pos[1] - ball_pos[1]) / ball_vel[1]
        predicted_x = ball_pos[0] + ball_vel[0] * frames_to_reach
        predicted_y = bottom_paddle_pos[1]
        while predicted_x < 0 or predicted_x > width:
            if predicted_x < 0:
                predicted_x = -predicted_x
            elif predicted_x > width:
                predicted_x = 2*width - predicted_x
    else:
        predicted_x = ball_pos[0]
        predicted_y = bottom_paddle_pos[1]

    target_y_bottom = max(height//2 + paddle_radius, min(height - paddle_radius, ball_pos[1]))

    if frame_count_bottom % reaction_delay ==0:
        last_predicted_bottom = (predicted_x, target_y_bottom)

    # X
    if last_predicted_bottom[0] > bottom_paddle_pos[0]:
        bottom_paddle_pos[0] += adaptive_speed
    else:
        bottom_paddle_pos[0] -= adaptive_speed

    # Y
    if last_predicted_bottom[1] > bottom_paddle_pos[1]:
        bottom_paddle_pos[1] += adaptive_speed
    else:
        bottom_paddle_pos[1] -= adaptive_speed

    frame_count_bottom +=1

    # 限制边界
    top_paddle_pos[0]=max(paddle_radius,min(width-paddle_radius,top_paddle_pos[0]))
    top_paddle_pos[1]=max(paddle_radius,min(height//2-paddle_radius,top_paddle_pos[1]))

    bottom_paddle_pos[0]=max(paddle_radius,min(width-paddle_radius,bottom_paddle_pos[0]))
    bottom_paddle_pos[1]=max(height//2+paddle_radius,min(height-paddle_radius,bottom_paddle_pos[1]))

    # 碰撞球拍
    dist_top=math.hypot(ball_pos[0]-top_paddle_pos[0],ball_pos[1]-top_paddle_pos[1])
    if dist_top<=ball_radius+paddle_radius:
        ball_vel[1]=abs(ball_vel[1])

    dist_bottom=math.hypot(ball_pos[0]-bottom_paddle_pos[0],ball_pos[1]-bottom_paddle_pos[1])
    if dist_bottom<=ball_radius+paddle_radius:
        ball_vel[1]=-abs(ball_vel[1])

    # 渲染
    screen.fill((255,255,255))
    # 球门
    pygame.draw.rect(screen, (0,255,0), (goal_x_min,0,goal_x_max-goal_x_min,5))
    pygame.draw.rect(screen, (0,255,0), (goal_x_min,height-5,goal_x_max-goal_x_min,5))
    # 球
    pygame.draw.circle(screen, (0,0,255), (int(ball_pos[0]),int(ball_pos[1])), ball_radius)
    # 球拍
    pygame.draw.circle(screen, (255,0,0), (int(top_paddle_pos[0]),int(top_paddle_pos[1])), paddle_radius)
    pygame.draw.circle(screen, (255,0,0), (int(bottom_paddle_pos[0]),int(bottom_paddle_pos[1])), paddle_radius)

    # 分数
    font = pygame.font.SysFont(None, 36)
    text = font.render(f"P1: {score_p1}  P2: {score_p2}", True, (0,0,0))
    screen.blit(text, (10,10))

    pygame.display.flip()

    # 保存视频
    frame = pygame.surfarray.array3d(pygame.display.get_surface())
    frame = np.rot90(frame)
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    video_out.write(frame)

    clock.tick(60)
