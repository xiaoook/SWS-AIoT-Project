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
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.initializeComponents();
        this.showMessage('System initialized, ready to start the game!', 'success');
    }
    
    setupEventListeners() {
        // Navigation tab events
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
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
        
        // Simulate initial data
        this.addLiveFeedItem('System startup complete, waiting for game to start...');
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
            case 'analysis':
                // Refresh analysis data
                if (window.analysisManager) {
                    window.analysisManager.refreshAnalysis();
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
                    this.switchTab('analysis');
                    break;
                case '3':
                    e.preventDefault();
                    this.switchTab('replay');
                    break;
                case '4':
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
        this.gameState.status = 'playing';
        this.gameState.startTime = new Date();
        this.gameState.scores = { playerA: 0, playerB: 0 };
        this.gameState.rounds = [];
        this.gameState.currentRound = 0;
        this.gameState.elapsedTime = 0;
        
        this.startTimer();
        this.updateGameStatus();
        this.updateScoreboard();
        this.addLiveFeedItem('Match started!', 'score');
        
        // Simulate scoring
        this.simulateGameplay();
        
        this.showMessage('Match has started!', 'success');
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
        
        const winner = this.gameState.scores.playerA > this.gameState.scores.playerB ? 'A' : 'B';
        this.addLiveFeedItem(`Match ended! Player ${winner} wins!`, 'score');
        this.showMessage(`Match ended! Player ${winner} wins!`, 'success');
        
        // Generate final report
        if (window.reportManager) {
            window.reportManager.generateFinalReport();
        }
    }
    
    addScore(player) {
        if (this.gameState.status !== 'playing') return;
        
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
        this.addLiveFeedItem(`Player ${player.slice(-1)} scored! Current score: ${this.gameState.scores.playerA} - ${this.gameState.scores.playerB}`, 'score');
        
        // Update analysis
        if (window.analysisManager) {
            window.analysisManager.addRound(round);
        }
        
        // Check if end condition is met
        if (this.gameState.scores.playerA >= 10 || this.gameState.scores.playerB >= 10) {
            setTimeout(() => this.endGame(), 1000);
        }
    }
    
    generateAIAnalysis() {
        const analysisTypes = [
            'Excellent reaction speed',
            'Defensive positioning needs improvement',
            'Good attack angle',
            'Need to improve focus',
            'Standard technical actions',
            'Good tactical application'
        ];
        
        const errorTypes = [
            'Slow reaction',
            'Defensive errors',
            'Poor attack angle',
            'Attention distraction',
            'Non-standard technical actions'
        ];
        
        return {
            feedback: analysisTypes[Math.floor(Math.random() * analysisTypes.length)],
            errorType: Math.random() > 0.7 ? errorTypes[Math.floor(Math.random() * errorTypes.length)] : null,
            suggestions: [
                'Maintain good body balance',
                'Improve reaction speed',
                'Watch defensive positioning',
                'Strengthen attack accuracy'
            ].slice(0, Math.floor(Math.random() * 3) + 1)
        };
    }
    
    simulateGameplay() {
        if (this.gameState.status !== 'playing') return;
        
        // Simulate random scoring
        const scoreInterval = setInterval(() => {
            if (this.gameState.status !== 'playing') {
                clearInterval(scoreInterval);
                return;
            }
            
            // Randomly select scoring player
            const player = Math.random() > 0.5 ? 'playerA' : 'playerB';
            this.addScore(player);
            
            // Stop simulation if match ends
            if (this.gameState.status === 'ended') {
                clearInterval(scoreInterval);
            }
        }, 3000 + Math.random() * 4000); // 3-7 second random interval
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
        feedItem.innerHTML = `
            <strong>${new Date().toLocaleTimeString()}</strong> - ${message}
        `;
        
        // Add to top of container
        feedContainer.insertBefore(feedItem, feedContainer.firstChild);
        
        // Limit display count
        const items = feedContainer.querySelectorAll('.feed-item');
        if (items.length > 20) {
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
            feedContainer.innerHTML = '<div class="feed-item">Waiting for game to start...</div>';
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
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.smartCourtApp = new SmartCourtApp();
}); 