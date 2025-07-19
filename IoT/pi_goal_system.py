import asyncio
import time
import requests
import atexit
import paho.mqtt.client as mqtt
from bleak import BleakClient
import RPi.GPIO as GPIO

# === UUIDs and MAC Addresses ===
UART_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
UART_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
MAC_A = "E1:B8:58:40:BD:D3"
MAC_B = "D8:38:5B:54:C9:02"

# === GPIO Pins ===
TRIG_A, ECHO_A = 23, 24
TRIG_B, ECHO_B = 17, 27
GPIO.setmode(GPIO.BCM)
GPIO.setup(TRIG_A, GPIO.OUT)
GPIO.setup(ECHO_A, GPIO.IN)
GPIO.setup(TRIG_B, GPIO.OUT)
GPIO.setup(ECHO_B, GPIO.IN)

# === Backend Config ===
BACKEND_IP = "172.20.10.3"
HTTP_PORT = 45678
MQTT_PORT = 45679
HTTP_GOAL_URL = f"http://{BACKEND_IP}:{HTTP_PORT}/goal?team={{team}}"
HTTP_NOTICE_URL = f"http://{BACKEND_IP}:{HTTP_PORT}/notify?event=undetected&team={{team}}"

# === Game Parameters ===
GAME_WIN_SCORE = 7
GOAL_THRESHOLD_CM = 3.8
UNLOCK_MARGIN_CM = 2.0      # Larger margin for stability
GOAL_COOLDOWN = 5.0
UNDETECTED_NOTICE_DELAY = 10.0
RESET_WAIT_SECONDS = 10

# === State ===
status = "ended"
reset_pending = True
score_A = 0
score_B = 0
puck_locked_A = False
puck_locked_B = False
is_flashing = False
game_over = False

last_goal_time_A = 0
last_goal_time_B = 0
last_notice_time_A = 0
last_notice_time_B = 0

# === Helper Functions ===
def send_goal(team):
    try:
        url = HTTP_GOAL_URL.format(team=team)
        print(f"[HTTP] Goal -> {team} @ {url}")
        r = requests.get(url, timeout=2)
        r.raise_for_status()
        print(f"[HTTP] Goal sent ({r.status_code})")
    except Exception as e:
        print(f"[ERROR] send_goal: {e}")

def send_undetected_notice(team):
    try:
        url = HTTP_NOTICE_URL.format(team=team)
        print(f"[HTTP] Undetected -> {team} @ {url}")
        r = requests.get(url, timeout=2)
        r.raise_for_status()
        print(f"[HTTP] Notice sent ({r.status_code})")
    except Exception as e:
        print(f"[ERROR] send_notice: {e}")

def raw_distance(trig, echo):
    GPIO.output(trig, False)
    time.sleep(0.05)
    GPIO.output(trig, True)
    time.sleep(0.00001)
    GPIO.output(trig, False)
    start = time.time()
    timeout = start + 0.04
    while GPIO.input(echo) == 0 and time.time() < timeout:
        start = time.time()
    while GPIO.input(echo) == 1 and time.time() < timeout:
        end = time.time()
    else:
        end = time.time()
    return round((end - start) * 17150, 2)

def measure_distance(trig, echo):
    samples = [raw_distance(trig, echo) for _ in range(5)]
    samples.sort()
    dist = samples[2]  # Median value
    return dist if 0 < dist < 100 else 999

# === MQTT Setup ===
mqtt_client = mqtt.Client(client_id="air_hockey_pi", clean_session=False)

def on_connect(client, userdata, flags, rc):
    print(f"[MQTT] Connected (rc={rc})")
    client.subscribe("game/status", qos=1)

def on_message(client, userdata, msg):
    global status, reset_pending
    new = msg.payload.decode().strip()
    print(f"[MQTT] status -> {new}")
    if new != status and new in ("in progress", "ended"):
        status = new
        reset_pending = True

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message
mqtt_client.connect(BACKEND_IP, MQTT_PORT, 60)
mqtt_client.loop_start()

# === Clean Exit ===
def clean_exit():
    GPIO.cleanup()
    print("[SYSTEM] GPIO cleaned")

atexit.register(clean_exit)

# === BLE-UART Handler ===
def handle_uart(src, data):
    text = data.decode().strip()
    if text.startswith("ACC:"):
        _, player, xyz = text.split(":", 2)
        ax, ay, az = map(int, xyz.split(","))
        print(f"[ACC] Player {player}: X={ax}, Y={ay}, Z={az}")
        mqtt_client.publish(f"game/acc/{player}", f"{ax},{ay},{az}")
    elif text.startswith(("SCORE", "DISPLAY", "WIN")):
        print(f"[{src} UART] {text}")

