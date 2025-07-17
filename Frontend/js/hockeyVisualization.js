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
        
        // Initialize velocities for display purposes (even though MQTT provides position data only)
        this.velocities = {
            pusherA: { x: 0, y: 0 },
            pusherB: { x: 0, y: 0 },
            puck: { x: 0, y: 0 }
        };
        
        // Previous positions for velocity calculation
        this.previousPositions = {
            pusherA: { x: 8, y: 13 },
            pusherB: { x: 35, y: 13 },
            puck: { x: 21.5, y: 13 }
        };
        
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
        
        // Puck visibility state
        this.puckState = {
            isVisible: true,
            isDetected: true,
            lastDetectedTime: Date.now(),
            disappearanceTimeout: null
        };
        
        // Pusher visibility state for half-court control
        this.pusherState = {
            pusherA: {
                isVisible: true,
                isInCorrectHalf: true,
                lastValidTime: Date.now()
            },
            pusherB: {
                isVisible: true,
                isInCorrectHalf: true,
                lastValidTime: Date.now()
            }
        };
        
        // Half-court boundaries (in real coordinates)
        this.halfCourt = {
            centerX: this.realDimensions.tableLength / 2,  // 21.5cm - center line
            leftSide: { min: 0, max: this.realDimensions.tableLength / 2 },     // 0-21.5cm
            rightSide: { min: this.realDimensions.tableLength / 2, max: this.realDimensions.tableLength } // 21.5-43cm
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
        
        // Collision detection removed - not needed for MQTT-based positioning
        // this.checkObjectCollisions(); // Removed: no longer needed
        
        // Goal scoring removed - now handled completely by backend WebSocket messages
        // this.checkGoalScoring(); // Removed: no longer depend on frontend position detection
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
                this.handleGoalScored('left', puckPos); // Handle goal animation
                console.log(`🥅 LEFT GOAL! Puck at (${puckPos.x.toFixed(2)}, ${puckPos.y.toFixed(2)})`);
                return;
            }
        }
        
        // Check right goal
        if (puckPos.x + puckRadius >= maxX) {
            if (puckPos.y >= this.goals.right.y && puckPos.y <= this.goals.right.y + this.goals.right.height) {
                this.onGoalScored('left'); // Left player scored
                this.handleGoalScored('right', puckPos); // Handle goal animation
                console.log(`🥅 RIGHT GOAL! Puck at (${puckPos.x.toFixed(2)}, ${puckPos.y.toFixed(2)})`);
                return;
            }
        }
    }

    // Handle goal scoring
    onGoalScored(scoringSide) {
        // Check if game is in progress before recording goal
        if (window.smartCourtApp && window.smartCourtApp.gameState.status !== 'playing') {
            console.log(`🚫 Goal not recorded - game is ${window.smartCourtApp.gameState.status}`);
            return;
        }
        
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
    
    // Collision detection removed - not needed for MQTT-based positioning
    
    // All collision detection functionality removed - not needed for MQTT-based positioning
    
    // Handle puck disappearance when not detected
    handlePuckDisappearance() {
        if (this.puckState.isDetected) {
            this.puckState.isDetected = false;
            this.puckState.lastDetectedTime = Date.now();
            
            // Use a shorter timeout to make disappearance more responsive
            if (this.puckState.disappearanceTimeout) {
                clearTimeout(this.puckState.disappearanceTimeout);
            }
            
            this.puckState.disappearanceTimeout = setTimeout(() => {
                this.puckState.isVisible = false;
                this.updatePuckVisibility();
                console.log('🫥 Puck hidden after timeout');
            }, 200); // Shorter delay for more responsive hiding
        }
    }

    // Handle puck appearance when detected
    handlePuckAppearance() {
        if (!this.puckState.isDetected) {
            this.puckState.isDetected = true;
            this.puckState.lastDetectedTime = Date.now();
            
            // Clear any pending disappearance timeout
            if (this.puckState.disappearanceTimeout) {
                clearTimeout(this.puckState.disappearanceTimeout);
                this.puckState.disappearanceTimeout = null;
            }
            
            // Show puck immediately
            this.puckState.isVisible = true;
            this.updatePuckVisibility();
            
            console.log('👁️ Puck detected - showing immediately');
        } else if (!this.puckState.isVisible) {
            // Puck was detected but hidden - show it immediately
            this.puckState.isVisible = true;
            this.updatePuckVisibility();
            
            console.log('👁️ Puck was hidden but detected - showing immediately');
        }
    }

    // Update puck visibility
    updatePuckVisibility() {
        if (this.puck) {
            this.puck.style.opacity = this.puckState.isVisible ? '1' : '0';
            this.puck.style.pointerEvents = this.puckState.isVisible ? 'auto' : 'none';
        }
    }
    
    // Check if pusher is in correct half-court (matching backend logic)
    checkPusherHalfCourt(pusherName, position) {
        const isInCorrectHalf = this.isPusherInCorrectHalf(pusherName, position);
        const currentState = this.pusherState[pusherName];
        
        if (isInCorrectHalf !== currentState.isInCorrectHalf) {
            currentState.isInCorrectHalf = isInCorrectHalf;
            
            if (isInCorrectHalf) {
                // Pusher returned to correct half - make visible
                currentState.isVisible = true;
                currentState.lastValidTime = Date.now();
                console.log(`✅ ${pusherName} returned to correct half-court`);
            } else {
                // Pusher crossed to wrong half - hide it
                currentState.isVisible = false;
                console.log(`❌ ${pusherName} crossed to wrong half-court - hiding pusher`);
            }
            
            this.updatePusherVisibility(pusherName);
        }
    }
    
    // Check if pusher is in correct half based on backend logic
    isPusherInCorrectHalf(pusherName, position) {
        const centerX = this.halfCourt.centerX;
        
        // After 180-degree rotation, the half-court logic needs to be reversed
        // because the coordinate system is rotated but the pusher assignments remain the same
        if (pusherName === 'pusherA') {
            // PusherA (paddle 0) should be in RIGHT half after rotation
            // Due to 180-degree rotation, pusherA now corresponds to right side
            return position.x >= centerX;
        } else if (pusherName === 'pusherB') {
            // PusherB (paddle 1) should be in LEFT half after rotation  
            // Due to 180-degree rotation, pusherB now corresponds to left side
            return position.x < centerX;
        }
        
        return true; // Default to visible for unknown pushers
    }
    
    // Update pusher visibility
    updatePusherVisibility(pusherName) {
        const element = this[pusherName];
        const state = this.pusherState[pusherName];
        
        if (element && state) {
            if (state.isVisible) {
                element.style.opacity = '1';
                element.style.pointerEvents = 'auto';
                element.style.transform = 'scale(1)';
            } else {
                element.style.opacity = '0.2';
                element.style.pointerEvents = 'none';
                element.style.transform = 'scale(0.8)';
            }
        }
    }
    
    // Initialize pusher visibility states
    initializePusherStates() {
        Object.keys(this.pusherState).forEach(pusherName => {
            this.updatePusherVisibility(pusherName);
        });
    }
    
    // Test half-court control functionality
    testHalfCourtControl() {
        console.log('🧪 Testing half-court control functionality...');
        
        // Test pusherA crossing to right side (should become invisible)
        console.log('📍 Testing pusherA crossing to right side...');
        this.currentPositions.pusherA = { x: 30, y: 13 }; // Right side
        this.checkPusherHalfCourt('pusherA', this.currentPositions.pusherA);
        
        // Test pusherB crossing to left side (should become invisible)
        console.log('📍 Testing pusherB crossing to left side...');
        this.currentPositions.pusherB = { x: 10, y: 13 }; // Left side
        this.checkPusherHalfCourt('pusherB', this.currentPositions.pusherB);
        
        // Wait 2 seconds then restore to correct sides
        setTimeout(() => {
            console.log('📍 Restoring pushers to correct sides...');
            this.currentPositions.pusherA = { x: 8, y: 13 }; // Left side
            this.currentPositions.pusherB = { x: 35, y: 13 }; // Right side
            this.checkPusherHalfCourt('pusherA', this.currentPositions.pusherA);
            this.checkPusherHalfCourt('pusherB', this.currentPositions.pusherB);
            this.updateVisualPositions();
        }, 2000);
        
        this.updateVisualPositions();
    }
    
    // Get current half-court status
    getHalfCourtStatus() {
        return {
            pusherA: {
                position: this.currentPositions.pusherA,
                isVisible: this.pusherState.pusherA.isVisible,
                isInCorrectHalf: this.pusherState.pusherA.isInCorrectHalf,
                correctHalf: 'left'
            },
            pusherB: {
                position: this.currentPositions.pusherB,
                isVisible: this.pusherState.pusherB.isVisible,
                isInCorrectHalf: this.pusherState.pusherB.isInCorrectHalf,
                correctHalf: 'right'
            },
            halfCourtCenter: this.halfCourt.centerX
        };
    }
    
    // Test enhanced goal effects
    testGoalEffects() {
        console.log('🧪 Testing enhanced goal effects...');
        
        // Test left goal
        setTimeout(() => {
            console.log('⚽ Testing left goal effect...');
            this.handleGoalScored('left', this.currentPositions.puck);
        }, 1000);
        
        // Test right goal
        setTimeout(() => {
            console.log('⚽ Testing right goal effect...');
            this.handleGoalScored('right', this.currentPositions.puck);
        }, 5000);
    }
    
    // Test puck immediate position updates
    testPuckPositionUpdates() {
        console.log('🧪 Testing puck immediate position updates...');
        
        // Test immediate position update
        const testPositions = [
            { x: 10, y: 10 },
            { x: 30, y: 15 },
            { x: 21.5, y: 13 },
            { x: 15, y: 20 }
        ];
        
        testPositions.forEach((pos, index) => {
            setTimeout(() => {
                console.log(`📍 Testing position ${index + 1}: (${pos.x}, ${pos.y})`);
                this.updatePuckPositionImmediate(pos);
            }, index * 1000);
        });
    }
    
    // Test puck visibility control
    testPuckVisibility() {
        console.log('🧪 Testing puck visibility control...');
        
        // Test disappearance
        setTimeout(() => {
            console.log('🫥 Testing puck disappearance...');
            this.handlePuckDisappearance();
        }, 1000);
        
        // Test reappearance
        setTimeout(() => {
            console.log('👁️ Testing puck reappearance...');
            this.handlePuckAppearance();
        }, 3000);
    }
    
    // Comprehensive test of all new features
    testAllNewFeatures() {
        console.log('🧪 Starting comprehensive test of all new features...');
        
        // Test half-court control
        this.testHalfCourtControl();
        
        // Test goal effects after half-court test
        setTimeout(() => {
            this.testGoalEffects();
        }, 8000);
        
        // Test puck position updates
        setTimeout(() => {
            this.testPuckPositionUpdates();
        }, 15000);
        
        // Test puck visibility
        setTimeout(() => {
            this.testPuckVisibility();
        }, 20000);
        
        console.log('✅ All tests scheduled - check console for results');
    }
    
    // Get current system status
    getSystemStatus() {
        return {
            puckState: this.puckState,
            pusherState: this.pusherState,
            currentPositions: this.currentPositions,
            gameState: this.gameState,
            halfCourtStatus: this.getHalfCourtStatus(),
            isWebSocketConnected: this.isWebSocketConnected,
            isInitialized: this.isInitialized,
            isPaused: this.isPaused
        };
    }

    // Handle goal scored with realistic animation
    handleGoalScored(goalSide, goalPosition) {
        console.log(`🥅 Goal scored! Side: ${goalSide}, Position:`, goalPosition);
        
        // Create enhanced goal effect animation
        this.createEnhancedGoalEffect(goalSide, goalPosition);
        
        // Hide puck after goal effect completes
        setTimeout(() => {
            this.puckState.isVisible = false;
            this.updatePuckVisibility();
            console.log('🏒 Puck hidden after goal effect');
            
            // Show puck again after 5 seconds at center position
            setTimeout(() => {
                // Reset puck to center position
                this.resetPuckToCenter();
                
                // Make puck visible again
                this.puckState.isVisible = true;
                this.puckState.isDetected = true;
                this.puckState.lastDetectedTime = Date.now();
                this.updatePuckVisibility();
                
                // Update visual position to center
                this.updateVisualPositions();
                
                console.log('🏒 Puck reappeared at center position');
            }, 5000); // 5 seconds delay
            
        }, 1500); // Hide after 1.5 seconds to let the effect complete
    }
    
    // Create enhanced visual goal effect
    createEnhancedGoalEffect(goalSide, goalPosition) {
        if (!this.puck) return;
        
        console.log(`✨ Creating enhanced goal effect for ${goalSide} side`);
        
        // Add enhanced goal effect class for animation
        this.puck.classList.add('puck-goal', 'goal-effect');
        
        // Create goal celebration container
        const celebrationContainer = document.createElement('div');
        celebrationContainer.className = 'goal-celebration';
        celebrationContainer.style.position = 'absolute';
        celebrationContainer.style.left = '50%';
        celebrationContainer.style.top = '50%';
        celebrationContainer.style.transform = 'translate(-50%, -50%)';
        celebrationContainer.style.pointerEvents = 'none';
        celebrationContainer.style.zIndex = '30';
        celebrationContainer.style.fontSize = '24px';
        celebrationContainer.style.fontWeight = 'bold';
        celebrationContainer.style.color = 'gold';
        celebrationContainer.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        celebrationContainer.style.animation = 'goalText 2s ease-out forwards';
        celebrationContainer.textContent = 'GOAL!';
        
        // Add celebration to table surface
        if (this.tableSurface) {
            this.tableSurface.appendChild(celebrationContainer);
        }
        
        // Animate puck towards goal with enhanced effect
        const goalElement = goalSide === 'left' ? this.goalLeft : this.goalRight;
        if (goalElement) {
            const goalRect = goalElement.getBoundingClientRect();
            const tableRect = this.tableSurface.getBoundingClientRect();
            
            // Calculate goal position relative to table
            const goalX = goalRect.left - tableRect.left + goalRect.width / 2;
            const goalY = goalRect.top - tableRect.top + goalRect.height / 2;
            
            // Enhanced puck animation to goal
            this.puck.style.transition = 'all 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            this.puck.style.left = goalX + 'px';
            this.puck.style.top = goalY + 'px';
            this.puck.style.transform = 'scale(1.2)';
            this.puck.style.filter = 'brightness(1.8) drop-shadow(0 0 15px gold)';
        }
        
        // Create enhanced spark effect
        this.createEnhancedSparkEffect(goalSide);
        
        // Create screen flash effect
        this.createScreenFlashEffect();
        
        // Remove effects after animation
        setTimeout(() => {
            if (this.puck) {
                this.puck.classList.remove('puck-goal', 'goal-effect');
                this.puck.style.transition = '';
                this.puck.style.transform = '';
                this.puck.style.filter = '';
            }
            
            // Remove celebration text
            if (celebrationContainer && celebrationContainer.parentNode) {
                celebrationContainer.parentNode.removeChild(celebrationContainer);
            }
        }, 2000);
    }
    
    // Create enhanced spark effect for goal
    createEnhancedSparkEffect(goalSide) {
        const goalElement = goalSide === 'left' ? this.goalLeft : this.goalRight;
        if (!goalElement) return;
        
        // Create multiple spark containers for layered effect
        for (let layer = 0; layer < 3; layer++) {
            const sparkContainer = document.createElement('div');
            sparkContainer.className = 'goal-sparks';
            sparkContainer.style.position = 'absolute';
            sparkContainer.style.left = '50%';
            sparkContainer.style.top = '50%';
            sparkContainer.style.transform = 'translate(-50%, -50%)';
            sparkContainer.style.pointerEvents = 'none';
            sparkContainer.style.zIndex = '25';
            
            // Add more sparks for enhanced effect
            for (let i = 0; i < 12; i++) {
                const spark = document.createElement('div');
                spark.className = 'goal-spark';
                spark.style.position = 'absolute';
                spark.style.width = '4px';
                spark.style.height = '4px';
                spark.style.backgroundColor = layer === 0 ? 'gold' : layer === 1 ? 'orange' : 'yellow';
                spark.style.borderRadius = '50%';
                spark.style.boxShadow = `0 0 10px ${spark.style.backgroundColor}`;
                
                // Random direction and distance
                const angle = (i * 30 + layer * 10) * Math.PI / 180;
                const distance = 50 + Math.random() * 30;
                const endX = Math.cos(angle) * distance;
                const endY = Math.sin(angle) * distance;
                
                spark.style.animation = `sparkFly${layer} 1.5s ease-out forwards`;
                spark.style.setProperty('--endX', `${endX}px`);
                spark.style.setProperty('--endY', `${endY}px`);
                
                sparkContainer.appendChild(spark);
            }
            
            goalElement.appendChild(sparkContainer);
            
            // Remove spark container after animation
            setTimeout(() => {
                if (sparkContainer && sparkContainer.parentNode) {
                    sparkContainer.parentNode.removeChild(sparkContainer);
                }
            }, 1500);
        }
    }
    
    // Create screen flash effect
    createScreenFlashEffect() {
        const flashOverlay = document.createElement('div');
        flashOverlay.className = 'goal-flash';
        flashOverlay.style.position = 'fixed';
        flashOverlay.style.top = '0';
        flashOverlay.style.left = '0';
        flashOverlay.style.width = '100vw';
        flashOverlay.style.height = '100vh';
        flashOverlay.style.backgroundColor = 'rgba(255, 215, 0, 0.3)';
        flashOverlay.style.pointerEvents = 'none';
        flashOverlay.style.zIndex = '9999';
        flashOverlay.style.animation = 'goalFlash 0.5s ease-out forwards';
        
        document.body.appendChild(flashOverlay);
        
        // Remove flash after animation
        setTimeout(() => {
            if (flashOverlay && flashOverlay.parentNode) {
                flashOverlay.parentNode.removeChild(flashOverlay);
            }
        }, 500);
    }
    
    // Reset puck to center position
    resetPuckToCenter() {
        this.currentPositions.puck = { 
            x: this.realDimensions.tableLength / 2, 
            y: this.realDimensions.tableWidth / 2 
        };
        this.previousPositions.puck = { ...this.currentPositions.puck };
        this.velocities.puck = { x: 0, y: 0 };
        
        console.log('🎯 Puck position reset to center');
    }

    // Check object boundaries (prevent objects from going out of bounds)
    checkObjectBoundaries(objectName, radius) {
        const pos = this.currentPositions[objectName];
        
        // Use exact real dimensions without any buffer - this ensures perfect alignment
        const minX = 0;
        const maxX = this.realDimensions.tableLength;
        const minY = 0;
        const maxY = this.realDimensions.tableWidth;
        
        // Store original position for logging
        const originalPos = { x: pos.x, y: pos.y };
        let positionClamped = false;
        
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
                    positionClamped = true;
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
                    positionClamped = true;
                }
            }
        } else {
            // Normal boundary checking for pushers
            // Check left boundary
            if (pos.x - radius <= minX) {
                pos.x = minX + radius;
                positionClamped = true;
            }
            
            // Check right boundary
            if (pos.x + radius >= maxX) {
                pos.x = maxX - radius;
                positionClamped = true;
            }
        }
        
        // Check top boundary (all objects)
        if (pos.y - radius <= minY) {
            pos.y = minY + radius;
            positionClamped = true;
        }
        
        // Check bottom boundary (all objects)
        if (pos.y + radius >= maxY) {
            pos.y = maxY - radius;
            positionClamped = true;
        }
        
        // Log position clamping for debugging
        if (positionClamped) {
            console.log(`🔒 ${objectName} position clamped: (${originalPos.x.toFixed(2)}, ${originalPos.y.toFixed(2)}) → (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`);
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
        
        // Reset velocities and previous positions
        this.velocities = {
            pusherA: { x: 0, y: 0 },
            pusherB: { x: 0, y: 0 },
            puck: { x: 0, y: 0 }
        };
        
        this.previousPositions = {
            pusherA: { x: 8, y: 13 },
            pusherB: { x: 35, y: 13 },
            puck: { x: 21.5, y: 13 }
        };
        
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
            
            // Skip updating puck position if it's not visible
            if (objectName === 'puck' && !this.puckState.isVisible) {
                return;
            }
            
            // Skip updating pusher position if it's not visible due to half-court control
            if ((objectName === 'pusherA' || objectName === 'pusherB') && !this.pusherState[objectName].isVisible) {
                return;
            }
            
            const displayPos = this.realToDisplayCoordinates(realPos.x, realPos.y);
            
            const element = this[objectName];
            if (element) {
                // Center the element on the position
                const elementWidth = element.offsetWidth;
                const elementHeight = element.offsetHeight;
                
                element.style.left = (displayPos.x - elementWidth / 2) + 'px';
                element.style.top = (displayPos.y - elementHeight / 2) + 'px';
            }
            
            // Update position display (always update, even when object is hidden)
            this.updatePositionDisplay(objectName, realPos.x, realPos.y);
        });
    }

    // Handle position update from WebSocket/MQTT
    handlePositionUpdate(data) {
        if (!this.isInitialized || this.isPaused) return;
        
        // Validate data structure
        if (!data || typeof data !== 'object') {
            console.warn('⚠️ Invalid position data received:', data);
            return;
        }
        
        // Log data reception for debugging (less verbose)
        if (this.updateCount % 30 === 0) { // Log every 30 updates to reduce spam
            console.log('📡 Position data received:', data);
        }
        
        // Track update success
        let updateSuccess = false;
        
        // Convert MQTT data to real-world coordinates
        // Backend sends data in format: { pusher1: {x, y}, pusher2: {x, y}, puck: {x, y} }
        
        if (data.pusher1) {
            // Check if pusher1 data is valid before processing
            if (this.isValidPositionData(data.pusher1)) {
                const realPos = this.mqttToRealCoordinates(data.pusher1.x, data.pusher1.y);
                
                // Double-check that conversion was successful
                if (realPos) {
                    // Calculate velocity based on position change
                    this.calculateVelocity('pusherA', realPos);
                    
                    // Update previous position for next calculation
                    this.previousPositions.pusherA = { ...this.currentPositions.pusherA };
                    
                    // Update current position
                    this.currentPositions.pusherA = realPos;
                    
                    // Check half-court control for pusherA
                    this.checkPusherHalfCourt('pusherA', realPos);
                    
                    updateSuccess = true;
                    
                    if (this.updateCount % 60 === 0) { // Log every 60 updates
                        console.log(`📍 Pusher A updated to: (${realPos.x.toFixed(2)}, ${realPos.y.toFixed(2)}) [MQTT: ${data.pusher1.x}, ${data.pusher1.y}]`);
                    }
                } else {
                    console.warn(`⚠️ Failed to convert pusher1 coordinates: (${data.pusher1.x}, ${data.pusher1.y})`);
                }
            } else {
                console.warn(`⚠️ Invalid pusher1 data: x=${data.pusher1.x}, y=${data.pusher1.y}`);
            }
        }
        
        if (data.pusher2) {
            // Check if pusher2 data is valid before processing
            if (this.isValidPositionData(data.pusher2)) {
                const realPos = this.mqttToRealCoordinates(data.pusher2.x, data.pusher2.y);
                
                // Double-check that conversion was successful
                if (realPos) {
                    // Calculate velocity based on position change
                    this.calculateVelocity('pusherB', realPos);
                    
                    // Update previous position for next calculation
                    this.previousPositions.pusherB = { ...this.currentPositions.pusherB };
                    
                    // Update current position
                    this.currentPositions.pusherB = realPos;
                    
                    // Check half-court control for pusherB
                    this.checkPusherHalfCourt('pusherB', realPos);
                    
                    updateSuccess = true;
                    
                    if (this.updateCount % 60 === 0) { // Log every 60 updates
                        console.log(`📍 Pusher B updated to: (${realPos.x.toFixed(2)}, ${realPos.y.toFixed(2)}) [MQTT: ${data.pusher2.x}, ${data.pusher2.y}]`);
                    }
                } else {
                    console.warn(`⚠️ Failed to convert pusher2 coordinates: (${data.pusher2.x}, ${data.pusher2.y})`);
                }
            } else {
                console.warn(`⚠️ Invalid pusher2 data: x=${data.pusher2.x}, y=${data.pusher2.y}`);
            }
        }
        
        // Handle puck data - including null/missing detection
        if (data.puck !== undefined) {
            if (data.puck === null) {
                // Puck not detected - handle disappearance
                this.handlePuckDisappearance();
            } else if (this.isValidPositionData(data.puck)) {
                const realPos = this.mqttToRealCoordinates(data.puck.x, data.puck.y);
                
                // Double-check that conversion was successful
                if (realPos) {
                    // Puck is detected and valid - show it immediately
                    this.handlePuckAppearance();
                    
                    // Update position immediately without any delay
                    this.updatePuckPositionImmediate(realPos);
                    
                    updateSuccess = true;
                    
                    if (this.updateCount % 60 === 0) { // Log every 60 updates
                        console.log(`📍 Puck updated to: (${realPos.x.toFixed(2)}, ${realPos.y.toFixed(2)}) [MQTT: ${data.puck.x}, ${data.puck.y}]`);
                    }
                } else {
                    console.warn(`⚠️ Failed to convert puck coordinates: (${data.puck.x}, ${data.puck.y})`);
                }
            } else {
                console.warn(`⚠️ Invalid puck data: x=${data.puck.x}, y=${data.puck.y}`);
            }
        }
        
        // Update performance metrics
        this.updatePerformanceMetrics();
        
        // Log successful update rate
        if (updateSuccess && this.updateCount % 120 === 0) {
            console.log(`✅ Position update successful (${this.updateCount} updates processed)`);
        }
    }

    // Calculate velocity based on position change
    calculateVelocity(objectName, newPosition) {
        if (!this.velocities || !this.previousPositions || !this.currentPositions) {
            return;
        }
        
        const previousPos = this.previousPositions[objectName];
        const currentPos = this.currentPositions[objectName];
        
        if (!previousPos || !currentPos) {
            // Initialize velocity to zero if no previous position
            this.velocities[objectName] = { x: 0, y: 0 };
            return;
        }
        
        // Calculate time difference (assuming 60fps update rate)
        const deltaTime = 1/60; // seconds
        
        // Calculate velocity (cm/s)
        const velX = (newPosition.x - currentPos.x) / deltaTime;
        const velY = (newPosition.y - currentPos.y) / deltaTime;
        
        // Update velocity with some smoothing to avoid jittery display
        if (this.velocities[objectName]) {
            const smoothingFactor = 0.7; // Smooth velocity changes
            this.velocities[objectName].x = this.velocities[objectName].x * smoothingFactor + velX * (1 - smoothingFactor);
            this.velocities[objectName].y = this.velocities[objectName].y * smoothingFactor + velY * (1 - smoothingFactor);
        } else {
            this.velocities[objectName] = { x: velX, y: velY };
        }
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
        
        // Check if values are within reasonable bounds (0-810 for x, 0-420 for y in MQTT coordinates)
        // Updated to match backend coordinate system (810x420)
        if (x < 0 || x > 810 || y < 0 || y > 420) {
            console.warn(`⚠️ Position data out of bounds: x=${x}, y=${y} (expected 0-810, 0-420)`);
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
        // Updated to match backend coordinate system (810x420)
        const clampedX = Math.max(0, Math.min(810, mqttX));
        const clampedY = Math.max(0, Math.min(420, mqttY));
        
        // Log if values were clamped
        if (clampedX !== mqttX || clampedY !== mqttY) {
            console.warn(`⚠️ MQTT coordinates clamped: (${mqttX}, ${mqttY}) → (${clampedX}, ${clampedY})`);
        }
        
        // Convert to real-world coordinates with 180-degree rotation
        // Backend uses 810x420 coordinate system, convert to 43x26cm real dimensions
        // Apply 180-degree rotation: x' = max_x - x, y' = max_y - y
        const normalizedX = clampedX / 810;
        const normalizedY = clampedY / 420;
        
        // 180-degree rotation: flip both x and y coordinates
        const rotatedX = 1 - normalizedX;
        const rotatedY = 1 - normalizedY;
        
        const realX = rotatedX * this.realDimensions.tableLength;
        const realY = rotatedY * this.realDimensions.tableWidth;
        
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
            // Check if velocities object exists and has the object key
            if (this.velocities && this.velocities[object]) {
                const vel = this.velocities[object];
                const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
                velElement.textContent = `V: ${speed.toFixed(1)} cm/s`;
            } else {
                velElement.textContent = `V: 0.0 cm/s`;
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
            
            // Listen for goal events
            window.websocketManager.on('goal_scored', (goalData) => {
                this.handleGoalEvent(goalData);
            });
            
            // Listen for game reset events
            window.websocketManager.on('game_reset', () => {
                this.handleGameReset();
            });
            
            // Listen for connection status changes
            window.websocketManager.on('connect', () => {
                this.updateConnectionStatus(true);
            });
            
            window.websocketManager.on('disconnect', () => {
                this.updateConnectionStatus(false);
            });
            
            console.log('🔌 WebSocket connection listeners set up for positions, goals, and game events');
        } else {
            console.warn('⚠️ WebSocket manager not available');
        }
    }
    
    // Handle goal event from WebSocket
    handleGoalEvent(goalData) {
        console.log('🥅 Goal event received:', goalData);
        
        if (goalData && goalData.side) {
            // Trigger goal animation with current puck position
            this.handleGoalScored(goalData.side, this.currentPositions.puck);
        }
    }
    
    // Handle game reset
    handleGameReset() {
        console.log('🔄 Game reset received');
        
        // Reset puck state
        this.puckState.isVisible = true;
        this.puckState.isDetected = true;
        this.puckState.lastDetectedTime = Date.now();
        
        if (this.puckState.disappearanceTimeout) {
            clearTimeout(this.puckState.disappearanceTimeout);
            this.puckState.disappearanceTimeout = null;
        }
        
        // Reset positions
        this.setInitialPositions();
        
        // Show puck and initialize pusher states
        this.puckState.isVisible = true;
        this.updatePuckVisibility();
        this.initializePusherStates();
    }

    // Update connection status
    updateConnectionStatus(isConnected) {
        this.isWebSocketConnected = isConnected;
        
        const statusElement = document.getElementById('mqttStatus');
        if (statusElement) {
            statusElement.textContent = isConnected ? 'Connected - Real Data' : 'Disconnected';
            statusElement.className = `status-value ${isConnected ? 'connected' : 'disconnected'}`;
        }
        
        console.log(`🔗 Connection status: ${isConnected ? 'connected' : 'disconnected'}`);
        
        // If disconnected, maintain last known positions
        if (!isConnected) {
            console.log('📡 WebSocket disconnected, keeping last known positions');
        }
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
    
    // Test function to simulate position data
    testPositionUpdate() {
        const testData = {
            pusher1: { x: 100 + Math.random() * 600, y: 50 + Math.random() * 300 },
            pusher2: { x: 200 + Math.random() * 600, y: 50 + Math.random() * 300 },
            puck: { x: 300 + Math.random() * 200, y: 100 + Math.random() * 200 }
        };
        
        console.log('🧪 Testing position update with:', testData);
        this.handlePositionUpdate(testData);
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

    // Update puck position immediately
    updatePuckPositionImmediate(realPos) {
        this.currentPositions.puck = realPos;
        this.previousPositions.puck = { ...this.currentPositions.puck };
        this.velocities.puck = { x: 0, y: 0 }; // Reset velocity when puck is updated
        this.updateVisualPositions(); // Update visual position immediately
    }
     // Test 180-degree rotation
     test180DegreeRotation() {
         console.log('🧪 Testing 180-degree rotation...');
         
         // Test corner positions to verify rotation
         const testMQTTPositions = [
             { mqtt: { x: 0, y: 0 }, expected: { x: 43, y: 26 }, description: 'Top-left corner' },
             { mqtt: { x: 810, y: 0 }, expected: { x: 0, y: 26 }, description: 'Top-right corner' },
             { mqtt: { x: 0, y: 420 }, expected: { x: 43, y: 0 }, description: 'Bottom-left corner' },
             { mqtt: { x: 810, y: 420 }, expected: { x: 0, y: 0 }, description: 'Bottom-right corner' },
             { mqtt: { x: 405, y: 210 }, expected: { x: 21.5, y: 13 }, description: 'Center' }
         ];
         
         testMQTTPositions.forEach(test => {
             const result = this.mqttToRealCoordinates(test.mqtt.x, test.mqtt.y);
             console.log(`📍 ${test.description}: MQTT(${test.mqtt.x}, ${test.mqtt.y}) → Real(${result.x.toFixed(1)}, ${result.y.toFixed(1)}) [Expected: (${test.expected.x}, ${test.expected.y})]`);
         });
     }
     
     // Test backend-based goal events
     testBackendGoalEvents() {
         console.log('🧪 Testing backend-based goal events...');
         
         // Test left goal
         setTimeout(() => {
             console.log('⚽ Simulating left goal from backend...');
             this.handleGoalEvent({ side: 'left' });
         }, 1000);
         
         // Test right goal
         setTimeout(() => {
             console.log('⚽ Simulating right goal from backend...');
             this.handleGoalEvent({ side: 'right' });
         }, 4000);
     }
     
     // Test goal sequence with puck reappearance
     testGoalSequenceWithPuckReappearance() {
         console.log('🧪 Testing goal sequence with puck reappearance...');
         
         // Set puck to a visible position first
         this.currentPositions.puck = { x: 20, y: 13 };
         this.puckState.isVisible = true;
         this.updatePuckVisibility();
         this.updateVisualPositions();
         
         console.log('📍 Puck positioned at (20, 13) and visible');
         
         // Simulate goal after 2 seconds
         setTimeout(() => {
             console.log('⚽ Simulating goal - puck should disappear and reappear at center in 5 seconds...');
             this.handleGoalEvent({ side: 'left' });
             
             // Log status at different intervals
             setTimeout(() => {
                 console.log('⏰ 3 seconds: Puck should still be hidden');
                 console.log('Puck visible:', this.puckState.isVisible);
             }, 3000);
             
             setTimeout(() => {
                 console.log('⏰ 7 seconds: Puck should now be visible at center');
                 console.log('Puck visible:', this.puckState.isVisible);
                 console.log('Puck position:', this.currentPositions.puck);
             }, 7000);
             
         }, 2000);
     }
     
     // Test multiple goal sequence
     testMultipleGoalsSequence() {
         console.log('🧪 Testing multiple goals sequence...');
         
         // First goal
         setTimeout(() => {
             console.log('⚽ First goal (left)');
             this.handleGoalEvent({ side: 'left' });
         }, 1000);
         
         // Second goal (should happen after first puck reappears)
         setTimeout(() => {
             console.log('⚽ Second goal (right)');
             this.handleGoalEvent({ side: 'right' });
         }, 8000);
         
         // Third goal
         setTimeout(() => {
             console.log('⚽ Third goal (left)');
             this.handleGoalEvent({ side: 'left' });
         }, 15000);
         
         console.log('📅 Goals scheduled at 1s, 8s, and 15s intervals');
     }
     
     // Test coordinate system consistency
     testCoordinateSystemConsistency() {
         console.log('🧪 Testing coordinate system consistency...');
         
         // Test pusher positions after rotation
         const testPusherPositions = [
             { mqtt: { x: 200, y: 210 }, pusher: 'pusherA', description: 'PusherA test position' },
             { mqtt: { x: 600, y: 210 }, pusher: 'pusherB', description: 'PusherB test position' }
         ];
         
         testPusherPositions.forEach(test => {
             const realPos = this.mqttToRealCoordinates(test.mqtt.x, test.mqtt.y);
             const isInCorrectHalf = this.isPusherInCorrectHalf(test.pusher, realPos);
             console.log(`📍 ${test.description}: MQTT(${test.mqtt.x}, ${test.mqtt.y}) → Real(${realPos.x.toFixed(1)}, ${realPos.y.toFixed(1)}) - In correct half: ${isInCorrectHalf}`);
         });
     }
     
     // Comprehensive test of rotation and backend integration
     testRotationAndBackendIntegration() {
         console.log('🧪 Starting comprehensive test of rotation and backend integration...');
         
         // Test 180-degree rotation
         this.test180DegreeRotation();
         
         // Test coordinate system consistency
         setTimeout(() => {
             this.testCoordinateSystemConsistency();
         }, 2000);
         
         // Test backend goal events with puck reappearance
         setTimeout(() => {
             this.testGoalSequenceWithPuckReappearance();
         }, 4000);
         
         // Test multiple goals sequence
         setTimeout(() => {
             this.testMultipleGoalsSequence();
         }, 12000);
         
         // Test all other features
         setTimeout(() => {
             this.testAllNewFeatures();
         }, 25000);
         
         console.log('✅ All rotation and backend integration tests scheduled (including goal reappearance)');
     }
     
     // Collision testing functionality removed
     
     // Quick test for goal and puck reappearance
     testQuickGoalReappearance() {
         console.log('🧪 Quick test: Goal → Puck disappears → Puck reappears at center');
         
         // Ensure puck is visible first
         this.puckState.isVisible = true;
         this.updatePuckVisibility();
         console.log('📍 Puck made visible');
         
         // Trigger goal immediately
         setTimeout(() => {
             console.log('⚽ Goal triggered!');
             this.handleGoalEvent({ side: 'left' });
             console.log('⏰ Timeline: Goal effect (1.5s) → Hide puck (5s) → Show at center');
         }, 500);
     }
     
     // Get current puck status
     getPuckStatus() {
         return {
             isVisible: this.puckState.isVisible,
             isDetected: this.puckState.isDetected,
             position: this.currentPositions.puck,
             lastDetectedTime: this.puckState.lastDetectedTime,
             centerPosition: {
                 x: this.realDimensions.tableLength / 2,
                 y: this.realDimensions.tableWidth / 2
             }
         };
     }
}

        // Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.hockeyVisualization = new HockeyVisualization();
    window.hockeyVisualization.initialize();
}); 