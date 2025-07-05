// Video Replay Manager
class ReplayManager {
    constructor() {
        this.videoPlayer = null;
        this.currentRound = null;
        this.rounds = [];
        this.currentVideoTime = 0;
        this.feedbackTimeline = [];
        
        this.init();
    }
    
    init() {
        this.setupVideoPlayer();
        this.setupRoundSelector();
        this.setupEventListeners();
        this.refreshReplays();
    }
    
    setupVideoPlayer() {
        this.videoPlayer = document.getElementById('replayVideo');
        if (!this.videoPlayer) return;
        
        // Set video player events
        this.videoPlayer.addEventListener('loadedmetadata', () => {
            this.onVideoLoaded();
        });
        
        this.videoPlayer.addEventListener('timeupdate', () => {
            this.onVideoTimeUpdate();
        });
        
        this.videoPlayer.addEventListener('ended', () => {
            this.onVideoEnded();
        });
        
        this.videoPlayer.addEventListener('error', (e) => {
            this.onVideoError(e);
        });
        
        // Set default placeholder video
        this.setupPlaceholderVideo();
    }
    
    setupPlaceholderVideo() {
        // Create placeholder video canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');
        
        // Draw placeholder content
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#667eea';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Air Hockey Replay Video', canvas.width / 2, canvas.height / 2 - 30);
        
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.fillText('Select a round to view match video', canvas.width / 2, canvas.height / 2 + 10);
        
        // Create a simple animated ball
        this.animatePlaceholder(ctx, canvas);
    }
    
    animatePlaceholder(ctx, canvas) {
        let ballX = 100;
        let ballY = 200;
        let ballVx = 3;
        let ballVy = 2;
        
        const animate = () => {
            // Clear canvas
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw text
            ctx.fillStyle = '#667eea';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Air Hockey Replay Video', canvas.width / 2, canvas.height / 2 - 30);
            
            ctx.fillStyle = '#999';
            ctx.font = '16px Arial';
            ctx.fillText('Select a round to view match video', canvas.width / 2, canvas.height / 2 + 10);
            
            // Draw moving ball
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Update ball position
            ballX += ballVx;
            ballY += ballVy;
            
            // Boundary detection
            if (ballX <= 10 || ballX >= canvas.width - 10) ballVx *= -1;
            if (ballY <= 10 || ballY >= canvas.height - 10) ballVy *= -1;
            
            // Convert to video source
            const dataURL = canvas.toDataURL();
            this.videoPlayer.poster = dataURL;
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    setupRoundSelector() {
        const selector = document.getElementById('roundSelector');
        if (!selector) return;
        
        selector.innerHTML = '<div class="no-rounds">No round data available</div>';
    }
    
    setupEventListeners() {
        // Listen for game state changes
        document.addEventListener('gameStateChange', () => {
            this.refreshReplays();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch (e.key) {
                case 'ArrowLeft':
                    if (this.videoPlayer) {
                        this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - 10);
                    }
                    break;
                case 'ArrowRight':
                    if (this.videoPlayer) {
                        this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + 10);
                    }
                    break;
                case ' ':
                    if (e.target.closest('.replay-container')) {
                        e.preventDefault();
                        this.togglePlayPause();
                    }
                    break;
            }
        });
    }
    
    refreshReplays() {
        if (window.smartCourtApp && window.smartCourtApp.gameState) {
            this.rounds = [...window.smartCourtApp.gameState.rounds];
            this.updateRoundSelector();
        }
    }
    
