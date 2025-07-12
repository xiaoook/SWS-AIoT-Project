// Real-time Hockey Game Visualization Module
class HockeyVisualization {
    constructor() {
        this.isInitialized = false;
        this.isPaused = false;
        this.showTrails = true;
        this.showCoordinates = false;
        
        // Element references
        this.tableSurface = null;
        this.paddleA = null;
        this.paddleB = null;
        this.puck = null;
        this.positionIndicator = null;
        
        // Position data (will be updated after initialization)
        this.currentPositions = {
            paddleA: { x: 100, y: 200 },
            paddleB: { x: 700, y: 200 },
            puck: { x: 400, y: 200 }
        };
        
        // Position history (for trails)
        this.positionHistory = {
            paddleA: [],
            paddleB: [],
            puck: []
        };
        
        // Performance monitoring
        this.updateCount = 0;
        this.lastUpdateTime = Date.now();
        this.updateRate = 0;
        
        // Puck speed calculation
        this.lastPuckPosition = { x: 400, y: 200 };
        this.lastPuckTime = Date.now();
        this.puckSpeed = 0;
        
        console.log('🏒 HockeyVisualization initialized');
    }

    // Initialize visualization system
    init() {
        try {
            this.initializeElements();
            this.setupEventListeners();
            this.setupWebSocketConnection();
            this.startUpdateLoop();
            this.isInitialized = true;
            console.log('✅ Hockey visualization started successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize hockey visualization:', error);
            return false;
        }
    }

    // Initialize DOM elements
    initializeElements() {
        this.tableSurface = document.getElementById('hockeyTable');
        this.paddleA = document.getElementById('paddleA');
        this.paddleB = document.getElementById('paddleB');
        this.puck = document.getElementById('puck');
        this.positionIndicator = document.getElementById('positionIndicator');
        
        if (!this.tableSurface || !this.paddleA || !this.paddleB || !this.puck) {
            throw new Error('Required DOM elements not found');
        }
        
        // Set initial positions based on table dimensions
        this.setInitialPositions();
        this.updateVisualPositions();
        console.log('🎯 DOM elements initialized');
    }

