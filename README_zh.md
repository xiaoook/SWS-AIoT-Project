# SWS-AIoT-Project – 智能空气曲棍球 AIoT 系统
🌍 [English](./README.md) | **简体中文**

本仓库包含由 **NUS SOC SWS 2025 AIoT Group 7** 实现的，一个完整的 **智能空气曲棍球训练与分析 AIoT 系统** 的全栈代码。

系统集成了：
- **IoT 硬件层**：超声波传感器、micro:bit、树莓派（Raspberry Pi）
- **后端服务**：Flask + Socket.IO + MQTT + SQLite
- **AI 计算机视觉与分析**：球 / 球杆追踪、胜率预测、回合与整场比赛分析
- **Web 前端**：实时记分牌、比赛控制界面、可视化分析面板

端到端数据流概览：

> 传感器 & micro:bit → 树莓派 → MQTT / HTTP → 后端 ↔ AI 服务 ↔ 前端

---

## 1. 仓库结构

- `Backend/` – Flask 后端，包含 REST API、WebSocket（Socket.IO）、MQTT 集成以及 SQLite 数据库
  - `app.py` – 后端主程序入口
  - `config.py` – 后端服务地址 / 端口与 MQTT Broker 配置
  - `core/dataManage.py` – 数据库访问层（比赛、回合、球员等）
  - `route/analysis.py` – AI 回合 / 比赛分析结果相关接口
- `Frontend/` – Web 前端界面，用于比赛控制、实时比分和分析展示
  - `index.html` – 前端主页面
  - `js/*.js` – 比赛控制、历史记录、分析、报告生成、WebSocket 客户端等逻辑
  - `styles/*.css` – 页面样式与响应式布局
  - `F_README.md`、`WEBSOCKET_README.md`、`BACKEND_WEBSOCKET_INTEGRATION.md` – 前端与 WebSocket 的详细说明
- `ai/` – AI 与计算机视觉处理流水线
  - `main.py` – 实时追踪 + 胜率预测 + MQTT / HTTP 集成
  - `cv.py`、`camera_tracking.py`、`hand.py` – 球与球杆追踪相关工具
  - `rule_based_report.py`、`predictor.py`、`random_forest.py`、`XGBoost.py`、`ml.py` – 分析与预测逻辑
  - `goal_events.json`、`analysis_game_0.json` – 示例分析输出
  - `ai_readme.md` – AI 模块补充说明
- `IoT/`
  - `pi_goal_system.py` – 运行在树莓派上的脚本，用于超声波进球检测、micro:bit BLE 通信与后端集成
- `air_hockey_api.json` – API 描述 / 参考

---

## 2. 系统组件说明

### 2.1 IoT 硬件层

1. **传感器**
   - 2 个 **超声波传感器** 安装在两侧球门后方，用于检测冰球是否越过球门线。

2. **微控制器**
   - **BBC micro:bit** 开发板用于显示当前比分，并在胜利时播放动画效果。

3. **雾 / 边缘计算节点**
   - **树莓派 4B** 运行 `IoT/pi_goal_system.py`，负责：
     - 通过 GPIO 读取超声波传感器距离
     - 通过 **BLE UART**（`bleak`）与 micro:bit 通信
     - 检测进球、在本地更新比分，并通过 **HTTP** 与 **MQTT** 将事件发送给后端

### 2.2 后端服务（Backend）

`Backend/` 目录下的后端基于 **Flask**、**Flask-SocketIO** 与 **Flask-MQTT** 构建。

主要职责：
- 提供 REST API：
  - 创建 / 选择 / 删除 比赛与回合
  - 管理球员信息
  - 接收 AI 回合级与比赛级分析结果
- 在内存中维护 **当前比赛状态**（当前比赛、当前回合、当前比分）
- 使用 **SQLite** 持久化数据（参见 `Backend/core/dataManage.py` 与 `Backend/data/data.db`）
- 作为通信枢纽：
  - 订阅 / 发布 **MQTT 主题**：`game/status`、`game/info`、`game/goal`、`game/positions`、`game/predictions`
  - 通过 **Socket.IO 事件** 推送到前端：`score_update`、`position_update`、`win_rate_prediction`

后端入口：
- `Backend/app.py`（通过 `python app.py` 启动）
- 网络配置在 `Backend/config.py` 中设置（`BACKEND_URL`、`BACKEND_PORT`、`BROKER_URL`、`BROKER_PORT`）。

### 2.3 AI / 计算机视觉组件（AI / CV）

`ai/` 目录下的 AI 服务负责实时视频分析与比赛过程的智能分析：

- **实时追踪（CV）**
  - 使用摄像头画面（或视频文件）追踪冰球和双方球杆。
  - 计算位置 $(x, y)$、速度和运动方向等特征。
  - 将归一化后的位置数据发布到 MQTT 主题 `game/positions`，供后端和前端使用。

- **胜率预测（ML）**
  - `RealTimePredictor` 聚合近期的特征（冰球与球杆运动、速度等）。
  - 将预测结果发布到 `game/predictions`（例如 A/B 双方的胜率）。

- **失分分析与技术洞察**
  - `rule_based_report.py`、`analyze_recent_round`、`analyze_recent_game` 用于总结常见错误和薄弱环节。
  - 分析结果通过 HTTP POST 回传给后端（分析接口），并以 JSON 的形式持久化。

