// Match Report Manager
class ReportManager {
    constructor() {
        this.chart = null;
        this.reportData = null;
        this.gameData = null;
        this.games = [];
        this.currentGame = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createGameSelector();
        this.initializeChart();
        this.refreshGameData();
    }
    
    setupEventListeners() {
        document.addEventListener('gameStateChange', () => {
            this.generateReport();
        });
        
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });
    }
    
    createGameSelector() {
        // Find report toolbar and add game selector
        const toolbar = document.querySelector('.report-toolbar');
        if (!toolbar) return;
        
        // Create game selector section
        const gameSelectorHTML = `
            <div class="game-selector-section">
                <label class="selector-label">Select Game for Report:</label>
                <select id="reportGameSelector" class="game-selector">
                    <option value="">Choose a game...</option>
                </select>
                <button id="generateReportBtn" class="btn btn-primary" disabled>Generate Report</button>
            </div>
        `;
        
        // Insert at the beginning of toolbar
        toolbar.insertAdjacentHTML('afterbegin', gameSelectorHTML);
        
        // Add event listeners
        const selector = document.getElementById('reportGameSelector');
        const generateBtn = document.getElementById('generateReportBtn');
        
        selector.addEventListener('change', (e) => {
            generateBtn.disabled = !e.target.value;
        });
        
        generateBtn.addEventListener('click', () => {
            const selectedGameId = selector.value;
            if (selectedGameId) {
                this.loadGameReport(selectedGameId);
            }
        });
    }
    
    // 从数据库加载游戏记录
    async loadGamesFromDatabase() {
        try {
            console.log('🔄 Loading games from database for report...');
            
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
                    console.log(`✅ Loaded ${data.games.length} games from database for report`);
                    
                    // 转换数据库格式到前端格式
                    const games = data.games.map((game) => {
                        const duration = game.duration || 0;
                        
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
                            rounds: [], // 轮次数据需要单独获取
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
            console.error('❌ Failed to load games from database for report:', error);
            return []; // 返回空数组
        }
    }
    
    async refreshGameData() {
        try {
            console.log('🔄 Refreshing game data for report...');
            
            // 优先从数据库获取游戏数据
            const gamesFromDB = await this.loadGamesFromDatabase();
            
            // 如果数据库中有数据，使用数据库数据；否则使用本地数据
            if (gamesFromDB && gamesFromDB.length > 0) {
                this.games = gamesFromDB;
                console.log(`✅ Report refreshed with ${gamesFromDB.length} games from database`);
            } else {
                                 // 数据库无数据时使用空数组
                 this.games = [];
                 console.log(`💾 Report: No games available from database`);
            }
            
            this.populateGameSelector();
            
            // 如果有游戏数据，默认选择最新的完成的游戏
            if (this.games.length > 0) {
                const completedGames = this.games.filter(g => g.status === 'ended');
                if (completedGames.length > 0) {
                    const latestGame = completedGames.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0];
                    this.loadGameReport(latestGame.gameId);
                }
            } else {
                this.generateReport();
            }
            
        } catch (error) {
            console.error('Error refreshing game data for report:', error);
            // 数据库错误时使用空数组，不显示假数据
            this.games = [];
            this.populateGameSelector();
            this.generateReport();
        }
    }
    
    populateGameSelector() {
        const selector = document.getElementById('reportGameSelector');
        if (!selector || this.games.length === 0) return;
        
        // Clear existing options except the first one
        selector.innerHTML = '<option value="">Choose a game...</option>';
        
        // Sort games by start time (newest first)
        const sortedGames = [...this.games].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        sortedGames.forEach(game => {
            const option = document.createElement('option');
            option.value = game.gameId;
            const startTime = new Date(game.startTime).toLocaleString();
            const status = game.status === 'ended' ? '✓' : '🔴';
            const winner = game.winner ? ` (${game.winner.slice(-1)} wins)` : '';
            option.textContent = `${status} ${game.gameType} - ${startTime}${winner}`;
            selector.appendChild(option);
        });
    }
    
    async loadGameReport(gameId) {
        const game = this.games.find(g => g.gameId === gameId);
        if (!game) return;
        
        // Update selector
        const selector = document.getElementById('reportGameSelector');
        if (selector) {
            selector.value = gameId;
        }
        
        // Update button state
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Loading...';
        }
        
        try {
            // 获取数据库中的游戏ID
            const databaseGameId = game.databaseGameId;
            if (!databaseGameId) {
                console.warn('No database game ID found, using local data');
                this.currentGame = game;
                this.gameData = this.convertGameToReportFormat(game);
                this.generateReport();
                return;
            }
            
            console.log(`📊 Loading rounds for report ${gameId} (Database ID: ${databaseGameId})`);
            
            // 从后端获取轮次数据
            const roundsResponse = await fetch(CONFIG.getRoundsUrl(databaseGameId), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (roundsResponse.ok) {
                const roundsData = await roundsResponse.json();
                if (roundsData.status === 'success' && roundsData.rounds) {
                    console.log(`✅ Loaded ${roundsData.rounds.length} rounds for report ${gameId}`);
                    
                    // 转换后端轮次数据格式到前端格式
                    const formattedRounds = roundsData.rounds.map((round, index) => ({
                        id: round.roundInGame,
                        timestamp: new Date().toISOString(),
                        winner: round.pointA > round.pointB ? 'playerA' : 'playerB',
                        playerAScore: round.pointA,
                        playerBScore: round.pointB,
                        analysis: {
                            feedback: 'Round completed successfully',
                            suggestions: ['Continue maintaining good performance'],
                            errorType: null
                        }
                    }));
                    
                    // 更新当前游戏的轮次数据
                    this.currentGame = {
                        ...game,
                        rounds: formattedRounds
                    };
                    
                    // 转换为报告格式
                    this.gameData = this.convertGameToReportFormat(this.currentGame);
                    
                    console.log(`🎯 Report data prepared for ${gameId} with ${formattedRounds.length} rounds`);
                } else {
                    console.warn('No rounds data received from backend, using local data');
                    this.currentGame = game;
                    this.gameData = this.convertGameToReportFormat(game);
                }
            } else {
                console.error('Failed to load rounds from backend, using local data');
                this.currentGame = game;
                this.gameData = this.convertGameToReportFormat(game);
            }
            
        } catch (error) {
            console.error('Error loading game report:', error);
            this.currentGame = game;
            this.gameData = this.convertGameToReportFormat(game);
        } finally {
            // 恢复按钮状态
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Report';
            }
        }
        
        this.generateReport();
    }
    
    convertGameToReportFormat(game) {
        return {
            scores: {
                playerA: game.finalScores.playerA,
                playerB: game.finalScores.playerB
            },
            rounds: game.rounds || [],
            playerNames: game.playerNames || {
                playerA: 'Player A',
                playerB: 'Player B'
            }
        };
    }
    
    generateReport() {
        if (this.gameData) {
            this.updateFinalScore();
            this.generateErrorChart();
            this.generateAISuggestions();
        } else if (window.smartCourtApp && window.smartCourtApp.gameState) {
            this.gameData = window.smartCourtApp.getGameState();
            this.updateFinalScore();
            this.generateErrorChart();
            this.generateAISuggestions();
        }
    }
    
    updateFinalScore() {
        const finalScoreElement = document.getElementById('finalScore');
        if (!finalScoreElement || !this.gameData) return;
        
        const playerAName = this.gameData.playerNames ? this.gameData.playerNames.playerA : 'Player A';
        const playerBName = this.gameData.playerNames ? this.gameData.playerNames.playerB : 'Player B';
        
        // 计算得分比例用于进度条
        const maxScore = Math.max(this.gameData.scores.playerA, this.gameData.scores.playerB, 1);
        const playerAPercentage = (this.gameData.scores.playerA / maxScore) * 100;
        const playerBPercentage = (this.gameData.scores.playerB / maxScore) * 100;
        
        finalScoreElement.innerHTML = `
            <div class="score-item ${this.gameData.scores.playerA > this.gameData.scores.playerB ? 'winner' : ''}">
                <div class="score-header">
                    <div class="score-content">
                        <span class="player">${playerAName}</span>
                        <span class="score">${this.gameData.scores.playerA}</span>
                    </div>
                    ${this.gameData.scores.playerA > this.gameData.scores.playerB ? '<div class="winner-badge">🏆</div>' : ''}
                </div>
                <div class="score-progress-bar">
                    <div class="score-progress-fill player-a" style="width: ${playerAPercentage}%"></div>
                </div>
            </div>
            <div class="score-item ${this.gameData.scores.playerB > this.gameData.scores.playerA ? 'winner' : ''}">
                <div class="score-header">
                    <div class="score-content">
                        <span class="player">${playerBName}</span>
                        <span class="score">${this.gameData.scores.playerB}</span>
                    </div>
                    ${this.gameData.scores.playerB > this.gameData.scores.playerA ? '<div class="winner-badge">🏆</div>' : ''}
                </div>
                <div class="score-progress-bar">
                    <div class="score-progress-fill player-b" style="width: ${playerBPercentage}%"></div>
                </div>
            </div>
        `;
    }
    
    generateErrorChart() {
        if (!this.gameData || !this.gameData.rounds || this.gameData.rounds.length === 0) {
            this.showNoDataChart();
            return;
        }
        
        const errorStats = this.calculateErrorStats();
        
        if (Object.keys(errorStats).length === 0) {
            this.showNoErrorChart();
            return;
        }
        
        this.createErrorChart(errorStats);
    }
    
    calculateErrorStats() {
        const errors = {};
        
        this.gameData.rounds.forEach(round => {
            if (round.analysis && round.analysis.errorType) {
                errors[round.analysis.errorType] = (errors[round.analysis.errorType] || 0) + 1;
            }
        });
        
        return errors;
    }
    
    createErrorChart(errorStats) {
        const canvas = document.getElementById('errorChart');
        if (!canvas) return;
        
        const container = canvas.parentElement;
        
        // Hide no data display if it exists
        const noDataDiv = container.querySelector('.chart-no-data');
        if (noDataDiv) {
            noDataDiv.style.display = 'none';
        }
        
        // Show canvas
        canvas.style.display = 'block';
        
        // Set canvas dimensions to match container
        const containerRect = container.getBoundingClientRect();
        canvas.width = containerRect.width || 400;
        canvas.height = containerRect.height || 300;
        
        const ctx = canvas.getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const labels = Object.keys(errorStats);
        const data = Object.values(errorStats);
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'];
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                size: 12
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    showNoDataChart() {
        const canvas = document.getElementById('errorChart');
        if (!canvas) return;
        
        const container = canvas.parentElement;
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Hide canvas and show no data message
        canvas.style.display = 'none';
        
        // Create or update no data display
        let noDataDiv = container.querySelector('.chart-no-data');
        if (!noDataDiv) {
            noDataDiv = document.createElement('div');
            noDataDiv.className = 'chart-no-data';
            container.appendChild(noDataDiv);
        }
        
        noDataDiv.innerHTML = `
            <div class="no-data-icon">📊</div>
            <div class="no-data-title">No Data Available</div>
            <div class="no-data-subtitle">Complete a match to see error statistics</div>
        `;
        
        noDataDiv.style.display = 'flex';
    }
    
    showNoErrorChart() {
        const canvas = document.getElementById('errorChart');
        if (!canvas) return;
        
        const container = canvas.parentElement;
        
        // Hide no data display if it exists
        const noDataDiv = container.querySelector('.chart-no-data');
        if (noDataDiv) {
            noDataDiv.style.display = 'none';
        }
        
        // Show canvas
        canvas.style.display = 'block';
        
        // Set canvas dimensions to match container
        const containerRect = container.getBoundingClientRect();
        canvas.width = containerRect.width || 400;
        canvas.height = containerRect.height || 300;
        
        const ctx = canvas.getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Perfect Performance'],
                datasets: [{
                    data: [100],
                    backgroundColor: ['#4CAF50'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                size: 14
                            },
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'No errors detected!';
                            }
                        }
                    }
                }
            }
        });
    }
    
    generateAISuggestions() {
        const suggestionsContainer = document.getElementById('aiSuggestions');
        if (!suggestionsContainer) return;
        
        if (!this.gameData || !this.gameData.rounds || this.gameData.rounds.length === 0) {
            suggestionsContainer.innerHTML = '<div class="suggestion-item">Complete a match to see AI analysis suggestions</div>';
            return;
        }
        
        const suggestions = this.calculateAISuggestions();
        
        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = `
                <div class="suggestion-item">
                    <h5>🎉 Perfect Performance!</h5>
                    <p>Excellent performance in this match, no obvious areas for improvement found. Keep up the great work!</p>
                </div>
            `;
            return;
        }
        
        const suggestionsHTML = suggestions.map(suggestion => `
            <div class="suggestion-item">
                <h5>${suggestion.title}</h5>
                <p>${suggestion.content}</p>
            </div>
        `).join('');
        
        suggestionsContainer.innerHTML = suggestionsHTML;
    }
    
    calculateAISuggestions() {
        const suggestions = [];
        const errorStats = this.calculateErrorStats();
        
        Object.entries(errorStats).forEach(([error, count]) => {
            const percentage = (count / this.gameData.rounds.length) * 100;
            
            if (percentage > 20) {
                suggestions.push({
                    title: `🎯 Key Improvement: ${error}`,
                    content: this.getErrorSuggestion(error)
                });
            }
        });
        
        return suggestions.slice(0, 5);
    }
    
    getErrorSuggestion(error) {
        const suggestions = {
            'Slow reaction': 'Recommend more reaction speed training, consider using a metronome or reaction lights for practice.',
            'Defensive errors': 'Need to improve defensive positioning, suggest watching defense technique videos and specialized practice.',
            'Poor attack angle': 'Practice different attack angles to improve diversity and accuracy of attacks.',
            'Attention distraction': 'Recommend strengthening focus exercises in training, try meditation or attention training.',
            'Non-standard technical actions': 'Focus on practicing basic technical movements, suggest correction under coach guidance.'
        };
        
        return suggestions[error] || 'Recommend specialized training for this issue.';
    }
    
    initializeChart() {
        const canvas = document.getElementById('errorChart');
        if (!canvas) return;
        
        // Set up canvas dimensions responsively
        const container = canvas.parentElement;
        const resizeCanvas = () => {
            const containerRect = container.getBoundingClientRect();
            const containerStyles = window.getComputedStyle(container);
            const paddingLeft = parseFloat(containerStyles.paddingLeft) || 0;
            const paddingRight = parseFloat(containerStyles.paddingRight) || 0;
            const paddingTop = parseFloat(containerStyles.paddingTop) || 0;
            const paddingBottom = parseFloat(containerStyles.paddingBottom) || 0;
            
            // Calculate available space
            const availableWidth = containerRect.width - paddingLeft - paddingRight;
            const availableHeight = containerRect.height - paddingTop - paddingBottom;
            
            // Set canvas dimensions
            canvas.width = Math.max(availableWidth, 300);
            canvas.height = Math.max(availableHeight, 200);
        };
        
        // Initial resize
        resizeCanvas();
        
        // Add resize listener
        window.addEventListener('resize', resizeCanvas);
        
        // Initialize with no data chart
        this.showNoDataChart();
    }
    
    clearReports() {
        this.reportData = null;
        this.gameData = null;
        this.currentGame = null;
        
        // Reset game selector
        const selector = document.getElementById('reportGameSelector');
        if (selector) {
            selector.value = '';
        }
        
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.disabled = true;
        }
        
        const finalScoreElement = document.getElementById('finalScore');
        if (finalScoreElement) {
            finalScoreElement.innerHTML = `
                <div class="score-item">
                    <span class="player">Player A:</span>
                    <span class="score">0</span>
                </div>
                <div class="score-item">
                    <span class="player">Player B:</span>
                    <span class="score">0</span>
                </div>
            `;
        }
        
        // Clear error chart and any existing chart
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Clear any existing no data displays
        const canvas = document.getElementById('errorChart');
        if (canvas) {
            const container = canvas.parentElement;
            const noDataDiv = container.querySelector('.chart-no-data');
            if (noDataDiv) {
                noDataDiv.remove();
            }
        }
        
        // Show no data chart
        this.showNoDataChart();
        
        const suggestionsContainer = document.getElementById('aiSuggestions');
        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = '<div class="suggestion-item">Complete a match to see AI analysis suggestions</div>';
        }
    }
    
    generateFinalReport() {
        if (!this.currentGame) {
            // 如果没有选择游戏，提示用户
            const selector = document.getElementById('reportGameSelector');
            if (selector && this.games.length > 0) {
                selector.focus();
                if (window.smartCourtApp) {
                    window.smartCourtApp.showMessage('Please select a game to generate report', 'warning');
                }
                return;
            }
        }
        
        this.generateReport();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.reportManager = new ReportManager();
}); 