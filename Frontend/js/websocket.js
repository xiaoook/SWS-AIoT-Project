// WebSocket Manager for Real-time Score Updates
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.serverUrl = 'http://localhost:5001'; // 使用5001端口避免AirTunes冲突
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
        
        // 动态加载Socket.IO客户端 - 使用v4兼容版本
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.0.0/socket.io.min.js';
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
        // 直接尝试Socket.IO连接，避免CORS问题
        try {
            console.log('Connecting to WebSocket server...');
            // 使用兼容的Socket.IO v4配置
            this.socket = io(this.serverUrl, {
                transports: ['polling', 'websocket'],
                upgrade: true,
                timeout: 10000,
                forceNew: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 3000,
                autoConnect: true
            });
            
            this.setupEventListeners();
            this.updateConnectionStatus('connecting');
            
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.handleConnectionError();
        }
    }
    
    // 删除了checkServerAvailable方法 - 避免CORS问题
    // Socket.IO会自己处理连接检查
    
    setupEventListeners() {
        // 连接成功
        this.socket.on('connect', () => {
            console.log('WebSocket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected');
        });
        
        // 连接断开
        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.attemptReconnect();
        });
        
        // 接收实时比分更新 - 匹配后端格式
        this.socket.on('score_update', (current_score) => {
            console.log('Score update received:', current_score);
            this.handleScoreUpdate(current_score);
        });
        
        // 连接错误
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            console.error('Error details:', error.message, error.description, error.context);
            this.handleConnectionError();
        });
        
        // 重连失败
        this.socket.on('reconnect_failed', () => {
            console.error('WebSocket reconnection failed');
            this.updateConnectionStatus('error');
            this.showConnectionError('Failed to reconnect to server');
        });
        
        // 重连尝试
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`WebSocket reconnect attempt #${attemptNumber}`);
            this.updateConnectionStatus('connecting');
        });
        
        // 详细的连接事件处理
        this.socket.on('connect_error', (error) => {
            console.error('Connection error details:', error);
            this.addLiveFeedItem(`Connection failed: ${error.message || 'Unknown error'}`, 'error');
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected after ${attemptNumber} attempts`);
            this.addLiveFeedItem('🔄 Reconnected successfully!', 'success');
        });
        
        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.addLiveFeedItem(`Socket error: ${error}`, 'error');
        });
        
        // 服务器消息
        this.socket.on('message', (message) => {
            console.log('Server message:', message);
            this.showMessage(message, 'info');
        });
    }
    
    // 处理比分更新 - 适配后端的 {A: 0, B: 0} 格式
    handleScoreUpdate(scoreData) {
        // 后端发送的格式是 {A: 0, B: 0}，需要转换为前端格式
        const convertedScore = {
            playerA: scoreData.A || 0,
            playerB: scoreData.B || 0
        };
        
        // 更新UI中的比分显示
        this.updateScoreDisplay(convertedScore);
        
        // 调用回调函数
        if (this.callbacks.onScoreUpdate) {
            this.callbacks.onScoreUpdate(convertedScore);
        }
        
        // 不再显示通用的比分更新消息，只在进球时显示特定消息
        // const message = `Score Update: ${convertedScore.playerA} - ${convertedScore.playerB}`;
        // this.showMessage(message, 'score');
    }
    
    // 更新比分显示
    updateScoreDisplay(scoreData) {
        const playerAScore = scoreData.playerA || 0;
        const playerBScore = scoreData.playerB || 0;
        
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
        if (window.smartCourtApp && window.smartCourtApp.gameState) {
            window.smartCourtApp.gameState.scores = {
                playerA: playerAScore,
                playerB: playerBScore
            };
            
            // 更新UI
            window.smartCourtApp.updateScoreboard();
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
        if (window.smartCourtApp && window.smartCourtApp.showMessage) {
            window.smartCourtApp.showMessage(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // 添加实时feed项
    addLiveFeedItem(message, type = 'info') {
        if (window.smartCourtApp && window.smartCourtApp.addLiveFeedItem) {
            window.smartCourtApp.addLiveFeedItem(message, type);
        }
    }
    
    // 发送进球到后端 - 避免CORS问题，使用本地分数管理
    simulateGoal(team) {
        // 后端期望的是 'A' 或 'B' 而不是 'playerA' 或 'playerB'
        const backendTeam = team === 'playerA' ? 'A' : 'B';
        
        // 直接在本地更新分数，避免CORS问题
        const localScore = {
            A: 0,
            B: 0
        };
        
        // 从当前显示的分数获取状态
        const scoreAElement = document.getElementById('scoreA');
        const scoreBElement = document.getElementById('scoreB');
        
        if (scoreAElement && scoreBElement) {
            localScore.A = parseInt(scoreAElement.textContent) || 0;
            localScore.B = parseInt(scoreBElement.textContent) || 0;
        }
        
        // 更新对应队伍的分数
        localScore[backendTeam] += 1;
        
        // 手动触发分数更新
        this.handleScoreUpdate(localScore);
        
        // 显示成功消息
        this.showMessage(`Goal scored by ${team}! Score: ${localScore.A} - ${localScore.B}`, 'success');
        
        console.log(`Local score updated: Team ${backendTeam}, Score:`, localScore);
        
        // 如果WebSocket连接正常，尝试通知后端（可选）
        if (this.socket && this.socket.connected) {
            // 可以在这里发送WebSocket消息给后端，但不依赖它
            this.socket.emit('goal', { team: backendTeam });
            console.log(`Goal notification sent to backend for team ${backendTeam}`);
        }
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