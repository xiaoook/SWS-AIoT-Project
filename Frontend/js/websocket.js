// WebSocket Manager for Real-time Score Updates
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.serverUrl = CONFIG.BACKEND_URL; // Use configured backend URL
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000; // 3 second reconnect delay
        this.callbacks = {
            onScoreUpdate: null,
            onGameStatus: null,
            onRoundUpdate: null,
            onConnectionStatus: null,
            onPositionUpdate: null
        };
        
        // Event listener storage
        this.eventListeners = {};
        
        this.init();
    }
    
    // Add event listener
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }
    
    // Remove event listener
    off(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }
    
    // Trigger event
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }
    
    init() {
        // Add Socket.IO client library
        this.loadSocketIOClient();
    }
    
    loadSocketIOClient() {
        // Check if Socket.IO is already loaded
        if (typeof io !== 'undefined') {
            this.connect();
            return;
        }
        
        // Dynamically load Socket.IO client - Use v4 compatible version
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
        // Try Socket.IO connection directly, avoid CORS issues
        try {
            console.log('Connecting to WebSocket server...');
            // Use compatible Socket.IO v4 configuration
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
    
            // Removed checkServerAvailable method - avoid CORS issues
        // Socket.IO handles connection checking itself
    
    setupEventListeners() {
        // Connection successful
        this.socket.on('connect', () => {
            console.log('WebSocket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected');
            this.emit('connect');
            
            // Sync score display once after successful connection
            setTimeout(() => {
                if (window.syncAllScores) {
                    window.syncAllScores();
                }
            }, 1000);
        });
        
        // Connection disconnected
        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
            this.emit('disconnect');
            this.attemptReconnect();
        });
        
        // Receive real-time score updates - Match backend format
        this.socket.on('score_update', (current_score) => {
            console.log('Score update received:', current_score);
            this.handleScoreUpdate(current_score);
        });
        
        // Receive position updates - From MQTT
        this.socket.on('position_update', (position_data) => {
            console.log('Position update received:', position_data);
            this.handlePositionUpdate(position_data);
        });
        
        // Receive win rate predictions - From CV model
        this.socket.on('win_rate_prediction', (prediction_data) => {
            console.log('Win rate prediction received:', prediction_data);
            this.handleWinRatePrediction(prediction_data);
        });
        
        // Connection error
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            console.error('Error details:', error.message, error.description, error.context);
            this.handleConnectionError();
        });
        
        // Reconnection failed
        this.socket.on('reconnect_failed', () => {
            console.error('WebSocket reconnection failed');
            this.updateConnectionStatus('error');
            this.showConnectionError('Failed to reconnect to server');
        });
        
        // Reconnection attempt
        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`WebSocket reconnect attempt #${attemptNumber}`);
            this.updateConnectionStatus('connecting');
        });
        
        // Detailed connection event handling
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
        
        // Server messages
        this.socket.on('message', (message) => {
            console.log('Server message:', message);
            this.showMessage(message, 'info');
        });

        // Goal success feedback
        this.socket.on('goal_success', (data) => {
            console.log('Goal success:', data);
            this.showMessage(`Goal scored by Team ${data.team}! Score: ${data.score.A} - ${data.score.B}`, 'success');
            this.addLiveFeedItem(`🎉 Team ${data.team} scored! Current score: ${data.score.A} - ${data.score.B}`, 'success');
        });

        // Error messages
        this.socket.on('error', (data) => {
            console.error('Server error:', data);
            this.showMessage(data.message || 'Unknown error', 'error');
            this.addLiveFeedItem(`❌ Error: ${data.message || 'Unknown error'}`, 'error');
        });
    }
    
    // Handle score update - Adapt backend {A: 0, B: 0} format
    handleScoreUpdate(scoreData) {
        // Check if game is in progress before updating score
        if (window.smartCourtApp && window.smartCourtApp.gameState.status !== 'playing') {
            console.log(`🚫 Score update from backend ignored - game is ${window.smartCourtApp.gameState.status}`);
            return;
        }
        
        // Backend sends format {A: 0, B: 0}, need to convert to frontend format
        const convertedScore = {
            playerA: scoreData.A || 0,
            playerB: scoreData.B || 0
        };
        
        // Update score display in UI
        this.updateScoreDisplay(convertedScore);
        
        // Call callback function
        if (this.callbacks.onScoreUpdate) {
            this.callbacks.onScoreUpdate(convertedScore);
        }
        
        // No longer show generic score update messages, only specific messages when scoring
        // const message = `Score Update: ${convertedScore.playerA} - ${convertedScore.playerB}`;
        // this.showMessage(message, 'score');
    }
    
    // Handle position update - From MQTT data
    handlePositionUpdate(positionData) {
        // Trigger position update event
        this.emit('position_update', positionData);
        
        // Call position update callback (compatible with old API)
        if (this.callbacks.onPositionUpdate) {
            this.callbacks.onPositionUpdate(positionData);
        }
    }
    
    // Handle win rate prediction - From CV model
    handleWinRatePrediction(predictionData) {
        console.log('🎯 WebSocket received win rate prediction:', predictionData);
        
        // Validate data format before processing
        if (!predictionData) {
            console.warn('🎯 WebSocket received null win rate prediction data');
            return;
        }
        
        if (typeof predictionData !== 'object') {
            console.warn('🎯 WebSocket received invalid win rate prediction data type:', typeof predictionData);
            return;
        }
        
        // Trigger win rate prediction event
        this.emit('win_rate_prediction', predictionData);
        
        // Call win rate prediction callback (compatible with old API)
        if (this.callbacks.onWinRatePrediction) {
            this.callbacks.onWinRatePrediction(predictionData);
        }
        
        // Update win rate predictor if available
        if (window.winRatePredictor) {
            window.winRatePredictor.handleWinRatePrediction(predictionData);
        }
    }
    
    // Update score display
    updateScoreDisplay(scoreData) {
        const playerAScore = scoreData.playerA || 0;
        const playerBScore = scoreData.playerB || 0;
        
        console.log('UpdateScoreDisplay called with:', {
            original: scoreData,
            converted: { playerA: playerAScore, playerB: playerBScore }
        });
        
        // Update main scoreboard
        const scoreAElement = document.getElementById('scoreA');
        const scoreBElement = document.getElementById('scoreB');
        
        if (scoreAElement) {
            scoreAElement.textContent = playerAScore;
            console.log('Updated scoreA element to:', playerAScore);
            // Add animation effect
            scoreAElement.classList.add('score-updated');
            setTimeout(() => scoreAElement.classList.remove('score-updated'), 500);
        }
        
        if (scoreBElement) {
            scoreBElement.textContent = playerBScore;
            console.log('Updated scoreB element to:', playerBScore);
            // Add animation effect
            scoreBElement.classList.add('score-updated');
            setTimeout(() => scoreBElement.classList.remove('score-updated'), 500);
        }

        // Update header navigation score display - Enhanced debugging
        const headerScoreA = document.getElementById('headerScoreA');
        const headerScoreB = document.getElementById('headerScoreB');
        if (headerScoreA) {
            headerScoreA.textContent = playerAScore;
            console.log('Updated headerScoreA to:', playerAScore, 'Element found:', !!headerScoreA);
        } else {
            console.error('headerScoreA element not found!');
        }
        if (headerScoreB) {
            headerScoreB.textContent = playerBScore;
            console.log('Updated headerScoreB to:', playerBScore, 'Element found:', !!headerScoreB);
        } else {
            console.error('headerScoreB element not found!');
        }

        // Update mobile score display
        const mobileScoreA = document.getElementById('mobileScoreA');
        const mobileScoreB = document.getElementById('mobileScoreB');
        if (mobileScoreA) {
            mobileScoreA.textContent = playerAScore;
            console.log('Updated mobileScoreA to:', playerAScore);
        }
        if (mobileScoreB) {
            mobileScoreB.textContent = playerBScore;
            console.log('Updated mobileScoreB to:', playerBScore);
        }
        
        // Call global update function (if exists)
        if (window.updateScoresFromWebSocket) {
            window.updateScoresFromWebSocket({ playerA: playerAScore, playerB: playerBScore });
        }
        
        // Update application state
        if (window.smartCourtApp && window.smartCourtApp.gameState) {
            window.smartCourtApp.gameState.scores = {
                playerA: playerAScore,
                playerB: playerBScore
            };
            
            // Update UI
            window.smartCourtApp.updateScoreboard();
        }
        
        // Final backup update mechanism - Force update all score elements directly
        setTimeout(() => {
            const allScoreElements = {
                'scoreA': playerAScore,
                'scoreB': playerBScore,
                'headerScoreA': playerAScore,
                'headerScoreB': playerBScore,
                'mobileScoreA': playerAScore,
                'mobileScoreB': playerBScore
            };
            
            Object.entries(allScoreElements).forEach(([elementId, score]) => {
                const element = document.getElementById(elementId);
                if (element && element.textContent !== score.toString()) {
                    element.textContent = score;
                    console.log(`Backup update: ${elementId} set to ${score}`);
                }
            });
        }, 100);
    }
    
    // Connection status update
    updateConnectionStatus(status) {
        const statusIndicator = document.getElementById('wsStatus');
        if (statusIndicator) {
            statusIndicator.textContent = status;
            statusIndicator.className = `ws-status ${status}`;
        }
        
        if (this.callbacks.onConnectionStatus) {
            this.callbacks.onConnectionStatus(status);
        }
        
        // Update UI based on connection status
        this.updateUIConnectionState(status);
    }
    
    // Update UI connection status
    updateUIConnectionState(status) {
        const gameControls = document.querySelectorAll('.control-panel button');
        const isConnected = status === 'connected';
        
        gameControls.forEach(button => {
            if (isConnected) {
                button.disabled = false;
                button.classList.remove('disabled');
            } else {
                // Only disable specific buttons when disconnected
                if (button.id === 'startGame') {
                    button.disabled = true;
                    button.classList.add('disabled');
                }
            }
        });
    }
    
    // Handle connection error
    handleConnectionError() {
        this.isConnected = false;
        this.updateConnectionStatus('error');
        this.attemptReconnect();
    }
    
            // Try to reconnect
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
    
    // Show connection error
    showConnectionError(message) {
        this.showMessage(`Connection Error: ${message}`, 'error');
    }
    
    // Show message
    showMessage(message, type = 'info') {
        if (window.smartCourtApp && window.smartCourtApp.showMessage) {
            window.smartCourtApp.showMessage(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // Add live feed item
    addLiveFeedItem(message, type = 'info') {
        if (window.smartCourtApp && window.smartCourtApp.addLiveFeedItem) {
            window.smartCourtApp.addLiveFeedItem(message, type);
        }
    }
    
    // Send goal to backend using HTTP API
    async simulateGoal(team) {
        // Check confirmation status (double protection)
        if (!window.arePlayersConfirmed || !window.arePlayersConfirmed()) {
            this.showMessage('Please confirm players first!', 'error');
            this.addLiveFeedItem('❌ Players not confirmed - Cannot score', 'error');
            return;
        }
        
        // Check game status
        if (window.smartCourtApp && window.smartCourtApp.gameState.status !== 'playing') {
            this.showMessage('Please start the game first', 'error');
            this.addLiveFeedItem('❌ Game not started - Cannot score', 'error');
            return;
        }
        
        // Backend expects 'A' or 'B' instead of 'playerA' or 'playerB'
        const backendTeam = team === 'playerA' ? 'A' : 'B';
        
        // Show sending message
        this.addLiveFeedItem(`⚡ Sending goal for Team ${backendTeam}...`, 'info');
        
        try {
            // Call backend HTTP API directly
            const response = await fetch(`${window.CONFIG.API_URLS.GOAL}?team=${backendTeam}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    console.log(`✅ Goal recorded: Team ${backendTeam} scored, score: ${data.score.A} - ${data.score.B}`);
                    this.addLiveFeedItem(`✅ Goal scored by Team ${backendTeam}! Score: ${data.score.A} - ${data.score.B}`, 'success');
                    
                    // Update local score display
                    if (window.smartCourtApp && window.smartCourtApp.updateScoreFromBackend) {
                        window.smartCourtApp.updateScoreFromBackend(data.score);
                    }
                    
                    // Show success message
                    this.showMessage(`Goal scored by Team ${backendTeam}! Score: ${data.score.A} - ${data.score.B}`, 'success');
                } else {
                    throw new Error(data.message || 'Failed to record goal');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Failed to record goal:', error);
            
            // Provide more user-friendly error messages
            let errorMessage = error.message;
            
            if (error.message.includes('HTTP 400')) {
                errorMessage = 'Please start the game first';
            } else if (error.message.includes('HTTP 404')) {
                errorMessage = 'Backend service not available';
            } else if (error.message.includes('HTTP 500')) {
                errorMessage = 'Backend server error';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'Network connection error';
            }
            
            this.addLiveFeedItem(`❌ Failed to record goal: ${errorMessage}`, 'error');
            this.showMessage(`Failed to record goal: ${errorMessage}`, 'error');
        }
    }
    
    // Set callback function
    setCallback(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
    }
    
    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
        }
    }
    
    // Get connection status
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            serverUrl: this.serverUrl
        };
    }
    
    // Test win rate prediction flow
    testWinRatePredictionFlow() {
        console.log('🧪 Testing WebSocket win rate prediction flow...');
        
        // Test with valid data
        this.handleWinRatePrediction({
            playerA: 70,
            playerB: 30,
            confidence: 0.9
        });
        
        // Test with invalid data after 3 seconds
        setTimeout(() => {
            this.handleWinRatePrediction(null);
        }, 3000);
        
        // Test with string data
        setTimeout(() => {
            this.handleWinRatePrediction("invalid data");
        }, 5000);
    }
}

// Create global WebSocket manager instance
window.wsManager = new WebSocketManager();
window.websocketManager = window.wsManager; // Provide alias for hockey visualization module

// Export WebSocket manager
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebSocketManager;
} 