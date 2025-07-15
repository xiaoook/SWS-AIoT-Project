// Game Control Manager
class GameControlManager {
    constructor() {
        this.buttons = {
            start: null,
            pause: null,
            end: null
        };
        
        // Track player confirmation status
        this.playersConfirmed = false;
        
        this.init();
    }
    
    init() {
        this.setupButtons();
        this.setupEventListeners();
        this.updateButtonStates();
    }
    
    setupButtons() {
        this.buttons.start = document.getElementById('startGame');
        this.buttons.pause = document.getElementById('pauseGame');
        this.buttons.end = document.getElementById('endGame');
        
        // Initially disable start button until players are confirmed
        if (this.buttons.start) {
            this.buttons.start.disabled = true;
            this.buttons.start.textContent = 'Confirm Players First';
        }
    }
    
    setupEventListeners() {
        // Start game button
        if (this.buttons.start) {
            this.buttons.start.addEventListener('click', () => {
                this.startGame();
            });
        }
        
        // Pause game button
        if (this.buttons.pause) {
            this.buttons.pause.addEventListener('click', () => {
                this.togglePause();
            });
        }
        
        // End game button
        if (this.buttons.end) {
            this.buttons.end.addEventListener('click', () => {
                this.endGame();
            });
        }
        
        // Listen for game state changes
        document.addEventListener('gameStateChange', (e) => {
            this.updateButtonStates();
        });
    }
    
    async startGame() {
        if (window.smartCourtApp) {
            // If game is already running, show confirmation dialog
            if (window.smartCourtApp.gameState.status !== 'idle') {
                if (confirm('A game is currently in progress. Are you sure you want to restart?')) {
                    window.smartCourtApp.resetGame();
                    setTimeout(async () => {
                        await window.smartCourtApp.startGame();
                    }, 500);
                }
            } else {
                await window.smartCourtApp.startGame();
            }
        }
        
        this.updateButtonStates();
    }
    
    togglePause() {
        if (window.smartCourtApp) {
            const gameState = window.smartCourtApp.gameState;
            console.log('🔄 Toggle pause - Current status:', gameState.status);
            
            if (gameState.status === 'playing') {
                console.log('⏸️ Pausing game...');
                window.smartCourtApp.pauseGame();
                this.buttons.pause.textContent = 'Resume Game';
            } else if (gameState.status === 'paused') {
                console.log('▶️ Resuming game...');
                window.smartCourtApp.resumeGame();
                this.buttons.pause.textContent = 'Pause Game';
            } else {
                console.log('⚠️ Cannot pause/resume - Invalid game status:', gameState.status);
            }
        } else {
            console.log('❌ smartCourtApp not found');
        }
        
        this.updateButtonStates();
    }
    
    async endGame() {
        if (window.smartCourtApp) {
            const gameState = window.smartCourtApp.gameState;
            
            if (gameState.status === 'playing' || gameState.status === 'paused') {
                if (confirm('Are you sure you want to end the current game?')) {
                    await window.smartCourtApp.endGame();
                }
            }
        }
        
        this.updateButtonStates();
    }
    
    updateButtonStates() {
        if (!window.smartCourtApp) {
            console.log('❌ updateButtonStates: smartCourtApp not found');
            return;
        }
        
        const gameState = window.smartCourtApp.gameState;
        const status = gameState.status;
        console.log('🔄 Updating button states - Current status:', status);
        
        // Update button states
        switch (status) {
            case 'idle':
                // Only enable start button if players are confirmed
                this.setButtonState('start', this.playersConfirmed, this.playersConfirmed ? 'Start Game' : 'Confirm Players First');
                this.setButtonState('pause', false, 'Pause Game');
                this.setButtonState('end', false, 'End Game');
                break;
                
            case 'playing':
                this.setButtonState('start', true, 'Restart');
                this.setButtonState('pause', true, 'Pause Game');
                this.setButtonState('end', true, 'End Game');
                break;
                
            case 'paused':
                this.setButtonState('start', true, 'Restart');
                this.setButtonState('pause', true, 'Resume Game');
                this.setButtonState('end', true, 'End Game');
                break;
                
            case 'ended':
                // Only enable start button if players are confirmed
                this.setButtonState('start', this.playersConfirmed, this.playersConfirmed ? 'Start New Game' : 'Confirm Players First');
                this.setButtonState('pause', false, 'Pause Game');
                this.setButtonState('end', false, 'End Game');
                break;
        }
        
        // Update button styles
        this.updateButtonStyles(status);
    }
    
