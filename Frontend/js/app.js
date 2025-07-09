// Main Application Logic
class SmartCourtApp {
    constructor() {
        this.gameState = {
            status: 'idle', // idle, playing, paused, ended
            startTime: null,
            endTime: null,
            scores: { playerA: 0, playerB: 0 },
            rounds: [],
            currentRound: 0,
            timer: null,
            elapsedTime: 0
        };
        
        // Game history management
        this.gamesHistory = [];
        this.currentGameId = null;
        this.gameCounter = 0;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.initializeComponents();
        this.initializeWebSocket();
        this.showMessage('System initialized, ready to start the game!', 'success');
    }
    
    setupEventListeners() {
        // Navigation tab events
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // WebSocket test button events
        document.getElementById('simulateGoalA')?.addEventListener('click', () => {
            this.simulateGoalA();
        });
        
        document.getElementById('simulateGoalB')?.addEventListener('click', () => {
            this.simulateGoalB();
        });
        
        document.getElementById('checkConnection')?.addEventListener('click', () => {
            this.checkWebSocketConnection();
        });
        
        // Global keyboard events
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardEvents(e);
        });
        
        // Window resize events
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Page visibility change events
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
    }
    
    setupTabNavigation() {
        const tabs = document.querySelectorAll('.tab-content');
        const navBtns = document.querySelectorAll('.nav-btn');
        
        // Activate first tab by default
        if (tabs.length > 0 && navBtns.length > 0) {
            tabs[0].classList.add('active');
            navBtns[0].classList.add('active');
        }
    }
    
    initializeComponents() {
        // Initialize components
        this.updateGameStatus();
        this.updateScoreboard();
        this.updateTimer();
        
        // 清理状态 - 不再生成模拟数据
        // this.generateSampleLossData(); // 已禁用模拟数据
        
        // 系统启动消息
        this.addLiveFeedItem('System ready - Connect sensors to begin scoring!', 'info');
    }
    
    generateSampleLossData() {
        // 已禁用 - 不再生成模拟数据
        // Generate multiple sample games for demonstration
        // this.generateSampleGames();
        
        // Load the most recent game into current game state
        // if (this.gamesHistory.length > 0) {
        //     const mostRecentGame = this.gamesHistory[this.gamesHistory.length - 1];
        //     this.loadGame(mostRecentGame.gameId);
        // }
        console.log('Sample data generation disabled - real data mode');
    }
    
    generateSampleGames() {
        // 已禁用所有模拟游戏数据
        // 系统现在等待真实的传感器输入
        
        // 清空游戏历史，从零开始
        this.gamesHistory = [];
        this.gameCounter = 0;
        
        console.log('Sample games disabled - starting with clean state');
    }
    
    // Game management methods
    loadGame(gameId) {
        const game = this.gamesHistory.find(g => g.gameId === gameId);
        if (!game) return false;
        
        // Load game data into current state
        this.currentGameId = gameId;
        this.gameState.rounds = [...game.rounds];
        this.gameState.currentRound = game.rounds.length;
        this.gameState.scores = { ...game.finalScores };
        this.gameState.status = game.status;
        this.gameState.startTime = game.startTime;
        this.gameState.endTime = game.endTime;
        this.gameState.elapsedTime = game.duration;
        
        // Update UI
        this.updateGameStatus();
        this.updateScoreboard();
        
        // Update analysis manager if available
        if (window.analysisManager) {
            setTimeout(() => {
                window.analysisManager.rounds = [...game.rounds];
                window.analysisManager.displayRounds();
            }, 100);
        }
        
        return true;
    }
    
    saveCurrentGameToHistory() {
        if (!this.currentGameId) {
            // Create new game ID
            this.gameCounter++;
            this.currentGameId = `GAME-${String(this.gameCounter).padStart(3, '0')}`;
        }
        
        // Find existing game or create new one
        let gameIndex = this.gamesHistory.findIndex(g => g.gameId === this.currentGameId);
        const gameData = {
            gameId: this.currentGameId,
            gameType: this.gameState.status === 'ended' ? 'Completed Match' : 'Live Match',
            startTime: this.gameState.startTime,
            endTime: this.gameState.endTime,
            duration: this.gameState.elapsedTime,
            finalScores: { ...this.gameState.scores },
            winner: this.gameState.status === 'ended' ? 
                   (this.gameState.scores.playerA >= 7 ? 'playerA' : 
                    this.gameState.scores.playerB >= 7 ? 'playerB' : null) : null,
            status: this.gameState.status,
            rounds: [...this.gameState.rounds]
        };
        
        if (gameIndex >= 0) {
            // Update existing game
            this.gamesHistory[gameIndex] = gameData;
        } else {
            // Add new game
            this.gamesHistory.push(gameData);
        }
    }
    
    getGamesHistory() {
        return [...this.gamesHistory];
    }
    
    deleteGame(gameId) {
        const index = this.gamesHistory.findIndex(g => g.gameId === gameId);
        if (index >= 0) {
            this.gamesHistory.splice(index, 1);
            return true;
        }
        return false;
    }
    
    switchTab(tabName) {
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active state from all navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Activate selected tab
        const targetTab = document.getElementById(`${tabName}-tab`);
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (targetTab && targetBtn) {
            targetTab.classList.add('active');
            targetBtn.classList.add('active');
            
            // Trigger tab switch event
            this.onTabSwitch(tabName);
        }
    }
    
    onTabSwitch(tabName) {
        // Execute corresponding logic based on switched tab
        switch (tabName) {
            case 'history':
                // Refresh game history data
                if (window.gameHistoryManager) {
                    window.gameHistoryManager.refreshDisplay();
                }
                break;
            case 'analysis':
                // Refresh game analysis data
                if (window.analysisManager) {
                    // Force refresh to get latest games
                    setTimeout(() => {
                        window.analysisManager.refreshAnalysis();
                    }, 100);
                }
                break;
            case 'replay':
                // Refresh replay data
                if (window.replayManager) {
                    window.replayManager.refreshReplays();
                }
                break;
            case 'report':
                // Refresh report data
                if (window.reportManager) {
                    window.reportManager.generateReport();
                }
                break;
        }
    }
    
    handleKeyboardEvents(e) {
        // Keyboard shortcut handling
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    this.switchTab('game');
                    break;
                case '2':
                    e.preventDefault();
                    this.switchTab('history');
                    break;
                case '3':
                    e.preventDefault();
                    this.switchTab('analysis');
                    break;
                case '4':
                    e.preventDefault();
                    this.switchTab('replay');
                    break;
                case '5':
                    e.preventDefault();
                    this.switchTab('report');
                    break;
            }
        }
        
        // Space key controls match
        if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            if (this.gameState.status === 'idle') {
                this.startGame();
            } else if (this.gameState.status === 'playing') {
                this.pauseGame();
            } else if (this.gameState.status === 'paused') {
                this.resumeGame();
            }
        }
    }
    
    handleResize() {
        // Responsive handling
        const isMobile = window.innerWidth <= 767;
        const isTablet = window.innerWidth <= 1023;
        
        // Adjust chart size
        if (window.reportManager && window.reportManager.chart) {
            window.reportManager.chart.resize();
        }
        
        // Adjust video player size
        const videoPlayer = document.getElementById('replayVideo');
        if (videoPlayer) {
            if (isMobile) {
                videoPlayer.style.height = '200px';
            } else if (isTablet) {
                videoPlayer.style.height = '300px';
            } else {
                videoPlayer.style.height = '400px';
            }
        }
    }
    
    handleVisibilityChange() {
        // Handle page visibility changes
        if (document.hidden) {
            // Pause game when page is hidden
            if (this.gameState.status === 'playing') {
                this.pauseGame();
                this.showMessage('Match paused automatically (page hidden)', 'info');
            }
        }
    }
    
    // Game state management
    startGame() {
        // Create new game ID for new game
        this.gameCounter++;
        this.currentGameId = `GAME-${String(this.gameCounter).padStart(3, '0')}`;
        
        this.gameState.status = 'playing';
        this.gameState.startTime = new Date();
        this.gameState.scores = { playerA: 0, playerB: 0 };
        this.gameState.rounds = [];
        this.gameState.currentRound = 0;
        this.gameState.elapsedTime = 0;
        
        this.startTimer();
        this.updateGameStatus();
        this.updateScoreboard();
        this.addLiveFeedItem(`New match started! Game ID: ${this.currentGameId}`, 'score');
        
        // Save initial game state to history
        this.saveCurrentGameToHistory();
        
        // 已禁用自动模拟 - 等待真实传感器输入
        // this.simulateGameplay(); // 自动模拟已禁用
        
        this.showMessage(`New match started! Game ID: ${this.currentGameId} - Waiting for sensor input`, 'success');
    }
    
    pauseGame() {
        this.gameState.status = 'paused';
        this.stopTimer();
        this.updateGameStatus();
        this.addLiveFeedItem('Match paused', 'info');
        this.showMessage('Match paused', 'info');
    }
    
    resumeGame() {
        this.gameState.status = 'playing';
        this.startTimer();
        this.updateGameStatus();
        this.addLiveFeedItem('Match resumed', 'score');
        this.showMessage('Match resumed', 'success');
    }
    
    endGame() {
        this.gameState.status = 'ended';
        this.gameState.endTime = new Date();
        this.stopTimer();
        this.updateGameStatus();
        
        const winner = this.gameState.scores.playerA >= 7 ? 'A' : 
                      this.gameState.scores.playerB >= 7 ? 'B' : 
                      this.gameState.scores.playerA > this.gameState.scores.playerB ? 'A' : 'B';
        
        const finalScore = `${this.gameState.scores.playerA}-${this.gameState.scores.playerB}`;
        this.addLiveFeedItem(`🏆 MATCH ENDED! Player ${winner} wins ${finalScore}! (${this.currentGameId})`, 'score');
        this.showMessage(`🏆 Player ${winner} wins ${finalScore}! Game ${this.currentGameId} completed`, 'success');
        
        // Save final game state to history
        this.saveCurrentGameToHistory();
        
        // Generate final report
        if (window.reportManager) {
            window.reportManager.generateFinalReport();
        }
    }
    
    addScore(player) {
        if (this.gameState.status !== 'playing') return;
        
        // Check if game should end before adding score
        if (this.gameState.scores.playerA >= 7 || this.gameState.scores.playerB >= 7) {
            return; // Game already ended, don't add more scores
        }
        
        this.gameState.scores[player]++;
        this.gameState.currentRound++;
        
        // Create round record
        const round = {
            id: this.gameState.currentRound,
            winner: player,
            timestamp: new Date(),
            playerAScore: this.gameState.scores.playerA,
            playerBScore: this.gameState.scores.playerB,
            analysis: this.generateAIAnalysis()
        };
        
        this.gameState.rounds.push(round);
        
        this.updateScoreboard();
        
        // Check if someone wins with this score
        if (this.gameState.scores.playerA >= 7 || this.gameState.scores.playerB >= 7) {
            const winner = this.gameState.scores.playerA >= 7 ? 'A' : 'B';
            this.addLiveFeedItem(`Player ${player.slice(-1)} scored! GAME OVER! Player ${winner} wins 7-${this.gameState.scores.playerA >= 7 ? this.gameState.scores.playerB : this.gameState.scores.playerA}!`, 'score');
            setTimeout(() => this.endGame(), 1000);
        } else {
            this.addLiveFeedItem(`Player ${player.slice(-1)} scored! Current score: ${this.gameState.scores.playerA} - ${this.gameState.scores.playerB}`, 'score');
        }
        
        // Update analysis
        if (window.analysisManager) {
            window.analysisManager.addRound(round);
        }
        
        // Save updated game state to history
        this.saveCurrentGameToHistory();
    }
    
    generateAIAnalysis() {
        const lossAnalysisTypes = [
            'The defense was broken through due to poor positioning',
            'Reaction speed was insufficient, failed to respond to opponent attacks',
            'Attack angle was poorly chosen, easily countered by opponent',
            'Attention was distracted, missed defensive timing',
            'Technical execution was non-standard, affecting ball control',
            'Defensive strategy was inappropriate, left gaps for opponent',
            'Ball prediction was inaccurate, leading to passive defense',
            'Movement speed was too slow, couldn\'t keep up with ball pace'
        ];
        
        const errorTypes = [
            'Slow reaction',
            'Defensive errors', 
            'Poor attack angle',
            'Attention distraction',
            'Non-standard technical actions'
        ];
        
        const lossPreventionSuggestions = [
            'Strengthen reaction speed training',
            'Improve defensive positioning',
            'Enhance ball trajectory prediction',
            'Strengthen concentration training',
            'Standardize technical movements',
            'Improve movement footwork',
            'Enhance ball control practice',
            'Learn better defensive strategies',
            'Improve body coordination',
            'Strengthen mental pressure training'
        ];
        
                    // 70% probability of generating loss analysis with error type
        const hasError = Math.random() > 0.3;
        
        return {
            feedback: lossAnalysisTypes[Math.floor(Math.random() * lossAnalysisTypes.length)],
            errorType: hasError ? errorTypes[Math.floor(Math.random() * errorTypes.length)] : null,
            suggestions: this.shuffleArray(lossPreventionSuggestions).slice(0, Math.floor(Math.random() * 3) + 2)
        };
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    simulateGameplay() {
        // 自动模拟已禁用 - 系统等待真实的传感器输入
        console.log('Auto-simulation disabled. Waiting for real sensor input via WebSocket.');
        
        // 显示等待传感器的消息
        this.addLiveFeedItem('🎯 Game started - Waiting for sensor detection...', 'info');
        
        // 不再执行任何自动模拟逻辑
        return;
    }
    
    startTimer() {
        this.gameState.timer = setInterval(() => {
            this.gameState.elapsedTime++;
            this.updateTimer();
        }, 1000);
    }
    
    stopTimer() {
        if (this.gameState.timer) {
            clearInterval(this.gameState.timer);
            this.gameState.timer = null;
        }
    }
    
    updateTimer() {
        const minutes = Math.floor(this.gameState.elapsedTime / 60);
        const seconds = this.gameState.elapsedTime % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timerElement = document.getElementById('gameTimer');
        if (timerElement) {
            timerElement.textContent = timeStr;
        }
    }
    
    updateGameStatus() {
        const statusElement = document.getElementById('gameStatus');
        if (statusElement) {
            const statusMap = {
                'idle': 'Not Started',
                'playing': 'In Progress',
                'paused': 'Paused',
                'ended': 'Ended'
            };
            statusElement.textContent = statusMap[this.gameState.status];
        }
    }
    
    updateScoreboard() {
        const scoreAElement = document.getElementById('scoreA');
        const scoreBElement = document.getElementById('scoreB');
        
        if (scoreAElement) {
            scoreAElement.textContent = this.gameState.scores.playerA;
        }
        if (scoreBElement) {
            scoreBElement.textContent = this.gameState.scores.playerB;
        }
    }
    
    addLiveFeedItem(message, type = 'info') {
        const feedContainer = document.getElementById('liveFeed');
        if (!feedContainer) return;
        
        const feedItem = document.createElement('div');
        feedItem.className = `feed-item ${type}`;
        
        // Add appropriate icon based on type
        const icons = {
            'score': '⚽',
            'info': 'ℹ️',
            'error': '❌',
            'success': '✅'
        };
        
        const icon = icons[type] || 'ℹ️';
        const time = new Date().toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        feedItem.innerHTML = `
            <div class="feed-item-icon">${icon}</div>
            <div class="feed-item-content">
                <div class="feed-item-time">${time}</div>
                <div class="feed-item-message">${message}</div>
            </div>
        `;
        
        // Add to top of container
        feedContainer.insertBefore(feedItem, feedContainer.firstChild);
        
        // Limit display count
        const items = feedContainer.querySelectorAll('.feed-item');
        if (items.length > 12) {
            items[items.length - 1].remove();
        }
    }
    
    showMessage(message, type = 'info') {
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        // Add to page
        document.body.appendChild(messageElement);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            messageElement.remove();
        }, 3000);
    }
    
    // Get game state
    getGameState() {
        return { ...this.gameState };
    }
    
    // Reset game
    resetGame() {
        this.stopTimer();
        this.gameState = {
            status: 'idle',
            startTime: null,
            endTime: null,
            scores: { playerA: 0, playerB: 0 },
            rounds: [],
            currentRound: 0,
            timer: null,
            elapsedTime: 0
        };
        
        this.updateGameStatus();
        this.updateScoreboard();
        this.updateTimer();
        
        // Clear live feed
        const feedContainer = document.getElementById('liveFeed');
        if (feedContainer) {
            feedContainer.innerHTML = '';
            this.addLiveFeedItem('System ready. Waiting for game to start...', 'info');
        }
        
        this.showMessage('Game has been reset', 'success');
    }
    
    // Export game data
    exportGameData() {
        return {
            gameState: this.getGameState(),
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
    }
    
    // Import game data
    importGameData(data) {
        try {
            this.gameState = { ...data.gameState };
            this.updateGameStatus();
            this.updateScoreboard();
            this.updateTimer();
            
            // Restore live feed
            if (this.gameState.rounds.length > 0) {
                this.gameState.rounds.forEach(round => {
                    this.addLiveFeedItem(`Round ${round.id}: Player ${round.winner.slice(-1)} scored`, 'score');
                });
            }
            
            this.showMessage('Game data imported successfully', 'success');
        } catch (error) {
            this.showMessage('Import failed: Invalid data format', 'error');
        }
    }
    
    // WebSocket 初始化和回调方法
    initializeWebSocket() {
        if (window.wsManager) {
            // 设置WebSocket回调函数
            window.wsManager.setCallback('onScoreUpdate', (scoreData) => {
                this.handleWebSocketScoreUpdate(scoreData);
            });
            
            window.wsManager.setCallback('onGameStatus', (statusData) => {
                this.handleWebSocketGameStatus(statusData);
            });
            
            window.wsManager.setCallback('onRoundUpdate', (roundData) => {
                this.handleWebSocketRoundUpdate(roundData);
            });
            
            window.wsManager.setCallback('onConnectionStatus', (status) => {
                this.handleWebSocketConnectionStatus(status);
            });
            
            console.log('WebSocket callbacks initialized');
        } else {
            console.warn('WebSocket manager not available');
        }
    }
    
    // 处理WebSocket比分更新
    handleWebSocketScoreUpdate(scoreData) {
        console.log('Handling score update:', scoreData);
        
        // 更新本地游戏状态
        this.gameState.scores = {
            playerA: scoreData.playerA || scoreData.home || 0,
            playerB: scoreData.playerB || scoreData.away || 0
        };
        
        // 更新UI
        this.updateScoreboard();
        
        // 添加实时feed
        const message = `🎯 Score Update: ${this.gameState.scores.playerA} - ${this.gameState.scores.playerB}`;
        this.addLiveFeedItem(message, 'score');
        
        // 检查是否有人获胜
        if (this.gameState.scores.playerA >= 7 || this.gameState.scores.playerB >= 7) {
            const winner = this.gameState.scores.playerA >= 7 ? 'A' : 'B';
            this.addLiveFeedItem(`🏆 GAME OVER! Player ${winner} wins!`, 'success');
            
            // 自动结束游戏
            setTimeout(() => {
                this.gameState.status = 'ended';
                this.gameState.endTime = new Date();
                this.updateGameStatus();
                this.saveCurrentGameToHistory();
            }, 1000);
        }
    }
    
    // 处理WebSocket游戏状态更新
    handleWebSocketGameStatus(statusData) {
        console.log('Handling game status update:', statusData);
        
        if (statusData.status) {
            this.gameState.status = statusData.status;
            this.updateGameStatus();
            
            const message = `📊 Game Status: ${statusData.status}`;
            this.addLiveFeedItem(message, 'info');
        }
    }
    
    // 处理WebSocket回合更新
    handleWebSocketRoundUpdate(roundData) {
        console.log('Handling round update:', roundData);
        
        // 创建新的回合记录
        const round = {
            id: roundData.round || this.gameState.currentRound + 1,
            winner: roundData.winner,
            timestamp: new Date(roundData.timestamp || Date.now()),
            playerAScore: roundData.playerAScore || 0,
            playerBScore: roundData.playerBScore || 0,
            analysis: roundData.analysis || this.generateAIAnalysis()
        };
        
        // 添加到游戏状态
        this.gameState.rounds.push(round);
        this.gameState.currentRound = round.id;
        
        // 更新比分
        this.gameState.scores = {
            playerA: round.playerAScore,
            playerB: round.playerBScore
        };
        
        // 更新UI
        this.updateScoreboard();
        
        // 添加实时feed
        const winner = roundData.winner === 'playerA' ? 'A' : 'B';
        const message = `⭐ Round ${round.id}: Player ${winner} scored! Current: ${round.playerAScore}-${round.playerBScore}`;
        this.addLiveFeedItem(message, 'score');
        
        // 更新分析管理器
        if (window.analysisManager) {
            window.analysisManager.addRound(round);
        }
        
        // 保存游戏状态
        this.saveCurrentGameToHistory();
    }
    
    // 处理WebSocket连接状态更新
    handleWebSocketConnectionStatus(status) {
        console.log('WebSocket connection status:', status);
        
        let message = '';
        let messageType = 'info';
        
        switch (status) {
            case 'connected':
                message = '🔗 Connected to game server';
                messageType = 'success';
                break;
            case 'connecting':
                message = '🔄 Connecting to game server...';
                messageType = 'info';
                break;
            case 'disconnected':
                message = '❌ Disconnected from game server';
                messageType = 'error';
                break;
            case 'error':
                message = '⚠️ Connection error occurred';
                messageType = 'error';
                break;
        }
        
        if (message) {
            this.addLiveFeedItem(message, messageType);
        }
    }
    
    // 发送WebSocket消息
    sendWebSocketMessage(eventName, data) {
        if (window.wsManager) {
            window.wsManager.sendMessage(eventName, data);
        }
    }
    
    // 模拟进球（用于测试）
    simulateGoalA() {
        this.sendWebSocketMessage('goal', { team: 'playerA' });
    }
    
    simulateGoalB() {
        this.sendWebSocketMessage('goal', { team: 'playerB' });
    }
    
    // 获取WebSocket连接状态
    getWebSocketStatus() {
        return window.wsManager ? window.wsManager.getConnectionStatus() : { isConnected: false };
    }
    
    // 检查WebSocket连接状态
    checkWebSocketConnection() {
        const status = this.getWebSocketStatus();
        const message = status.isConnected 
            ? `✅ Connected to ${status.serverUrl || 'server'}` 
            : `❌ Disconnected (${status.reconnectAttempts || 0} attempts)`;
        
        this.addLiveFeedItem(message, status.isConnected ? 'success' : 'error');
        this.showMessage(message, status.isConnected ? 'success' : 'error');
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.smartCourtApp = new SmartCourtApp();
});

/* Cache breaker - English Loss Analysis Update: 2025-07-07 03:25 */ 