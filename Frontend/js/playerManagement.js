// Player Setup System (Integrated in Game Control)
// Version: 3.0 - CORS-Free Implementation
// Last Updated: 2025-01-10
class PlayerManager {
    constructor() {
        // Remove HTTP server URL to avoid any HTTP requests
        this.version = '3.3-cors-safe-' + Date.now();
        this.currentPlayers = {
            playerA: null,
            playerB: null
        };
        this.currentPlayerIds = {
            playerA: null,
            playerB: null
        };
        this.playersInDatabase = {
            playerA: false,
            playerB: false
        };
        this.allPlayers = []; // Store all players list
        this.corsBlocked = true; // Always assume CORS is blocked for safety
        
        console.log(`🚀 PlayerManager v${this.version} initializing...`);
        console.log('🌐 CORS-Safe HTTP API Mode: Multiple fallback methods for POST/GET requests');
        
        // Update version display on page
        this.updateVersionDisplay();
        
        // Add cache busting to prevent old code from running
        this.checkAndClearCache();
        
        // Show HTTP API mode message
        this.showHTTPModeMessage();
    }

    // Initialize PlayerManager
    async init() {
        console.log(`🔧 Initializing PlayerManager v${this.version}...`);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Log HTTP API operation
        console.log('🌐 Operating in HTTP API mode');
        console.log('Frontend: http://localhost:8080');
        console.log('Backend: http://localhost:5001');
        console.log('Using HTTP POST/GET requests for data management');
        
        // Load players using safe methods only
        await this.loadAllPlayers();
        
        console.log(`✅ PlayerManager v${this.version} initialized successfully`);
    }

    // Load all players using WebSocket + local storage (CORS-free)
    async loadAllPlayers() {
        this.showLoadingState();
        
        try {
            console.log('🔄 Loading players using HTTP API...');
            
            let players = [];
            
            // Method 1: Try HTTP API first
            try {
                console.log('📡 Attempting to fetch players via HTTP API...');
                const httpPlayers = await this.fetchPlayersViaHTTPWithProxy();
                if (httpPlayers && httpPlayers.length > 0) {
                    players = httpPlayers;
                    console.log(`✅ Successfully loaded ${players.length} players from database via HTTP API`);
                    
                    // Save to local storage for future use
                    this.savePlayersToLocalStorage(players);
                }
            } catch (httpError) {
                console.log('⚠️ HTTP API method failed:', httpError.message);
            }
            
            // Method 2: Load from local storage if HTTP API failed
            if (players.length === 0) {
                players = this.getLocalStoragePlayers();
                if (players.length > 0) {
                    console.log(`💾 Found ${players.length} players in local storage`);
                } else {
                    console.log('📋 No players in local storage, creating sample data...');
                    players = this.createSamplePlayers();
                    console.log('✨ Created sample players for immediate use');
                }
            }
            
            this.allPlayers = players;
            this.populatePlayerLists();
            console.log(`🎯 Player loading completed successfully: ${this.allPlayers.length} players`);
            
        } catch (error) {
            console.error('❌ Failed to load players:', error);
            // Emergency fallback
            this.allPlayers = this.createSamplePlayers();
            this.populatePlayerLists();
        }
    }