    setButtonState(buttonName, enabled, text) {
        const button = this.buttons[buttonName];
        if (button) {
            button.disabled = !enabled;
            button.textContent = text;
        }
    }
    
    updateButtonStyles(status) {
        // Update button styles based on game state
        const startBtn = this.buttons.start;
        const pauseBtn = this.buttons.pause;
        const endBtn = this.buttons.end;
        
        if (startBtn) {
            startBtn.className = 'btn btn-primary';
            if (status === 'playing' || status === 'paused') {
                startBtn.classList.add('btn-warning');
                startBtn.classList.remove('btn-primary');
            }
        }
        
        if (pauseBtn) {
            pauseBtn.className = 'btn btn-secondary';
            if (status === 'paused') {
                pauseBtn.classList.add('btn-primary');
                pauseBtn.classList.remove('btn-secondary');
            }
        }
        
        if (endBtn) {
            endBtn.className = 'btn btn-danger';
        }
    }
    
    // Keyboard shortcut handling
    handleKeyboardShortcuts(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return; // Ignore keystrokes in input fields
        }
        
        switch (e.key) {
            case 'Enter':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.startGame();
                }
                break;
                
            case ' ':
                e.preventDefault();
                this.togglePause();
                break;
                
            case 'Escape':
                e.preventDefault();
                this.endGame();
                break;
        }
    }
    
    // Add manual scoring (for testing)
    async addManualScore(player) {
        if (window.smartCourtApp) {
            const gameState = window.smartCourtApp.gameState;
            if (gameState.status === 'playing') {
                await window.smartCourtApp.addScore(player);
            }
        }
    }
    
    // Get game statistics
    getGameStats() {
        if (!window.smartCourtApp) return null;
        
        const gameState = window.smartCourtApp.gameState;
        const stats = {
            totalRounds: gameState.rounds.length,
            totalTime: gameState.elapsedTime,
            playerAScore: gameState.scores.playerA,
            playerBScore: gameState.scores.playerB,
            winRate: {
                playerA: gameState.rounds.length ? (gameState.scores.playerA / gameState.rounds.length * 100).toFixed(1) : 0,
                playerB: gameState.rounds.length ? (gameState.scores.playerB / gameState.rounds.length * 100).toFixed(1) : 0
            }
        };
        
        return stats;
    }
    
    // Set game parameters
    setGameParameters(params) {
        this.gameParams = {
            maxScore: params.maxScore || 7,
            timeLimit: params.timeLimit || null,
            autoPlay: params.autoPlay || false,
            difficulty: params.difficulty || 'normal'
        };
    }
    
    // Auto-save game progress
    autoSaveGame() {
        if (!window.smartCourtApp) return;
        
        const gameData = window.smartCourtApp.exportGameData();
        localStorage.setItem('smartCourt_autosave', JSON.stringify(gameData));
        
        // Show save indicator
        this.showSaveIndicator();
    }
    
    // Auto-load game progress
    autoLoadGame() {
        const savedData = localStorage.getItem('smartCourt_autosave');
        if (savedData) {
            try {
                const gameData = JSON.parse(savedData);
                if (confirm('Unfinished match detected, do you want to continue?')) {
                    window.smartCourtApp.importGameData(gameData);
                }
            } catch (error) {
                console.error('Auto-load failed:', error);
            }
        }
    }
    
    showSaveIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'save-indicator';
        indicator.textContent = 'Auto-saved';
        indicator.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 5px;
            font-size: 0.9rem;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        document.body.appendChild(indicator);
        
        // Show animation
        setTimeout(() => {
            indicator.style.opacity = '1';
        }, 100);
        
        // Auto-hide
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                indicator.remove();
            }, 300);
        }, 2000);
    }
    
    // Set player confirmation status
    setPlayersConfirmed(confirmed) {
        this.playersConfirmed = confirmed;
        this.updateButtonStates();
    }
    
    // Reset all data
    resetAllData() {
        if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
            localStorage.removeItem('smartCourt_autosave');
            window.smartCourtApp.resetGame();
            
            // Reset player confirmation status
            this.playersConfirmed = false;
            
            // Clear other related data
            if (window.analysisManager) {
                window.analysisManager.clearAnalysis();
            }
            
            if (window.reportManager) {
                window.reportManager.clearReports();
            }
            
            window.smartCourtApp.showMessage('All data has been reset', 'success');
        }
    }
}

