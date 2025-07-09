# 🏒 Air Hockey Assistant - WebSocket 实时比分功能

## 概述

这个WebSocket功能为Air Hockey Assistant提供了实时比分更新能力，当传感器检测到进球时，比分会自动更新并推送到所有连接的前端客户端。

## 功能特性

✅ **实时比分更新** - 传感器检测到进球时立即更新比分  
✅ **自动重连机制** - 连接断开时自动尝试重连  
✅ **连接状态指示** - 实时显示连接状态（连接中/已连接/断开/错误）  
✅ **比分动画效果** - 比分更新时的视觉反馈  
✅ **回合记录** - 每个进球都会记录回合信息  
✅ **游戏状态同步** - 多个客户端间的状态同步  

## 快速开始

### 1. 安装后端依赖

```bash
cd Backend
pip install -r requirements.txt
```

### 2. 启动WebSocket服务器

```bash
cd Backend
python websocket_server.py
```

服务器将在 `http://localhost:5000` 启动，WebSocket连接地址为 `ws://localhost:5000`

### 3. 打开前端页面

在浏览器中打开 `Frontend/index.html`，你会看到：

- 🟢 **Connected** - 成功连接到服务器
- 🟡 **Connecting** - 正在连接中
- 🔴 **Disconnected** - 连接断开
- 🟣 **Error** - 连接错误

## 使用方法

### 前端界面

1. **连接状态指示器**
   - 位于游戏控制面板的右上角
   - 实时显示WebSocket连接状态

2. **测试按钮**
   - **Player A Goal** - 模拟Player A进球
   - **Player B Goal** - 模拟Player B进球  
   - **Check Connection** - 检查连接状态

3. **实时比分显示**
   - 比分更新时会有动画效果
   - 实时Feed会显示进球信息

### 后端API

#### HTTP接口

```bash
# 模拟Player A进球
curl "http://localhost:5000/goal?team=playerA"

# 模拟Player B进球
curl "http://localhost:5000/goal?team=playerB"

# 查看当前状态
curl "http://localhost:5000/status"

# 重置游戏
curl "http://localhost:5000/reset"
```

#### WebSocket事件

**客户端发送：**
- `goal` - 进球事件：`{team: 'playerA'}`
- `request_score` - 请求当前比分
- `start_game` - 开始游戏
- `pause_game` - 暂停游戏
- `end_game` - 结束游戏

**服务器发送：**
- `score_update` - 比分更新：`{playerA: 2, playerB: 1}`
- `round_update` - 回合更新：`{round: 3, winner: 'playerA', ...}`
- `game_status` - 游戏状态：`{status: 'playing'}`
- `message` - 服务器消息

## 传感器集成

要集成真实的传感器，你需要：

### 1. 硬件传感器（例如：树莓派 + GPIO）

```python
import requests
import RPi.GPIO as GPIO
import time

# 设置GPIO引脚
GOAL_PIN_A = 17  # Player A进球传感器
GOAL_PIN_B = 18  # Player B进球传感器

GPIO.setmode(GPIO.BCM)
GPIO.setup(GOAL_PIN_A, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
GPIO.setup(GOAL_PIN_B, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

def detect_goal():
    while True:
        # 检测Player A进球
        if GPIO.input(GOAL_PIN_A) == GPIO.HIGH:
            requests.get('http://localhost:5000/goal?team=playerA')
            time.sleep(1)  # 防抖
        
        # 检测Player B进球
        if GPIO.input(GOAL_PIN_B) == GPIO.HIGH:
            requests.get('http://localhost:5000/goal?team=playerB')
            time.sleep(1)  # 防抖
        
        time.sleep(0.1)

if __name__ == '__main__':
    detect_goal()
```

### 2. 红外传感器

```python
import requests
import serial
import time

# 串口连接
ser = serial.Serial('/dev/ttyUSB0', 9600)

def read_sensor():
    while True:
        if ser.in_waiting > 0:
            data = ser.readline().decode('utf-8').strip()
            
            if data == 'GOAL_A':
                requests.get('http://localhost:5000/goal?team=playerA')
            elif data == 'GOAL_B':
                requests.get('http://localhost:5000/goal?team=playerB')
        
        time.sleep(0.1)

if __name__ == '__main__':
    read_sensor()
```

