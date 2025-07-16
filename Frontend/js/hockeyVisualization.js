// Real-time Hockey Game Visualization Module with Real Scale & MQTT Data Integration
class HockeyVisualization {
    constructor() {
        this.isInitialized = false;
        this.isPaused = false;
        this.showTrails = true;
        this.showCoordinates = false;
        this.isWebSocketConnected = false;
        
        // Real world dimensions (in cm)
        this.realDimensions = {
            tableLength: 43,    // cm (x-axis)
            tableWidth: 26,     // cm (y-axis)
            puckDiameter: 4,    // cm
            pusherDiameter: 5,  // cm
            goalLength: 9       // cm - goal opening length
        };
        
        // Calculate aspect ratio
        this.aspectRatio = this.realDimensions.tableLength / this.realDimensions.tableWidth; // 43:26 ≈ 1.65:1
        
        // Coordinate system: left-top corner as origin (0,0)
        // x-axis: horizontal (length direction)
        // y-axis: vertical (width direction)
        this.coordinateSystem = {
            origin: { x: 0, y: 0 },
            maxX: this.realDimensions.tableLength,
            maxY: this.realDimensions.tableWidth
        };
        
        // Goal positions (centered vertically)
        this.goals = {
            left: {
                x: 0,
                y: (this.realDimensions.tableWidth - this.realDimensions.goalLength) / 2,
                width: 1,  // Goal depth
                height: this.realDimensions.goalLength
            },
            right: {
                x: this.realDimensions.tableLength - 1,
                y: (this.realDimensions.tableWidth - this.realDimensions.goalLength) / 2,
                width: 1,  // Goal depth
                height: this.realDimensions.goalLength
            }
        };
        
        // Element references
        this.tableSurface = null;
        this.pusherA = null;
        this.pusherB = null;
        this.puck = null;
        this.positionIndicator = null;
        this.goalLeft = null;
        this.goalRight = null;
        
        // Position data (in real world coordinates - cm)
        this.currentPositions = {
            pusherA: { x: 8, y: 13 },    // Left side, center
            pusherB: { x: 35, y: 13 },   // Right side, center
            puck: { x: 21.5, y: 13 }     // Center of table
        };
        
        // Velocity data removed - MQTT provides position data only
        
        // Display properties - For boundary detection and visualization
        this.display = {
            puckRadius: this.realDimensions.puckDiameter / 2,      // 2cm
            pusherRadius: this.realDimensions.pusherDiameter / 2,  // 2.5cm
            minVelocity: 0.05,        // Lower minimum velocity threshold for display
            maxVelocity: 80,          // Higher maximum velocity for display
            updateRate: 16            // Update rate in ms (60fps)
        };
        
        // Game state
        this.gameState = {
            score: { left: 0, right: 0 },
            lastGoal: null,
            goalCooldown: false
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
        
        // Visualization loop
        this.lastVisualizationTime = Date.now();
        this.visualizationRunning = false;
        
        console.log('🏒 HockeyVisualization initialized with real-world scale (MQTT data driven):', this.realDimensions);
        console.log('📏 Aspect ratio:', this.aspectRatio.toFixed(2) + ':1');
        console.log('🥅 Goal size:', this.realDimensions.goalLength + 'cm');
        console.log('📡 Data source: MQTT sensors (no physics simulation)');
    }

    // Initialize visualization system
    async initialize() {
        try {
            console.log('🚀 Initializing hockey visualization (MQTT data driven)...');
            
            // Log boundary information for debugging
            console.log(`📏 Real dimensions: ${this.realDimensions.tableLength}cm × ${this.realDimensions.tableWidth}cm`);
            console.log(`🎯 Physical boundaries: X(0 - ${this.realDimensions.tableLength}cm), Y(0 - ${this.realDimensions.tableWidth}cm)`);
            console.log(`⚽ Puck radius: ${this.display.puckRadius}cm, Pusher radius: ${this.display.pusherRadius}cm`);
            console.log(`🔄 Boundary system: NO BUFFER - exact real dimensions for perfect alignment`);
            console.log(`🎯 Coordinate system: Origin at RED BORDER inner edge (not outer container)`);
            console.log(`📡 Data source: MQTT sensors (no collision simulation)`);
            
            // Initialize DOM elements
            this.initializeElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup WebSocket connection
            this.setupWebSocketConnection();
            
            // Set initial positions
            this.setInitialPositions();
            
            // Start visualization update loop
            this.startVisualizationLoop();
            
            this.isInitialized = true;
            console.log('✅ Hockey visualization initialized successfully (MQTT data driven)');
            console.log('🎯 Physical boundaries match visual boundaries exactly');
            console.log('🔴 Origin: Red border inner edge (43×26cm game area)');
            console.log('📡 Ready to receive MQTT sensor data');
            
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
        this.goalLeft = document.querySelector('.goal-a');
        this.goalRight = document.querySelector('.goal-b');
        
        if (!this.tableSurface || !this.pusherA || !this.pusherB || !this.puck) {
            throw new Error('Required DOM elements not found');
        }
        
        // Initialize coordinate display elements
        const mouseSection = document.getElementById('mouseCoordinatesSection');
        const positionInfo = document.getElementById('positionInfo');
        
        // Set initial display state based on showCoordinates (for mouse coordinates)
        if (mouseSection) {
            mouseSection.style.display = this.showCoordinates ? 'block' : 'none';
        }
        
        // Set initial display state based on showTrails (for pusher/puck coordinates)
        if (positionInfo) {
            positionInfo.style.display = this.showTrails ? 'flex' : 'none';
        }
        
        // Add MQTT enabled class to enable MQTT-specific CSS
        this.tableSurface.classList.add('mqtt-enabled');
        
        // Update element sizes based on real dimensions
        this.updateElementSizes();
        
        // Update goal sizes
        this.updateGoalSizes();
        
        console.log('🎯 DOM elements initialized');
        console.log('📍 Coordinate system: Left-top corner as origin (0,0), X: horizontal, Y: vertical');
        console.log('🎭 Show Trails (pusher/puck coords):', this.showTrails ? 'enabled' : 'disabled');
        console.log('📍 Show Coordinates (mouse coords):', this.showCoordinates ? 'enabled' : 'disabled');
    }

    // Update element sizes based on real dimensions
    updateElementSizes() {
        const dimensions = this.getTableDimensions();
        const scaleX = dimensions.width / this.realDimensions.tableLength;
        const scaleY = dimensions.height / this.realDimensions.tableWidth;
        
        // Use consistent scale (smaller of the two to maintain aspect ratio)
        const scale = Math.min(scaleX, scaleY);
        
        // Update puck size
        const puckSize = this.realDimensions.puckDiameter * scale;
        this.puck.style.width = puckSize + 'px';
        this.puck.style.height = puckSize + 'px';
        
        // Update pusher sizes
        const pusherSize = this.realDimensions.pusherDiameter * scale;
        this.pusherA.style.width = pusherSize + 'px';
        this.pusherA.style.height = pusherSize + 'px';
        this.pusherB.style.width = pusherSize + 'px';
        this.pusherB.style.height = pusherSize + 'px';
        
        console.log('📏 Element sizes updated - Scale:', scale.toFixed(3));
        console.log('📏 Puck size:', puckSize + 'px', 'Pusher size:', pusherSize + 'px');
    }

    // Update goal sizes based on real dimensions
    updateGoalSizes() {
        const dimensions = this.getTableDimensions();
        const scaleY = dimensions.height / this.realDimensions.tableWidth;
        
        // Update goal heights
        const goalHeight = this.realDimensions.goalLength * scaleY;
        
        if (this.goalLeft) {
            this.goalLeft.style.height = goalHeight + 'px';
        }
        
        if (this.goalRight) {
            this.goalRight.style.height = goalHeight + 'px';
        }
        
        console.log('🥅 Goal sizes updated - Height:', goalHeight + 'px');
    }

    // Convert real-world coordinates to display coordinates
    realToDisplayCoordinates(realX, realY) {
        const dimensions = this.getTableDimensions();
        
        // Calculate scale factors based on the area inside the red border
        const scaleX = dimensions.width / this.realDimensions.tableLength;
        const scaleY = dimensions.height / this.realDimensions.tableWidth;
        
        // Convert coordinates - accounting for red border offset
        const displayX = realX * scaleX;
        const displayY = realY * scaleY;
        
        return {
            x: displayX,
            y: displayY
        };
    }

    // Convert display coordinates to real-world coordinates
    displayToRealCoordinates(displayX, displayY) {
        const dimensions = this.getTableDimensions();
        
        // Calculate scale factors based on the area inside the red border
        const scaleX = dimensions.width / this.realDimensions.tableLength;
        const scaleY = dimensions.height / this.realDimensions.tableWidth;
        
        // Convert coordinates - accounting for red border offset
        const realX = displayX / scaleX;
        const realY = displayY / scaleY;
        
        return {
            x: realX,
            y: realY
        };
    }

    // Get current table dimensions - based on red border area (actual game area)
    getTableDimensions() {
        if (!this.tableSurface) return { width: 430, height: 260 };
        
        const tableSurfaceElement = this.tableSurface.querySelector('.table-surface');
        if (!tableSurfaceElement) return { width: 430, height: 260 };
        
        const rect = tableSurfaceElement.getBoundingClientRect();
        
        // Account for red border thickness (2px on each side)
        const borderThickness = 2;
        const actualWidth = rect.width - (borderThickness * 2);
        const actualHeight = rect.height - (borderThickness * 2);
        
        // Ensure we maintain exact aspect ratio based on actual game area
        const width = actualWidth;
        const height = width / this.aspectRatio;
        
        return {
            width: width,
            height: height
        };
    }

    // Boundary detection for object position validation
    validateObjectPositions() {
        // Check boundary constraints (prevent objects from going out of bounds)
        this.checkBoundaryConstraints();
        
        // Check goal scoring
        this.checkGoalScoring();
    }

    // Collision simulation removed - Data comes from MQTT sensors only

    // Check if puck scored in goals
    checkGoalScoring() {
        if (this.gameState.goalCooldown) return;
        
        const puckPos = this.currentPositions.puck;
        const puckRadius = this.display.puckRadius;
        
        // Use exact real dimensions without any buffer - consistent with boundary detection
        const minX = 0;
        const maxX = this.realDimensions.tableLength;
        
        // Check left goal
        if (puckPos.x - puckRadius <= minX) {
            if (puckPos.y >= this.goals.left.y && puckPos.y <= this.goals.left.y + this.goals.left.height) {
                this.onGoalScored('right'); // Right player scored
                console.log(`🥅 LEFT GOAL! Puck at (${puckPos.x.toFixed(2)}, ${puckPos.y.toFixed(2)})`);
                return;
            }
        }
        
        // Check right goal
        if (puckPos.x + puckRadius >= maxX) {
            if (puckPos.y >= this.goals.right.y && puckPos.y <= this.goals.right.y + this.goals.right.height) {
                this.onGoalScored('left'); // Left player scored
                console.log(`🥅 RIGHT GOAL! Puck at (${puckPos.x.toFixed(2)}, ${puckPos.y.toFixed(2)})`);
                return;
            }
        }
    }

    // Handle goal scoring
    onGoalScored(scoringSide) {
        this.gameState.score[scoringSide]++;
        this.gameState.lastGoal = {
            side: scoringSide,
            time: Date.now()
        };
        
        // Goal cooldown to prevent multiple goals
        this.gameState.goalCooldown = true;
        setTimeout(() => {
            this.gameState.goalCooldown = false;
        }, 2000);
        
        // Puck reset handled by MQTT data - no manual position reset
        
        // Add goal effect
        this.addGoalEffect(scoringSide);
        
        console.log(`🥅 GOAL! ${scoringSide} scored! Score: ${this.gameState.score.left} - ${this.gameState.score.right}`);
    }

    // Add goal effect - 在对方那一侧显示闪烁
    addGoalEffect(scoringSide) {
        // 进球时在对方那一侧显示高亮
        const goalElement = scoringSide === 'left' ? this.goalRight : this.goalLeft;
        if (goalElement) {
            goalElement.classList.add('goal-scored');
            setTimeout(() => {
                goalElement.classList.remove('goal-scored');
            }, 1200);
        }
        
        // Add puck celebration effect
        this.puck.classList.add('goal-celebration');
        setTimeout(() => {
            this.puck.classList.remove('goal-celebration');
        }, 1000);
    }

    // Check boundary constraints (prevent objects from going out of bounds)
    checkBoundaryConstraints() {
        // Check puck boundaries
        this.checkObjectBoundaries('puck', this.display.puckRadius);
        
        // Check pusher boundaries
        this.checkObjectBoundaries('pusherA', this.display.pusherRadius);
        this.checkObjectBoundaries('pusherB', this.display.pusherRadius);
    }

    // Check object boundaries (prevent objects from going out of bounds)
    checkObjectBoundaries(objectName, radius) {
        const pos = this.currentPositions[objectName];
        
        // Use exact real dimensions without any buffer - this ensures perfect alignment
        const minX = 0;
        const maxX = this.realDimensions.tableLength;
        const minY = 0;
        const maxY = this.realDimensions.tableWidth;
        
        // Constrain position to boundaries (no bouncing physics)
        // Special handling for puck near goals
        if (objectName === 'puck') {
            // Check left boundary with goal
            if (pos.x - radius <= minX) {
                // Check if in goal area
                if (pos.y >= this.goals.left.y && pos.y <= this.goals.left.y + this.goals.left.height) {
                    // Puck is in goal - allow it through for goal detection
                    return;
                } else {
                    // Constrain to boundary
                    pos.x = minX + radius;
                }
            }
            
            // Check right boundary with goal
            if (pos.x + radius >= maxX) {
                // Check if in goal area
                if (pos.y >= this.goals.right.y && pos.y <= this.goals.right.y + this.goals.right.height) {
                    // Puck is in goal - allow it through for goal detection
                    return;
                } else {
                    // Constrain to boundary
                    pos.x = maxX - radius;
                }
            }
        } else {
            // Normal boundary checking for pushers
            // Check left boundary
            if (pos.x - radius <= minX) {
                pos.x = minX + radius;
            }
            
            // Check right boundary
            if (pos.x + radius >= maxX) {
                pos.x = maxX - radius;
            }
        }
        
        // Check top boundary (all objects)
        if (pos.y - radius <= minY) {
            pos.y = minY + radius;
        }
        
        // Check bottom boundary (all objects)
        if (pos.y + radius >= maxY) {
            pos.y = maxY - radius;
        }
    }

    // Collision effects removed - Data comes from MQTT sensors only

    // Update visualization based on MQTT data (no physics simulation)
    updateVisualization() {
        // Only validate positions and check goals
        // No physics simulation - positions come from MQTT sensors
        
        // Validate object positions to prevent out-of-bounds
        this.validateObjectPositions();
        
        // Update visual elements on display
        this.updateVisualPositions();
    }

    // Velocity limiting removed - Data comes from MQTT sensors

    // Start visualization loop
    startVisualizationLoop() {
        this.visualizationRunning = true;
        this.lastVisualizationTime = Date.now();
        
        const visualizationLoop = () => {
            if (!this.visualizationRunning || this.isPaused) {
                if (this.visualizationRunning) {
                    requestAnimationFrame(visualizationLoop);
                }
                return;
            }
            
            const currentTime = Date.now();
            const deltaTime = (currentTime - this.lastVisualizationTime) / 1000; // Convert to seconds
            this.lastVisualizationTime = currentTime;
            
            // Update visualization (no physics)
            this.updateVisualization();
            
            requestAnimationFrame(visualizationLoop);
        };
        
        requestAnimationFrame(visualizationLoop);
        console.log('🎨 Visualization loop started (MQTT data driven)');
    }

    // Stop visualization loop
    stopVisualizationLoop() {
        this.visualizationRunning = false;
        console.log('⏸️ Visualization loop stopped');
    }

    // Set initial positions based on real dimensions
    setInitialPositions() {
        // Set positions in real-world coordinates (cm)
        this.currentPositions = {
            pusherA: { x: 8, y: 13 },      // Left side, center
            pusherB: { x: 35, y: 13 },     // Right side, center
            puck: { x: 21.5, y: 13 }       // Center of table
        };
        
        // Velocity reset removed - MQTT provides position data only
        
        // Reset game state
        this.gameState.score = { left: 0, right: 0 };
        this.gameState.lastGoal = null;
        this.gameState.goalCooldown = false;
        
        console.log('🎯 Initial positions set in real-world coordinates');
    }

    // Update visual positions
    updateVisualPositions() {
        if (!this.isInitialized) return;
        
        Object.keys(this.currentPositions).forEach(objectName => {
            const realPos = this.currentPositions[objectName];
            const displayPos = this.realToDisplayCoordinates(realPos.x, realPos.y);
            
            const element = this[objectName];
            if (element) {
                // Center the element on the position
                const elementWidth = element.offsetWidth;
                const elementHeight = element.offsetHeight;
                
                element.style.left = (displayPos.x - elementWidth / 2) + 'px';
                element.style.top = (displayPos.y - elementHeight / 2) + 'px';
            }
            
            // Update position display
            this.updatePositionDisplay(objectName, realPos.x, realPos.y);
        });
    }

    // Handle position update from WebSocket/MQTT
    handlePositionUpdate(data) {
        if (!this.isInitialized || this.isPaused) return;
        
        // Convert MQTT data to real-world coordinates
        // Assuming MQTT sends data in the format: { pusher1: {x, y}, pusher2: {x, y}, puck: {x, y} }
        
        if (data.pusher1) {
            // Check if pusher1 data is valid before processing
            if (this.isValidPositionData(data.pusher1)) {
                const realPos = this.mqttToRealCoordinates(data.pusher1.x, data.pusher1.y);
                
                // Double-check that conversion was successful
                if (realPos) {
                    this.currentPositions.pusherA = realPos;
                    
                    console.log(`📍 Pusher A updated to: (${realPos.x.toFixed(2)}, ${realPos.y.toFixed(2)})`);
                } else {
                    console.log(`⚠️ Failed to convert pusher1 coordinates, keeping current position: (${this.currentPositions.pusherA.x.toFixed(2)}, ${this.currentPositions.pusherA.y.toFixed(2)})`);
                }
            } else {
                console.log(`⚠️ Invalid pusher1 data received, keeping current position: (${this.currentPositions.pusherA.x.toFixed(2)}, ${this.currentPositions.pusherA.y.toFixed(2)})`);
            }
        }
        
        if (data.pusher2) {
            // Check if pusher2 data is valid before processing
            if (this.isValidPositionData(data.pusher2)) {
                const realPos = this.mqttToRealCoordinates(data.pusher2.x, data.pusher2.y);
                
                // Double-check that conversion was successful
                if (realPos) {
                    this.currentPositions.pusherB = realPos;
                    
                    console.log(`📍 Pusher B updated to: (${realPos.x.toFixed(2)}, ${realPos.y.toFixed(2)})`);
                } else {
                    console.log(`⚠️ Failed to convert pusher2 coordinates, keeping current position: (${this.currentPositions.pusherB.x.toFixed(2)}, ${this.currentPositions.pusherB.y.toFixed(2)})`);
                }
            } else {
                console.log(`⚠️ Invalid pusher2 data received, keeping current position: (${this.currentPositions.pusherB.x.toFixed(2)}, ${this.currentPositions.pusherB.y.toFixed(2)})`);
            }
        }
        
        if (data.puck) {
            // Check if puck data is valid before processing
            if (this.isValidPositionData(data.puck)) {
                const realPos = this.mqttToRealCoordinates(data.puck.x, data.puck.y);
                
                // Double-check that conversion was successful
                if (realPos) {
                    this.currentPositions.puck = realPos;
                    
                    console.log(`📍 Puck updated to: (${realPos.x.toFixed(2)}, ${realPos.y.toFixed(2)})`);
                } else {
                    console.log(`⚠️ Failed to convert puck coordinates, keeping current position: (${this.currentPositions.puck.x.toFixed(2)}, ${this.currentPositions.puck.y.toFixed(2)})`);
                }
            } else {
                console.log(`⚠️ Invalid puck data received, keeping current position: (${this.currentPositions.puck.x.toFixed(2)}, ${this.currentPositions.puck.y.toFixed(2)})`);
            }
        }
        
        // Update performance metrics
        this.updatePerformanceMetrics();
    }

    // Check if position data is valid (not null, undefined, or NaN)
    isValidPositionData(positionData) {
        if (!positionData || typeof positionData !== 'object') {
            return false;
        }
        
        const { x, y } = positionData;
        
        // Check if x and y are valid numbers
        if (x === null || x === undefined || isNaN(x) || typeof x !== 'number') {
            return false;
        }
        
        if (y === null || y === undefined || isNaN(y) || typeof y !== 'number') {
            return false;
        }
        
        // Check if values are within reasonable bounds (0-800 for x, 0-400 for y in MQTT coordinates)
        if (x < 0 || x > 800 || y < 0 || y > 400) {
            console.warn(`⚠️ Position data out of bounds: x=${x}, y=${y}`);
            return false;
        }
        
        return true;
    }

    // Convert MQTT coordinates to real-world coordinates
    mqttToRealCoordinates(mqttX, mqttY) {
        // Ensure input values are valid numbers
        if (typeof mqttX !== 'number' || typeof mqttY !== 'number' || isNaN(mqttX) || isNaN(mqttY)) {
            console.error('Invalid MQTT coordinates:', { mqttX, mqttY });
            return null;
        }
        
        // Clamp values to expected MQTT range to prevent out-of-bounds positions
        const clampedX = Math.max(0, Math.min(800, mqttX));
        const clampedY = Math.max(0, Math.min(400, mqttY));
        
        // Log if values were clamped
        if (clampedX !== mqttX || clampedY !== mqttY) {
            console.warn(`⚠️ MQTT coordinates clamped: (${mqttX}, ${mqttY}) → (${clampedX}, ${clampedY})`);
        }
        
        // Convert to real-world coordinates
        // Assuming MQTT coordinate system is 0-800 for length, 0-400 for width
        const realX = (clampedX / 800) * this.realDimensions.tableLength;
        const realY = (clampedY / 400) * this.realDimensions.tableWidth;
        
        // Ensure the resulting coordinates are within table bounds
        const boundedX = Math.max(0, Math.min(this.realDimensions.tableLength, realX));
        const boundedY = Math.max(0, Math.min(this.realDimensions.tableWidth, realY));
        
        return { x: boundedX, y: boundedY };
    }

    // Velocity calculation removed - MQTT provides position data only

    // Update performance metrics
    updatePerformanceMetrics() {
        this.updateCount++;
        const currentTime = Date.now();
        
        if (currentTime - this.lastUpdateTime >= 1000) {
            this.updateRate = this.updateCount;
            this.updateCount = 0;
            this.lastUpdateTime = currentTime;
            
            // Update rate display
            this.updateRateDisplay();
        }
    }

    // Update position info display
    updatePositionDisplay(object, x, y) {
        const posElement = document.getElementById(`${object}Pos`);
        const velElement = document.getElementById(`${object}Vel`);
        
        // Display real-world coordinates (左上角为原点，横向为x，竖向为y)
        if (posElement) {
            posElement.textContent = `X: ${x.toFixed(2)}cm, Y: ${y.toFixed(2)}cm`;
        }
        
        // Display velocity
        if (velElement) {
            const vel = this.velocities[object];
            if (vel) {
                const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
                velElement.textContent = `V: ${speed.toFixed(1)} cm/s`;
            }
        }
    }

    // Update rate display
    updateRateDisplay() {
        const rateElement = document.getElementById('updateRate');
        if (rateElement) {
            rateElement.textContent = `${this.updateRate} Hz`;
        }
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
                
                // Show/hide pusher and puck position info panel
                const positionInfo = document.getElementById('positionInfo');
                
                if (positionInfo) {
                    positionInfo.style.display = this.showTrails ? 'flex' : 'none';
                }
                
                console.log('🎭 Trails display and pusher/puck coordinates:', this.showTrails ? 'enabled' : 'disabled');
            });
        }
        