// WebSocket connection management (for real-time hardware data)
class HardwareConnection {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isConnected = false;
        
        this.init();
    }
    
    init() {
        this.setupConnectionIndicator();
        // Don't auto-connect for now, wait for user manual connection
        // this.connect();
    }
    
    setupConnectionIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'hardwareIndicator';
        indicator.className = 'hardware-indicator';
        indicator.innerHTML = `
            <div class="indicator-dot offline"></div>
            <span>Hardware disconnected</span>
        `;
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(255, 255, 255, 0.9);
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        
        document.body.appendChild(indicator);
    }
    
    connect(url = `ws://localhost:${CONFIG.FRONTEND_PORT}`) {
        try {
            this.ws = new WebSocket(url);
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
                console.log('Hardware connection successful');
            };
            
            this.ws.onmessage = (event) => {
                this.handleHardwareMessage(event.data);
            };
            
            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
            };
            
        } catch (error) {
            console.error('Hardware connection failed:', error);
            this.updateConnectionStatus('error');
        }
    }
    
    handleHardwareMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'score':
                    // Handle scoring data
                    if (message.player && window.smartCourtApp) {
                        window.smartCourtApp.addScore(message.player);
                    }
                    break;
                    
                case 'sensor':
                    // Handle sensor data
                    this.handleSensorData(message.data);
                    break;
                    
                case 'status':
                    // Handle status updates
                    this.handleStatusUpdate(message.status);
                    break;
            }
        } catch (error) {
            console.error('Hardware message parsing failed:', error);
        }
    }
    
    handleSensorData(data) {
        // Handle sensor data (like ball speed, position, etc.)
        // Additional sensor data processing logic can be added here
    }
    
    handleStatusUpdate(status) {
        // Handle hardware status updates
        console.log('Hardware status update:', status);
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.connect();
            }, this.reconnectDelay);
        } else {
            console.log('Maximum reconnection attempts reached, stopping attempts');
        }
    }
    
    updateConnectionStatus(status) {
        const indicator = document.getElementById('hardwareIndicator');
        if (indicator) {
            const dot = indicator.querySelector('.indicator-dot');
            const text = indicator.querySelector('span');
            
            dot.className = `indicator-dot ${status}`;
            
            switch (status) {
                case 'connected':
                    text.textContent = 'Hardware connected';
                    break;
                case 'disconnected':
                    text.textContent = 'Hardware disconnected';
                    break;
                case 'error':
                    text.textContent = 'Connection error';
                    break;
            }
        }
        
        // Add corresponding CSS styles
        this.addConnectionStyles();
    }
    
    addConnectionStyles() {
        if (document.getElementById('hardwareStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'hardwareStyles';
        style.textContent = `
            .indicator-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            
            .indicator-dot.connected {
                background: #4CAF50;
            }
            
            .indicator-dot.disconnected {
                background: #ff9800;
            }
            
            .indicator-dot.error {
                background: #f44336;
            }
            
            .indicator-dot.offline {
                background: #ccc;
                animation: none;
            }
            
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.updateConnectionStatus('offline');
    }
    
    sendMessage(message) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify(message));
        }
    }
}

// Initialize game control manager
document.addEventListener('DOMContentLoaded', () => {
    window.gameControlManager = new GameControlManager();
    window.hardwareConnection = new HardwareConnection();
    
    // Add keyboard event listeners
    document.addEventListener('keydown', (e) => {
        window.gameControlManager.handleKeyboardShortcuts(e);
    });
    
    // Try to auto-load saved game after page loads
    setTimeout(() => {
        window.gameControlManager.autoLoadGame();
    }, 1000);
    
    // Periodic auto-save (every 30 seconds)
    setInterval(() => {
        if (window.smartCourtApp && window.smartCourtApp.gameState.status === 'playing') {
            window.gameControlManager.autoSaveGame();
        }
    }, 30000);
}); 