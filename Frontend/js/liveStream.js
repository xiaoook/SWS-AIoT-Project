// Live Stream Manager for Air Hockey System
class LiveStreamManager {
    constructor() {
        this.isConnected = false;
        this.isStreaming = false;
        this.streamUrl = null;
        this.videoElement = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.statsInterval = null;
        this.heartbeatInterval = null;
        this.streamStats = {
            resolution: '--',
            fps: '--',
            bitrate: '--',
            latency: '--'
        };
        
        this.init();
    }
    
    init() {
        this.videoElement = document.getElementById('liveStream');
        this.setupEventListeners();
        this.setupVideoEvents();
        this.loadSettings();
        this.updateUI();
    }
    
    setupEventListeners() {
        // 连接按钮
        document.getElementById('connectStream')?.addEventListener('click', () => {
            this.connect();
        });
        
        // 断开按钮
        document.getElementById('disconnectStream')?.addEventListener('click', () => {
            this.disconnect();
        });
        
        // 全屏按钮
        document.getElementById('fullscreenStream')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // 设置变更监听
        document.getElementById('streamQuality')?.addEventListener('change', (e) => {
            this.changeQuality(e.target.value);
        });
        
        document.getElementById('autoReconnect')?.addEventListener('change', (e) => {
            this.settings.autoReconnect = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('audioEnabled')?.addEventListener('change', (e) => {
            this.toggleAudio(e.target.checked);
        });
        
        // IP和端口输入框变更
        document.getElementById('cameraIp')?.addEventListener('change', (e) => {
            this.settings.cameraIp = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('cameraPort')?.addEventListener('change', (e) => {
            this.settings.cameraPort = parseInt(e.target.value);
            this.saveSettings();
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // 窗口关闭时断开连接
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });
    }
    
    setupVideoEvents() {
        if (!this.videoElement) return;
        
        this.videoElement.addEventListener('loadstart', () => {
            this.updateStatus('connecting', 'Connecting to stream...');
            this.showPlaceholder(false);
        });
        
        this.videoElement.addEventListener('loadedmetadata', () => {
            this.updateStreamStats();
            this.startStatsMonitoring();
        });
        
        this.videoElement.addEventListener('canplay', () => {
            this.updateStatus('online', 'Stream Connected');
            this.isStreaming = true;
            this.reconnectAttempts = 0;
            this.showPlaceholder(false);
            this.enableControls(true);
            this.showMessage('📺 直播连接成功！', 'success');
        });
        
        this.videoElement.addEventListener('error', (e) => {
            console.error('Video error:', e);
            this.handleStreamError('Stream error occurred');
        });
        
        this.videoElement.addEventListener('ended', () => {
            this.handleStreamEnd();
        });
        
        this.videoElement.addEventListener('pause', () => {
            if (this.isStreaming) {
                this.updateStatus('connecting', 'Stream Paused');
            }
        });
        
        this.videoElement.addEventListener('play', () => {
            if (this.isStreaming) {
                this.updateStatus('online', 'Stream Active');
            }
        });
    }
    
    async connect() {
        if (this.isConnected) return;
        
        const ip = document.getElementById('cameraIp')?.value || '192.168.1.100';
        const port = document.getElementById('cameraPort')?.value || '8000';
        
        try {
            this.updateStatus('connecting', 'Connecting to camera...');
            this.showPlaceholder(true, 'connecting');
            
            // 构建流URL - 支持多种协议
            const streamUrls = [
                `http://${ip}:${port}/stream.mjpg`,  // MJPEG stream
                `http://${ip}:${port}/video`,        // Generic video endpoint
                `http://${ip}:${port}/stream`,       // Generic stream endpoint
                `http://${ip}:${port}/stream.mp4`,   // MP4 stream
                `ws://${ip}:${port}/stream`          // WebSocket stream
            ];
            
            // 尝试连接不同的流URL
            for (const url of streamUrls) {
                try {
                    await this.tryConnectToStream(url);
                    break;
                } catch (error) {
                    console.log(`Failed to connect to ${url}:`, error.message);
                    continue;
                }
            }
            
            // 如果所有URL都失败，显示错误
            if (!this.isConnected) {
                throw new Error('Unable to connect to camera stream');
            }
            
        } catch (error) {
            console.error('Connection error:', error);
            this.handleConnectionError(error.message);
        }
    }
    
    async tryConnectToStream(url) {
        return new Promise((resolve, reject) => {
            const testVideo = document.createElement('video');
            testVideo.crossOrigin = 'anonymous';
            testVideo.autoplay = true;
            testVideo.muted = true;
            
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 5000);
            
            testVideo.onloadedmetadata = () => {
                clearTimeout(timeout);
                this.streamUrl = url;
                this.isConnected = true;
                this.startStream();
                resolve();
            };
            
            testVideo.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Stream not accessible'));
            };
            
            testVideo.src = url;
        });
    }
    
    startStream() {
        if (!this.videoElement || !this.streamUrl) return;
        
        this.videoElement.src = this.streamUrl;
        this.videoElement.play().catch(error => {
            console.error('Play failed:', error);
            this.handleStreamError('Failed to start video playback');
        });
        
        this.startHeartbeat();
    }
    
    disconnect() {
        if (!this.isConnected) return;
        
        this.isConnected = false;
        this.isStreaming = false;
        this.streamUrl = null;
        
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
            this.videoElement.load();
        }
        
        this.stopStatsMonitoring();
        this.stopHeartbeat();
        this.updateStatus('offline', 'Stream Disconnected');
        this.showPlaceholder(true, 'disconnected');
        this.enableControls(false);
        this.showMessage('📺 直播已断开连接', 'info');
    }
    
    toggleFullscreen() {
        if (!this.isStreaming) return;
        
        const streamScreen = document.querySelector('.stream-screen');
        if (!streamScreen) return;
        
        if (streamScreen.classList.contains('stream-fullscreen')) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    }
    
    enterFullscreen() {
        const streamScreen = document.querySelector('.stream-screen');
        if (!streamScreen) return;
        
        streamScreen.classList.add('stream-fullscreen');
        document.body.style.overflow = 'hidden';
        
        // 全屏快捷键提示
        setTimeout(() => {
            this.showMessage('按 ESC 键退出全屏', 'info');
        }, 1000);
    }
    
    exitFullscreen() {
        const streamScreen = document.querySelector('.stream-screen');
        if (!streamScreen) return;
        
        streamScreen.classList.remove('stream-fullscreen');
        document.body.style.overflow = '';
    }
    
    changeQuality(quality) {
        if (!this.isStreaming) return;
        
        const qualityMap = {
            'high': '720p',
            'medium': '480p',
            'low': '360p'
        };
        
        // 这里可以向树莓派发送质量变更请求
        console.log(`Quality changed to: ${qualityMap[quality]}`);
        this.showMessage(`画质已切换到 ${qualityMap[quality]}`, 'info');
    }
    
    toggleAudio(enabled) {
        if (this.videoElement) {
            this.videoElement.muted = !enabled;
            this.showMessage(enabled ? '🔊 音频已开启' : '🔇 音频已关闭', 'info');
        }
    }
    
    handleConnectionError(message) {
        this.updateStatus('offline', 'Connection Failed');
        this.showPlaceholder(true, 'error');
        this.showMessage(`❌ 连接失败: ${message}`, 'error');
        
        // 自动重连
        if (this.settings.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }
    
    handleStreamError(message) {
        this.updateStatus('offline', 'Stream Error');
        this.showPlaceholder(true, 'error');
        this.showMessage(`❌ 流媒体错误: ${message}`, 'error');
        
        this.isStreaming = false;
        this.stopStatsMonitoring();
        
        // 自动重连
        if (this.settings.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }
    
    handleStreamEnd() {
        this.updateStatus('offline', 'Stream Ended');
        this.showPlaceholder(true, 'disconnected');
        this.isStreaming = false;
        this.stopStatsMonitoring();
        
        this.showMessage('📺 直播流已结束', 'info');
        
        // 自动重连
        if (this.settings.autoReconnect) {
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        
        this.showMessage(`🔄 ${delay/1000}秒后尝试重新连接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'info');
        
        setTimeout(() => {
            if (this.settings.autoReconnect && this.reconnectAttempts <= this.maxReconnectAttempts) {
                this.connect();
            }
        }, delay);
    }
    
    updateStatus(status, message) {
        const statusIndicator = document.querySelector('.stream-status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (statusIndicator) {
            statusIndicator.className = `stream-status-indicator ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = message;
        }
    }
    
    showPlaceholder(show, type = 'disconnected') {
        const placeholder = document.getElementById('streamPlaceholder');
        if (!placeholder) return;
        
        if (show) {
            placeholder.classList.remove('hidden');
            placeholder.className = `stream-placeholder stream-${type}`;
        } else {
            placeholder.classList.add('hidden');
        }
    }
    
    enableControls(enabled) {
        const disconnectBtn = document.getElementById('disconnectStream');
        const fullscreenBtn = document.getElementById('fullscreenStream');
        
        if (disconnectBtn) {
            disconnectBtn.disabled = !enabled;
        }
        
        if (fullscreenBtn) {
            fullscreenBtn.disabled = !enabled;
        }
    }
    
    startStatsMonitoring() {
        this.statsInterval = setInterval(() => {
            this.updateStreamStats();
        }, 1000);
    }
    
    stopStatsMonitoring() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
        
        // 重置统计数据
        this.streamStats = {
            resolution: '--',
            fps: '--',
            bitrate: '--',
            latency: '--'
        };
        this.updateStatsDisplay();
    }
    
    updateStreamStats() {
        if (!this.videoElement || !this.isStreaming) return;
        
        // 获取视频分辨率
        if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
            this.streamStats.resolution = `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`;
        }
        
        // 模拟其他统计数据（实际应用中应该从流媒体服务获取）
        this.streamStats.fps = this.calculateFPS();
        this.streamStats.bitrate = this.estimateBitrate();
        this.streamStats.latency = this.calculateLatency();
        
        this.updateStatsDisplay();
    }
    
    calculateFPS() {
        // 简单的FPS计算，实际应用中需要更精确的方法
        return Math.floor(Math.random() * 5) + 25 + 'fps';
    }
    
    estimateBitrate() {
        // 估算比特率
        const qualities = {
            'high': '2.5 Mbps',
            'medium': '1.5 Mbps',
            'low': '0.8 Mbps'
        };
        
        const quality = document.getElementById('streamQuality')?.value || 'medium';
        return qualities[quality] || '1.5 Mbps';
    }
    
    calculateLatency() {
        // 模拟延迟计算
        return Math.floor(Math.random() * 100) + 50 + 'ms';
    }
    
    updateStatsDisplay() {
        document.getElementById('streamResolution').textContent = this.streamStats.resolution;
        document.getElementById('streamFps').textContent = this.streamStats.fps;
        document.getElementById('streamBitrate').textContent = this.streamStats.bitrate;
        document.getElementById('streamLatency').textContent = this.streamStats.latency;
    }
    
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 5000);
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    sendHeartbeat() {
        if (!this.isConnected || !this.streamUrl) return;
        
        // 发送心跳包检查连接状态
        fetch(this.streamUrl.replace('/stream', '/heartbeat'))
            .then(response => {
                if (!response.ok) {
                    throw new Error('Heartbeat failed');
                }
            })
            .catch(error => {
                console.warn('Heartbeat failed:', error);
                // 可以在这里处理连接丢失的情况
            });
    }
    
    handleKeyboardShortcuts(e) {
        if (e.target.tagName === 'INPUT') return;
        
        switch (e.key) {
            case 'f':
            case 'F':
                if (this.isStreaming) {
                    e.preventDefault();
                    this.toggleFullscreen();
                }
                break;
            case 'Escape':
                if (document.querySelector('.stream-fullscreen')) {
                    e.preventDefault();
                    this.exitFullscreen();
                }
                break;
            case 'c':
            case 'C':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (this.isConnected) {
                        this.disconnect();
                    } else {
                        this.connect();
                    }
                }
                break;
        }
    }
    