主流程脚本：
- `ai/main.py`
  - 订阅 MQTT 主题：`game/goal`、`game/status`、`game/info`
  - 使用 `CameraTracker` 逐帧处理视频
  - 将位置信息和预测结果通过 MQTT 与 HTTP 发送回后端

> 更底层的实现细节可参考 `ai/ai_readme.md`。

### 2.4 Web 前端界面（Frontend）

`Frontend/` 目录下的 Web 应用是一个基于 **HTML + CSS + 原生 JavaScript** 的静态前端。

核心能力：
- 启动 / 暂停 / 结束 比赛
- 实时显示 **比分** 与 **回合历史**
- 展示 **冰球 / 球杆实时位置** 与 **胜率预测**
- 查看 AI 生成的 **回合分析** 与 **整场比赛总结报告**
- 管理 **球员信息**（可选：通过 WebSocket 直连数据库）

关键文件：
- `Frontend/index.html` – 主控制与展示面板
- `Frontend/js/app.js`、`gameControl.js`、`gameHistory.js`、`analysis.js`、`report.js`、`websocket.js` 等 – 前端业务逻辑
- `Frontend/styles/*.css` – 布局与样式、图表样式、响应式适配

更多关于 UI/UX 与 WebSocket 的说明，请参考：
- `Frontend/F_README.md`
- `Frontend/WEBSOCKET_README.md`
- `Frontend/BACKEND_WEBSOCKET_INTEGRATION.md`

---

## 3. 快速开始

### 3.1 环境准备

- 推荐 **Python 3.10+**（用于后端与 AI 模块）
- 一台具备 GPIO 的 **树莓派**（用于运行 `IoT/pi_goal_system.py`）
- 带 UART/BLE 固件的 **micro:bit** 开发板
- 一台用于拍摄球台上方的 **摄像头**（USB 摄像头或其他）

Python 依赖（高层概览）：
- 后端：见 `Backend/requirements.txt`（Flask、Flask-SocketIO、Flask-MQTT、eventlet 等）
- AI：通常需要 `opencv-python`、`numpy`、`mediapipe`、`paho-mqtt`、`requests` 以及你选择的 ML 库（如 PyTorch / scikit-learn），按需安装
- IoT（树莓派侧）：`paho-mqtt`、`bleak`、`RPi.GPIO`、`requests`

> 请确保 `Backend/config.py`、`ai/main.py`、`IoT/pi_goal_system.py` 中设置的 IP 地址与端口在你的网络环境下保持一致。

---

## 4. 运行整个系统

通常需要同时运行 **四个部分**：

1. 后端服务（Backend）
2. AI / CV 服务（ai）
3. 树莓派 IoT 进球检测系统（IoT）
4. Web 前端（浏览器界面）

### 4.1 启动后端（Backend）

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

python app.py
```

后端将监听 `Backend/config.py` 中配置的 `BACKEND_URL:BACKEND_PORT`（默认 `0.0.0.0:3000`）。

### 4.2 启动 AI / CV 服务（ai）

在带摄像头的机器上打开新的终端：

```bash
cd ai
python -m venv .venv
source .venv/bin/activate
pip install opencv-python numpy mediapipe paho-mqtt requests  # 以及所需的 ML 库

python main.py
```

如有需要，可在 `ai/main.py` 中配置视频源（摄像头编号或视频路径）与 MQTT Broker 的 IP / 端口。

### 4.3 启动树莓派 IoT 进球系统（IoT）

在连接了传感器与 micro:bit 的树莓派上：

```bash
cd IoT
python -m venv .venv
source .venv/bin/activate
pip install paho-mqtt bleak RPi.GPIO requests

python pi_goal_system.py
```

根据实际硬件连接情况，在 `IoT/pi_goal_system.py` 中调整 GPIO 引脚、BLE MAC 地址以及后端 IP / 端口配置。

### 4.4 启动 Web 前端（Frontend）

前端为静态页面，可用多种方式提供服务。下面以 Python 内置 HTTP Server 为例：

```bash
cd Frontend
python -m http.server 8000
```

然后在浏览器中访问：

- `http://localhost:8000/index.html`

你也可以在 VS Code 中使用 **Live Server** 插件直接打开 `index.html`。

---

## 5. 典型使用流程

1. **启动后端**：运行 `Backend/app.py`。
2. **启动 AI 服务**：运行 `ai/main.py`，开始通过 MQTT 发布位置信息与胜率预测。
3. **启动树莓派 IoT 系统**：运行 `IoT/pi_goal_system.py`，开始检测进球并更新比分。
4. **打开前端页面**：
   - 创建 / 选择球员并开始一场新比赛
   - 实时查看比分与胜率预测
   - 比赛结束后查看 AI 生成的回合分析和整场比赛总结报告。

---

## 6. 备注与更多文档

- 前端行为、快捷键、报告生成与 WebSocket 细节：
  - `Frontend/F_README.md`
  - `Frontend/WEBSOCKET_README.md`
  - `Frontend/BACKEND_WEBSOCKET_INTEGRATION.md`
- AI 内部逻辑与事件日志：
  - `ai/ai_readme.md`
  - `ai/goal_events.json` 及其他 JSON 示例
- 后端 API 参考：
  - `air_hockey_api.json`

你可以根据自己的部署环境进一步调整 IP / 端口配置、模型选择和前端交互行为，以更好地集成到真实场景中。