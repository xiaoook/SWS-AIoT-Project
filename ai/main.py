from paho.mqtt import client as mqtt
import time
from cv import CameraTracker  # 假设 CameraTracker 类在 ai/camera_tracker.py 中定义
import json
from predictor import RealTimePredictor
from cv import client  # 导入 MQTT 客户端
from rule_based_report import analyze_recent_round, analyze_recent_game
from collections import deque
from hhhh import predict_both_scores
import requests
MQTT_BROKER_URL = "172.20.10.3"
MQTT_BROKER_PORT = 45679 
status = "ended"
in_goal = 0
scorer = 0
round_id = 1
game_id = 0
goal = None
acc_a = None
acc_b = None

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("game/goal")
    client.subscribe("game/status")
    client.subscribe("game/info")
    client.subscribe("acc/A")
    client.subscribe("acc/B")

def on_message(client, userdata, msg):
    global goal, in_goal, scorer, round_id, game_id, status, acc_a, acc_b

    print(f"Received message on {msg.topic}: {msg.payload.decode()}")
    if msg.topic == "game/goal":
        goal = json.loads(msg.payload.decode())
        winner = goal.get("winner")
        in_goal = 1
        scorer = 1 if winner == "A" else 2
        # 这里可以添加处理进球事件的逻辑
    elif msg.topic == "game/status":
        status = msg.payload.decode()
    elif msg.topic == "game/info":
        game_id = json.loads(msg.payload.decode())
        # game_id = info.get("gid", game_id)
        print(f"Game Info - Game ID: {game_id}")
    elif msg.topic == "acc/A":
        acc_a = json.loads(msg.payload.decode())
        print(f"Accelerometer A: {acc_a}")  
    elif msg.topic == "acc/B":
        acc_b = json.loads(msg.payload.decode())
        print(f"Accelerometer B: {acc_b}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message
client.connect(MQTT_BROKER_URL, MQTT_BROKER_PORT, 60)
client.loop_start()

def main():

    prediction_buffer = deque()
    last_publish_time = time.time()
    publish_interval = 1  # seconds
    global in_goal, scorer, round_id, game_id
    video_source = 0# 或者替换为视频路径，例如 "sample.mp4"
    tracker = CameraTracker(video_source)
    last_handled_round = None
    last_handled_game = None
    predictor = RealTimePredictor()
    client.on_connect = on_connect
    client.on_message = on_message
    handled_game_id = 0  # ✅ 加在 main 函数中初始化
    round_history = []
    game_history = []
    try:
        last_print_time = 0
        while True:
            # 传入参数
            
            tracker.update_game_state(
                in_goal=in_goal,
                scorer=scorer,
                round_id=round_id,
                game_id=game_id
            )
            '''if in_goal == 1:
                if (last_handled_round is None or
                    (round_id != last_handled_round or game_id != last_handled_game)):

                    print(f"⚠️ Detected goal. Analyzing round: G{game_id} R{round_id}")
                    result = analyze_recent_round(game_id, round_id)
                    filename = f"round_g{game_id}_r{round_id}.json"
                    with open(filename, "w", encoding="utf-8") as f:
                        json.dump(result, f, ensure_ascii=False, indent=2)

                    print(f"✅ Saved round analysis to {filename}")

                    # 更新已处理的标记
                    last_handled_round = round_id
                    last_handled_game = game_id'''
        
                
            in_goal = 0
            scorer = 0

            # 处理当前帧
            if not tracker.process_frame():
                break
            latest = tracker.latest_data
            round_history.append(latest.copy()) 
            if  status == "in progress" and in_goal == 1:
                result_round = analyze_recent_round(game_id, round_id,round_history)
                game_history.append(result_round)
                round_history.clear()  # 清空回合历史
                response = requests.post('http://172.20.10.3:45678/analysis/round/new', json=result_round)
                round_id += 1
                print(result_round)
            if (status == "ended" and game_id != handled_game_id):
                result_game = analyze_recent_game(game_id,game_history)
                game_id = -1
                round_id = 1
                print(result_game)
                response = requests.post('http://172.20.10.3:45678/analysis/game/new', json=result_game)
                handled_game_id = game_id
                game_history.clear()
            if latest:
                

                def safe_scale(value, scale):
                    return int(round(value * scale)) if value is not None else None


                data = {
                    "puck": {
                        "x": safe_scale(latest["ball"]["u"], 810),
                        "y": safe_scale(latest["ball"]["v"], 420)
                    },
                    "pusher1": {
                        "x": safe_scale(latest["paddle1"]["u"], 810),
                        "y": safe_scale(latest["paddle1"]["v"], 420)
                    },
                    "pusher2": {
                        "x": safe_scale(latest["paddle2"]["u"], 810),
                        "y": safe_scale(latest["paddle2"]["v"], 420)
                    }
                }


                payload = json.dumps(data)
                client.publish('game/positions', payload)
                #print("Published pos:", payload)

            # 初始化
            

            # 每帧处理后，构建 feature_vector 并调用
            ball = latest["ball"]
            p1 = latest["paddle1"]
            p2 = latest["paddle2"]
            features = [
                ball["u"], ball["v"], ball["speed"], ball["angle"],
                p1["u"], p1["v"], p1["speed"],p1["angle"],
                p2["u"], p2["v"], p2["speed"], p2["angle"]
            ]
            

            if all(v is not None for v in features):
                prediction = predictor.update_and_predict(features)
                if prediction is not None:
                    now = time.time()

                    p1_speed = features[6]
                    p2_speed = features[10]
                    if p1_speed >= 0.05 and p2_speed >= 0.05:
                        mean_pred = prediction
                    else:
                        mean_pred = {
                            "playerA": 50,
                            "playerB": 50
                        }

                    # 如果到达发布时间，发送
                    if now - last_publish_time >= publish_interval:
                        last_publish_time = now
                        client.publish("game/prediction", json.dumps(mean_pred))



                        payload1 = json.dumps(mean_pred)
                        client.publish('game/predictions', payload1)
                        print("Published pred:", payload1)

                        last_publish_time = now  # 更新时间戳

            

    except KeyboardInterrupt:
        print("退出程序")
    finally:
        tracker.release()

if __name__ == "__main__":
    main()