    loadSettings() {
        const saved = localStorage.getItem('liveStreamSettings');
        this.settings = saved ? JSON.parse(saved) : {
            cameraIp: '192.168.1.100',
            cameraPort: 8000,
            quality: 'medium',
            autoReconnect: true,
            audioEnabled: false
        };
        
        // 应用设置到UI
        document.getElementById('cameraIp').value = this.settings.cameraIp;
        document.getElementById('cameraPort').value = this.settings.cameraPort;
        document.getElementById('streamQuality').value = this.settings.quality;
        document.getElementById('autoReconnect').checked = this.settings.autoReconnect;
        document.getElementById('audioEnabled').checked = this.settings.audioEnabled;
    }
    
    saveSettings() {
        localStorage.setItem('liveStreamSettings', JSON.stringify(this.settings));
    }
    
    updateUI() {
        this.updateStatus('offline', 'Stream Offline');
        this.showPlaceholder(true, 'disconnected');
        this.enableControls(false);
        this.updateStatsDisplay();
    }
    
    // 显示消息提示
    showMessage(message, type = 'info') {
        // 使用主应用的消息系统
        if (window.smartCourtApp) {
            window.smartCourtApp.showMessage(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // 获取连接状态
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            isStreaming: this.isStreaming,
            streamUrl: this.streamUrl,
            stats: this.streamStats
        };
    }
    
    // 销毁管理器
    destroy() {
        this.disconnect();
        this.stopStatsMonitoring();
        this.stopHeartbeat();
        
        // 清理事件监听器
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        window.removeEventListener('beforeunload', this.disconnect);
    }
}

// 初始化直播管理器
document.addEventListener('DOMContentLoaded', () => {
    window.liveStreamManager = new LiveStreamManager();
    
    // 添加到主应用中
    if (window.smartCourtApp) {
        window.smartCourtApp.liveStreamManager = window.liveStreamManager;
    }
    
    console.log('✅ Live Stream Manager initialized');
});

// 导出类供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveStreamManager;
} 