# === Main Loop ===
async def run():
    global reset_pending, score_A, score_B
    global puck_locked_A, puck_locked_B, is_flashing, game_over
    global last_goal_time_A, last_goal_time_B, last_notice_time_A, last_notice_time_B

    async with BleakClient(MAC_A) as cA, BleakClient(MAC_B) as cB:
        await cA.start_notify(UART_RX_UUID, lambda _, d: handle_uart("A", d))
        await cB.start_notify(UART_RX_UUID, lambda _, d: handle_uart("B", d))
        print("[BLE] Connected to A & B")

        while True:
            now = time.time()

            # Reset on status transitions
            if status == "ended" and reset_pending:
                print("[RESET] Game ended -> clearing all")
                score_A = score_B = 0
                puck_locked_A = puck_locked_B = False
                is_flashing = game_over = False
                await cA.write_gatt_char(UART_TX_UUID, b"RESET\n")
                await cB.write_gatt_char(UART_TX_UUID, b"RESET\n")
                await asyncio.sleep(0.1)
                await cA.write_gatt_char(UART_TX_UUID, b"DISPLAY:0\n")
                await cB.write_gatt_char(UART_TX_UUID, b"DISPLAY:0\n")
                reset_pending = False
                await asyncio.sleep(0.2)
                continue

            if status == "in progress" and reset_pending:
                print("[RESET] Game start -> zeroing sensors")
                score_A = score_B = 0
                puck_locked_A = puck_locked_B = False
                is_flashing = game_over = False
                await cA.write_gatt_char(UART_TX_UUID, b"RESET\n")
                await cB.write_gatt_char(UART_TX_UUID, b"RESET\n")
                await asyncio.sleep(0.1)
                await cA.write_gatt_char(UART_TX_UUID, b"DISPLAY:0\n")
                await cB.write_gatt_char(UART_TX_UUID, b"DISPLAY:0\n")
                reset_pending = False

            # Only process goals during active play
            if status != "in progress" or is_flashing or game_over:
                await asyncio.sleep(0.1)
                continue

            # Distance measurements with debug
            distA = measure_distance(TRIG_A, ECHO_A)
            distB = measure_distance(TRIG_B, ECHO_B)
            print(f"[DIST] A={distA:.1f}cm | B={distB:.1f}cm")

            # Undetected puck notices
            if distA < GOAL_THRESHOLD_CM and (now - last_goal_time_A) > GOAL_COOLDOWN:
                if (now - last_notice_time_A) > UNDETECTED_NOTICE_DELAY:
                    print("[NOTICE] Puck at A's goal undetected")
                    send_undetected_notice('A')
                    last_notice_time_A = now
            if distB < GOAL_THRESHOLD_CM and (now - last_goal_time_B) > GOAL_COOLDOWN:
                if (now - last_notice_time_B) > UNDETECTED_NOTICE_DELAY:
                    print("[NOTICE] Puck at B's goal undetected")
                    send_undetected_notice('B')
                    last_notice_time_B = now

      # Team B scores at A sensor
            if distA < GOAL_THRESHOLD_CM and not puck_locked_A and (now - last_goal_time_A) > GOAL_COOLDOWN:
                puck_locked_A = True
                last_goal_time_A = now
                is_flashing = True
                score_B += 1
                print(f"[GOAL] B scored: {score_A}-{score_B}")
                send_goal('B')
                await cB.write_gatt_char(UART_TX_UUID, f"SCORE:{score_B}\n".encode())
                await cA.write_gatt_char(UART_TX_UUID, b"SLEEP\n")
                await asyncio.sleep(2)
                if score_B >= GAME_WIN_SCORE:
                    await cA.write_gatt_char(UART_TX_UUID, b"WIN_B\n")
                    await cB.write_gatt_char(UART_TX_UUID, b"WIN_B\n")
                    game_over = True
                    print("[GAME] B wins, resetting soon")
                    await asyncio.sleep(RESET_WAIT_SECONDS)
                else:
                    await cA.write_gatt_char(UART_TX_UUID, f"DISPLAY:{score_A}\n".encode())
                is_flashing = False
            elif distA > GOAL_THRESHOLD_CM + UNLOCK_MARGIN_CM:
                puck_locked_A = False

            # Team A scores at B sensor
            if distB < GOAL_THRESHOLD_CM and not puck_locked_B and (now - last_goal_time_B) > GOAL_COOLDOWN:
                puck_locked_B = True
                last_goal_time_B = now
                is_flashing = True
                score_A += 1
                print(f"[GOAL] A scored: {score_A}-{score_B}")
                send_goal('A')
                await cA.write_gatt_char(UART_TX_UUID, f"SCORE:{score_A}\n".encode())
                await cB.write_gatt_char(UART_TX_UUID, b"SLEEP\n")
                await asyncio.sleep(2)
                if score_A >= GAME_WIN_SCORE:
                    await cA.write_gatt_char(UART_TX_UUID, b"WIN_A\n")
                    await cB.write_gatt_char(UART_TX_UUID, b"WIN_A\n")
                    game_over = True
                    print("[GAME] A wins, resetting soon")
                    await asyncio.sleep(RESET_WAIT_SECONDS)
                else:
                    await cB.write_gatt_char(UART_TX_UUID, f"DISPLAY:{score_B}\n".encode())
                is_flashing = False
            elif distB > GOAL_THRESHOLD_CM + UNLOCK_MARGIN_CM:
                puck_locked_B = False

            await asyncio.sleep(0.2)

# === Entrypoint ===
if __name__ == '__main__':
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("[SYSTEM] Interrupted by user.")