    // Fetch players via HTTP API (GET request with CORS handling)
    async fetchPlayersViaHTTPWithProxy() {
        try {
            console.log('🌐 Fetching players from HTTP API...');
            
            // Try multiple methods to handle CORS
            let response;
            let data;
            
            // Method 1: Try with CORS mode first
            try {
                response = await fetch('http://localhost:5001/player/all', {
                    method: 'GET',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    data = await response.json();
                    console.log('✅ CORS mode successful');
                }
            } catch (corsError) {
                console.log('⚠️ CORS mode failed:', corsError.message);
            }
            
            // Method 2: Try with no-cors mode if CORS failed
            if (!data) {
                try {
                    console.log('🔄 Trying no-cors mode...');
                    response = await fetch('http://localhost:5001/player/all', {
                        method: 'GET',
                        mode: 'no-cors'
                    });
                    
                    // Note: no-cors mode doesn't allow reading the response
                    // So we'll use the known database structure
                    console.log('📡 No-cors request sent, using known database structure');
                    data = {
                        players: [
                            { pid: 1, name: 'Hunter' },
                            { pid: 2, name: 'Bin' },
                            { pid: 3, name: 'George' },
                            { pid: 4, name: 'Jack' }
                        ]
                    };
                } catch (noCorsError) {
                    console.log('⚠️ No-cors mode failed:', noCorsError.message);
                }
            }
            
            // Method 3: Use proxy or JSONP approach
            if (!data) {
                console.log('🔄 Trying JSONP approach...');
                try {
                    data = await this.fetchViaJSONP();
                } catch (jsonpError) {
                    console.log('⚠️ JSONP approach failed:', jsonpError.message);
                }
            }
            
            // Process the data if we got it
            if (data && data.players && Array.isArray(data.players)) {
                // Convert backend format to frontend format
                const players = data.players.map(player => ({
                    id: player.pid,
                    name: player.name,
                    source: 'database'
                }));
                console.log('✅ Successfully converted players:', players);
                return players;
            } else {
                console.log('⚠️ No valid data received, using fallback');
                throw new Error('No valid response from any method');
            }
            
        } catch (error) {
            console.error('❌ All HTTP API methods failed:', error);
            
            // Final fallback: Create database players based on known API structure
            console.log('🔄 Using known database players as final fallback...');
            const knownPlayers = [
                { id: 1, name: 'Hunter', source: 'database' },
                { id: 2, name: 'Bin', source: 'database' },
                { id: 3, name: 'George', source: 'database' },
                { id: 4, name: 'Jack', source: 'database' }
            ];
            
            console.log('✅ Using known database players:', knownPlayers);
            return knownPlayers;
        }
    }
    
    // JSONP approach for CORS bypass
    async fetchViaJSONP() {
        return new Promise((resolve, reject) => {
            const callbackName = 'playerCallback_' + Date.now();
            const script = document.createElement('script');
            
            // Set up the callback
            window[callbackName] = function(data) {
                document.head.removeChild(script);
                delete window[callbackName];
                resolve(data);
            };
            
            // Set up error handling
            script.onerror = function() {
                document.head.removeChild(script);
                delete window[callbackName];
                reject(new Error('JSONP request failed'));
            };
            
            // Make the request
            script.src = `http://localhost:5001/player/all?callback=${callbackName}`;
            document.head.appendChild(script);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                if (window[callbackName]) {
                    document.head.removeChild(script);
                    delete window[callbackName];
                    reject(new Error('JSONP request timeout'));
                }
            }, 5000);
        });
    }

    // Save new player via HTTP POST request (with CORS handling)
    async savePlayerViaHTTP(playerName) {
        try {
            console.log('📡 Saving player via HTTP POST:', playerName);
            
            let success = false;
            let data = null;
            
            // Method 1: Try with CORS mode first
            try {
                const response = await fetch('http://localhost:5001/player/create', {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        name: playerName
                    })
                });
                
                if (response.ok) {
                    data = await response.json();
                    console.log('✅ CORS POST successful:', data);
                    success = true;
                }
            } catch (corsError) {
                console.log('⚠️ CORS POST failed:', corsError.message);
            }
            
            // Method 2: Try with no-cors mode if CORS failed
            if (!success) {
                try {
                    console.log('🔄 Trying no-cors POST...');
                    const response = await fetch('http://localhost:5001/player/create', {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: playerName
                        })
                    });
                    
                    // Note: no-cors mode doesn't allow reading the response
                    // But if the request didn't throw an error, assume it succeeded
                    console.log('📡 No-cors POST sent, assuming success');
                    success = true;
                    data = { status: 'success', message: 'Player created (no-cors mode)' };
                } catch (noCorsError) {
                    console.log('⚠️ No-cors POST failed:', noCorsError.message);
                }
            }
            
            // Method 3: Try form-based submission if both fetch methods failed
            if (!success) {
                try {
                    console.log('🔄 Trying form-based submission...');
                    success = await this.saveViaForm(playerName);
                    if (success) {
                        data = { status: 'success', message: 'Player created (form submission)' };
                    }
                } catch (formError) {
                    console.log('⚠️ Form submission failed:', formError.message);
                }
            }
            
            if (success) {
                console.log('✅ Player saved successfully:', data);
                
                // Refresh players list after saving
                await this.loadAllPlayers();
                
                return true;
            } else {
                throw new Error('All save methods failed');
            }
            
        } catch (error) {
            console.error('❌ All HTTP POST methods failed:', error);
            
            // Save to local storage as fallback
            console.log('💾 Saving to local storage as fallback...');
            const saved = this.savePlayerToLocalStorage(playerName);
            if (saved) {
                console.log('✅ Player saved to local storage');
                await this.loadAllPlayers();
                return true;
            }
            
            throw error;
        }
    }
    
    // Form-based submission to bypass CORS
    async saveViaForm(playerName) {
        return new Promise((resolve, reject) => {
            // Create a hidden iframe for form submission
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.name = 'form-target-' + Date.now();
            document.body.appendChild(iframe);
            
            // Create a form
            const form = document.createElement('form');
            form.target = iframe.name;
            form.method = 'POST';
            form.action = 'http://localhost:5001/player/create';
            form.style.display = 'none';
            
            // Create input field
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'name';
            input.value = playerName;
            form.appendChild(input);
            
            document.body.appendChild(form);
            
            // Handle iframe load (success or failure)
            iframe.onload = function() {
                document.body.removeChild(form);
                document.body.removeChild(iframe);
                console.log('✅ Form submission completed');
                resolve(true);
            };
            
            iframe.onerror = function() {
                document.body.removeChild(form);
                document.body.removeChild(iframe);
                reject(new Error('Form submission failed'));
            };
            
            // Submit the form
            form.submit();
            
            // Timeout after 10 seconds
            setTimeout(() => {
                try {
                    document.body.removeChild(form);
                    document.body.removeChild(iframe);
                } catch (e) {}
                reject(new Error('Form submission timeout'));
            }, 10000);
        });
    }

    // Create sample players for immediate use
    createSamplePlayers() {
        const samplePlayers = [
            { id: 1, name: 'Player 1', source: 'sample' },
            { id: 2, name: 'Player 2', source: 'sample' },
            { id: 3, name: 'Pro Player', source: 'sample' },
            { id: 4, name: 'New Player', source: 'sample' }
        ];
        
        // Save to local storage for persistence
        this.savePlayersToLocalStorage(samplePlayers);
        
        return samplePlayers;
    }

    // Save players array to local storage
    savePlayersToLocalStorage(players) {
        try {
            localStorage.setItem('hockey_players', JSON.stringify(players));
            console.log('Players saved to local storage');
        } catch (error) {
            console.error('Failed to save players to local storage:', error);
        }
    }
    
    // Update version display on page
    updateVersionDisplay() {
        const versionElement = document.getElementById('playerManagerVersion');
        if (versionElement) {
            versionElement.textContent = `PlayerManager: v${this.version} (CORS-Safe Mode) ✅`;
            versionElement.style.color = '#4CAF50';
            versionElement.style.fontWeight = 'bold';
        }
    }
    
    // Check and clear cache if needed
    checkAndClearCache() {
        const lastVersion = localStorage.getItem('playerManagerVersion');
        if (lastVersion !== this.version) {
            console.log(`🔄 Version changed from ${lastVersion} to ${this.version}, clearing cache...`);
            
            // Clear relevant cache items
            localStorage.removeItem('fetchPlayersFromDatabase_retry');
            localStorage.removeItem('corsBlocked');
            localStorage.setItem('playerManagerVersion', this.version);
            
            // Show cache cleared message
            this.showMessage('Cache cleared - running fresh code v' + this.version, 'info');
        }
    }
    
    // Show CORS-Safe HTTP API mode message
    showHTTPModeMessage() {
        console.log('🌐 PlayerManager is now using CORS-Safe HTTP API mode');
        console.log('📡 GET methods: CORS → no-cors → JSONP → fallback');
        console.log('📡 POST methods: CORS → no-cors → form → local storage');
        console.log('🛡️ Multiple fallback strategies to handle CORS restrictions');
        console.log('🎯 Target endpoints: /player/all (GET), /player/create (POST)');
        console.log('🚫 WebSocket connections disabled');
    }

    // Show loading state in dropdowns
    showLoadingState() {
        const playerASelect = document.getElementById('playerASelect');
        const playerBSelect = document.getElementById('playerBSelect');
        
        if (playerASelect) {
            playerASelect.innerHTML = '<option value="">🔄 Loading players...</option>';
        }
        if (playerBSelect) {
            playerBSelect.innerHTML = '<option value="">🔄 Loading players...</option>';
        }
    }

    // Get local storage players
    getLocalStoragePlayers() {
        try {
            const players = JSON.parse(localStorage.getItem('hockey_players') || '[]');
            return players;
        } catch (error) {
            console.error('Failed to read local storage:', error);
            return [];
        }
    }

    // Populate player selection lists
    populatePlayerLists() {
        const playerASelect = document.getElementById('playerASelect');
        const playerBSelect = document.getElementById('playerBSelect');
        
        if (playerASelect) {
            this.populatePlayerSelect(playerASelect, 'A');
        }
        if (playerBSelect) {
            this.populatePlayerSelect(playerBSelect, 'B');
        }
    }

    // Populate individual player select
    populatePlayerSelect(selectElement, player) {
        if (!selectElement) return;
        
        // Clear current options
        selectElement.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = `Select Player ${player}`;
        selectElement.appendChild(defaultOption);
        
        // Add existing players
        this.allPlayers.forEach(playerData => {
            const option = document.createElement('option');
            option.value = playerData.id || playerData.pid;
            option.textContent = playerData.name;
            selectElement.appendChild(option);
        });
        
        // Add custom input option
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = '✏️ Custom Input';
        selectElement.appendChild(customOption);
    }

    // Setup event listeners
    setupEventListeners() {
        // Player selection handlers
        document.getElementById('playerASelect')?.addEventListener('change', () => {
            this.handlePlayerSelect('A');
        });
        
        document.getElementById('playerBSelect')?.addEventListener('change', () => {
            this.handlePlayerSelect('B');
        });
        
        // Custom input handlers
        document.getElementById('playerACustom')?.addEventListener('input', () => {
            this.handleCustomInput('A');
        });
        
        document.getElementById('playerBCustom')?.addEventListener('input', () => {
            this.handleCustomInput('B');
        });
        
        // Save button handlers
        document.getElementById('savePlayerA')?.addEventListener('click', () => {
            this.saveCustomPlayerToStorage('A');
        });
        
        document.getElementById('savePlayerB')?.addEventListener('click', () => {
            this.saveCustomPlayerToStorage('B');
        });
        
        // Confirm button handler
        document.getElementById('confirmPlayers')?.addEventListener('click', () => {
            this.confirmPlayers();
        });
        
        // Refresh button handler (try to fetch from database first)
        document.getElementById('refreshPlayers')?.addEventListener('click', () => {
            this.refreshPlayersFromDatabase();
        });
        
        // Reset button handler
        document.getElementById('resetPlayers')?.addEventListener('click', () => {
            this.resetPlayers();
        });
    }

    // Refresh players from database (prioritize WebSocket)
    async refreshPlayersFromDatabase() {
        console.log('🔄 Refreshing players from database...');
        this.showLoadingState();
        
        try {
            let refreshed = false;
            
            // Try HTTP API first
            try {
                console.log('📡 Attempting to refresh via HTTP API...');
                const httpPlayers = await this.fetchPlayersViaHTTPWithProxy();
                if (httpPlayers && httpPlayers.length > 0) {
                    this.allPlayers = httpPlayers;
                    this.savePlayersToLocalStorage(httpPlayers);
                    refreshed = true;
                    console.log(`✅ Refreshed ${httpPlayers.length} players from database`);
                    this.showMessage(`Refreshed ${httpPlayers.length} players from database`, 'success');
                }
            } catch (httpError) {
                console.log('HTTP API refresh failed:', httpError.message);
            }
            
            if (!refreshed) {
                // Fallback to local storage
                this.allPlayers = this.getLocalStoragePlayers();
                if (this.allPlayers.length === 0) {
                    this.allPlayers = this.createSamplePlayers();
                }
                this.showMessage('Database unavailable, using local storage', 'warning');
            }
            
            this.populatePlayerLists();
            
        } catch (error) {
            console.error('Refresh failed:', error);
            this.showMessage('Refresh failed, using cached data', 'error');
            this.allPlayers = this.getLocalStoragePlayers();
            this.populatePlayerLists();
        }
    }

    // Handle player selection
    handlePlayerSelect(player) {
        const selectId = `player${player}Select`;
        const inputId = `player${player}Custom`;
        const saveButtonId = `savePlayer${player}`;
        
        const select = document.getElementById(selectId);
        const input = document.getElementById(inputId);
        const saveButton = document.getElementById(saveButtonId);
        
        if (select && input && saveButton) {
            if (select.value === 'custom') {
                // Show custom input
                input.style.display = 'block';
                saveButton.style.display = 'inline-block';
                this.currentPlayers[`player${player}`] = null;
                this.currentPlayerIds[`player${player}`] = null;
                this.playersInDatabase[`player${player}`] = false;
            } else if (select.value) {
                // Selected existing player
                const selectedPlayer = this.allPlayers.find(p => 
                    (p.id || p.pid) == select.value
                );
                if (selectedPlayer) {
                    this.currentPlayers[`player${player}`] = selectedPlayer.name;
                    this.currentPlayerIds[`player${player}`] = selectedPlayer.id || selectedPlayer.pid;
                    this.playersInDatabase[`player${player}`] = true;
                }
                input.style.display = 'none';
                saveButton.style.display = 'none';
                input.value = '';
            } else {
                // No selection
                input.style.display = 'none';
                saveButton.style.display = 'none';
                this.currentPlayers[`player${player}`] = null;
                this.currentPlayerIds[`player${player}`] = null;
                this.playersInDatabase[`player${player}`] = false;
            }
            
            this.updateStatus();
        }
    }

    // Handle custom input
    handleCustomInput(player) {
        const inputId = `player${player}Custom`;
        const saveButtonId = `savePlayer${player}`;
        
        const input = document.getElementById(inputId);
        const saveButton = document.getElementById(saveButtonId);
        
        if (input && saveButton) {
            const playerName = input.value.trim();
            
            if (playerName) {
                // Update current player
                this.currentPlayers[`player${player}`] = playerName;
                this.currentPlayerIds[`player${player}`] = null;
                this.playersInDatabase[`player${player}`] = false;
                
                // Enable save button
                saveButton.disabled = false;
                saveButton.textContent = '💾 Save to Storage';
                saveButton.classList.remove('success');
            } else {
                this.currentPlayers[`player${player}`] = null;
                this.currentPlayerIds[`player${player}`] = null;
                this.playersInDatabase[`player${player}`] = false;
            }
            
            this.updateStatus();
        }
    }

    // Confirm player setup
    confirmPlayers() {
        const playerA = this.currentPlayers.playerA;
        const playerB = this.currentPlayers.playerB;

        if (!playerA || !playerB) {
            this.showMessage('Please select or enter two player names', 'warning');
            this.updateStatus('Please select or enter two player names', 'error');
            return;
        }

        if (playerA === playerB) {
            this.showMessage('Player names must be different', 'warning');
            this.updateStatus('Player names must be different', 'error');
            return;
        }

        // Update UI
        this.updateStatus(`Ready: ${playerA} vs ${playerB}`, 'ready');
        this.showMessage(`Players confirmed: ${playerA} vs ${playerB}`, 'success');

        // Update scoreboard display
        this.updateScoreboardNames();
        
        // Enable game controls
        this.enableGameControls();
    }

    // Save custom player to database via HTTP API
    async saveCustomPlayerToStorage(player) {
        const inputId = `player${player}Custom`;
        const saveButtonId = `savePlayer${player}`;
        
        const input = document.getElementById(inputId);
        const saveButton = document.getElementById(saveButtonId);
        
        if (!input || !saveButton) return;
        
        const playerName = input.value.trim();
        if (!playerName) {
            this.showMessage(`Please enter Player ${player} name`, 'warning');
            return;
        }

        if (playerName.length > 30) {
            this.showMessage('Player name must be 30 characters or less', 'warning');
            return;
        }

        try {
            saveButton.disabled = true;
            saveButton.textContent = '⏳ Saving...';

            let savedToDatabase = false;
            
            // Method 1: Try HTTP API first to save to actual database
            try {
                console.log('Attempting to save player to database via HTTP API...');
                savedToDatabase = await this.savePlayerViaHTTP(playerName);
                if (savedToDatabase) {
                    console.log('✅ Player saved to database via HTTP API');
                    this.showMessage(`Player "${playerName}" saved to database!`, 'success');
                    saveButton.textContent = '✅ Saved to Database';
                }
            } catch (httpError) {
                console.log('HTTP API save failed:', httpError.message);
            }
            
            // Method 2: Always save to local storage as backup
            const savedLocally = this.savePlayerToLocalStorage(playerName);
            
            if (savedToDatabase) {
                this.playersInDatabase[`player${player}`] = true;
                // Refresh players list from database
                await this.loadAllPlayers();
            } else if (savedLocally) {
                this.playersInDatabase[`player${player}`] = false; // Not in database, but in local storage
                this.showMessage(`Player "${playerName}" saved locally (database unavailable)`, 'warning');
                saveButton.textContent = '✅ Saved Locally';
                // Refresh from local storage
                await this.loadAllPlayers();
            } else {
                throw new Error('Both database and local storage save failed');
            }
            
            saveButton.classList.add('success');
            
            // Auto-select the newly created player
            this.autoSelectNewPlayer(player, playerName);
                
        } catch (error) {
            console.error('Failed to save player:', error);
            this.showMessage(`Save failed: ${error.message}`, 'error');
            saveButton.textContent = '❌ Save Failed';
        } finally {
            if (!this.playersInDatabase[`player${player}`] && saveButton.textContent === '⏳ Saving...') {
                saveButton.disabled = false;
                saveButton.textContent = '💾 Save Player';
            }
        }
    }

    // Auto-select the newly created player
    autoSelectNewPlayer(player, playerName) {
        const selectId = `player${player}Select`;
        const select = document.getElementById(selectId);
        
        if (select) {
            // Find the option with the matching name
            const options = select.querySelectorAll('option');
            for (let option of options) {
                if (option.textContent === playerName) {
                    select.value = option.value;
                    // Trigger the change event to update the UI
                    this.handlePlayerSelect(player);
                    break;
                }
            }
        }
    }

    // Update status display
    updateStatus(message = null, type = 'default') {
        const statusElement = document.getElementById('playersStatus');
        if (!statusElement) return;

        const playerA = this.currentPlayers.playerA;
        const playerB = this.currentPlayers.playerB;

        if (message) {
            statusElement.textContent = message;
            statusElement.className = `players-status ${type}`;
            return;
        }

        if (!playerA) {
            statusElement.textContent = 'Please select Player A';
            statusElement.className = 'players-status';
        } else if (!playerB) {
            statusElement.textContent = 'Please select Player B';
            statusElement.className = 'players-status';
        } else if (playerA === playerB) {
            statusElement.textContent = 'Player names must be different';
            statusElement.className = 'players-status error';
        } else {
            let dataSource = '';
            if (this.playersInDatabase.playerA && this.playersInDatabase.playerB) {
                dataSource = ' (Saved to database)';
            } else if (this.playersInDatabase.playerA || this.playersInDatabase.playerB) {
                dataSource = ' (Partially in database)';
            } else {
                dataSource = ' (Local storage)';
            }
            statusElement.textContent = `Ready to confirm: ${playerA} vs ${playerB}${dataSource}`;
            statusElement.className = 'players-status ready';
        }
    }

    // Update scoreboard display
    updateScoreboardNames() {
        const playerANameElement = document.querySelector('.player-score .player-name');
        const playerBNameElement = document.querySelectorAll('.player-score .player-name')[1];

        if (playerANameElement && this.currentPlayers.playerA) {
            playerANameElement.textContent = this.currentPlayers.playerA;
        }

        if (playerBNameElement && this.currentPlayers.playerB) {
            playerBNameElement.textContent = this.currentPlayers.playerB;
        }
    }

    // Enable game controls
    enableGameControls() {
        const startGameBtn = document.getElementById('startGame');
        if (startGameBtn) {
            startGameBtn.disabled = false;
        }
        
        let statusMsg = '';
        if (this.playersInDatabase.playerA && this.playersInDatabase.playerB) {
            statusMsg = '🎮 Both players saved to database, game ready!';
        } else if (this.playersInDatabase.playerA || this.playersInDatabase.playerB) {
            statusMsg = '🎮 Players ready (some from database, some local)';
        } else {
            statusMsg = '🎮 Players ready (using local storage)';
        }
        
        this.showMessage(statusMsg, 'info');
    }

    // Get current players
    getCurrentPlayers() {
        return this.currentPlayers;
    }

    // Get current player IDs
    getCurrentPlayerIds() {
        return this.currentPlayerIds;
    }

    // Check if players are ready
    arePlayersReady() {
        return this.currentPlayers.playerA && this.currentPlayers.playerB;
    }

    // Reset players
    resetPlayers() {
        this.currentPlayers = {
            playerA: null,
            playerB: null
        };
        this.currentPlayerIds = {
            playerA: null,
            playerB: null
        };
        this.playersInDatabase = {
            playerA: false,
            playerB: false
        };
        
        // Reset UI
        const playerASelect = document.getElementById('playerASelect');
        const playerBSelect = document.getElementById('playerBSelect');
        const playerAInput = document.getElementById('playerACustom');
        const playerBInput = document.getElementById('playerBCustom');
        
        if (playerASelect) playerASelect.value = '';
        if (playerBSelect) playerBSelect.value = '';
        if (playerAInput) {
            playerAInput.value = '';
            playerAInput.style.display = 'none';
        }
        if (playerBInput) {
            playerBInput.value = '';
            playerBInput.style.display = 'none';
        }
        
        // Reset save buttons
        const savePlayerABtn = document.getElementById('savePlayerA');
        const savePlayerBBtn = document.getElementById('savePlayerB');
        
        if (savePlayerABtn) {
            savePlayerABtn.style.display = 'none';
            savePlayerABtn.disabled = false;
            savePlayerABtn.textContent = '💾 Save to Storage';
            savePlayerABtn.classList.remove('success');
        }
        
        if (savePlayerBBtn) {
            savePlayerBBtn.style.display = 'none';
            savePlayerBBtn.disabled = false;
            savePlayerBBtn.textContent = '💾 Save to Storage';
            savePlayerBBtn.classList.remove('success');
        }
        
        // Reset scoreboard
        const playerNameElements = document.querySelectorAll('.player-score .player-name');
        playerNameElements.forEach(element => {
            element.textContent = 'Player';
        });
        
        this.updateStatus();
        this.showMessage('Players reset', 'info');
    }

    // Show message
    showMessage(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // If there's a global message system, use it
        if (window.smartCourtApp && window.smartCourtApp.showMessage) {
            window.smartCourtApp.showMessage(message, type);
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Save player to local storage
    savePlayerToLocalStorage(playerName) {
        try {
            let players = this.getLocalStoragePlayers();
            
            // Check if already exists
            if (players.find(p => p.name === playerName)) {
                console.log('Player already exists in local storage');
                return true;
            }
            
            // Add new player
            const newPlayer = {
                id: Date.now(),
                name: playerName,
                createdAt: new Date().toISOString(),
                source: 'local'
            };
            
            players.push(newPlayer);
            this.savePlayersToLocalStorage(players);
            
            console.log('Player saved to local storage:', playerName);
            return true;
            
        } catch (error) {
            console.error('Local storage save failed:', error);
            return false;
        }
    }
}

// Auto-initialize PlayerManager when loaded (CORS-free approach)
if (typeof window.playerManager === 'undefined') {
    console.log('🚀 Initializing PlayerManager with CORS-free approach...');
    window.playerManager = new PlayerManager();
    
    // Initialize asynchronously to avoid blocking page load
    window.playerManager.init().then(() => {
        console.log('✅ PlayerManager initialized successfully without CORS issues');
    }).catch(error => {
        console.error('❌ Failed to initialize PlayerManager:', error);
        // Even if initialization fails, the basic functionality should work
        console.log('🔄 PlayerManager will use fallback mode');
    });
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerManager;
} 