        if (showCoordinatesCheckbox) {
            showCoordinatesCheckbox.addEventListener('change', (e) => {
                this.showCoordinates = e.target.checked;
                
                // Show/hide mouse coordinates section
                const mouseSection = document.getElementById('mouseCoordinatesSection');
                
                if (mouseSection) {
                    mouseSection.style.display = this.showCoordinates ? 'block' : 'none';
                }
                
                console.log('📍 Mouse coordinates display:', this.showCoordinates ? 'enabled' : 'disabled');
            });
        }
        
        if (pauseVisualizationCheckbox) {
            pauseVisualizationCheckbox.addEventListener('change', (e) => {
                this.isPaused = e.target.checked;
                console.log('⏸️ Visualization:', this.isPaused ? 'paused' : 'resumed');
            });
        }
        
        // Window resize handling
        window.addEventListener('resize', () => {
            // Update element sizes when window resizes
            this.updateElementSizes();
            this.updateGoalSizes();
            this.updateVisualPositions();
        });
        
        // Add mouse controls
        this.setupMouseControls();
        
        console.log('👂 Event listeners set up');
    }

    // Setup mouse controls for pusher A
    setupMouseControls() {
        let isDragging = false;
        let dragTarget = null;
        
        // Mouse down on pusher
        document.addEventListener('mousedown', (e) => {
            if (this.isPaused) return;
            
            const rect = this.tableSurface.getBoundingClientRect();
            const tableSurfaceRect = this.tableSurface.querySelector('.table-surface').getBoundingClientRect();
            
            // Calculate mouse position relative to the actual game area (inside red border)
            const mouseX = e.clientX - tableSurfaceRect.left;
            const mouseY = e.clientY - tableSurfaceRect.top;
            
            // Check if click is on pusher A
            const pusherARect = this.pusherA.getBoundingClientRect();
            const pusherAX = pusherARect.left - tableSurfaceRect.left + pusherARect.width / 2;
            const pusherAY = pusherARect.top - tableSurfaceRect.top + pusherARect.height / 2;
            
            if (Math.sqrt((mouseX - pusherAX) ** 2 + (mouseY - pusherAY) ** 2) < 30) {
                isDragging = true;
                dragTarget = 'pusherA';
                return;
            }
            
            // Check if click is on pusher B
            const pusherBRect = this.pusherB.getBoundingClientRect();
            const pusherBX = pusherBRect.left - tableSurfaceRect.left + pusherBRect.width / 2;
            const pusherBY = pusherBRect.top - tableSurfaceRect.top + pusherBRect.height / 2;
            
            if (Math.sqrt((mouseX - pusherBX) ** 2 + (mouseY - pusherBY) ** 2) < 30) {
                isDragging = true;
                dragTarget = 'pusherB';
                return;
            }
        });
        
        // Mouse move - show coordinates whenever mouse is over the table
        document.addEventListener('mousemove', (e) => {
            if (this.isPaused) return;
            
            const tableSurfaceRect = this.tableSurface.querySelector('.table-surface').getBoundingClientRect();
            
            // Calculate mouse position relative to the actual game area (inside red border)
            // Account for red border thickness (2px) - origin is now at red border's inner edge
            const borderThickness = 2;
            const mouseX = e.clientX - tableSurfaceRect.left - borderThickness;
            const mouseY = e.clientY - tableSurfaceRect.top - borderThickness;
            
            // Get actual game area dimensions (inside red border)
            const gameAreaWidth = tableSurfaceRect.width - (borderThickness * 2);
            const gameAreaHeight = tableSurfaceRect.height - (borderThickness * 2);
            
            // Check if mouse is over the game area (inside red border)
            if (mouseX >= 0 && mouseY >= 0 && mouseX <= gameAreaWidth && mouseY <= gameAreaHeight) {
                // Convert to real coordinates using corrected coordinates
                const realPos = this.displayToRealCoordinates(mouseX, mouseY);
                
                // Always show mouse coordinates when over table
                this.updateMousePosition(realPos.x, realPos.y, mouseX, mouseY);
                
                // Update pusher position only when dragging
                if (isDragging && dragTarget) {
                    this.currentPositions[dragTarget] = realPos;
                }
            }
        });
        
        // Mouse up
        document.addEventListener('mouseup', () => {
            isDragging = false;
            dragTarget = null;
        });
        
        console.log('🖱️ Mouse controls set up - Origin at red border inner edge');
    }

    // Setup WebSocket connection
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
            console.warn('⚠️ WebSocket manager not available');
        }
    }

    // Update connection status
    updateConnectionStatus(isConnected) {
        const statusElement = document.getElementById('mqttStatus');
        if (statusElement) {
            statusElement.textContent = isConnected ? 'Connected - Real Data' : 'Disconnected';
            statusElement.className = `status-value ${isConnected ? 'connected' : 'disconnected'}`;
        }
        
        console.log(`🔗 Connection status: ${isConnected ? 'connected' : 'disconnected'}`);
    }

    // Start update loop
    startUpdateLoop() {
        const update = () => {
            if (this.isInitialized && !this.isPaused) {
                // Update display elements
                this.updateVisualPositions();
            }
            requestAnimationFrame(update);
        };
        
        requestAnimationFrame(update);
        console.log('🔄 Update loop started');
    }

    // Clean up
    destroy() {
        this.stopVisualizationLoop();
        this.isInitialized = false;
        console.log('🧹 HockeyVisualization destroyed');
    }

    // Update mouse position display
    updateMousePosition(realX, realY, displayX, displayY) {
        const mouseSection = document.getElementById('mouseCoordinatesSection');
        const mousePosElement = document.getElementById('mousePos');
        const mouseDisplayElement = document.getElementById('mouseDisplay');
        
        if (mousePosElement) {
            mousePosElement.textContent = `X: ${realX.toFixed(2)}cm, Y: ${realY.toFixed(2)}cm`;
        }
        
        if (mouseDisplayElement) {
            mouseDisplayElement.textContent = `Display: (${displayX.toFixed(0)}px, ${displayY.toFixed(0)}px)`;
        }
    }
}

        // Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.hockeyVisualization = new HockeyVisualization();
    window.hockeyVisualization.initialize();
}); 