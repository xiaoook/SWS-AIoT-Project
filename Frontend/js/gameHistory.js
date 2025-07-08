// Game History Manager
class GameHistoryManager {
    constructor() {
        this.app = null;
        this.modal = null;
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
    
    refreshDisplay() {
        if (!this.app) return;
        
        const games = this.app.getGamesHistory();
        this.updateStats(games);
        this.displayGames(games);
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
            container.innerHTML = '<div class="no-games">No games found. Start a new game to see history.</div>';
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
        
        return `
            <div class="game-card ${game.status} ${isCurrent ? 'active' : ''}" data-game-id="${game.gameId}">
                <div class="game-header">
                    <div class="game-id">${game.gameId}</div>
                    <div class="game-status ${game.status}">${game.status}</div>
                </div>
                
                <div class="game-type">${game.gameType}</div>
                
                <div class="game-score">
                    <span class="player-a-score">${game.finalScores.playerA}</span>
                    <span class="vs">VS</span>
                    <span class="player-b-score">${game.finalScores.playerB}</span>
                </div>
                
                ${game.winner ? `<div class="game-winner ${game.winner}">🏆 Player ${game.winner.slice(-1)} Wins!</div>` : ''}
                
                <div class="game-info">
                    <div class="game-info-item">
                        <span>Rounds:</span>
                        <span>${game.rounds.length}</span>
                    </div>
                    <div class="game-info-item">
                        <span>Duration:</span>
                        <span>${duration}</span>
                    </div>
                    <div class="game-info-item">
                        <span>Started:</span>
                        <span>${startTime.toLocaleTimeString()}</span>
                    </div>
                    <div class="game-info-item">
                        <span>Date:</span>
                        <span>${startTime.toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div class="game-actions">
                    ${isCurrent ? 
                        '<button class="game-action-btn primary" data-action="current">Current Game</button>' :
                        '<button class="game-action-btn" data-action="load">Load Game</button>'
                    }
                    <button class="game-action-btn" data-action="view">View Details</button>
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
        if (this.app.loadGame(gameId)) {
            this.app.showMessage(`Game ${gameId} loaded successfully!`, 'success');
            this.refreshDisplay();
        } else {
            this.app.showMessage(`Failed to load game ${gameId}`, 'error');
        }
    }
    
    deleteGame(gameId) {
        if (confirm(`Are you sure you want to delete game ${gameId}?`)) {
            if (this.app.deleteGame(gameId)) {
                this.app.showMessage(`Game ${gameId} deleted successfully!`, 'success');
                this.refreshDisplay();
            } else {
                this.app.showMessage(`Failed to delete game ${gameId}`, 'error');
            }
        }
    }
    
    showGameDetails(gameId) {
        const games = this.app.getGamesHistory();
        const game = games.find(g => g.gameId === gameId);
        
        if (!game) return;
        
        const detailsContainer = document.getElementById('gameDetails');
        detailsContainer.innerHTML = this.createGameDetailsHTML(game);
        
        this.modal.classList.add('show');
    }
    
    createGameDetailsHTML(game) {
        const startTime = new Date(game.startTime);
        const endTime = game.endTime ? new Date(game.endTime) : null;
        const duration = this.formatDuration(game.duration);
        
        return `
            <div class="game-details">
                <div class="detail-section">
                    <h4>Game Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <strong>Game ID:</strong> ${game.gameId}
                        </div>
                        <div class="detail-item">
                            <strong>Type:</strong> ${game.gameType}
                        </div>
                        <div class="detail-item">
                            <strong>Status:</strong> <span class="game-status ${game.status}">${game.status}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Duration:</strong> ${duration}
                        </div>
                        <div class="detail-item">
                            <strong>Started:</strong> ${startTime.toLocaleString()}
                        </div>
                        ${endTime ? `<div class="detail-item">
                            <strong>Ended:</strong> ${endTime.toLocaleString()}
                        </div>` : ''}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Final Score</h4>
                    <div class="score-summary">
                        <div class="score-item">
                            <span class="player">Player A:</span>
                            <span class="score">${game.finalScores.playerA}</span>
                        </div>
                        <div class="score-item">
                            <span class="player">Player B:</span>
                            <span class="score">${game.finalScores.playerB}</span>
                        </div>
                        ${game.winner ? `<div class="winner">🏆 Player ${game.winner.slice(-1)} Wins!</div>` : ''}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Round History (${game.rounds.length} rounds)</h4>
                    <div class="rounds-list">
                        ${game.rounds.map(round => `
                            <div class="round-item">
                                <div class="round-info">
                                    <div class="round-number">Round ${round.id}</div>
                                    <div class="round-winner">Player ${round.winner.slice(-1)} scored</div>
                                    <div class="round-score">${round.playerAScore} - ${round.playerBScore}</div>
                                </div>
                                <div class="round-time">${new Date(round.timestamp).toLocaleTimeString()}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    closeModal() {
        this.modal.classList.remove('show');
    }
    
    clearAllGames() {
        if (confirm('Are you sure you want to clear all game history? This action cannot be undone.')) {
            this.app.gamesHistory = [];
            this.app.currentGameId = null;
            this.app.showMessage('All game history cleared!', 'success');
            this.refreshDisplay();
        }
    }
    
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';
        
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