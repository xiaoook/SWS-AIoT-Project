import paho.mqtt.client as mqtt
import time
import json
import random

client = mqtt.Client()
client.connect('127.0.0.1', 45677, 60)

while True:
    data = {
        "puck": {"x": random.randint(0,100), "y": random.randint(0,100)},
        "pusher1": {"x": random.randint(0,100), "y": random.randint(0,100)},
        "pusher2": {"x": random.randint(0,100), "y": random.randint(0,100)}
    }
    payload = json.dumps(data)
    client.publish('game/positions', payload)
    time.sleep(0.1)  # 每100ms推一次