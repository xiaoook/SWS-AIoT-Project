import paho.mqtt.client as mqtt
import time
import json
import random

client = mqtt.Client()
client.connect('127.0.0.1', 45677, 60)

while True:
    data = {
        "puck": {"x": random.randint(0,800), "y": random.randint(0,400)},
        "pusher1": {"x": random.randint(0,800), "y": random.randint(0,400)},
        "pusher2": {"x": random.randint(0,800), "y": random.randint(0,400)}
    }
    payload = json.dumps(data)
    client.publish('game/positions', payload)
    time.sleep(1)  # push per 1s