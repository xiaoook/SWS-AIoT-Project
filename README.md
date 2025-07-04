# SWS-AIoT-Project
This is the repository of AIoT Group7, NUS SOC SWS 2025. Please create your own branch when working.

## Description of Proposed Solution
### IoT Hardware Prototype
#### 1. Sensors
- **IR Sensors** x 2: IR sensors for detecting if the puck crosses the goal line. IR sensors are chosen for their faster response time and lower cost, suitable for detecting puck entry events.
- **Touch Sensor**: A touch sensor for starting/ending the match
- **Force Sensor**: Detect the force of pushers hitting the puck

#### Microcontroller
- A **micro:bit** or **ESP32** board is used to interface with the sensors, collect scoring data, and communicate with the fog processor.

#### Actuators
- LEDs and buzzers are used to provide instant visual/auditory feedback during play

#### Fog Processor
- A **Raspberry Pi 4B** serves as the local edge computing node. It aggregates sensor data from the ESP32 and performs real-time processing of the video stream captured by an overhead camera module. This camera is critical for enabling AI-based video analysis.

### AI Machine Learning Component
The AI component includes:
- **Real-Tracking (CV)**: Tracks the puck and pushers using the overhead camera. Calculates:
  - Position (x,y)
  - Velocity (speed & direction)
  - Acceleration
- **Automated Scoring & Win Prediction (ML)**:
  - Validates goals by fusing puck trace with goal sensor triggers.
  - Predicts win probability using: current score, time left, player stats, and real-time puck/pusher momentum data.
- **Loss Analysis & Insights (ML)**: 
  - Identifies root causes of lost points (e.g., "Slow Reaction - Right", "Weak Defense - Top Corner") by analyzing puck/pusher trace during critical moments.
  - Generates match summaries highlighting frequent errors, vulnerable zones, and key weaknesses.

### Software Engingeering Part
#### Backend System
- Developed using **Python Flask** providing RESTful APIs.
- Stores IoT sensor data, video metadata, player information, and AI analysis results.
Includes **MySQL** to manage structured data such as match records, score logs, and user profiles.
- Runs the Machine Learning program, collecting data from the microcontrollers.

#### Frontend System
- Developed using **HTML + CSS + JS**
- A web application is developed for users to:
  - Start or stop a match
  - View live scores (streamed from microcontroller input)
  - Watch segmented replays linked to AI-generated feedback
  - View end-of-match reports including:
    - Mistakes made
    - Repetition frequency
    - Suggested improvements
    - Final score with player name + winner status

#### Summary
**The whole system works as follow:**
Sensors -> ESP32/micro:bit -> Backend <-> Frontend
