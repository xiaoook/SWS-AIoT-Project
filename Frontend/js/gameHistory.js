// Game History Manager
class GameHistoryManager {
    constructor() {
        this.app = null;
        this.modal = null;
        this.loadedGames = []; // Store loaded games from database
        this.init();
    }
    
    init() {
        // Wait for app to be available
        if (window.smartCourtApp) {
            this.app = window.smartCourtApp;
            this.setupEventListeners();
            this.createModal();
            this.refreshDisplay();
        } else {
            setTimeout(() => this.init(), 100);
        }
    }
    
    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshHistory');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDisplay());
        }
        
        // Clear all button
        const clearBtn = document.getElementById('clearHistory');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllGames());
        }
    }
    
    // 根据玩家ID获取玩家名字
    async getPlayerNames(playerAId, playerBId) {
        // 首先尝试从当前的 PlayerManager 获取
        if (window.playerManager && window.playerManager.allPlayers) {
            const allPlayers = window.playerManager.allPlayers;
            const playerA = allPlayers.find(p => (p.id || p.pid) == playerAId);
            const playerB = allPlayers.find(p => (p.id || p.pid) == playerBId);
            
            if (playerA && playerB) {
                return {
                    playerA: playerA.name,
                    playerB: playerB.name
                };
            }
        }
        
        // 如果 PlayerManager 中没有找到，尝试从数据库获取
        try {
            const response = await fetch(CONFIG.API_URLS.PLAYER_ALL, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.players) {
                    const playerA = data.players.find(p => p.pid == playerAId);
                    const playerB = data.players.find(p => p.pid == playerBId);
                    
                    return {
                        playerA: playerA ? playerA.name : `Player ${playerAId}`,
                        playerB: playerB ? playerB.name : `Player ${playerBId}`
                    };
                }
            }
        } catch (error) {
            console.warn('Failed to fetch player names:', error);
        }
        
        // 回退到默认名字
        return {
            playerA: `Player ${playerAId || 'A'}`,
            playerB: `Player ${playerBId || 'B'}`
        };
    }
    
    // 从数据库加载真实游戏记录
    async loadGamesFromDatabase() {
        try {
            console.log('🔄 Loading games from database...');
            
            const response = await fetch(CONFIG.API_URLS.GAMES, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    limit: 100 // 获取最近100场游戏
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.games) {
                    console.log(`✅ Loaded ${data.games.length} games from database`);
                    
                    // 转换数据库格式到前端格式
                    const games = data.games.map((game) => {
                        const duration = game.duration || 0;
                        console.log(`📊 Loading game ${game.gid} - Raw duration: ${game.duration}, Processed: ${duration}`);
                        
                        return {
                            gameId: `GAME-${String(game.gid).padStart(3, '0')}`,
                            gameType: duration > 0 ? 'Completed Match' : 'Live Match',
                            startTime: new Date(game.date + ' ' + game.time),
                            endTime: duration > 0 ? new Date(new Date(game.date + ' ' + game.time).getTime() + duration * 1000) : null,
                            duration: duration,
                            finalScores: { 
                                playerA: game.pointA || 0, 
                                playerB: game.pointB || 0 
                            },
                            winner: game.pointA > game.pointB ? 'playerA' : 
                                   game.pointB > game.pointA ? 'playerB' : null,
                            status: duration > 0 ? 'ended' : 'playing',
                            databaseGameId: game.gid,
                            playerNames: {
                                playerA: game.playerAname || 'Player A',
                                playerB: game.playerBname || 'Player B'
                            }
                        };
                    });
                    
                    return games;
                } else {
                    throw new Error(data.message || 'Failed to load games from database');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Failed to load games from database:', error);
            console.log('💾 Using fallback: no games to display');
            return []; // 返回空数组，不显示虚拟数据
        }
    }
    
    createModal() {
        // Create modal for game details
        this.modal = document.createElement('div');
        this.modal.className = 'game-modal';
        this.modal.innerHTML = `
            <div class="game-modal-content">
                <div class="game-modal-header">
                    <h3>Game Details</h3>
                    <button class="game-modal-close">&times;</button>
                </div>
                <div class="game-modal-body">
                    <div id="gameDetails"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        
        // Close modal event
        this.modal.querySelector('.game-modal-close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Close on background click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });
    }
    
    async refreshDisplay() {
        if (!this.app) return;
        
        try {
            // 显示加载状态
            const refreshButton = document.getElementById('refreshHistory');
            const clearButton = document.getElementById('clearHistory');
            const gamesContainer = document.getElementById('gamesGrid');
            
            if (refreshButton) {
                refreshButton.disabled = true;
                refreshButton.textContent = '🔄 Refreshing...';
            }
            if (clearButton) {
                clearButton.disabled = true;
            }
            if (gamesContainer) {
                gamesContainer.innerHTML = '<div class="loading-games">🔄 Loading games from database...</div>';
            }
            
            console.log('🔄 Refreshing game history...');
            
            // 从数据库获取真实的游戏记录，而不是前端虚拟数据
            const games = await this.loadGamesFromDatabase();
            
            // 直接使用数据库中的游戏记录，不再显示本地游戏历史
            this.loadedGames = games; // Store loaded games for later use
            this.updateStats(games);
            this.displayGames(games);
            
            if (games.length === 0) {
                console.log('📝 No games found in database, showing empty state');
            } else {
                console.log(`✅ Game history refreshed: ${games.length} games loaded`);
            }
            
        } catch (error) {
            console.error('❌ Failed to refresh game history:', error);
            this.app.showMessage(`Failed to refresh game history: ${error.message}`, 'error');
        } finally {
            // 恢复按钮状态
            const refreshButton = document.getElementById('refreshHistory');
            const clearButton = document.getElementById('clearHistory');
            
            if (refreshButton) {
                refreshButton.disabled = false;
                refreshButton.textContent = '🔄 Refresh';
            }
            if (clearButton) {
                clearButton.disabled = false;
            }
        }
    }
    
    updateStats(games) {
        const totalGames = games.length;
        const completedGames = games.filter(g => g.status === 'ended').length;
        const activeGames = games.filter(g => g.status !== 'ended').length;
        
        // Update stats display
        const totalElement = document.getElementById('totalGames');
        const completedElement = document.getElementById('completedGames');
        const activeElement = document.getElementById('activeGames');
        
        if (totalElement) totalElement.textContent = `Total Games: ${totalGames}`;
        if (completedElement) completedElement.textContent = `Completed: ${completedGames}`;
        if (activeElement) activeElement.textContent = `Active: ${activeGames}`;
    }
    
    displayGames(games) {
        const container = document.getElementById('gamesGrid');
        if (!container) return;
        
        if (games.length === 0) {
            container.innerHTML = `
                <div class="no-games">
                    <div class="no-games-icon">🎮</div>
                    <div class="no-games-title">No Game History</div>
                    <div class="no-games-message">No games have been played yet. Start a new game to begin recording match history.</div>
                </div>
            `;
            return;
        }
        
        // Sort games by start time (newest first)
        const sortedGames = [...games].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        container.innerHTML = sortedGames.map(game => this.createGameCard(game)).join('');
        
        // Add event listeners to game cards
        container.querySelectorAll('.game-card').forEach(card => {
            const gameId = card.dataset.gameId;
            card.addEventListener('click', () => this.showGameDetails(gameId));
        });
        
        // Add event listeners to action buttons
        container.querySelectorAll('.game-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const gameId = btn.closest('.game-card').dataset.gameId;
                this.handleGameAction(action, gameId);
            });
        });
    }
    
    createGameCard(game) {
        const startTime = new Date(game.startTime);
        const duration = this.formatDuration(game.duration);
        const isActive = game.status !== 'ended';
        const isCurrent = this.app.currentGameId === game.gameId;
        
        // 获取玩家名字
        const playerAName = game.playerNames ? game.playerNames.playerA : 'Player A';
        const playerBName = game.playerNames ? game.playerNames.playerB : 'Player B';
        
        // 计算总轮次数
        const totalRounds = game.finalScores.playerA + game.finalScores.playerB;
        
        return `
            <div class="game-card ${game.status} ${isCurrent ? 'active' : ''}" data-game-id="${game.gameId}">
                <div class="game-header">
                    <div class="game-status ${game.status}">${game.status.toUpperCase()}</div>
                    <div class="game-date">${startTime.toLocaleDateString()}</div>
                </div>
                
                <div class="game-players">
                    <div class="player-name player-a">${playerAName}</div>
                    <div class="vs-text">vs</div>
                    <div class="player-name player-b">${playerBName}</div>
                </div>
                
                <div class="game-score">
                    <span class="player-a-score">${game.finalScores.playerA}</span>
                    <span class="vs">-</span>
                    <span class="player-b-score">${game.finalScores.playerB}</span>
                </div>
                
                ${game.winner ? `<div class="game-winner ${game.winner}">🏆 ${game.winner === 'playerA' ? playerAName : playerBName} Wins!</div>` : ''}
                
                <div class="game-stats">
                    <div class="stat-item">
                        <span class="stat-icon">🎯</span>
                        <span class="stat-value">${totalRounds}</span>
                        <span class="stat-label">Rounds</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">⏱️</span>
                        <span class="stat-value">${duration}</span>
                        <span class="stat-label">Duration</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-icon">🕒</span>
                        <span class="stat-value">${startTime.toLocaleTimeString()}</span>
                        <span class="stat-label">Started</span>
                    </div>
                </div>
                
                <div class="game-actions">
                    <button class="game-action-btn" data-action="view">Details</button>
                    ${isActive ? '<button class="game-action-btn primary" data-action="resume">Resume</button>' : ''}
                    <button class="game-action-btn danger" data-action="delete">Delete</button>
                </div>
            </div>
        `;
    }
    
    handleGameAction(action, gameId) {
        switch (action) {
            case 'load':
                this.loadGame(gameId);
                break;
            case 'view':
                this.showGameDetails(gameId);
                break;
            case 'resume':
                this.resumeGame(gameId);
                break;
            case 'delete':
                this.deleteGame(gameId);
                break;
            case 'current':
                // Switch to game control tab
                this.app.switchTab('game');
                break;
        }
    }
    
    loadGame(gameId) {
        // Find the game in loaded games
        const game = this.loadedGames.find(g => g.gameId === gameId);
        
        if (!game) {
            this.app.showMessage(`Game ${gameId} not found`, 'error');
            return;
        }
        
        // Load the game data into the app
        if (this.app.loadGame(gameId)) {
            this.app.showMessage(`Game ${gameId} loaded successfully!`, 'success');
            this.refreshDisplay();
        } else {
            this.app.showMessage(`Failed to load game ${gameId}`, 'error');
        }
    }
    
    // Resume an unfinished game
    async resumeGame(gameId) {
        try {
            // Find the game in loaded games
            const game = this.loadedGames.find(g => g.gameId === gameId);
            
            if (!game) {
                this.app.showMessage(`Game ${gameId} not found`, 'error');
                return;
            }
            
            // Check if the game is actually unfinished
            if (game.status === 'ended') {
                this.app.showMessage(`Game ${gameId} has already ended and cannot be resumed`, 'warning');
                return;
            }
            
            // Get the database game ID
            const databaseGameId = game.databaseGameId;
            if (!databaseGameId) {
                this.app.showMessage(`Cannot resume game ${gameId} - no database ID found`, 'error');
                return;
            }
            
            // Find the resume button and update its state
            const resumeButton = document.querySelector(`[data-game-id="${gameId}"] [data-action="resume"]`);
            if (resumeButton) {
                resumeButton.disabled = true;
                resumeButton.textContent = 'Resuming...';
            }
            
            console.log(`🔄 Resuming game ${gameId} (Database ID: ${databaseGameId})`);
            
            // Call the backend to select this game
            const response = await fetch(`${CONFIG.API_URLS.GAMES_SELECT}?game=${databaseGameId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.game) {
                    console.log(`✅ Game ${gameId} selected successfully on backend`);
                    
                    // Update the app's current game state
                    this.app.currentGameId = gameId;
                    this.app.gameState.status = 'playing';
                    this.app.gameState.scores = {
                        playerA: data.game.pointA || 0,
                        playerB: data.game.pointB || 0
                    };
                    this.app.gameState.currentRound = (data.game.pointA || 0) + (data.game.pointB || 0);
                    this.app.gameState.startTime = game.startTime;
                    this.app.gameState.endTime = null;
                    
                    // Update UI
                    this.app.updateGameStatus();
                    this.app.updateScoreboard();
                    
                    // Switch to game control tab
                    this.app.switchTab('game');
                    
                    // Show success message
                    this.app.showMessage(`Game ${gameId} resumed successfully! Continue playing.`, 'success');
                    
                    // Refresh the display to show updated status
                    setTimeout(() => {
                        this.refreshDisplay();
                    }, 1000);
                    
                } else {
                    throw new Error(data.message || 'Failed to select game on backend');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to resume game:', error);
            this.app.showMessage(`Failed to resume game ${gameId}: ${error.message}`, 'error');
            
            // Re-enable the resume button on error
            const resumeButton = document.querySelector(`[data-game-id="${gameId}"] [data-action="resume"]`);
            if (resumeButton) {
                resumeButton.disabled = false;
                resumeButton.textContent = 'Resume';
            }
        }
    }
    
    async deleteGame(gameId) {
        if (confirm(`Are you sure you want to delete game ${gameId}? This action cannot be undone.`)) {
            // Find the delete button and disable it during deletion
            const deleteButton = document.querySelector(`[data-game-id="${gameId}"] [data-action="delete"]`);
            if (deleteButton) {
                deleteButton.disabled = true;
                deleteButton.textContent = 'Deleting...';
            }
            
            try {
                // Find the game in loaded games to get the database ID
                const game = this.loadedGames.find(g => g.gameId === gameId);
                if (!game) {
                    throw new Error(`Game ${gameId} not found in loaded games`);
                }
                
                const databaseGameId = game.databaseGameId;
                console.log(`🗑️ Deleting game ${gameId} (Database ID: ${databaseGameId}) from database...`);
                
                const response = await fetch(CONFIG.API_URLS.GAMES_DELETE, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        gid: databaseGameId
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        console.log(`✅ Game ${gameId} deleted successfully from database`);
                this.app.showMessage(`Game ${gameId} deleted successfully!`, 'success');
                        
                        // Refresh the display to show updated list
                        await this.refreshDisplay();
                    } else {
                        throw new Error(data.message || 'Failed to delete game from database');
                    }
            } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error('❌ Failed to delete game from database:', error);
                this.app.showMessage(`Failed to delete game ${gameId}: ${error.message}`, 'error');
                
                // Re-enable the delete button on error
                if (deleteButton) {
                    deleteButton.disabled = false;
                    deleteButton.textContent = 'Delete';
                }
            }
        }
    }
    

    
    async showGameDetails(gameId) {
        const game = this.loadedGames.find(g => g.gameId === gameId);
        
        if (!game) {
            console.error(`Game ${gameId} not found in loaded games`);
            this.app.showMessage(`Game ${gameId} not found`, 'error');
            return;
        }
        
        const detailsContainer = document.getElementById('gameDetails');
        
        // 显示加载状态
        detailsContainer.innerHTML = `
            <div class="loading-game-details">
                <div class="loading-spinner">🔄</div>
                <div class="loading-text">Loading game details...</div>
            </div>
        `;
        
        this.modal.classList.add('show');
        
        try {
            // 直接显示游戏详情，不需要加载轮次数据
            detailsContainer.innerHTML = this.createGameDetailsHTML(game);
            console.log(`🎯 Game details displayed for ${gameId}`);
            
        } catch (error) {
            console.error('Error loading game details:', error);
            detailsContainer.innerHTML = this.createGameDetailsHTML(game);
        }
    }
    
    createGameDetailsHTML(game) {
        const startTime = new Date(game.startTime);
        const endTime = game.endTime ? new Date(game.endTime) : null;
        const duration = this.formatDuration(game.duration);
        
        // 获取玩家名字
        const playerAName = game.playerNames ? game.playerNames.playerA : 'Player A';
        const playerBName = game.playerNames ? game.playerNames.playerB : 'Player B';
        
        // 计算总轮次数
        const totalRounds = game.finalScores.playerA + game.finalScores.playerB;
        
        return `
            <div class="game-details-container">
                <!-- Game Information Card -->
                <div class="game-info-card">
                    <h3>🎮 Game Information</h3>
                    <div class="game-meta">
                        <div class="meta-item">
                            <strong>Type:</strong> ${game.gameType}
                        </div>
                        <div class="meta-item">
                            <strong>Status:</strong> ${game.status.toUpperCase()}
                        </div>
                        <div class="meta-item">
                            <strong>Total Rounds:</strong> ${totalRounds}
                        </div>
                        <div class="meta-item">
                            <strong>Duration:</strong> ${duration}
                        </div>
                        <div class="meta-item">
                            <strong>Started:</strong> ${startTime.toLocaleString()}
                        </div>
                        ${endTime ? `<div class="meta-item">
                            <strong>Ended:</strong> ${endTime.toLocaleString()}
                        </div>` : ''}
                    </div>
                </div>
                
                <!-- Players & Final Score Card -->
                <div class="players-score-card">
                    <h3>🏆 Players & Final Score</h3>
                    <div class="final-score">
                        <div class="score-item ${game.finalScores.playerA > game.finalScores.playerB ? 'winner' : ''}">
                            <div class="score-header">
                                <div class="score-content">
                                    <span class="player">${playerAName}</span>
                                    <span class="score">${game.finalScores.playerA}</span>
                                </div>
                                ${game.finalScores.playerA > game.finalScores.playerB ? '<div class="winner-badge">🏆</div>' : ''}
                            </div>
                            <div class="score-progress-bar">
                                <div class="score-progress-fill player-a" style="width: ${(game.finalScores.playerA / Math.max(game.finalScores.playerA, game.finalScores.playerB, 1)) * 100}%"></div>
                            </div>
                        </div>
                        <div class="score-item ${game.finalScores.playerB > game.finalScores.playerA ? 'winner' : ''}">
                            <div class="score-header">
                                <div class="score-content">
                                    <span class="player">${playerBName}</span>
                                    <span class="score">${game.finalScores.playerB}</span>
                                </div>
                                ${game.finalScores.playerB > game.finalScores.playerA ? '<div class="winner-badge">🏆</div>' : ''}
                            </div>
                            <div class="score-progress-bar">
                                <div class="score-progress-fill player-b" style="width: ${(game.finalScores.playerB / Math.max(game.finalScores.playerA, game.finalScores.playerB, 1)) * 100}%"></div>
                            </div>
                        </div>
                    </div>
                    ${game.winner ? `<div class="game-winner">
                        <div class="winner-badge">
                            <span class="trophy">🏆</span>
                            <span class="winner-text">${game.winner === 'playerA' ? playerAName : playerBName} Wins!</span>
                        </div>
                    </div>` : ''}
                </div>
            </div>
        `;
    }
    
    closeModal() {
        this.modal.classList.remove('show');
    }
    
    async clearAllGames() {
        // 确认删除操作
        if (!confirm('Are you sure you want to delete ALL games? This action cannot be undone!')) {
            return;
        }
        
        // 二次确认
        if (!confirm('This will permanently delete all game records from the database. Are you absolutely sure?')) {
            return;
        }
        
        try {
            // 禁用按钮，显示加载状态
            const clearButton = document.getElementById('clearHistory');
            const refreshButton = document.getElementById('refreshHistory');
            
            if (clearButton) {
                clearButton.disabled = true;
                clearButton.textContent = '🗑️ Clearing...';
            }
            if (refreshButton) {
                refreshButton.disabled = true;
            }
            
            console.log('🗑️ Clearing all games from database...');
            
            // 调用后端删除所有游戏的接口
            const response = await fetch(CONFIG.API_URLS.GAMES_DELETE_ALL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    console.log('✅ All games deleted successfully from database');
                    this.app.showMessage('All games have been deleted successfully!', 'success');
                    
                    // 刷新显示
                    await this.refreshDisplay();
                } else {
                    throw new Error(data.message || 'Failed to delete all games from database');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to clear all games:', error);
            this.app.showMessage(`Failed to clear all games: ${error.message}`, 'error');
        } finally {
            // 恢复按钮状态
            const clearButton = document.getElementById('clearHistory');
            const refreshButton = document.getElementById('refreshHistory');
            
            if (clearButton) {
                clearButton.disabled = false;
                clearButton.textContent = '🗑️ Clear All';
            }
            if (refreshButton) {
                refreshButton.disabled = false;
            }
        }
    }
    
    formatDuration(seconds) {
        if (!seconds || seconds === 0) {
            return '0:00';
        }
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
}

// Initialize game history manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.gameHistoryManager = new GameHistoryManager();
}); 