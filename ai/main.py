import time
from cv import CameraTracker  # 假设 CameraTracker 类在 ai/camera_tracker.py 中定义
import json

def main():
    video_source = "/home/mkbk/code/nus/proj/SWS-AIoT-Project/ai/f2.mp4"# 或者替换为视频路径，例如 "sample.mp4"
    tracker = CameraTracker(video_source)

    try:
        while True:
            # 模拟传入游戏状态参数
            curr_time = time.time()
            if curr_time - tracker.last_goal_time > 5:
                in_goal = True
                scorer = 1 if int(curr_time) % 2 == 0 else 2
                tracker.round_id += 1
                if tracker.round_id > 5:
                    tracker.round_id = 1
                    tracker.game_id += 1
                tracker.last_goal_time = curr_time
            else:
                in_goal = False
                scorer = 0

            # 传入参数
            tracker.update_game_state(
                in_goal=in_goal,
                scorer=scorer,
                round_id=tracker.round_id,
                game_id=tracker.game_id
            )

            # 处理当前帧
            if not tracker.process_frame():
                break
            latest = tracker.latest_data
            if latest:
                with open("latest_frames.jsonl", "a", encoding="utf-8") as f:
                    json_line = json.dumps(tracker.latest_data, ensure_ascii=False)
                    f.write(json_line + "\n")


    except KeyboardInterrupt:
        print("退出程序")
    finally:
        tracker.release()

if __name__ == "__main__":
    main()