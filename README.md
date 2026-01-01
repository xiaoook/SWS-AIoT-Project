# SWS-AIoT-Project – Smart Air Hockey AIoT System
🌍 **English** | [简体中文](./README_zh.md)

This repository contains the full-stack implementation of an **AIoT air hockey training and analysis system** built by **AIoT Group 7, NUS SOC SWS 2025**.

The system integrates:
- **IoT hardware** (ultrasonic sensors, micro:bit, Raspberry Pi)
- **Backend server** (Flask + Socket.IO + MQTT + SQLite)
- **AI computer vision & analytics** (puck / pusher tracking, win prediction, round & game analysis)
- **Web frontend** (real‑time scoreboard, game control, analytics UI)

End‑to‑end flow:

> Sensors & micro:bit → Raspberry Pi → MQTT / HTTP → Backend ↔ AI service ↔ Frontend

---

## 1. Repository Structure

- `Backend/` – Flask backend with REST APIs, WebSocket (Socket.IO), MQTT integration and SQLite database
  - `app.py` – main backend application
  - `config.py` – backend host/port and MQTT broker configuration
  - `core/dataManage.py` – database access (games, rounds, players, etc.)
  - `route/analysis.py` – endpoints for AI round / game analysis results
- `Frontend/` – web UI for game control, live scores and analysis
  - `index.html` – main page
  - `js/*.js` – game control, history, analysis, report, WebSocket client, etc.
  - `styles/*.css` – styling and responsive layout
  - `F_README.md`, `WEBSOCKET_README.md`, `BACKEND_WEBSOCKET_INTEGRATION.md` – detailed frontend and WebSocket notes
- `ai/` – AI & computer‑vision pipeline
  - `main.py` – real‑time tracking + win‑rate prediction + MQTT / HTTP integration
  - `cv.py`, `camera_tracking.py`, `hand.py` – puck and pusher tracking utilities
  - `rule_based_report.py`, `predictor.py`, `random_forest.py`, `XGBoost.py`, `ml.py` – analysis and prediction logic
  - `goal_events.json`, `analysis_game_0.json` – example analysis outputs
  - `ai_readme.md` – additional notes for the AI component
- `IoT/`
  - `pi_goal_system.py` – Raspberry Pi script for ultrasonic goal detection, BLE micro:bit communication and backend integration
- `air_hockey_api.json` – API description / reference

---

## 2. System Components

### 2.1 IoT Hardware Layer

1. **Sensors**
   - 2 × **ultrasonic sensors** mounted behind each goal to detect when the puck crosses the line.

2. **Microcontroller**
   - **BBC micro:bit** boards display the current score and show win animations.

3. **Fog / Edge Node**
   - A **Raspberry Pi 4B** runs `IoT/pi_goal_system.py` to:
     - Read distances from ultrasonic sensors via GPIO
     - Communicate with micro:bits over **BLE UART** (via `bleak`)
     - Detect goals, update scores locally and send events to the backend using **HTTP** and **MQTT**

### 2.2 Backend Server

The backend in `Backend/` is built with **Flask**, **Flask‑SocketIO** and **Flask‑MQTT**.

Main responsibilities:
- Expose REST APIs for:
  - Creating / selecting / deleting games and rounds
  - Managing players
  - Receiving AI analysis results (round‑level and game‑level)
- Maintain **game state** in memory (current game, round and score)
- Persist data to **SQLite** (see `Backend/core/dataManage.py` and database at `Backend/data/data.db`)
- Bridge communication via:
  - **MQTT topics**: `game/status`, `game/info`, `game/goal`, `game/positions`, `game/predictions`
  - **Socket.IO events** to the frontend: `score_update`, `position_update`, `win_rate_prediction`

Backend entrypoint:
- `Backend/app.py` (run with `python app.py`)
- Network configuration is controlled by `Backend/config.py` (`BACKEND_URL`, `BACKEND_PORT`, `BROKER_URL`, `BROKER_PORT`).

### 2.3 AI / CV Component

The AI service in `ai/` performs real‑time video analysis and match analytics:

- **Real‑time tracking (CV)**
  - Uses a camera feed (or video file) to track the puck and both pushers.
  - Computes positions $(x, y)$, velocities and movement directions.
  - Publishes normalized positions to MQTT topic `game/positions` for the backend and frontend.

- **Win prediction (ML)**
  - `RealTimePredictor` aggregates recent features (puck + pusher movement, speeds, etc.).
  - Publishes prediction results to `game/predictions` (e.g. win rate for Player A vs Player B).

- **Loss analysis & insights**
  - `rule_based_report.py`, `analyze_recent_round` and `analyze_recent_game` summarize frequent errors and weaknesses.
  - Results are POSTed back to the backend (analysis endpoints) and stored as JSON.