    // Setup event listeners
    setupEventListeners() {
        // Control options
        const showTrailsCheckbox = document.getElementById('showTrails');
        const showCoordinatesCheckbox = document.getElementById('showCoordinates');
        const pauseVisualizationCheckbox = document.getElementById('pauseVisualization');
        
        if (showTrailsCheckbox) {
            showTrailsCheckbox.addEventListener('change', (e) => {
                this.showTrails = e.target.checked;
                console.log('🎭 Trails display:', this.showTrails ? 'enabled' : 'disabled');
            });
        }
        
        if (showCoordinatesCheckbox) {
            showCoordinatesCheckbox.addEventListener('change', (e) => {
                this.showCoordinates = e.target.checked;
                this.positionIndicator.style.display = this.showCoordinates ? 'block' : 'none';
                console.log('📍 Coordinates display:', this.showCoordinates ? 'enabled' : 'disabled');
            });
        }
        
        if (pauseVisualizationCheckbox) {
            pauseVisualizationCheckbox.addEventListener('change', (e) => {
                this.isPaused = e.target.checked;
                console.log('⏸️ Visualization:', this.isPaused ? 'paused' : 'resumed');
            });
        }
        
        // Mouse hover to show coordinates
        if (this.tableSurface) {
            this.tableSurface.addEventListener('mousemove', (e) => {
                if (this.showCoordinates) {
                    const rect = this.tableSurface.querySelector('.table-surface').getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    this.updatePositionIndicator(x, y);
                }
            });
            
            this.tableSurface.addEventListener('mouseleave', () => {
                if (this.positionIndicator) {
                    this.positionIndicator.style.display = 'none';
                }
            });
        }
        
        // Window resize handler
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.setInitialPositions();
                this.updateVisualPositions();
            }, 100);
        });
        
        console.log('👂 Event listeners set up');
    }

    // Setup WebSocket connection to receive MQTT data
    setupWebSocketConnection() {
        // Use existing WebSocket manager
        if (window.websocketManager) {
            // Listen for position update events
            window.websocketManager.on('position_update', (data) => {
                this.handlePositionUpdate(data);
            });
            
            // Listen for connection status changes
            window.websocketManager.on('connect', () => {
                this.updateConnectionStatus(true);
            });
            
            window.websocketManager.on('disconnect', () => {
                this.updateConnectionStatus(false);
            });
            
            console.log('🔌 WebSocket connection listeners set up');
        } else {
            console.warn('⚠️ WebSocket manager not available, using demo mode');
            this.startDemoMode();
        }
    }

    // Handle position update data
    handlePositionUpdate(data) {
        if (this.isPaused) return;
        
        try {
            // Parse position data
            if (data.paddleA) {
                this.updatePosition('paddleA', data.paddleA.x, data.paddleA.y);
            }
            
            if (data.paddleB) {
                this.updatePosition('paddleB', data.paddleB.x, data.paddleB.y);
            }
            
            if (data.puck) {
                this.updatePuckPosition(data.puck.x, data.puck.y);
            }
            
            // Update frequency statistics
            this.updateCount++;
            const now = Date.now();
            if (now - this.lastUpdateTime >= 1000) {
                this.updateRate = this.updateCount;
                this.updateCount = 0;
                this.lastUpdateTime = now;
                this.updateRateDisplay();
            }
            
        } catch (error) {
            console.error('❌ Error processing position update:', error);
        }
    }

    // Get current table dimensions
    getTableDimensions() {
        if (!this.tableSurface) return { width: 800, height: 400 };
        
        const rect = this.tableSurface.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height
        };
    }

    // Set initial positions based on table dimensions
    setInitialPositions() {
        const dimensions = this.getTableDimensions();
        const centerY = dimensions.height / 2;
        
        this.currentPositions = {
            paddleA: { x: dimensions.width * 0.2, y: centerY },
            paddleB: { x: dimensions.width * 0.8, y: centerY },
            puck: { x: dimensions.width * 0.5, y: centerY }
        };
        
        // Update last puck position for speed calculation
        this.lastPuckPosition = { x: dimensions.width * 0.5, y: centerY };
    }

    // Update object position
    updatePosition(object, x, y) {
        // Get current table dimensions
        const dimensions = this.getTableDimensions();
        const maxX = dimensions.width;
        const maxY = dimensions.height;
        
        // Ensure coordinates are within valid range
        x = Math.max(0, Math.min(maxX, x));
        y = Math.max(0, Math.min(maxY, y));
        
        // Update current position
        this.currentPositions[object] = { x, y };
        
        // Add to history (for trails)
        if (this.showTrails) {
            this.positionHistory[object].push({ x, y, timestamp: Date.now() });
            
            // Limit history length
            if (this.positionHistory[object].length > 50) {
                this.positionHistory[object].shift();
            }
        }
        
        // Update visual positions
        this.updateVisualPositions();
        
        // Update position info display
        this.updatePositionDisplay(object, x, y);
    }

    // Update puck position (including speed calculation)
    updatePuckPosition(x, y) {
        const now = Date.now();
        const deltaTime = (now - this.lastPuckTime) / 1000; // Convert to seconds
        
        if (deltaTime > 0) {
            const deltaX = x - this.lastPuckPosition.x;
            const deltaY = y - this.lastPuckPosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            this.puckSpeed = distance / deltaTime; // pixels/second
        }
        
        this.lastPuckPosition = { x, y };
        this.lastPuckTime = now;
        
        // Update position
        this.updatePosition('puck', x, y);
        
        // Update speed display
        this.updateSpeedDisplay();
        
        // Add movement effect
        if (this.puckSpeed > 50) { // Speed threshold
            this.puck.classList.add('moving');
            setTimeout(() => {
                if (this.puck) {
                    this.puck.classList.remove('moving');
                }
            }, 500);
        }
    }

    // Update visual positions
    updateVisualPositions() {
        if (!this.isInitialized) return;
        
        // Update paddle A position
        if (this.paddleA) {
            const pos = this.currentPositions.paddleA;
            this.paddleA.style.left = `${pos.x - 20}px`; // Subtract radius
            this.paddleA.style.top = `${pos.y - 20}px`;
        }
        
        // Update paddle B position
        if (this.paddleB) {
            const pos = this.currentPositions.paddleB;
            this.paddleB.style.left = `${pos.x - 20}px`;
            this.paddleB.style.top = `${pos.y - 20}px`;
        }
        
        // Update puck position
        if (this.puck) {
            const pos = this.currentPositions.puck;
            this.puck.style.left = `${pos.x - 12.5}px`; // Subtract radius
            this.puck.style.top = `${pos.y - 12.5}px`;
        }
    }

    // Update position indicator
    updatePositionIndicator(x, y) {
        if (this.positionIndicator && this.showCoordinates) {
            this.positionIndicator.style.left = `${x}px`;
            this.positionIndicator.style.top = `${y}px`;
            this.positionIndicator.style.display = 'block';
            
            const coordsElement = this.positionIndicator.querySelector('.indicator-coords');
            if (coordsElement) {
                coordsElement.textContent = `(${Math.round(x)}, ${Math.round(y)})`;
            }
        }
    }

    // Update position info display
    updatePositionDisplay(object, x, y) {
        const xElement = document.getElementById(`${object}X`);
        const yElement = document.getElementById(`${object}Y`);
        
        if (xElement) xElement.textContent = Math.round(x);
        if (yElement) yElement.textContent = Math.round(y);
    }

    // Update speed display
    updateSpeedDisplay() {
        const speedElement = document.getElementById('puckSpeed');
        if (speedElement) {
            speedElement.textContent = `${Math.round(this.puckSpeed)} px/s`;
        }
    }

    // Update rate display
    updateRateDisplay() {
        const rateElement = document.getElementById('updateRate');
        if (rateElement) {
            rateElement.textContent = `${this.updateRate} Hz`;
        }
    }

    // Update connection status
    updateConnectionStatus(isConnected) {
        const statusElement = document.getElementById('mqttStatus');
        if (statusElement) {
            statusElement.textContent = isConnected ? 'Connected' : 'Disconnected';
            statusElement.className = `status-value ${isConnected ? 'connected' : 'disconnected'}`;
        }
        
        console.log(`🔗 MQTT connection status: ${isConnected ? 'connected' : 'disconnected'}`);
    }

    // Start update loop
    startUpdateLoop() {
        const update = () => {
            if (this.isInitialized && !this.isPaused) {
                // Clean up expired history records
                this.cleanupPositionHistory();
            }
            requestAnimationFrame(update);
        };
        
        requestAnimationFrame(update);
        console.log('🔄 Update loop started');
    }

    // Cleanup position history
    cleanupPositionHistory() {
        const now = Date.now();
        const maxAge = 5000; // 5 seconds
        
        ['paddleA', 'paddleB', 'puck'].forEach(object => {
            this.positionHistory[object] = this.positionHistory[object].filter(
                pos => now - pos.timestamp < maxAge
            );
        });
    }

    // Demo mode (when no WebSocket connection is available)
    startDemoMode() {
        console.log('🎮 Starting demo mode');
        
        let time = 0;
        const demoInterval = setInterval(() => {
            if (this.isPaused) return;
            
            time += 0.1;
            
            // Get current table dimensions for demo
            const dimensions = this.getTableDimensions();
            const centerX = dimensions.width / 2;
            const centerY = dimensions.height / 2;
            
            // Simulate data with dynamic scaling
            const paddleAX = dimensions.width * 0.2 + Math.sin(time) * (dimensions.width * 0.08);
            const paddleAY = centerY + Math.cos(time * 0.5) * (dimensions.height * 0.3);
            
            const paddleBX = dimensions.width * 0.8 + Math.sin(time + Math.PI) * (dimensions.width * 0.08);
            const paddleBY = centerY + Math.cos(time * 0.5 + Math.PI) * (dimensions.height * 0.3);
            
            const puckX = centerX + Math.sin(time * 2) * (dimensions.width * 0.35);
            const puckY = centerY + Math.cos(time * 1.5) * (dimensions.height * 0.35);
            
            // Simulate position updates
            this.handlePositionUpdate({
                paddleA: { x: paddleAX, y: paddleAY },
                paddleB: { x: paddleBX, y: paddleBY },
                puck: { x: puckX, y: puckY }
            });
            
        }, 50); // 20Hz update frequency
        
        // Simulate connection status
        setTimeout(() => this.updateConnectionStatus(true), 1000);
    }

    // Reset visualization
    reset() {
        this.currentPositions = {
            paddleA: { x: 100, y: 200 },
            paddleB: { x: 700, y: 200 },
            puck: { x: 400, y: 200 }
        };
        
        this.positionHistory = {
            paddleA: [],
            paddleB: [],
            puck: []
        };
        
        this.puckSpeed = 0;
        this.updateVisualPositions();
        this.updateSpeedDisplay();
        
        console.log('🔄 Hockey visualization reset');
    }

    // Destroy visualization
    destroy() {
        this.isInitialized = false;
        console.log('🗑️ Hockey visualization destroyed');
    }
}

// Global instance
let hockeyVisualization = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure other components are loaded
    setTimeout(() => {
        hockeyVisualization = new HockeyVisualization();
        if (hockeyVisualization.init()) {
            console.log('🏒 Hockey visualization system ready');
            
            // Expose to global scope for other modules to use
            window.hockeyVisualization = hockeyVisualization;
            
            // Start demo mode automatically for display
            hockeyVisualization.startDemoMode();
        }
    }, 1000);
});

// Export module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HockeyVisualization;
} 