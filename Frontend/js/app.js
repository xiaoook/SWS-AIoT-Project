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
        
        // Add sample loss analysis data for demonstration
        this.generateSampleLossData();
        
        // Simulate initial data
        this.addLiveFeedItem('System startup complete, ready to begin!', 'success');
    }
    
    generateSampleLossData() {
        // Generate multiple sample games for demonstration
        this.generateSampleGames();
        
        // Load the most recent game into current game state
        if (this.gamesHistory.length > 0) {
            const mostRecentGame = this.gamesHistory[this.gamesHistory.length - 1];
            this.loadGame(mostRecentGame.gameId);
        }
    }
    
    generateSampleGames() {
        const games = [
            // Game 1: Player A wins 7-5 (Most recent - current state)
            {
                gameId: 'GAME-001',
                gameType: 'Practice Match',
                startTime: new Date(Date.now() - 600000), // 10 minutes ago
                endTime: new Date(Date.now() - 60000), // 1 minute ago  
                duration: 540, // 9 minutes
                finalScores: { playerA: 6, playerB: 5 },
                winner: null, // Still in progress
                status: 'paused',
                rounds: [
                    { id: 1, winner: 'playerB', timestamp: new Date(Date.now() - 580000), playerAScore: 0, playerBScore: 1, analysis: { feedback: 'The defense was broken through due to poor positioning', errorType: 'Defensive errors', suggestions: ['Improve defensive positioning', 'Enhance ball trajectory prediction'] }},
                    { id: 2, winner: 'playerA', timestamp: new Date(Date.now() - 540000), playerAScore: 1, playerBScore: 1, analysis: { feedback: 'Reaction speed was insufficient, failed to respond to opponent attacks', errorType: 'Slow reaction', suggestions: ['Strengthen reaction speed training', 'Improve movement footwork'] }},
                    { id: 3, winner: 'playerB', timestamp: new Date(Date.now() - 500000), playerAScore: 1, playerBScore: 2, analysis: { feedback: 'Attention was distracted, missed defensive timing', errorType: 'Attention distraction', suggestions: ['Strengthen concentration training', 'Establish match rhythm'] }},
                    { id: 4, winner: 'playerA', timestamp: new Date(Date.now() - 460000), playerAScore: 2, playerBScore: 2, analysis: { feedback: 'Technical execution was non-standard, affecting ball control', errorType: 'Non-standard technical actions', suggestions: ['Standardize technical movements', 'Return to basic practice'] }},
                    { id: 5, winner: 'playerB', timestamp: new Date(Date.now() - 420000), playerAScore: 2, playerBScore: 3, analysis: { feedback: 'Movement speed was too slow, couldn\'t keep up with ball pace', errorType: 'Slow reaction', suggestions: ['Strengthen physical training', 'Improve movement speed'] }},
                    { id: 6, winner: 'playerA', timestamp: new Date(Date.now() - 380000), playerAScore: 3, playerBScore: 3, analysis: { feedback: 'Good recovery after losing point', errorType: null, suggestions: ['Maintain momentum', 'Keep focused on positioning'] }},
                    { id: 7, winner: 'playerA', timestamp: new Date(Date.now() - 340000), playerAScore: 4, playerBScore: 3, analysis: { feedback: 'Excellent attack strategy under pressure', errorType: null, suggestions: ['Continue aggressive play', 'Watch for counter-attacks'] }},
                    { id: 8, winner: 'playerB', timestamp: new Date(Date.now() - 300000), playerAScore: 4, playerBScore: 4, analysis: { feedback: 'Ball control was compromised under pressure', errorType: 'Non-standard technical actions', suggestions: ['Focus on fundamental techniques', 'Maintain composure'] }},
                    { id: 9, winner: 'playerA', timestamp: new Date(Date.now() - 260000), playerAScore: 5, playerBScore: 4, analysis: { feedback: 'Decisive play in crucial moment', errorType: null, suggestions: ['Keep pressure on opponent', 'Stay alert for comeback'] }},
                    { id: 10, winner: 'playerB', timestamp: new Date(Date.now() - 220000), playerAScore: 5, playerBScore: 5, analysis: { feedback: 'Defensive lapse allowed opponent comeback', errorType: 'Defensive errors', suggestions: ['Strengthen defensive positioning', 'Maintain concentration'] }},
                    { id: 11, winner: 'playerA', timestamp: new Date(Date.now() - 180000), playerAScore: 6, playerBScore: 5, analysis: { feedback: 'Match point advantage! One point away from 7-point victory', errorType: null, suggestions: ['Stay calm under pressure', 'One more point to win!'] }}
                ]
            },
            
            // Game 2: Player B wins 7-3 (Completed)
            {
                gameId: 'GAME-002',
                gameType: 'Training Session',
                startTime: new Date(Date.now() - 7200000), // 2 hours ago
                endTime: new Date(Date.now() - 6600000), // 1.5 hours ago
                duration: 600, // 10 minutes
                finalScores: { playerA: 3, playerB: 7 },
                winner: 'playerB',
                status: 'ended',
                rounds: [
                    { id: 1, winner: 'playerB', timestamp: new Date(Date.now() - 7150000), playerAScore: 0, playerBScore: 1, analysis: { feedback: 'Strong opening play', errorType: null, suggestions: ['Keep up the momentum'] }},
                    { id: 2, winner: 'playerB', timestamp: new Date(Date.now() - 7100000), playerAScore: 0, playerBScore: 2, analysis: { feedback: 'Opponent failed to adapt to pace', errorType: 'Slow reaction', suggestions: ['Increase reaction training'] }},
                    { id: 3, winner: 'playerA', timestamp: new Date(Date.now() - 7050000), playerAScore: 1, playerBScore: 2, analysis: { feedback: 'Good defensive recovery', errorType: null, suggestions: ['Build on this success'] }},
                    { id: 4, winner: 'playerB', timestamp: new Date(Date.now() - 7000000), playerAScore: 1, playerBScore: 3, analysis: { feedback: 'Excellent ball placement', errorType: null, suggestions: ['Continue strategic play'] }},
                    { id: 5, winner: 'playerB', timestamp: new Date(Date.now() - 6950000), playerAScore: 1, playerBScore: 4, analysis: { feedback: 'Opponent defensive positioning poor', errorType: 'Defensive errors', suggestions: ['Review defensive fundamentals'] }},
                    { id: 6, winner: 'playerA', timestamp: new Date(Date.now() - 6900000), playerAScore: 2, playerBScore: 4, analysis: { feedback: 'Improved concentration showing results', errorType: null, suggestions: ['Maintain focus'] }},
                    { id: 7, winner: 'playerB', timestamp: new Date(Date.now() - 6850000), playerAScore: 2, playerBScore: 5, analysis: { feedback: 'Technical superiority evident', errorType: null, suggestions: ['Close out the game'] }},
                    { id: 8, winner: 'playerA', timestamp: new Date(Date.now() - 6800000), playerAScore: 3, playerBScore: 5, analysis: { feedback: 'Late game pressure response', errorType: null, suggestions: ['Fight for every point'] }},
                    { id: 9, winner: 'playerB', timestamp: new Date(Date.now() - 6750000), playerAScore: 3, playerBScore: 6, analysis: { feedback: 'Match point opportunity', errorType: null, suggestions: ['One point to victory'] }},
                    { id: 10, winner: 'playerB', timestamp: new Date(Date.now() - 6700000), playerAScore: 3, playerBScore: 7, analysis: { feedback: 'Victory secured with decisive shot', errorType: null, suggestions: ['Excellent performance!'] }}
                ]
            },
            
            // Game 3: Player A wins 7-4 (Completed)
            {
                gameId: 'GAME-003',
                gameType: 'Competitive Match',
                startTime: new Date(Date.now() - 14400000), // 4 hours ago
                endTime: new Date(Date.now() - 13800000), // 3.5 hours ago
                duration: 600, // 10 minutes
                finalScores: { playerA: 7, playerB: 4 },
                winner: 'playerA',
                status: 'ended',
                rounds: [
                    { id: 1, winner: 'playerA', timestamp: new Date(Date.now() - 14350000), playerAScore: 1, playerBScore: 0, analysis: { feedback: 'Perfect game opening', errorType: null, suggestions: ['Maintain aggressive play'] }},
                    { id: 2, winner: 'playerA', timestamp: new Date(Date.now() - 14300000), playerAScore: 2, playerBScore: 0, analysis: { feedback: 'Dominant early performance', errorType: null, suggestions: ['Keep pressure on opponent'] }},
                    { id: 3, winner: 'playerB', timestamp: new Date(Date.now() - 14250000), playerAScore: 2, playerBScore: 1, analysis: { feedback: 'Opponent breaks through defense', errorType: 'Defensive errors', suggestions: ['Tighten defensive positioning'] }},
                    { id: 4, winner: 'playerA', timestamp: new Date(Date.now() - 14200000), playerAScore: 3, playerBScore: 1, analysis: { feedback: 'Quick response to opponent score', errorType: null, suggestions: ['Stay mentally strong'] }},
                    { id: 5, winner: 'playerB', timestamp: new Date(Date.now() - 14150000), playerAScore: 3, playerBScore: 2, analysis: { feedback: 'Attention lapse allows comeback', errorType: 'Attention distraction', suggestions: ['Maintain concentration'] }},
                    { id: 6, winner: 'playerA', timestamp: new Date(Date.now() - 14100000), playerAScore: 4, playerBScore: 2, analysis: { feedback: 'Regaining control of match', errorType: null, suggestions: ['Build toward victory'] }},
                    { id: 7, winner: 'playerB', timestamp: new Date(Date.now() - 14050000), playerAScore: 4, playerBScore: 3, analysis: { feedback: 'Opponent shows resilience', errorType: 'Poor attack angle', suggestions: ['Improve shot selection'] }},
                    { id: 8, winner: 'playerA', timestamp: new Date(Date.now() - 14000000), playerAScore: 5, playerBScore: 3, analysis: { feedback: 'Strategic patience pays off', errorType: null, suggestions: ['Two more points to win'] }},
                    { id: 9, winner: 'playerB', timestamp: new Date(Date.now() - 13950000), playerAScore: 5, playerBScore: 4, analysis: { feedback: 'Late comeback attempt', errorType: 'Non-standard technical actions', suggestions: ['Focus on fundamentals'] }},
                    { id: 10, winner: 'playerA', timestamp: new Date(Date.now() - 13900000), playerAScore: 6, playerBScore: 4, analysis: { feedback: 'Match point achieved', errorType: null, suggestions: ['One point from victory'] }},
                    { id: 11, winner: 'playerA', timestamp: new Date(Date.now() - 13850000), playerAScore: 7, playerBScore: 4, analysis: { feedback: 'Decisive victory completed!', errorType: null, suggestions: ['Excellent match performance'] }}
                ]
            }
        ];
        
        // Add games to history
        this.gamesHistory = games;
        this.gameCounter = games.length;
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
        
        // Simulate scoring
        this.simulateGameplay();
        
        this.showMessage(`New match started! Game ID: ${this.currentGameId}`, 'success');
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
        if (this.gameState.status !== 'playing') return;
        
        // Simulate random scoring
        const scoreInterval = setInterval(() => {
            if (this.gameState.status !== 'playing') {
                clearInterval(scoreInterval);
                return;
            }
            
            // Check if game should end (7 points reached)
            if (this.gameState.scores.playerA >= 7 || this.gameState.scores.playerB >= 7) {
                clearInterval(scoreInterval);
                return;
            }
            
            // Randomly select scoring player
            const player = Math.random() > 0.5 ? 'playerA' : 'playerB';
            this.addScore(player);
            
            // Stop simulation if match ends
            if (this.gameState.status === 'ended' || 
                this.gameState.scores.playerA >= 7 || 
                this.gameState.scores.playerB >= 7) {
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
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.smartCourtApp = new SmartCourtApp();
});

/* Cache breaker - English Loss Analysis Update: 2025-07-07 03:25 */ 