Main process:
- `ai/main.py`
  - Subscribes to MQTT topics (`game/goal`, `game/status`, `game/info`)
  - Uses `CameraTracker` to process each frame
  - Sends position and prediction updates back via MQTT and HTTP

> See `ai/ai_readme.md` for lower‑level implementation details.

### 2.4 Frontend Web UI

The web app in `Frontend/` is a static **HTML + CSS + JavaScript** interface.

Key capabilities:
- Start / pause / end games
- Display real‑time **scores** and **round history**
- Show **live puck / pusher positions** and **win‑rate predictions**
- View AI‑generated **round analysis** and **game summary reports**
- Manage **players** (with optional WebSocket‑based DB integration)

Relevant files:
- `Frontend/index.html` – main dashboard
- `Frontend/js/app.js`, `gameControl.js`, `gameHistory.js`, `analysis.js`, `report.js`, `websocket.js`, etc.
- `Frontend/styles/*.css` – layout, charts and responsive design

For more UI/UX and WebSocket details, refer to:
- `Frontend/F_README.md`
- `Frontend/WEBSOCKET_README.md`
- `Frontend/BACKEND_WEBSOCKET_INTEGRATION.md`

---

## 3. Getting Started

### 3.1 Prerequisites

- **Python** 3.10 or later (recommended for backend & AI)
- **Raspberry Pi** with GPIO access (for `IoT/pi_goal_system.py`)
- **micro:bit** boards with UART firmware for BLE communication
- **Camera** (USB camera or overhead camera) for CV tracking

Python packages (high‑level):
- Backend: see `Backend/requirements.txt` (Flask, Flask‑SocketIO, Flask‑MQTT, eventlet, etc.)
- AI: typically needs `opencv-python`, `numpy`, `mediapipe`, `paho-mqtt`, `requests` and your ML libraries (e.g. PyTorch / scikit‑learn). Install as required.
- IoT (Raspberry Pi): `paho-mqtt`, `bleak`, `RPi.GPIO`, `requests`.

> Make sure IP addresses and ports in `Backend/config.py`, `ai/main.py` and `IoT/pi_goal_system.py` are consistent with your network.

---

## 4. Running the System

You typically run **three main processes**:

1. Backend server
2. AI / CV service
3. Raspberry Pi IoT goal system
4. Frontend (browser UI)

### 4.1 Start the Backend

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt

python app.py
```

The backend will start on `BACKEND_URL:BACKEND_PORT` as defined in `Backend/config.py` (default `0.0.0.0:3000`).

### 4.2 Start the AI / CV Service

In a separate terminal on the machine with the camera:

```bash
cd ai
python -m venv .venv
source .venv/bin/activate
pip install opencv-python numpy mediapipe paho-mqtt requests  # plus ML libs as needed

python main.py
```

Configure the video source and MQTT broker in `ai/main.py` (e.g. camera index, broker IP/port) if required.

### 4.3 Start the IoT Goal System (Raspberry Pi)

On the Raspberry Pi that connects to sensors and micro:bits:

```bash
cd IoT
python -m venv .venv
source .venv/bin/activate
pip install paho-mqtt bleak RPi.GPIO requests

python pi_goal_system.py
```

Adjust GPIO pins, BLE MAC addresses, and backend IP/ports in `IoT/pi_goal_system.py` to match your hardware setup.

### 4.4 Start the Frontend

The frontend is static and can be served in multiple ways. Example using Python’s built‑in HTTP server:

```bash
cd Frontend
python -m http.server 8000
```

Then open in your browser:

- `http://localhost:8000/index.html`

Alternatively, you can use VS Code **Live Server** to host `index.html` directly.

---

## 5. Typical Workflow

1. **Start backend** (`Backend/app.py`).
2. **Start AI service** (`ai/main.py`) so it begins publishing positions and predictions via MQTT.
3. **Start Raspberry Pi goal system** (`IoT/pi_goal_system.py`) to detect goals and update scores.
4. **Open the frontend** and:
   - Create/select players and start a new game
   - Watch real‑time scores and win‑rate predictions
   - At the end of the game, view AI analysis and summary reports.

---

## 6. Notes & Further Documentation

- Frontend behavior, keyboard shortcuts, report generation and WebSocket details:
  - `Frontend/F_README.md`
  - `Frontend/WEBSOCKET_README.md`
  - `Frontend/BACKEND_WEBSOCKET_INTEGRATION.md`
- AI internals and event logging:
  - `ai/ai_readme.md`
  - `ai/goal_events.json` and other JSON examples
- Backend API reference:
  - `air_hockey_api.json`

Feel free to refine IP/port configuration, model selection and UI behavior as you integrate the system into your own environment.
