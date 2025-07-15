// Real-time Hockey Game Visualization Module
class HockeyVisualization {
    constructor() {
        this.isInitialized = false;
        this.isPaused = false;
        this.showTrails = true;
        this.showCoordinates = false;
        this.isWebSocketConnected = false;
        
        // MQTT coordinate system (from Backend/test_mqtt.py)
        this.mqttCoordinates = {
            width: 800,   // MQTT x range: 0-800
            height: 400   // MQTT y range: 0-400
        };
        
        // Element references
        this.tableSurface = null;
        this.pusherA = null;
        this.pusherB = null;
        this.puck = null;
        this.positionIndicator = null;
        
        // Position data (will be updated after initialization)
        this.currentPositions = {
            pusherA: { x: 100, y: 200 },
            pusherB: { x: 700, y: 200 },
            puck: { x: 400, y: 200 }
        };
        
        // Position history (for trails)
        this.positionHistory = {
            pusherA: [],
            pusherB: [],
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
        
        console.log('🏒 HockeyVisualization initialized with MQTT coordinate system:', this.mqttCoordinates);
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
        this.pusherA = document.getElementById('pusherA');
        this.pusherB = document.getElementById('pusherB');
        this.puck = document.getElementById('puck');
        // Note: positionIndicator is no longer used to avoid obstruction
        
        if (!this.tableSurface || !this.pusherA || !this.pusherB || !this.puck) {
            throw new Error('Required DOM elements not found');
        }
        
        // Initialize mouse coordinates section as hidden
        const mouseSection = document.getElementById('mouseCoordinatesSection');
        if (mouseSection) {
            mouseSection.style.display = 'none';
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
                
                // Hide mouse coordinates section when coordinates are disabled
                if (!this.showCoordinates) {
                    this.clearMouseCoordinatesDisplay();
                }
                
                console.log('📍 Coordinates display:', this.showCoordinates ? 'enabled' : 'disabled');
            });
        }
        
        if (pauseVisualizationCheckbox) {
            pauseVisualizationCheckbox.addEventListener('change', (e) => {
                this.isPaused = e.target.checked;
                console.log('⏸️ Visualization:', this.isPaused ? 'paused' : 'resumed');
            });
        }
        
        // Mouse hover to show coordinates in info panel
        if (this.tableSurface) {
            this.tableSurface.addEventListener('mousemove', (e) => {
                if (this.showCoordinates) {
                    const rect = this.tableSurface.querySelector('.table-surface').getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    this.updateMouseCoordinatesDisplay(x, y);
                }
            });
            
            this.tableSurface.addEventListener('mouseleave', () => {
                if (this.showCoordinates) {
                    this.clearMouseCoordinatesDisplay();
                }
            });
        }
        
        // Window resize handler - maintain coordinate system proportions
        window.addEventListener('resize', () => {
            setTimeout(() => {
                // Update visual positions to maintain proportions after resize
                this.updateVisualPositions();
                
                // Update position displays with new dimensions
                Object.keys(this.currentPositions).forEach(object => {
                    const pos = this.currentPositions[object];
                    this.updatePositionDisplay(object, pos.x, pos.y);
                });
                
                console.log('🔄 Window resized - coordinate system updated');
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
                this.onWebSocketConnected();
            });
            
            window.websocketManager.on('disconnect', () => {
                this.updateConnectionStatus(false);
                this.onWebSocketDisconnected();
            });
            
            // Check if WebSocket is already connected
            if (window.websocketManager.isConnected) {
                this.onWebSocketConnected();
            } else {
                // Wait for real WebSocket connection - no fallback mode
                console.log('⏳ Waiting for WebSocket connection...');
                this.showWaitingForConnection();
            }
            
            console.log('🔌 WebSocket connection listeners set up');
        } else {
            console.warn('⚠️ WebSocket manager not available - waiting for connection');
            this.showWaitingForConnection();
        }
    }

    // Handle WebSocket connection established
    onWebSocketConnected() {
        this.isWebSocketConnected = true;
        this.stopDemoMode();
        console.log('✅ WebSocket connected - Using real MQTT data');
        
        // Show connection status
        const statusElement = document.getElementById('mqttStatus');
        if (statusElement) {
            statusElement.textContent = 'Connected - Real Data';
            statusElement.className = 'status-value connected';
        }
    }

    // Handle WebSocket disconnection
    onWebSocketDisconnected() {
        this.isWebSocketConnected = false;
        console.log('❌ WebSocket disconnected - Waiting for reconnection');
        
        // Show waiting status - no fallback mode
        this.showWaitingForConnection();
    }

