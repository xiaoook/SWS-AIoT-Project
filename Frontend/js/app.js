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
        
        // Game history management - 不再使用前端虚拟数据
        this.gamesHistory = []; // 保留以兼容性，但不再使用
        this.currentGameId = null;
        this.gameCounter = 0;
        
        // 异步初始化
        this.init().catch(error => {
            console.error('Initialization failed:', error);
        });
    }
    
    async init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.initializeComponents();
        
        // 确保页面刷新后得分重置为0
        await this.forceResetScores();
        
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
        
        // Game control buttons
        document.getElementById('startGame')?.addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('pauseGame')?.addEventListener('click', () => {
            this.pauseGame();
        });
        
        document.getElementById('endGame')?.addEventListener('click', () => {
            this.endGame();
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
        // 已完全禁用所有模拟游戏数据
        // 系统现在只显示真实的数据库记录
        
        // 清空前端虚拟数据，确保不生成任何虚拟内容
        this.gamesHistory = [];
        this.gameCounter = 0;
        
        console.log('✅ Sample games completely disabled - Game History will load from database only');
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
        

    }
    
    handleVisibilityChange() {
        // Handle page visibility changes
        if (document.hidden) {
            // 不再自动暂停比赛 - 让比赛可以一直进行
            // if (this.gameState.status === 'playing') {
            //     this.pauseGame();
            //     this.showMessage('Match paused automatically (page hidden)', 'info');
            // }
            console.log('Page hidden but game continues running');
        } else {
            console.log('Page visible again');
        }
    }
    
    // Game state management
    async startGame() {
        // Check if players are confirmed
        if (!window.arePlayersConfirmed || !window.arePlayersConfirmed()) {
            this.showMessage('Please confirm players before starting the game', 'error');
            return;
        }
        
        // Create new game ID for new game (local backup)
        this.gameCounter++;
        this.currentGameId = `GAME-${String(this.gameCounter).padStart(3, '0')}`;
        
        this.gameState.status = 'playing';
        this.gameState.startTime = new Date();
        this.gameState.scores = { playerA: 0, playerB: 0 };
        this.gameState.rounds = [];
        this.gameState.currentRound = 0;
        this.gameState.elapsedTime = 0;
        
        // Try to create game in database
        try {
            const response = await fetch(CONFIG.API_URLS.GAMES_NEW, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerA: playerIds.playerA,
                    playerB: playerIds.playerB
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    this.gameState.databaseGameId = data.gid;
                    console.log(`✅ Game created in database with ID: ${data.gid}`);
                    this.addLiveFeedItem(`✅ Game created in database`, 'success');
                } else {
                    throw new Error(data.message || 'Failed to create game in database');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Failed to create game in database:', error);
            this.addLiveFeedItem(`⚠️ Database unavailable, game saved locally only`, 'error');
            this.gameState.databaseGameId = null;
        }
        
        this.startTimer();
        this.updateGameStatus();
        this.updateScoreboard();
        this.addLiveFeedItem(`New match started!`, 'score');
        
        // 不要在开始时保存虚拟数据，只有游戏真正结束时才保存
        // this.saveCurrentGameToHistory(); // 移除虚拟数据生成
        
        // 已禁用自动模拟 - 等待真实传感器输入
        // this.simulateGameplay(); // 自动模拟已禁用
        
        // Trigger game state change event to update button states
        document.dispatchEvent(new CustomEvent('gameStateChange', {
            detail: { 
                status: this.gameState.status,
                gameId: this.currentGameId
            }
        }));
        
        this.showMessage(`New match started! Waiting for sensor input`, 'success');
    }
    
    pauseGame() {
        this.gameState.status = 'paused';
        this.stopTimer();
        this.updateGameStatus();
        this.addLiveFeedItem('Match paused', 'info');
        
        // Trigger game state change event
        document.dispatchEvent(new CustomEvent('gameStateChange', {
            detail: { 
                status: this.gameState.status,
                gameId: this.currentGameId
            }
        }));
        
        this.showMessage('Match paused', 'info');
    }
    
    resumeGame() {
        this.gameState.status = 'playing';
        this.startTimer();
        this.updateGameStatus();
        this.addLiveFeedItem('Match resumed', 'score');
        
        // Trigger game state change event
        document.dispatchEvent(new CustomEvent('gameStateChange', {
            detail: { 
                status: this.gameState.status,
                gameId: this.currentGameId
            }
        }));
        
        this.showMessage('Match resumed', 'success');
    }
    
    async endGame() {
        this.gameState.status = 'ended';
        this.gameState.endTime = new Date();
        this.stopTimer();
        this.updateGameStatus();
        
        const winner = this.gameState.scores.playerA >= 7 ? 'A' : 
                      this.gameState.scores.playerB >= 7 ? 'B' : 
                      this.gameState.scores.playerA > this.gameState.scores.playerB ? 'A' : 'B';
        
        const finalScore = `${this.gameState.scores.playerA}-${this.gameState.scores.playerB}`;
        this.addLiveFeedItem(`🏆 MATCH ENDED! Player ${winner} wins ${finalScore}!`, 'score');
        this.showMessage(`🏆 Player ${winner} wins ${finalScore}! Game completed`, 'success');
        
        // Calculate game statistics for database
        const totalRounds = this.gameState.rounds.length;
        const durationInSeconds = this.gameState.elapsedTime; // Keep as seconds for accuracy
        
        // Get player information
        const playerInfo = this.getCurrentPlayerInfo();
        
        // Update game in database if it was created there
        if (this.gameState.databaseGameId) {
            try {
                console.log(`📊 Updating game ${this.gameState.databaseGameId} - Rounds: ${totalRounds}, Duration: ${durationInSeconds}s`);
                
                const response = await fetch(CONFIG.API_URLS.GAMES_UPDATE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        gid: this.gameState.databaseGameId,
                        status: 'ended',
                        duration: durationInSeconds, // Send duration in seconds
                        rounds: totalRounds,
                        finalScores: {
                            playerA: this.gameState.scores.playerA,
                            playerB: this.gameState.scores.playerB
                        },
                        playerNames: playerInfo.names
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        console.log(`✅ Game ${this.gameState.databaseGameId} saved to database successfully`);
                        this.addLiveFeedItem(`✅ Game saved to database (${totalRounds} rounds, ${this.formatDuration(durationInSeconds)})`, 'success');
                    } else {
                        throw new Error(data.message || 'Failed to update game in database');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error('❌ Failed to save game to database:', error);
                this.addLiveFeedItem(`⚠️ Failed to save game to database`, 'error');
            }
        } else {
            this.addLiveFeedItem(`📝 Game saved locally only (${totalRounds} rounds)`, 'info');
        }
        
        // Save final game state to history
        this.saveCurrentGameToHistory();
        
        // Generate final report
        if (window.reportManager) {
            window.reportManager.generateFinalReport();
        }
        
        // Trigger game state change event
        document.dispatchEvent(new CustomEvent('gameStateChange', {
            detail: { 
                status: this.gameState.status,
                gameId: this.currentGameId
            }
        }));
    }
    
    async addScore(player) {
        if (this.gameState.status !== 'playing') return;
        
        // Check if game should end before adding score
        if (this.gameState.scores.playerA >= 7 || this.gameState.scores.playerB >= 7) {
            return; // Game already ended, don't add more scores
        }
        
        // Convert player name to team letter for backend API
        const team = player === 'playerA' ? 'A' : 'B';
        
        // Update score in database if game was created there
        if (this.gameState.databaseGameId) {
            try {
                const response = await fetch(`${CONFIG.API_URLS.GOAL}?team=${team}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        console.log(`✅ Score recorded in database: ${team} scored`);
                        // Update local scores to match database
                        this.gameState.scores.playerA = data.score.A || 0;
                        this.gameState.scores.playerB = data.score.B || 0;
                    } else {
                        throw new Error(data.message || 'Failed to record score in database');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error('❌ Failed to record score in database:', error);
                this.addLiveFeedItem(`⚠️ Database error, score recorded locally only`, 'error');
                // Continue with local score update as fallback
        this.gameState.scores[player]++;
            }
        } else {
            // No database game, update locally only
            this.gameState.scores[player]++;
        }
        
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
        const scoreA = this.gameState.scores.playerA;
        const scoreB = this.gameState.scores.playerB;
        
        // 更新主得分板
        const scoreAElement = document.getElementById('scoreA');
        const scoreBElement = document.getElementById('scoreB');
        
        if (scoreAElement) {
            scoreAElement.textContent = scoreA;
        }
        if (scoreBElement) {
            scoreBElement.textContent = scoreB;
        }
        
        // 更新头部导航栏得分
        const headerScoreA = document.getElementById('headerScoreA');
        const headerScoreB = document.getElementById('headerScoreB');
        
        if (headerScoreA) {
            headerScoreA.textContent = scoreA;
        }
        if (headerScoreB) {
            headerScoreB.textContent = scoreB;
        }
        
        // 更新移动端得分
        const mobileScoreA = document.getElementById('mobileScoreA');
        const mobileScoreB = document.getElementById('mobileScoreB');
        
        if (mobileScoreA) {
            mobileScoreA.textContent = scoreA;
        }
        if (mobileScoreB) {
            mobileScoreB.textContent = scoreB;
        }
        
        console.log('Scoreboard updated:', { playerA: scoreA, playerB: scoreB });
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
        // Check if a message with the same content already exists
        const existingMessages = document.querySelectorAll('.message');
        for (let existingMessage of existingMessages) {
            if (existingMessage.textContent === message) {
                return; // Don't show duplicate message
            }
        }
        
        // Clear existing messages of the same type to prevent stacking
        const existingMessagesOfType = document.querySelectorAll(`.message.${type}`);
        existingMessagesOfType.forEach(msg => {
            msg.classList.add('fade-out');
            setTimeout(() => {
                if (msg.parentNode) {
                    msg.remove();
                }
            }, 300);
        });
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        // Add click to close functionality
        let isRemoved = false;
        const removeMessage = () => {
            if (isRemoved) return;
            isRemoved = true;
            messageElement.classList.add('fade-out');
            // Remove element after animation completes
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300); // matches animation duration
        };
        
        // Click to close
        messageElement.addEventListener('click', removeMessage);
        
        // Add to page
        document.body.appendChild(messageElement);
        
        // Auto-remove after 2.5 seconds with fade-out animation
        setTimeout(removeMessage, 2500);
    }
    
    // Get game state
    getGameState() {
        return { ...this.gameState };
    }
    
    // Reset game
    // 强制重置所有得分显示为0（页面刷新后使用）
    async forceResetScores() {
        console.log('Force resetting all scores to 0...');
        
        // 设置重置时间戳，防止WebSocket立即覆盖
        this.lastResetTime = Date.now();
        
        // 重置游戏状态
        this.gameState.scores = { playerA: 0, playerB: 0 };
        this.gameState.status = 'idle';
        this.gameState.rounds = [];
        this.gameState.currentRound = 0;
        this.gameState.elapsedTime = 0;
        
        // 强制更新所有得分显示元素
        const scoreElements = [
            'scoreA', 'scoreB',
            'headerScoreA', 'headerScoreB', 
            'mobileScoreA', 'mobileScoreB'
        ];
        
        scoreElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = '0';
                console.log(`Reset ${elementId} to 0`);
            }
        });
        
        // 更新游戏状态显示
        this.updateGameStatus();
        this.updateTimer();
        
        // 清除任何可能保存的状态
        this.clearPersistedState();
        
        // 调用全局得分同步函数确保一致性
        if (window.updateScore) {
            window.updateScore('A', 0);
            window.updateScore('B', 0);
        }
        
        // 重置后端得分状态（异步操作）
        try {
            await this.resetBackendScores();
            console.log('Backend scores also reset');
        } catch (error) {
            console.error('Failed to reset backend scores:', error);
        }
        
        console.log('All scores force reset to 0');
    }
    
    // 清除可能保存的状态
    clearPersistedState() {
        // 清除可能的localStorage数据
        try {
            localStorage.removeItem('gameScores');
            localStorage.removeItem('currentGame');
            localStorage.removeItem('gameState');
        } catch (e) {
            console.log('No persisted state to clear');
        }
    }
    
    // 重置后端得分状态
    async resetBackendScores() {
        try {
            const backendUrl = window.CONFIG?.BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/reset/scores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Backend scores reset:', result);
                return true;
            } else {
                console.error('Failed to reset backend scores:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error resetting backend scores:', error);
            return false;
        }
    }

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
        
        // Trigger game state change event
        document.dispatchEvent(new CustomEvent('gameStateChange', {
            detail: { 
                status: this.gameState.status,
                gameId: this.currentGameId
            }
        }));
        
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
        
        // 检查是否刚刚重置，避免在重置后立即被WebSocket覆盖
        if (this.lastResetTime && (Date.now() - this.lastResetTime) < 3000) {
            console.log('Ignoring WebSocket score update - recent reset detected (within 3 seconds)');
            return;
        }
        
        // 更新本地游戏状态
        this.gameState.scores = {
            playerA: scoreData.playerA || scoreData.home || scoreData.A || 0,
            playerB: scoreData.playerB || scoreData.away || scoreData.B || 0
        };
        
        // 更新UI
        this.updateScoreboard();
        
        // 只在feed中显示，不重复显示消息通知
        const message = `🎯 Score Update: ${this.gameState.scores.playerA} - ${this.gameState.scores.playerB}`;
        this.addLiveFeedItem(message, 'score');
        
        // 检查是否有人获胜
        if (this.gameState.scores.playerA >= 7 || this.gameState.scores.playerB >= 7) {
            const winner = this.gameState.scores.playerA >= 7 ? 'A' : 'B';
            this.addLiveFeedItem(`🏆 GAME OVER! Player ${winner} wins!`, 'success');
            
            // 自动结束游戏
            setTimeout(() => {
                this.endGame(); // Use the async endGame method
            }, 1000);
        }
        
        // 保存游戏状态
        this.saveCurrentGameToHistory();
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
        // 检查确认状态
        if (!window.arePlayersConfirmed || !window.arePlayersConfirmed()) {
            this.showMessage('Please confirm players first!', 'error');
            return;
        }
        
        if (window.wsManager) {
            window.wsManager.simulateGoal('playerA');
        } else {
            this.showMessage('WebSocket manager not available', 'error');
        }
    }
    
    simulateGoalB() {
        // 检查确认状态
        if (!window.arePlayersConfirmed || !window.arePlayersConfirmed()) {
            this.showMessage('Please confirm players first!', 'error');
            return;
        }
        
        if (window.wsManager) {
            window.wsManager.simulateGoal('playerB');
        } else {
            this.showMessage('WebSocket manager not available', 'error');
        }
    }
    
    // 获取WebSocket连接状态
    getWebSocketStatus() {
        return window.wsManager ? window.wsManager.getConnectionStatus() : { isConnected: false };
    }
    
    // 检查WebSocket连接状态
    checkWebSocketConnection() {
        const status = this.getWebSocketStatus();
        
        if (status.isConnected) {
            const message = `✅ Connected to ${status.serverUrl || 'server'}`;
            this.addLiveFeedItem(message, 'success');
            this.showMessage(message, 'success');
        } else {
            // 执行连接诊断 - 避免CORS问题
            this.addLiveFeedItem('🔍 Running connection diagnostics...', 'info');
            this.addLiveFeedItem('🔄 Attempting to reconnect WebSocket...', 'info');
            
            // 尝试重新连接 (Socket.IO会自己处理服务器可用性检查)
            if (window.wsManager) {
                window.wsManager.connect();
                this.showMessage('Attempting to reconnect...', 'info');
                
                // 设置连接超时检查
                setTimeout(() => {
                    const newStatus = this.getWebSocketStatus();
                    if (!newStatus.isConnected) {
                        this.addLiveFeedItem('❌ Connection failed after timeout', 'error');
                        this.addLiveFeedItem('💡 Please ensure backend server is running:', 'info');
                        this.addLiveFeedItem(`   Backend should be on port ${CONFIG.BACKEND_PORT}`, 'info');
                        this.showMessage('Failed to connect - check backend server', 'error');
                    }
                }, 5000); // 5秒超时
            } else {
                this.addLiveFeedItem('❌ WebSocket manager not available', 'error');
                this.showMessage('WebSocket manager error', 'error');
            }
        }
    }
    
    // Database connection and game state utilities
    async checkDatabaseConnection() {
        try {
            const response = await fetch(CONFIG.API_URLS.ROOT, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            if (response.ok) {
                console.log('✅ Database server is available');
                this.addLiveFeedItem('✅ Database server is available', 'success');
                return true;
            } else {
                console.log('❌ Database server returned error:', response.status);
                this.addLiveFeedItem(`❌ Database server error: ${response.status}`, 'error');
                return false;
            }
        } catch (error) {
            console.log('❌ Database server is not available:', error.message);
            this.addLiveFeedItem('❌ Database server is not available', 'error');
            return false;
        }
    }
    
    getDatabaseGameId() {
        return this.gameState.databaseGameId || null;
    }
    
    isGameInDatabase() {
        return !!this.gameState.databaseGameId;
    }
    
    // 获取当前玩家信息
    getCurrentPlayerInfo() {
        if (window.playerManager) {
            const playerIds = window.playerManager.getCurrentPlayerIds();
            const playerNames = window.playerManager.getCurrentPlayers();
            
            return {
                ids: playerIds,
                names: playerNames,
                hasValidPlayers: !!(playerIds && playerIds.playerA && playerIds.playerB)
            };
        }
        
        return {
            ids: { playerA: null, playerB: null },
            names: { playerA: 'Player A', playerB: 'Player B' },
            hasValidPlayers: false
        };
    }
    
    // 格式化时长（秒转为分:秒）
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    // 获取游戏状态摘要（用于调试）
    getGameStatusSummary() {
        return {
            localGameId: this.currentGameId,
            databaseGameId: this.gameState.databaseGameId,
            status: this.gameState.status,
            scores: this.gameState.scores,
            rounds: this.gameState.rounds.length,
            isInDatabase: this.isGameInDatabase(),
            players: window.playerManager ? window.playerManager.getCurrentPlayerIds() : null
        };
    }
}

// Add cache busting function to force reload
function forceReload() {
    console.log('🔄 Force reloading page to clear cache...');
    
    // Clear localStorage and sessionStorage
    localStorage.removeItem('playerManagerVersion');
    localStorage.removeItem('corsBlocked');
    localStorage.removeItem('fetchPlayersFromDatabase_retry');
    
    // Force reload with cache bypass
    window.location.reload(true);
}

// Add keyboard shortcut for force reload
document.addEventListener('keydown', function(e) {
    // Ctrl+Shift+R or Cmd+Shift+R to force reload
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        forceReload();
    }
});

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.smartCourtApp = new SmartCourtApp();
});

/* Cache breaker - English Loss Analysis Update: 2025-07-07 03:25 */ 