    updateRoundSelector() {
        const selector = document.getElementById('roundSelector');
        if (!selector) return;
        
        if (this.rounds.length === 0) {
            selector.innerHTML = '<div class="no-rounds">No round data available</div>';
            return;
        }
        
        const roundsHTML = this.rounds.map(round => 
            `<button class="round-btn" data-round-id="${round.id}">
                Round ${round.id}
            </button>`
        ).join('');
        
        selector.innerHTML = roundsHTML;
        
        // Add click events
        selector.querySelectorAll('.round-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roundId = parseInt(e.target.dataset.roundId);
                this.selectRound(roundId);
            });
        });
    }
    
    selectRound(roundId) {
        const round = this.rounds.find(r => r.id === roundId);
        if (!round) return;
        
        this.currentRound = round;
        
        // Update button state
        document.querySelectorAll('.round-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.roundId) === roundId) {
                btn.classList.add('active');
            }
        });
        
        // Load video
        this.loadRoundVideo(round);
        
        // Display AI feedback
        this.displayAIFeedback(round);
    }
    
    loadRoundVideo(round) {
        // In a real application, this should load actual video files
        // For now we create simulated video content
        this.createMockVideo(round);
    }
    
    createMockVideo(round) {
        // Create simulated video content
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 450;
        const ctx = canvas.getContext('2d');
        
        // Draw game scene
        this.drawGameScene(ctx, canvas, round);
        
        // Set video poster
        this.videoPlayer.poster = canvas.toDataURL();
        
        // Simulate video duration
        this.videoPlayer.addEventListener('loadedmetadata', () => {
            // Simulate 5 seconds video duration
            Object.defineProperty(this.videoPlayer, 'duration', {
                value: 5,
                writable: false
            });
        });
        
        // Create timeline markers
        this.createTimelineMarkers(round);
    }
    
    drawGameScene(ctx, canvas, round) {
        // Draw background
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw table
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
        
        // Draw center line
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 50);
        ctx.lineTo(canvas.width / 2, canvas.height - 50);
        ctx.stroke();
        
        // Draw goals
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(45, canvas.height / 2 - 50, 10, 100);
        ctx.fillRect(canvas.width - 55, canvas.height / 2 - 50, 10, 100);
        
        // Draw ball
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw round information
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Round ${round.id}`, canvas.width / 2, 30);
        
        ctx.font = '16px Arial';
        const winnerText = round.winner === 'playerA' ? 'Player A Scored' : 'Player B Scored';
        ctx.fillText(winnerText, canvas.width / 2, canvas.height - 20);
        
        // Draw score
        ctx.font = '24px Arial';
        ctx.fillText(`${round.playerAScore} - ${round.playerBScore}`, canvas.width / 2, canvas.height - 60);
    }
    
    createTimelineMarkers(round) {
        // Create timeline markers for AI feedback synchronization
        this.feedbackTimeline = [];
        
        if (round.analysis) {
            // Add feedback markers at different time points
            this.feedbackTimeline.push({
                time: 1.0,
                type: 'analysis',
                content: `Overall Assessment: ${round.analysis.feedback}`
            });
            
            if (round.analysis.errorType) {
                this.feedbackTimeline.push({
                    time: 2.5,
                    type: 'error',
                    content: `Needs Improvement: ${round.analysis.errorType}`
                });
            }
            
            if (round.analysis.suggestions && round.analysis.suggestions.length > 0) {
                this.feedbackTimeline.push({
                    time: 4.0,
                    type: 'suggestion',
                    content: `Suggestions: ${round.analysis.suggestions.join(', ')}`
                });
            }
        }
    }
    
    displayAIFeedback(round) {
        const feedbackContainer = document.getElementById('aiFeedback');
        if (!feedbackContainer) return;
        
        if (!round.analysis) {
            feedbackContainer.innerHTML = `
                <div class="feedback-item">
                    <div class="feedback-header">
                        <span class="round-number">Round ${round.id}</span>
                    </div>
                    <div class="feedback-content">No AI analysis data available</div>
                </div>
            `;
            return;
        }
        
        const analysis = round.analysis;
        feedbackContainer.innerHTML = `
            <div class="feedback-item">
                <div class="feedback-header">
                    <span class="round-number">Round ${round.id}</span>
                    <span class="feedback-time">${this.formatTime(round.timestamp)}</span>
                </div>
                <div class="feedback-content">
                    <div class="feedback-main">
                        <strong>Overall Assessment:</strong>
                        <p>${analysis.feedback}</p>
                    </div>
                    
                    ${analysis.errorType ? `
                        <div class="feedback-error">
                            <strong>Needs Improvement:</strong>
                            <p>${analysis.errorType}</p>
                        </div>
                    ` : ''}
                    
                    ${analysis.suggestions && analysis.suggestions.length > 0 ? `
                        <div class="feedback-suggestions">
                            <strong>Improvement Suggestions:</strong>
                            <ul>
                                ${analysis.suggestions.map(s => `<li>${s}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="feedback-score">
                        <strong>Technical Score:</strong>
                        <span class="score-value">${this.calculateScore(analysis)}/10</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    calculateScore(analysis) {
        // Simple scoring algorithm
        let score = 7;
        if (analysis.feedback.includes('excellent')) score += 2;
        if (analysis.feedback.includes('good')) score += 1;
        if (analysis.feedback.includes('standard')) score += 1;
        if (analysis.errorType) score -= 1;
        return Math.max(1, Math.min(10, score));
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    onVideoLoaded() {
        // Handle video loading completion
        console.log('Video loading complete');
        this.updateProgressBar();
    }
    
    onVideoTimeUpdate() {
        this.currentVideoTime = this.videoPlayer.currentTime;
        this.updateProgressBar();
        this.checkFeedbackTimeline();
    }
    
    onVideoEnded() {
        // Video playback ended
        console.log('Video playback ended');
        this.showVideoEndMessage();
    }
    
    onVideoError(error) {
        console.error('Video playback error:', error);
        this.showErrorMessage('Video playback error, please check network connection');
    }
    
    updateProgressBar() {
        // Update progress bar (if available)
        const progress = this.videoPlayer.currentTime / this.videoPlayer.duration * 100;
        const progressBar = document.querySelector('.video-progress');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
    
    checkFeedbackTimeline() {
        // Check if feedback time points are reached
        this.feedbackTimeline.forEach(marker => {
            if (Math.abs(this.currentVideoTime - marker.time) < 0.1) {
                this.showTimedFeedback(marker);
            }
        });
    }
    
    showTimedFeedback(marker) {
        // Display timed feedback
        const notification = document.createElement('div');
        notification.className = `feedback-notification ${marker.type}`;
        notification.textContent = marker.content;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 1rem 2rem;
            border-radius: 10px;
            z-index: 1000;
            animation: fadeInOut 3s ease-in-out;
        `;
        
        document.body.appendChild(notification);
        
        // Add CSS animation
        if (!document.getElementById('feedbackAnimations')) {
            const style = document.createElement('style');
            style.id = 'feedbackAnimations';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    showVideoEndMessage() {
        const message = document.createElement('div');
        message.className = 'video-end-message';
        message.innerHTML = `
            <div class="end-message-content">
                <h3>回放结束</h3>
                <p>是否要重新播放或选择其他回合？</p>
                <div class="end-message-buttons">
                    <button class="btn btn-primary" onclick="this.parentElement.parentElement.parentElement.remove(); window.replayManager.replayVideo();">重新播放</button>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove();">关闭</button>
                </div>
            </div>
        `;
        message.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const content = message.querySelector('.end-message-content');
        content.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 15px;
            text-align: center;
            max-width: 400px;
        `;
        
        document.body.appendChild(message);
    }
    
    showErrorMessage(message) {
        if (window.smartCourtApp) {
            window.smartCourtApp.showMessage(message, 'error');
        }
    }
    
    togglePlayPause() {
        if (!this.videoPlayer) return;
        
        if (this.videoPlayer.paused) {
            this.videoPlayer.play();
        } else {
            this.videoPlayer.pause();
        }
    }
    
    replayVideo() {
        if (!this.videoPlayer) return;
        
        this.videoPlayer.currentTime = 0;
        this.videoPlayer.play();
    }
    
            // Export replay data
    exportReplayData() {
        const exportData = {
            rounds: this.rounds,
            currentRound: this.currentRound,
            feedbackTimeline: this.feedbackTimeline,
            exportTime: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `replay_data_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        if (window.smartCourtApp) {
            window.smartCourtApp.showMessage('Replay data exported successfully', 'success');
        }
    }
    
            // Create replay control panel
    createReplayControls() {
        const container = document.querySelector('.replay-container');
        if (!container) return;
        
        const controls = document.createElement('div');
        controls.className = 'replay-controls-panel';
        controls.innerHTML = `
            <div class="replay-control-buttons">
                <button class="control-btn" onclick="window.replayManager.replayVideo();">⏪ 重播</button>
                <button class="control-btn" onclick="window.replayManager.togglePlayPause();">⏯️ 播放/暂停</button>
                <button class="control-btn" onclick="window.replayManager.skipForward();">⏩ 快进</button>
                <button class="control-btn" onclick="window.replayManager.toggleFullscreen();">🔍 全屏</button>
            </div>
            <div class="replay-progress">
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div class="time-display">
                    <span class="current-time">00:00</span>
                    <span class="total-time">00:00</span>
                </div>
            </div>
        `;
        
        container.appendChild(controls);
        
        // 添加控制面板样式
        this.addControlsStyles();
    }
    
    addControlsStyles() {
        if (document.getElementById('replayControlsStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'replayControlsStyles';
        style.textContent = `
            .replay-controls-panel {
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 1rem;
                border-radius: 10px;
                margin-top: 1rem;
            }
            
            .replay-control-buttons {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 1rem;
            }
            
            .control-btn {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.3s;
            }
            
            .control-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .replay-progress {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .progress-bar {
                flex: 1;
                height: 6px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: #667eea;
                width: 0%;
                transition: width 0.1s;
            }
            
            .time-display {
                font-size: 0.9rem;
                display: flex;
                gap: 0.5rem;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    skipForward() {
        if (this.videoPlayer) {
            this.videoPlayer.currentTime = Math.min(
                this.videoPlayer.duration, 
                this.videoPlayer.currentTime + 10
            );
        }
    }
    
    toggleFullscreen() {
        if (this.videoPlayer) {
            if (this.videoPlayer.requestFullscreen) {
                this.videoPlayer.requestFullscreen();
            } else if (this.videoPlayer.webkitRequestFullscreen) {
                this.videoPlayer.webkitRequestFullscreen();
            } else if (this.videoPlayer.msRequestFullscreen) {
                this.videoPlayer.msRequestFullscreen();
            }
        }
    }
}

// 初始化回放管理器
document.addEventListener('DOMContentLoaded', () => {
    window.replayManager = new ReplayManager();
    
    // 延迟创建控制面板，确保DOM完全加载
    setTimeout(() => {
        window.replayManager.createReplayControls();
    }, 1000);
}); 