### 3. 摄像头 + AI检测

```python
import cv2
import requests
import numpy as np

def detect_goal_with_cv():
    cap = cv2.VideoCapture(0)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # 使用YOLO或其他算法检测进球
        # 这里是伪代码，需要根据实际情况实现
        if detect_ball_in_goal_area_a(frame):
            requests.get('http://localhost:5000/goal?team=playerA')
        elif detect_ball_in_goal_area_b(frame):
            requests.get('http://localhost:5000/goal?team=playerB')
        
        cv2.imshow('Air Hockey Detection', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    detect_goal_with_cv()
```

## 配置选项

### 前端配置

在 `Frontend/js/websocket.js` 中可以修改：

```javascript
this.serverUrl = 'ws://localhost:5000'; // WebSocket服务器地址
this.maxReconnectAttempts = 5; // 最大重连次数
this.reconnectDelay = 3000; // 重连延迟（毫秒）
```

### 后端配置

在 `Backend/websocket_server.py` 中可以修改：

```python
# 服务器端口
socketio.run(app, port=5000)

# CORS设置
CORS(app, origins=['http://localhost:3000', 'http://127.0.0.1:3000'])

# 游戏获胜分数
WINNING_SCORE = 7
```

## 故障排除

### 常见问题

1. **连接失败**
   - 检查后端服务器是否启动
   - 确认端口5000未被占用
   - 检查防火墙设置

2. **自动重连不工作**
   - 检查浏览器控制台是否有错误
   - 确认WebSocket URL正确
   - 检查网络连接

3. **比分不更新**
   - 检查Socket.IO版本兼容性
   - 确认事件监听器正确设置
   - 查看服务器日志

### 调试技巧

1. **浏览器控制台**
   ```javascript
   // 检查WebSocket连接状态
   console.log(window.wsManager.getConnectionStatus());
   
   // 手动发送测试消息
   window.wsManager.sendMessage('goal', {team: 'playerA'});
   ```

2. **服务器日志**
   ```bash
   # 查看详细日志
   python websocket_server.py
   ```

3. **网络调试**
   ```bash
   # 测试HTTP接口
   curl -v http://localhost:5000/status
   
   # 测试WebSocket连接
   npm install -g wscat
   wscat -c ws://localhost:5000
   ```

## 扩展功能

### 1. 多房间支持

```python
# 服务器端
@socketio.on('join_room')
def handle_join_room(data):
    room = data['room']
    join_room(room)
    emit('joined', room=room)

# 前端
socket.emit('join_room', {room: 'game_001'});
```

### 2. 用户认证

```python
# 添加JWT认证
from flask_jwt_extended import JWTManager, verify_jwt_in_request

@socketio.on('connect')
def handle_connect(auth):
    try:
        verify_jwt_in_request()
        emit('authenticated', {'status': 'success'})
    except:
        disconnect()
```

### 3. 数据持久化

```python
# 使用SQLite保存游戏记录
import sqlite3

def save_game_to_db(game_data):
    conn = sqlite3.connect('games.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO games (player_a_score, player_b_score, duration, rounds)
        VALUES (?, ?, ?, ?)
    ''', (game_data['playerA'], game_data['playerB'], 
          game_data['duration'], json.dumps(game_data['rounds'])))
    conn.commit()
    conn.close()
```

## 部署到生产环境

### 1. 使用Gunicorn + Nginx

```bash
# 安装Gunicorn
pip install gunicorn

# 启动服务器
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 websocket_server:app
```

### 2. Docker部署

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", 
     "--bind", "0.0.0.0:5000", "websocket_server:app"]
```

### 3. 环境变量配置

```python
import os

# 配置
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
PORT = int(os.getenv('PORT', 5000))
CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')
```

---

## 技术支持

如果你在使用过程中遇到问题，请：

1. 查看浏览器控制台错误
2. 检查服务器日志
3. 确认网络连接
4. 验证依赖版本

更多信息请参考 [Flask-SocketIO官方文档](https://flask-socketio.readthedocs.io/) 