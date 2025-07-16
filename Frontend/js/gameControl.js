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
                // 胜率由模型提供，前端不计算
                playerA: 'Model Data Required',
                playerB: 'Model Data Required'
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

// Real-time Win Rate Predictor (using CV prediction model)
class WinRatePredictor {
    constructor() {
        this.isConnected = false;
        this.winRateData = { playerA: 50, playerB: 50 }; // Default 50-50
        this.lastUpdateTime = null;
        this.updateInterval = null;
        
        this.init();
    }
    
    init() {
        this.setupWinRateIndicator();
        this.setupWebSocketConnection();
        this.setupGameStateListener();
    }
    
    setupWinRateIndicator() {
        // 创建主面板
        const indicator = document.createElement('div');
        indicator.id = 'winRateIndicator';
        indicator.className = 'win-rate-indicator';
        indicator.innerHTML = `
            <div class="win-rate-header" id="winRateHeader">
                <div class="prediction-icon">🎯</div>
                <span class="prediction-title">Win Rate</span>
                <div class="control-buttons">
                    <button class="collapse-btn" id="collapseBtn" title="Collapse/Expand">−</button>
                    <button class="close-btn" id="closeBtn" title="Minimize to ball">○</button>
                </div>
            </div>
            <div class="win-rate-content" id="winRateContent">
                <div class="vs-indicator">
                    <div class="vs-text">VS</div>
                    <div class="match-status">Live Prediction</div>
                </div>
                <div class="players-container">
                    <div class="player-win-rate player-a">
                        <div class="player-avatar">🔵</div>
                        <div class="player-info">
                            <div class="player-name">Player A</div>
                            <div class="win-percentage">50%</div>
                        </div>
                        <div class="win-rate-bar">
                            <div class="win-rate-fill player-a-fill" style="width: 50%"></div>
                            <div class="win-rate-glow player-a-glow"></div>
                        </div>
                    </div>
                    <div class="player-win-rate player-b">
                        <div class="player-avatar">🔴</div>
                        <div class="player-info">
                            <div class="player-name">Player B</div>
                            <div class="win-percentage">50%</div>
                        </div>
                        <div class="win-rate-bar">
                            <div class="win-rate-fill player-b-fill" style="width: 50%"></div>
                            <div class="win-rate-glow player-b-glow"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="prediction-status" id="predictionStatus">
                <div class="status-info">
                    <span class="status-text">CV Model Ready</span>
                </div>
                <div class="status-dot active"></div>
            </div>
        `;
        
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 255, 0.98));
            border-radius: 20px;
            font-size: 0.75rem;
            z-index: 1000;
            box-shadow: 0 10px 40px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.08);
            border: 2px solid rgba(255,255,255,0.5);
            backdrop-filter: blur(25px);
            min-width: 240px;
            max-width: 280px;
            display: none;
            cursor: move;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        // 创建小球
        const floatingBall = document.createElement('div');
        floatingBall.id = 'winRateFloatingBall';
        floatingBall.className = 'win-rate-floating-ball';
        floatingBall.innerHTML = `
            <div class="ball-content">
                <div class="ball-icon">🎯</div>
                <div class="ball-rates">
                    <div class="rate-display">
                        <span class="rate-a">50%</span>
                        <span class="rate-b">50%</span>
                    </div>
                    <div class="rate-status">Ready</div>
                </div>
            </div>
            <div class="resize-handle" title="拖拽调整大小"></div>
        `;
        
        floatingBall.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 90px;
            height: 140px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 45px;
            display: flex;
            cursor: pointer;
            z-index: 1000;
            box-shadow: 0 6px 25px rgba(102, 126, 234, 0.35);
            transition: all 0.3s ease;
            border: 2px solid rgba(255,255,255,0.2);
            min-width: 60px;
            max-width: 120px;
            min-height: 100px;
            max-height: 180px;
        `;
        
        document.body.appendChild(indicator);
        document.body.appendChild(floatingBall);
        
        // Ball is always visible (常驻显示)
        floatingBall.style.display = 'flex';
        
        // Initialize ball in inactive state
        const ballRates = floatingBall.querySelector('.ball-rates');
        if (ballRates) {
            ballRates.classList.add('inactive');
        }
        
        this.addWinRateStyles();
        this.setupIndicatorInteractions();
    }
    
    setupIndicatorInteractions() {
        const indicator = document.getElementById('winRateIndicator');
        const header = document.getElementById('winRateHeader');
        const content = document.getElementById('winRateContent');
        const status = document.getElementById('predictionStatus');
        const collapseBtn = document.getElementById('collapseBtn');
        const closeBtn = document.getElementById('closeBtn');
        const floatingBall = document.getElementById('winRateFloatingBall');
        const resizeHandle = document.getElementById('resizeHandle') || floatingBall.querySelector('.resize-handle');
        
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };
        let isCollapsed = false;
        let isResizing = false;
        let resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        
        // Restore saved position and state
        this.loadIndicatorState();
        
        // Ball click event (only if not clicking resize handle)
        floatingBall.addEventListener('click', (e) => {
            if (!e.target.classList.contains('resize-handle')) {
                this.showPanelFromBall();
            }
        });
        
        // Ball resize functionality
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                isResizing = true;
                const rect = floatingBall.getBoundingClientRect();
                resizeStart.x = e.clientX;
                resizeStart.y = e.clientY;
                resizeStart.width = rect.width;
                resizeStart.height = rect.height;
            });
        }
        
        document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const deltaX = e.clientX - resizeStart.x;
                const deltaY = e.clientY - resizeStart.y;
                
                const newWidth = Math.max(50, Math.min(100, resizeStart.width + deltaX));
                const newHeight = Math.max(80, Math.min(160, resizeStart.height + deltaY));
                
                floatingBall.style.width = newWidth + 'px';
                floatingBall.style.height = newHeight + 'px';
                
                // Adjust font sizes based on size (use height as base for vertical layout)
                const scaleFactor = newHeight / 140;
                const icon = floatingBall.querySelector('.ball-icon');
                const rateDisplay = floatingBall.querySelector('.rate-display');
                const rateStatus = floatingBall.querySelector('.rate-status');
                
                if (icon) icon.style.fontSize = (1.4 * scaleFactor) + 'rem';
                if (rateDisplay) rateDisplay.style.fontSize = (0.75 * scaleFactor) + 'rem';
                if (rateStatus) rateStatus.style.fontSize = (0.55 * scaleFactor) + 'rem';
            }
        });
        

        
        // Drag functionality
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('collapse-btn') || e.target.classList.contains('close-btn')) {
                return;
            }
            isDragging = true;
            const rect = indicator.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            header.style.cursor = 'grabbing';
            indicator.classList.add('dragging');
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = e.clientX - dragOffset.x;
                const y = e.clientY - dragOffset.y;
                
                // Boundary check
                const maxX = window.innerWidth - indicator.offsetWidth;
                const maxY = window.innerHeight - indicator.offsetHeight;
                
                const constrainedX = Math.max(0, Math.min(maxX, x));
                const constrainedY = Math.max(0, Math.min(maxY, y));
                
                indicator.style.left = constrainedX + 'px';
                indicator.style.top = constrainedY + 'px';
                indicator.style.right = 'auto';
                indicator.style.bottom = 'auto';
            }
            
            if (isResizing) {
                const deltaX = e.clientX - resizeStart.x;
                const deltaY = e.clientY - resizeStart.y;
                
                const newWidth = Math.max(50, Math.min(100, resizeStart.width + deltaX));
                const newHeight = Math.max(80, Math.min(160, resizeStart.height + deltaY));
                
                floatingBall.style.width = newWidth + 'px';
                floatingBall.style.height = newHeight + 'px';
                
                // Adjust font sizes based on size (use height as base for vertical layout)
                const scaleFactor = newHeight / 140;
                const icon = floatingBall.querySelector('.ball-icon');
                const rateDisplay = floatingBall.querySelector('.rate-display');
                const rateStatus = floatingBall.querySelector('.rate-status');
                
                if (icon) icon.style.fontSize = (1.4 * scaleFactor) + 'rem';
                if (rateDisplay) rateDisplay.style.fontSize = (0.75 * scaleFactor) + 'rem';
                if (rateStatus) rateStatus.style.fontSize = (0.55 * scaleFactor) + 'rem';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'move';
                indicator.classList.remove('dragging');
                
                // Save position
                this.saveIndicatorState();
            }
            
            if (isResizing) {
                isResizing = false;
                this.saveIndicatorState();
            }
        });
        
        // Collapse/expand functionality
        collapseBtn.addEventListener('click', () => {
            const content = document.getElementById('winRateContent');
            const status = document.getElementById('predictionStatus');
            
            isCollapsed = !isCollapsed;
            
            if (isCollapsed) {
                // 收缩时只显示标题
                content.style.display = 'none';
                status.style.display = 'none';
                collapseBtn.textContent = '+';
                collapseBtn.title = 'Expand';
                indicator.style.minWidth = '120px';
                indicator.style.maxWidth = '120px';
                indicator.classList.add('collapsed');
            } else {
                // 展开时显示完整内容
                content.style.display = 'block';
                status.style.display = 'flex';
                collapseBtn.textContent = '−';
                collapseBtn.title = 'Collapse';
                indicator.style.minWidth = '240px';
                indicator.style.maxWidth = '280px';
                indicator.classList.remove('collapsed');
            }
            
            // Save state
            this.saveIndicatorState();
        });
        
        // Close functionality - minimize to ball
        closeBtn.addEventListener('click', () => {
            this.hidePanelToBall();
        });
        
        // Double-click header to quickly collapse/expand
        header.addEventListener('dblclick', (e) => {
            if (e.target.classList.contains('collapse-btn') || e.target.classList.contains('close-btn')) {
                return;
            }
            collapseBtn.click();
        });
        
        // Keyboard shortcut support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && indicator.style.display !== 'none') {
                this.hidePanelToBall();
            }
        });
        
        // Prevent text selection while dragging
        indicator.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });
    }
    
    // 显示面板
    showIndicator() {
        this.showPanelFromBall();
    }
    
    // 隐藏面板
    hideIndicator() {
        this.hidePanelToBall();
    }
    
    // 从小球展开面板
    showPanelFromBall() {
        const indicator = document.getElementById('winRateIndicator');
        const floatingBall = document.getElementById('winRateFloatingBall');
        
        if (indicator && floatingBall) {
            // Hide ball
            floatingBall.style.display = 'none';
            
            // Show panel
            indicator.style.display = 'block';
            indicator.classList.add('show');
            
            // Remove animation class
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 600);
        }
    }
    
    // 将面板收起成小球
    hidePanelToBall() {
        const indicator = document.getElementById('winRateIndicator');
        const floatingBall = document.getElementById('winRateFloatingBall');
        
        if (indicator && floatingBall) {
            // Hide panel
            indicator.style.display = 'none';
            indicator.classList.remove('show');
            
            // Show ball
            floatingBall.style.display = 'flex';
            floatingBall.classList.add('show');
            
            // Remove animation class
            setTimeout(() => {
                floatingBall.classList.remove('show');
            }, 600);
        }
    }
    
    // 保存指示器状态
    saveIndicatorState() {
        const indicator = document.getElementById('winRateIndicator');
        const content = document.getElementById('winRateContent');
        const floatingBall = document.getElementById('winRateFloatingBall');
        
        if (indicator) {
            const ballRect = floatingBall ? floatingBall.getBoundingClientRect() : null;
            const state = {
                position: {
                    left: indicator.style.left,
                    top: indicator.style.top,
                    right: indicator.style.right,
                    bottom: indicator.style.bottom
                },
                ballSize: ballRect ? {
                    width: ballRect.width,
                    height: ballRect.height
                } : null,
                isCollapsed: content && content.style.display === 'none',
                isPanelVisible: indicator.style.display !== 'none',
                timestamp: Date.now()
            };
            
            localStorage.setItem('winRateIndicatorState', JSON.stringify(state));
        }
    }
    
    // 恢复指示器状态
    loadIndicatorState() {
        const savedState = localStorage.getItem('winRateIndicatorState');
        if (!savedState) return;
        
        try {
            const state = JSON.parse(savedState);
            const indicator = document.getElementById('winRateIndicator');
            const content = document.getElementById('winRateContent');
            const status = document.getElementById('predictionStatus');
            const collapseBtn = document.getElementById('collapseBtn');
            const floatingBall = document.getElementById('winRateFloatingBall');
            
            if (indicator && state.position) {
                // Restore position
                if (state.position.left) indicator.style.left = state.position.left;
                if (state.position.top) indicator.style.top = state.position.top;
                if (state.position.right) indicator.style.right = state.position.right;
                if (state.position.bottom) indicator.style.bottom = state.position.bottom;
                
                // Restore collapsed state
                if (state.isCollapsed && content && status && collapseBtn) {
                    // 收缩时只显示标题
                    content.style.display = 'none';
                    status.style.display = 'none';
                    collapseBtn.textContent = '+';
                    collapseBtn.title = 'Expand';
                    indicator.style.minWidth = '120px';
                    indicator.style.maxWidth = '120px';
                    indicator.classList.add('collapsed');
                } else {
                    // 展开时显示完整内容
                    if (status) status.style.display = 'flex';
                    indicator.classList.remove('collapsed');
                }
                
                // Restore display state
                if (state.isPanelVisible) {
                    indicator.style.display = 'block';
                } else {
                    indicator.style.display = 'none';
                }
                
                // Restore ball size
                if (state.ballSize && floatingBall) {
                    floatingBall.style.width = state.ballSize.width + 'px';
                    floatingBall.style.height = state.ballSize.height + 'px';
                    
                    // Adjust font sizes based on size (use height as base for vertical layout)
                    const scaleFactor = state.ballSize.height / 140;
                    const icon = floatingBall.querySelector('.ball-icon');
                    const rateDisplay = floatingBall.querySelector('.rate-display');
                    const rateStatus = floatingBall.querySelector('.rate-status');
                    
                    if (icon) icon.style.fontSize = (1.4 * scaleFactor) + 'rem';
                    if (rateDisplay) rateDisplay.style.fontSize = (0.75 * scaleFactor) + 'rem';
                    if (rateStatus) rateStatus.style.fontSize = (0.55 * scaleFactor) + 'rem';
                }
            }
        } catch (e) {
            console.warn('Failed to load win rate indicator state:', e);
        }
    }
    
    setupWebSocketConnection() {
        // Listen for CV prediction data via WebSocket
        if (window.websocketManager) {
            window.websocketManager.on('win_rate_prediction', (data) => {
                this.handleWinRatePrediction(data);
            });
        }
        
        // Also try to connect to MQTT for CV prediction data
        if (window.mqttManager) {
            window.mqttManager.on('cv_prediction', (data) => {
                this.handleWinRatePrediction(data);
            });
        }
        
        console.log('🎯 Win rate predictor connected to data sources');
    }
    
    setupGameStateListener() {
        // Listen for game state changes
        document.addEventListener('gameStateChange', (e) => {
            this.handleGameStateChange(e.detail);
        });
        
        // Check initial game state
        if (window.smartCourtApp) {
            this.handleGameStateChange({
                status: window.smartCourtApp.gameState.status
            });
        }
    }
    
    handleGameStateChange(gameState) {
        const indicator = document.getElementById('winRateIndicator');
        const floatingBall = document.getElementById('winRateFloatingBall');
        
        if (!indicator || !floatingBall) return;
        
        console.log('🎯 Win rate predictor - Game state changed:', gameState.status);
        
        // Ball is always visible, but rates only show when game is in progress
        if (gameState.status === 'playing') {
            // Show active win rate data
            const ballRates = floatingBall.querySelector('.ball-rates');
            if (ballRates) {
                ballRates.classList.remove('inactive');
            }
            
            this.startPredictionUpdates();
            // Initialize with default values
            this.updateWinRateDisplay();
            
            // Update status
            const rateStatus = floatingBall.querySelector('.rate-status');
            if (rateStatus) {
                rateStatus.textContent = 'Live';
            }
        } else {
            // Show inactive state
            const ballRates = floatingBall.querySelector('.ball-rates');
            if (ballRates) {
                ballRates.classList.add('inactive');
            }
            
            // Reset to default values
            const rateA = floatingBall.querySelector('.rate-a');
            const rateB = floatingBall.querySelector('.rate-b');
            const rateStatus = floatingBall.querySelector('.rate-status');
            
            if (rateA) rateA.textContent = '50%';
            if (rateB) rateB.textContent = '50%';
            if (rateStatus) rateStatus.textContent = 'Ready';
            
            // Hide detailed panel
            indicator.style.display = 'none';
            this.stopPredictionUpdates();
        }
    }
    
    handleWinRatePrediction(data) {
        // Expected data format: { playerA: 65, playerB: 35, confidence: 0.85 }
        if (data && typeof data.playerA === 'number' && typeof data.playerB === 'number') {
            this.winRateData = {
                playerA: Math.round(data.playerA),
                playerB: Math.round(data.playerB)
            };
            
            this.updateWinRateDisplay();
            this.lastUpdateTime = Date.now();
            
            console.log('🎯 Win rate prediction updated:', this.winRateData);
        }
    }
    
    updateWinRateDisplay() {
        const indicator = document.getElementById('winRateIndicator');
        const floatingBall = document.getElementById('winRateFloatingBall');
        
        if (!indicator) return;
        
        // Update player names
        const playerAName = this.getPlayerName('playerA');
        const playerBName = this.getPlayerName('playerB');
        
        // Update percentages
        const playerAPercentage = indicator.querySelector('.player-a .win-percentage');
        const playerBPercentage = indicator.querySelector('.player-b .win-percentage');
        const playerAFill = indicator.querySelector('.player-a-fill');
        const playerBFill = indicator.querySelector('.player-b-fill');
        const playerANameEl = indicator.querySelector('.player-a .player-name');
        const playerBNameEl = indicator.querySelector('.player-b .player-name');
        
        if (playerAPercentage) playerAPercentage.textContent = `${this.winRateData.playerA}%`;
        if (playerBPercentage) playerBPercentage.textContent = `${this.winRateData.playerB}%`;
        if (playerAFill) playerAFill.style.width = `${this.winRateData.playerA}%`;
        if (playerBFill) playerBFill.style.width = `${this.winRateData.playerB}%`;
        if (playerANameEl) playerANameEl.textContent = playerAName;
        if (playerBNameEl) playerBNameEl.textContent = playerBName;
        
        // Update status
        const statusText = indicator.querySelector('.status-text');
        
        if (statusText) {
            const timeSinceUpdate = this.lastUpdateTime ? Date.now() - this.lastUpdateTime : 0;
            if (this.winRateData.status === 'waiting_for_model') {
                statusText.textContent = 'Waiting for model data';
            } else if (timeSinceUpdate < 5000) {
                statusText.textContent = 'CV Model Active';
            } else {
                statusText.textContent = 'CV Model Ready';
            }
        }
        
        // Confidence badge removed - no longer needed
        
        // Update floating ball with current win rates
        if (floatingBall) {
            const rateA = floatingBall.querySelector('.rate-a');
            const rateB = floatingBall.querySelector('.rate-b');
            const rateStatus = floatingBall.querySelector('.rate-status');
            
            // Update rates in ball
            if (rateA) rateA.textContent = `${this.winRateData.playerA}%`;
            if (rateB) rateB.textContent = `${this.winRateData.playerB}%`;
            
            // Update status
            if (rateStatus) {
                const timeSinceUpdate = this.lastUpdateTime ? Date.now() - this.lastUpdateTime : 0;
                if (this.winRateData.status === 'waiting_for_model') {
                    rateStatus.textContent = 'Waiting';
                } else if (timeSinceUpdate < 5000) {
                    rateStatus.textContent = 'Live';
                } else {
                    rateStatus.textContent = 'Ready';
                }
            }
        }
    }
    
    getPlayerName(player) {
        if (window.playerManager && window.playerManager.currentPlayers) {
            return window.playerManager.currentPlayers[player] || (player === 'playerA' ? 'Player A' : 'Player B');
        }
        return player === 'playerA' ? 'Player A' : 'Player B';
    }
    
    showIndicator() {
        const indicator = document.getElementById('winRateIndicator');
        if (indicator) {
            indicator.style.display = 'block';
            indicator.style.animation = 'fadeIn 0.3s ease-in';
        }
    }
    
    hideIndicator() {
        const indicator = document.getElementById('winRateIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    startPredictionUpdates() {
        // Request prediction updates every 2 seconds during gameplay
        this.updateInterval = setInterval(() => {
            this.requestPredictionUpdate();
        }, 2000);
    }
    
    stopPredictionUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    requestPredictionUpdate() {
        // Send request to CV model for updated prediction
        if (window.websocketManager) {
            window.websocketManager.emit('request_win_rate_prediction', {
                timestamp: Date.now()
            });
        }
        
        // 不再使用模拟数据，只等待后端模型提供真实数据
        if (!this.lastUpdateTime || (Date.now() - this.lastUpdateTime) > 10000) {
            console.log('⚠️ No recent win rate data from backend model');
        }
    }
    
    simulatePrediction() {
        // 不再自己计算胜率，等待后端模型数据
        console.log('⚠️ Win rate simulation disabled - waiting for backend model data');
        
        // 显示默认等待状态
        this.handleWinRatePrediction({
            playerA: 50,
            playerB: 50,
            confidence: 0,
            timestamp: Date.now(),
            status: 'waiting_for_model'
        });
    }
    
    addWinRateStyles() {
        if (document.getElementById('winRateStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'winRateStyles';
        style.textContent = `
            .win-rate-indicator {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                user-select: none;
                padding: 1rem;
                position: relative;
                overflow: hidden;
            }
            
            .win-rate-indicator::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(45deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .win-rate-indicator:hover::before {
                opacity: 1;
            }
            
            .win-rate-header {
                display: flex;
                align-items: center;
                gap: 0.6rem;
                margin-bottom: 0.8rem;
                padding-bottom: 0.6rem;
                border-bottom: 2px solid rgba(102, 126, 234, 0.15);
                cursor: move;
                position: relative;
                z-index: 1;
            }
            
            .win-rate-indicator.collapsed .win-rate-header {
                flex-direction: column;
                align-items: center;
                gap: 0.4rem;
                margin-bottom: 0;
                padding-bottom: 0.4rem;
                text-align: center;
            }
            
            .win-rate-indicator.collapsed .prediction-title {
                font-size: 0.8rem;
                line-height: 1.2;
            }
            
            .win-rate-indicator.collapsed .control-buttons {
                flex-direction: column;
                gap: 0.2rem;
            }
            
            .prediction-icon {
                font-size: 1.2rem;
                animation: iconPulse 2s infinite;
            }
            
            .prediction-title {
                font-weight: 700;
                color: #1a1a1a;
                font-size: 0.9rem;
                flex: 1;
                background: linear-gradient(45deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .control-buttons {
                display: flex;
                gap: 0.3rem;
            }
            
            .collapse-btn, .close-btn {
                width: 28px;
                height: 28px;
                border: none;
                border-radius: 10px;
                background: rgba(255,255,255,0.9);
                color: #666;
                font-size: 0.85rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                font-weight: bold;
                box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                border: 1px solid rgba(255,255,255,0.6);
            }
            
            .collapse-btn:hover, .close-btn:hover {
                background: rgba(255,255,255,1);
                color: #333;
                transform: scale(1.05);
                box-shadow: 0 4px 15px rgba(0,0,0,0.12);
            }
            
            .close-btn:hover {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
            }
            
            .vs-indicator {
                text-align: center;
                margin-bottom: 0.8rem;
                position: relative;
                padding: 0.8rem 0;
            }
            
            .vs-text {
                font-size: 1.2rem;
                font-weight: 900;
                color: #ffffff;
                margin-bottom: 0.3rem;
                text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                padding: 0.4rem 1.2rem;
                border-radius: 20px;
                display: inline-block;
                box-shadow: 0 4px 15px rgba(238, 90, 36, 0.3);
            }
            
            .match-status {
                font-size: 0.75rem;
                color: #ffffff;
                background: linear-gradient(135deg, #4834d4, #686de0);
                padding: 0.3rem 0.8rem;
                border-radius: 15px;
                display: inline-block;
                margin-top: 0.3rem;
                font-weight: 600;
                text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                box-shadow: 0 3px 10px rgba(72, 52, 212, 0.3);
            }
            
            .players-container {
                display: flex;
                flex-direction: column;
                gap: 0.8rem;
                margin-bottom: 0.8rem;
            }
            
            .player-win-rate {
                display: flex;
                align-items: center;
                gap: 0.6rem;
                padding: 0.8rem;
                background: rgba(255,255,255,0.7);
                border-radius: 16px;
                box-shadow: 0 3px 15px rgba(0,0,0,0.08);
                transition: all 0.3s ease;
                border: 1px solid rgba(255,255,255,0.8);
            }
            
            .player-win-rate:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 25px rgba(0,0,0,0.12);
                background: rgba(255,255,255,0.9);
            }
            
            .player-avatar {
                font-size: 1.5rem;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255,255,255,0.9);
                box-shadow: 0 3px 12px rgba(0,0,0,0.1);
                border: 2px solid rgba(255,255,255,0.8);
            }
            
            .player-info {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
            }
            
            .player-name {
                font-weight: 600;
                font-size: 0.75rem;
                color: #444;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .win-percentage {
                font-weight: 900;
                font-size: 1.3rem;
                color: #333;
            }
            
            .player-a .win-percentage {
                color: #2563eb;
                text-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
            }
            
            .player-b .win-percentage {
                color: #dc2626;
                text-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);
            }
            
            .win-rate-bar {
                width: 70px;
                height: 10px;
                background: rgba(229, 231, 235, 0.6);
                border-radius: 8px;
                overflow: hidden;
                position: relative;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
                border: 1px solid rgba(255,255,255,0.4);
            }
            
            .win-rate-fill {
                height: 100%;
                border-radius: 8px;
                transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            }
            
            .player-a-fill {
                background: linear-gradient(90deg, #2563eb, #1d4ed8);
                box-shadow: 0 0 12px rgba(37, 99, 235, 0.4);
            }
            
            .player-b-fill {
                background: linear-gradient(90deg, #dc2626, #b91c1c);
                box-shadow: 0 0 12px rgba(220, 38, 38, 0.4);
            }
            
            .win-rate-glow {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.6), rgba(255,255,255,0.3));
                animation: shimmer 2s infinite;
            }
            
            .prediction-status {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-top: 0.8rem;
                border-top: 2px solid rgba(102, 126, 234, 0.15);
                position: relative;
                z-index: 1;
                margin-top: 0.4rem;
            }
            
            .status-info {
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
            }
            
            .status-text {
                font-size: 0.75rem;
                color: #555;
                font-weight: 600;
                text-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            
            .status-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #10b981;
                animation: pulse 2s infinite;
                box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
                border: 1px solid rgba(255,255,255,0.3);
            }
            
            .status-dot.active {
                background: #10b981;
            }
            
            .status-dot.inactive {
                background: #6b7280;
                animation: none;
                box-shadow: none;
            }
            
            .win-rate-indicator:hover {
                transform: translateY(-4px);
                box-shadow: 0 15px 45px rgba(0,0,0,0.15), 0 6px 25px rgba(0,0,0,0.1);
            }
            
            .win-rate-indicator.dragging {
                transform: rotate(1deg) scale(1.02);
                box-shadow: 0 25px 60px rgba(0,0,0,0.25);
            }
            
            /* 小球样式 */
            .win-rate-floating-ball {
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                user-select: none;
                padding: 0.4rem;
            }
            
            .win-rate-floating-ball:hover {
                transform: scale(1.08);
                box-shadow: 0 10px 35px rgba(102, 126, 234, 0.5);
            }
            
            .win-rate-floating-ball:active {
                transform: scale(0.95);
            }
            
            .ball-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 0.3rem;
                flex: 1;
                padding: 0.3rem;
            }
            
            .ball-icon {
                font-size: 1.4rem;
                animation: ballPulse 2s infinite;
                flex-shrink: 0;
                margin-bottom: 0.2rem;
            }
            
            .ball-rates {
                display: flex;
                flex-direction: column;
                align-items: center;
                flex: 1;
                width: 100%;
            }
            
            .rate-display {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.2rem;
                font-size: 0.8rem;
                font-weight: 800;
                color: white;
                text-shadow: 0 1px 3px rgba(0,0,0,0.4);
                width: 100%;
            }
            
            .rate-a {
                color: #60a5fa;
                font-size: 0.9rem;
            }
            
            .rate-b {
                color: #f87171;
                font-size: 0.9rem;
            }
            
            .rate-separator {
                display: none;
            }
            
            .rate-status {
                font-size: 0.6rem;
                color: rgba(255,255,255,0.9);
                margin-top: 0.3rem;
                text-align: center;
                font-weight: 600;
            }
            
            .resize-handle {
                position: absolute;
                bottom: 4px;
                right: 50%;
                transform: translateX(50%);
                width: 16px;
                height: 8px;
                background: rgba(255,255,255,0.4);
                border-radius: 4px;
                cursor: ns-resize;
                opacity: 0;
                transition: opacity 0.3s ease;
                border: 1px solid rgba(255,255,255,0.6);
            }
            
            .win-rate-floating-ball:hover .resize-handle {
                opacity: 1;
            }
            
            .ball-rates.inactive {
                opacity: 0.5;
            }
            
            .ball-rates.inactive .rate-display {
                color: rgba(255,255,255,0.6);
            }
            
            @keyframes iconPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            @keyframes ballPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.1); }
                100% { opacity: 1; transform: scale(1); }
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px) scale(0.8); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            
            @keyframes ballBounceIn {
                from { transform: scale(0) rotate(180deg); opacity: 0; }
                to { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            
            @keyframes panelSlideIn {
                from { transform: translateX(100%) scale(0.9); opacity: 0; }
                to { transform: translateX(0) scale(1); opacity: 1; }
            }
            
            .win-rate-floating-ball.show {
                animation: ballBounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
            
            .win-rate-indicator.show {
                animation: panelSlideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Test method for manual testing
    testWinRatePrediction(playerARate = 65, playerBRate = 35) {
        console.log('🎯 Testing win rate prediction with:', { playerARate, playerBRate });
        
        // Ball is always visible, just update the rates
        const floatingBall = document.getElementById('winRateFloatingBall');
        if (floatingBall) {
            const ballRates = floatingBall.querySelector('.ball-rates');
            if (ballRates) {
                ballRates.classList.remove('inactive');
            }
        }
        
        this.handleWinRatePrediction({
            playerA: playerARate,
            playerB: playerBRate,
            confidence: 0.85,
            timestamp: Date.now()
        });
        
        console.log('🎨 Enhanced Win Rate Panel Features:');
        console.log('- 🎯 Permanent vertical floating ball in bottom-left corner');
        console.log('- 📊 Real-time win rate display (A% above B%)');
        console.log('- 🔄 Shows values only when game is in progress');
        console.log('- 📏 Resizable by dragging bottom handle (vertical layout)');
        console.log('- 🖱️ Click ball to expand detailed panel');
        console.log('- 🎨 Drag panel header to move');
        console.log('- 📱 Click - to collapse panel (show header only)');
        console.log('- 🔵 Click ○ to minimize panel to ball');
        console.log('- ⌨️ Double-click header to toggle');
        console.log('- 🚪 Press Escape to minimize');
        console.log('- 💫 Smooth animations and improved colors');
        console.log('- 🎭 Beautiful gradient design with optimized VS section');
        console.log('- 🔧 Removed confidence display for cleaner look');
        console.log('- 📐 Vertical layout prevents content obstruction');
        console.log('- 🎚️ Collapsed view shows header only for minimal UI');
        
        // 添加快速测试示例
        console.log('🔧 Quick test commands:');
        console.log('window.winRatePredictor.testWinRatePrediction(70, 30)');
        console.log('window.winRatePredictor.testWinRatePrediction(45, 55)');
        console.log('window.winRatePredictor.testWinRatePrediction(80, 20)');
        console.log('window.winRatePredictor.showPanelFromBall()  // Show panel');
        console.log('window.winRatePredictor.hidePanelToBall()   // Hide to ball');
    }
}

// Initialize game control manager
document.addEventListener('DOMContentLoaded', () => {
    window.gameControlManager = new GameControlManager();
    window.winRatePredictor = new WinRatePredictor();
    
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