    // Show waiting for connection status
    showWaitingForConnection() {
        const statusElement = document.getElementById('mqttStatus');
        if (statusElement) {
            statusElement.textContent = 'Waiting for Connection';
            statusElement.className = 'status-value disconnected';
        }
        
        // Reset update rate display
        const rateElement = document.getElementById('updateRate');
        if (rateElement) {
            rateElement.textContent = '0 Hz';
        }
        
        console.log('⏳ Waiting for WebSocket connection...');
    }

    // Legacy method - no longer used (no demo mode)
    stopDemoMode() {
        // No demo mode to stop - only real data mode
        console.log('ℹ️ No demo mode to stop - using real data only');
    }

    // Handle position update data - ONLY from backend WebSocket
    handlePositionUpdate(data) {
        // Only process data when WebSocket is connected and not paused
        if (this.isPaused || !this.isWebSocketConnected) return;
        
        try {
            // Parse and convert position data from backend MQTT (pusher1/pusher2 format)
            if (data.pusher1) {
                // Convert MQTT coordinates to display coordinates
                const convertedPos = this.convertMqttToDisplayCoordinates(data.pusher1.x, data.pusher1.y);
                this.updatePosition('pusherA', convertedPos.x, convertedPos.y);
            }
            
            if (data.pusher2) {
                // Convert MQTT coordinates to display coordinates
                const convertedPos = this.convertMqttToDisplayCoordinates(data.pusher2.x, data.pusher2.y);
                this.updatePosition('pusherB', convertedPos.x, convertedPos.y);
            }
            
            if (data.puck) {
                // Convert MQTT coordinates to display coordinates
                const convertedPos = this.convertMqttToDisplayCoordinates(data.puck.x, data.puck.y);
                this.updatePuckPosition(convertedPos.x, convertedPos.y);
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

    // Get current table dimensions - maintaining 2:1 aspect ratio
    getTableDimensions() {
        if (!this.tableSurface) return { width: 800, height: 400 };
        
        const tableSurfaceElement = this.tableSurface.querySelector('.table-surface');
        if (!tableSurfaceElement) return { width: 800, height: 400 };
        
        const rect = tableSurfaceElement.getBoundingClientRect();
        
        // Ensure we maintain exact 2:1 ratio even if CSS has minor differences
        const width = rect.width;
        const height = width / 2; // Force 2:1 ratio
        
        console.log(`🏒 Table dimensions: ${width}x${height} (ratio: ${(width/height).toFixed(2)}:1)`);
        
        return {
            width: width,
            height: height
        };
    }
    
    // Convert MQTT coordinates to frontend display coordinates
    // MQTT: (0,0) to (800,400) → Display: (0,0) to (width, height)
    // Maintains proportional positioning across all screen sizes
    // 修复: 修正了xy轴映射
    convertMqttToDisplayCoordinates(mqttX, mqttY) {
        const displayDimensions = this.getTableDimensions();
        
        // Calculate scale factors - both should be equal due to 2:1 aspect ratio
        const scaleX = displayDimensions.width / this.mqttCoordinates.width;
        const scaleY = displayDimensions.height / this.mqttCoordinates.height;
        
        // Verify scale factors are equal (indicating proper aspect ratio maintenance)
        if (Math.abs(scaleX - scaleY) > 0.01) {
            console.warn(`⚠️ Scale factor mismatch: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}`);
        }
        
        // Convert coordinates - 修复xy轴映射问题
        // MQTT坐标系统: x轴表示长度方向，y轴表示宽度方向
        // 显示坐标系统: x轴表示宽度方向，y轴表示长度方向
        const displayX = mqttY * scaleX;  // MQTT的y轴映射到显示的x轴
        const displayY = mqttX * scaleY;  // MQTT的x轴映射到显示的y轴
        
        // Ensure coordinates are within display bounds
        const boundedX = Math.max(0, Math.min(displayDimensions.width, displayX));
        const boundedY = Math.max(0, Math.min(displayDimensions.height, displayY));
        
        return {
            x: boundedX,
            y: boundedY
        };
    }

    // Set initial positions based on table dimensions
    setInitialPositions() {
        const dimensions = this.getTableDimensions();
        const centerY = dimensions.height / 2;
        
        // Verify aspect ratio is correct
        const aspectRatio = dimensions.width / dimensions.height;
        if (Math.abs(aspectRatio - 2.0) > 0.1) {
            console.warn(`⚠️ Aspect ratio deviation detected: ${aspectRatio.toFixed(2)}:1 (expected 2:1)`);
        }
        
        // Set initial positions in display coordinates
        this.currentPositions = {
            pusherA: { x: dimensions.width * 0.2, y: centerY },
            pusherB: { x: dimensions.width * 0.8, y: centerY },
            puck: { x: dimensions.width * 0.5, y: centerY }
        };
        
        // Update last puck position for speed calculation
        this.lastPuckPosition = { x: dimensions.width * 0.5, y: centerY };
        
        console.log('🎯 Initial positions set for display dimensions:', dimensions);
        console.log('🏒 Coordinate system verification:');
        console.log(`   MQTT: ${this.mqttCoordinates.width}x${this.mqttCoordinates.height} (${this.mqttCoordinates.width/this.mqttCoordinates.height}:1)`);
        console.log(`   Display: ${dimensions.width.toFixed(0)}x${dimensions.height.toFixed(0)} (${aspectRatio.toFixed(2)}:1)`);
    }

    // Update object position (coordinates already converted from MQTT to display)
    updatePosition(object, x, y) {
        // Update current position (coordinates are already in display coordinate system)
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
        
        // Update position info display (show both display and MQTT coordinates)
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
        
        // Update pusher A position
        if (this.pusherA) {
            const pos = this.currentPositions.pusherA;
            this.pusherA.style.left = `${pos.x - 20}px`; // Subtract radius
            this.pusherA.style.top = `${pos.y - 20}px`;
        }
        
        // Update pusher B position
        if (this.pusherB) {
            const pos = this.currentPositions.pusherB;
            this.pusherB.style.left = `${pos.x - 20}px`;
            this.pusherB.style.top = `${pos.y - 20}px`;
        }
        
        // Update puck position
        if (this.puck) {
            const pos = this.currentPositions.puck;
            this.puck.style.left = `${pos.x - 12.5}px`; // Subtract radius
            this.puck.style.top = `${pos.y - 12.5}px`;
        }
    }

    // Update mouse coordinates display in info panel
    updateMouseCoordinatesDisplay(x, y) {
        if (!this.showCoordinates) return;
        
        // Calculate MQTT coordinates from display coordinates
        // 修复: 修正反向坐标转换以匹配正向转换
        const dimensions = this.getTableDimensions();
        const mqttX = (y / dimensions.height) * this.mqttCoordinates.width;  // 显示y轴映射到MQTT x轴
        const mqttY = (x / dimensions.width) * this.mqttCoordinates.height;  // 显示x轴映射到MQTT y轴
        
        // Update mouse coordinates in info panel
        const mouseXElement = document.getElementById('mouseX');
        const mouseYElement = document.getElementById('mouseY');
        
        if (mouseXElement) mouseXElement.textContent = `${Math.round(mqttX)} (${Math.round(x)}px)`;
        if (mouseYElement) mouseYElement.textContent = `${Math.round(mqttY)} (${Math.round(y)}px)`;
        
        // Show mouse coordinates section
        const mouseSection = document.getElementById('mouseCoordinatesSection');
        if (mouseSection) {
            mouseSection.style.display = 'block';
        }
    }
    
    // Clear mouse coordinates display
    clearMouseCoordinatesDisplay() {
        const mouseSection = document.getElementById('mouseCoordinatesSection');
        if (mouseSection) {
            mouseSection.style.display = 'none';
        }
    }

    // Update position info display
    updatePositionDisplay(object, x, y) {
        const xElement = document.getElementById(`${object}X`);
        const yElement = document.getElementById(`${object}Y`);
        
        // Calculate MQTT coordinates from display coordinates for reference
        // 修复: 修正反向坐标转换以匹配正向转换
        const dimensions = this.getTableDimensions();
        const mqttX = (y / dimensions.height) * this.mqttCoordinates.width;  // 显示y轴映射到MQTT x轴
        const mqttY = (x / dimensions.width) * this.mqttCoordinates.height;  // 显示x轴映射到MQTT y轴
        
        // Display both coordinate systems
        if (xElement) xElement.textContent = `${Math.round(mqttX)} (${Math.round(x)}px)`;
        if (yElement) yElement.textContent = `${Math.round(mqttY)} (${Math.round(y)}px)`;
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
        
        ['pusherA', 'pusherB', 'puck'].forEach(object => {
            this.positionHistory[object] = this.positionHistory[object].filter(
                pos => now - pos.timestamp < maxAge
            );
        });
    }

    // No demo mode - only real data from backend

    // Reset visualization
    reset() {
        this.currentPositions = {
            pusherA: { x: 100, y: 200 },
            pusherB: { x: 700, y: 200 },
            puck: { x: 400, y: 200 }
        };
        
        this.positionHistory = {
            pusherA: [],
            pusherB: [],
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
            
            // Only real data from backend - no simulation
            console.log('🔌 Ready to receive real data from backend...');
        }
    }, 1000);
});

// Export module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HockeyVisualization;
} 