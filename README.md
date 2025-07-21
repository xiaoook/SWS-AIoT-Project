# SWS-AIoT-Project
This is the repository of AIoT Group7, NUS SOC SWS 2025.

## Description of Proposed Solution
### IoT Hardware Prototype
#### 1. Sensors
- **Ultrasonic Sensors** x 2: Ultrasonic sensors for detecting if the puck crosses the goal line.

#### 2. Microcontroller
- A **micro:bit** board is used to show the score.

#### 3. Fog Processor
- A **Raspberry Pi 4B** serves as the local edge computing node. It aggregates sensor data and performs goal detection

### AI Machine Learning Component
The AI component includes:
- **Real-Tracking (CV)**: Tracks the puck and pushers using the overhead camera. Calculates:
  - Position (x,y)
  - Velocity (speed & direction)
- **Win Prediction (ML)**:
  - Predicts win probability using: current score, time left, player stats, and real-time puck/pusher momentum data.
- **Loss Analysis & Insights (ML)**: 
  - Identifies root causes of lost points (e.g., "Slow Reaction - Right", "Weak Defense - Top Corner") by analyzing puck/pusher trace during critical moments.
  - Generates match summaries highlighting frequent errors, vulnerable zones, and key weaknesses.

### Software Engingeering Part
#### Backend System
- Developed using **Python Flask** providing RESTful APIs.
- Stores IoT sensor data, video metadata, player information, and AI analysis results.
Includes **SQLite** to manage structured data such as match records, score logs, and user profiles.
- Runs the Machine Learning program, collecting data from the microcontrollers.

#### Frontend System
- Developed using **HTML + CSS + JS**
- A web application is developed for users to:
  - Start or stop a match
  - View live scores (streamed from microcontroller input)
  - View end-of-match reports including:
    - Mistakes made
    - Repetition frequency
    - Suggested improvements
    - Final score with player name + winner status

#### Summary
**The whole system works as follow:**
Sensors -> Raspberry Pi -> Backend <-> Frontend
