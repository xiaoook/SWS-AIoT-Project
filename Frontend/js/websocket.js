// WebSocket Manager for Real-time Score Updates
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.serverUrl = 'ws://localhost:5001'; // WebSocket服务器地址
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 3秒重连延迟
        this.callbacks = {
            onScoreUpdate: null,
            onGameStatus: null,
            onRoundUpdate: null,
            onConnectionStatus: null
        };
        
        this.init();
    }
    
    init() {
        // 添加Socket.IO客户端库
        this.loadSocketIOClient();
    }
    
    loadSocketIOClient() {
        // 检查是否已加载Socket.IO
        if (typeof io !== 'undefined') {
            this.connect();
            return;
        }
        
        // 动态加载Socket.IO客户端
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
        script.onload = () => {
            console.log('Socket.IO client loaded successfully');
            this.connect();
        };
        script.onerror = () => {
            console.error('Failed to load Socket.IO client');
            this.showConnectionError('Failed to load WebSocket client');
        };
        document.head.appendChild(script);
    }
    
    connect() {
        try {
            console.log('Connecting to WebSocket server...');
            this.socket = io(this.serverUrl);
            
            this.setupEventListeners();
            this.updateConnectionStatus('connecting');
            
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.handleConnectionError();
        }
    }
    
    setupEventListeners() {
        // 连接成功
        this.socket.on('connect', () => {
            console.log('WebSocket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected');
            
            // 请求当前比分
            this.requestCurrentScore();
        });
        
        // 连接断开
        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.attemptReconnect();
        });
        
        // 接收实时比分更新
        this.socket.on('score_update', (current_score) => {
            console.log('Score update received:', scoreData);
            this.handleScoreUpdate(scoreData);
        });
        
        // 接收游戏状态更新
        this.socket.on('game_status', (statusData) => {
            console.log('Game status update:', statusData);
            this.handleGameStatus(statusData);
        });
        
        // 接收回合更新
        this.socket.on('round_update', (roundData) => {
            console.log('Round update received:', roundData);
            this.handleRoundUpdate(roundData);
        });
        
        // 连接错误
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.handleConnectionError();
        });
        
        // 服务器消息
        this.socket.on('message', (message) => {
            console.log('Server message:', message);
            this.showMessage(message, 'info');
        });
    }
    
    // 请求当前比分
    requestCurrentScore() {
        if (this.isConnected) {
            this.socket.emit('request_score');
        }
    }
    
    // 处理比分更新
    handleScoreUpdate(scoreData) {
        // 更新UI中的比分显示
        this.updateScoreDisplay(scoreData);
        
        // 调用回调函数
        if (this.callbacks.onScoreUpdate) {
            this.callbacks.onScoreUpdate(scoreData);
        }
        
        // 显示比分更新消息
        const message = `Score Update: ${scoreData.home || scoreData.playerA || 0} - ${scoreData.away || scoreData.playerB || 0}`;
        this.showMessage(message, 'score');
    }
    
    // 处理游戏状态更新
    handleGameStatus(statusData) {
        if (this.callbacks.onGameStatus) {
            this.callbacks.onGameStatus(statusData);
        }
        
        // 更新游戏状态显示
        const statusElement = document.getElementById('gameStatus');
        if (statusElement) {
            statusElement.textContent = statusData.status || 'Unknown';
        }
    }
    
    // 处理回合更新
    handleRoundUpdate(roundData) {
        if (this.callbacks.onRoundUpdate) {
            this.callbacks.onRoundUpdate(roundData);
        }
        
        // 添加到实时feed
        const winner = roundData.winner === 'playerA' ? 'A' : 'B';
        const message = `Round ${roundData.round}: Player ${winner} scored! Current: ${roundData.playerAScore}-${roundData.playerBScore}`;
        this.addLiveFeedItem(message, 'score');
    }
    
    // 更新比分显示
    updateScoreDisplay(scoreData) {
        // 兼容不同的比分数据格式
        const playerAScore = scoreData.playerA || scoreData.home || 0;
        const playerBScore = scoreData.playerB || scoreData.away || 0;
        
        // 更新计分板
        const scoreAElement = document.getElementById('scoreA');
        const scoreBElement = document.getElementById('scoreB');
        
        if (scoreAElement) {
            scoreAElement.textContent = playerAScore;
            // 添加动画效果
            scoreAElement.classList.add('score-updated');
            setTimeout(() => scoreAElement.classList.remove('score-updated'), 500);
        }
        
        if (scoreBElement) {
            scoreBElement.textContent = playerBScore;
            // 添加动画效果
            scoreBElement.classList.add('score-updated');
            setTimeout(() => scoreBElement.classList.remove('score-updated'), 500);
        }
        
        // 更新应用状态
        if (window.app && window.app.gameState) {
            window.app.gameState.scores = {
                playerA: playerAScore,
                playerB: playerBScore
            };
        }
    }
    
    // 连接状态更新
    updateConnectionStatus(status) {
        const statusIndicator = document.getElementById('wsStatus');
        if (statusIndicator) {
            statusIndicator.textContent = status;
            statusIndicator.className = `ws-status ${status}`;
        }
        
        if (this.callbacks.onConnectionStatus) {
            this.callbacks.onConnectionStatus(status);
        }
        
        // 根据连接状态更新UI
        this.updateUIConnectionState(status);
    }
    
    // 更新UI连接状态
    updateUIConnectionState(status) {
        const gameControls = document.querySelectorAll('.control-panel button');
        const isConnected = status === 'connected';
        
        gameControls.forEach(button => {
            if (isConnected) {
                button.disabled = false;
                button.classList.remove('disabled');
            } else {
                // 只有在断开连接时禁用特定按钮
                if (button.id === 'startGame') {
                    button.disabled = true;
                    button.classList.add('disabled');
                }
            }
        });
    }
    
    // 处理连接错误
    handleConnectionError() {
        this.isConnected = false;
        this.updateConnectionStatus('error');
        this.attemptReconnect();
    }
    
    // 尝试重新连接
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay);
        } else {
            console.error('Max reconnection attempts reached');
            this.showConnectionError('Unable to connect to game server');
        }
    }
    
    // 显示连接错误
    showConnectionError(message) {
        this.showMessage(`Connection Error: ${message}`, 'error');
    }
    
    // 显示消息
    showMessage(message, type = 'info') {
        if (window.app && window.app.showMessage) {
            window.app.showMessage(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // 添加实时feed项
    addLiveFeedItem(message, type = 'info') {
        if (window.app && window.app.addLiveFeedItem) {
            window.app.addLiveFeedItem(message, type);
        }
    }
    
    // 发送消息到服务器
    sendMessage(eventName, data) {
        if (this.isConnected && this.socket) {
            this.socket.emit(eventName, data);
        } else {
            console.warn('WebSocket not connected. Cannot send message:', eventName, data);
        }
    }
    
    // 模拟进球（用于测试）
    simulateGoal(team) {
        this.sendMessage('goal', { team: team });
    }
    
    // 设置回调函数
    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }
    
    // 断开连接
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
        }
    }
    
    // 获取连接状态
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            serverUrl: this.serverUrl
        };
    }
}

// 创建全局WebSocket管理器实例
window.wsManager = new WebSocketManager();

// 导出WebSocket管理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketManager;
} 