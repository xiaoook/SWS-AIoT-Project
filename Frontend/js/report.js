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
            const selectedGameId = e.target.value;
            generateBtn.disabled = !selectedGameId;
            
            // 不立即加载游戏，等用户点击按钮
            if (!selectedGameId) {
                this.currentGame = null;
                this.displayNoGameMessage();
            } else {
                // 选择了游戏但还没生成报告，显示等待生成的提示
                this.displayWaitingForReport();
            }
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
            
            // 只有在用户主动选择游戏时才显示内容
            if (this.currentGame) {
                this.generateReport();
            } else {
                // 没有选择游戏时显示选择提示
                this.displayNoGameMessage();
            }
            
        } catch (error) {
            console.error('Error refreshing game data for report:', error);
            // 数据库错误时使用空数组，不显示假数据
            this.games = [];
            this.populateGameSelector();
            this.displayNoGameMessage();
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
    
    displayNoGameMessage() {
        const container = document.getElementById('reportContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="no-game-selected">
                <div class="no-game-icon">📊</div>
                <h3>No Game Selected</h3>
                <p>Please select a game from the dropdown above to view the match report.</p>
                ${this.games.length === 0 ? 
                    '<p><em>No games available. Start a new game to begin reporting.</em></p>' : 
                    '<p><em>Choose from available games in the selector.</em></p>'
                }
            </div>
        `;
    }
    
    displayWaitingForReport() {
        const container = document.getElementById('reportContainer');
        if (!container) return;
        
        const selectedGame = document.getElementById('reportGameSelector').value;
        if (!selectedGame) return;
        
        container.innerHTML = `
            <div class="waiting-for-report">
                <div class="waiting-icon">⏳</div>
                <h3>Game Selected</h3>
                <p>Click the <strong>"Generate Report"</strong> button to view the match report.</p>
                <p><em>Selected game: ${selectedGame}</em></p>
            </div>
        `;
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
                    const formattedRounds = roundsData.rounds.map((round, index) => {
                        // 正确判断在这个回合中谁得分了
                        let winner = 'playerA'; // 默认值
                        
                        if (index === 0) {
                            // 第一回合，直接比较得分
                            winner = round.pointA > round.pointB ? 'playerA' : 'playerB';
                        } else {
                            // 不是第一回合，比较与前一回合的得分差异
                            const prevRound = roundsData.rounds[index - 1];
                            const playerAScoreIncrease = round.pointA - prevRound.pointA;
                            const playerBScoreIncrease = round.pointB - prevRound.pointB;
                            
                            if (playerAScoreIncrease > playerBScoreIncrease) {
                                winner = 'playerA';
                            } else if (playerBScoreIncrease > playerAScoreIncrease) {
                                winner = 'playerB';
                            } else {
                                // 如果两者得分增加相同（通常不会发生），使用累积得分判断
                                winner = round.pointA > round.pointB ? 'playerA' : 'playerB';
                            }
                        }
                        
                        return {
                        id: round.roundInGame,
                        timestamp: new Date().toISOString(),
                            winner: winner,
                        playerAScore: round.pointA,
                            playerBScore: round.pointB
                        };
                    });
                    
                    // 更新当前游戏的轮次数据
                    this.currentGame = {
                        ...game,
                        rounds: formattedRounds
                    };
                    
                    // 转换为报告格式
                    this.gameData = this.convertGameToReportFormat(this.currentGame);
                    
                    // 加载后端分析数据
                    await this.loadBackendAnalysis(databaseGameId);
                    
                    console.log(`🎯 Report data prepared for ${gameId} with ${formattedRounds.length} rounds`);
                } else {
                    console.warn('No rounds data received from backend, using local data');
                    this.currentGame = game;
                    this.gameData = this.convertGameToReportFormat(game);
                    // 仍然尝试加载分析数据
                    await this.loadBackendAnalysis(databaseGameId);
                }
            } else if (roundsResponse.status === 404) {
                // 404错误 - 轮次数据不存在，这是正常情况
                console.log(`ℹ️ No rounds found for report ${gameId} (Database ID: ${databaseGameId}) - 404`);
                this.currentGame = game;
                this.gameData = this.convertGameToReportFormat(game);
                // 仍然尝试加载分析数据
                await this.loadBackendAnalysis(databaseGameId);
            } else {
                console.error(`Failed to load rounds from backend: HTTP ${roundsResponse.status}, using local data`);
                this.currentGame = game;
                this.gameData = this.convertGameToReportFormat(game);
                // 仍然尝试加载分析数据
                await this.loadBackendAnalysis(databaseGameId);
            }
            
        } catch (error) {
            console.error('Error loading game report:', error);
            this.currentGame = game;
            this.gameData = this.convertGameToReportFormat(game);
            // 即使出错也尝试加载分析数据
            if (databaseGameId) {
                try {
                    await this.loadBackendAnalysis(databaseGameId);
                } catch (analysisError) {
                    console.warn('Failed to load analysis data after error:', analysisError);
                }
            }
        } finally {
            // 恢复按钮状态
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Report';
            }
        }
        
        this.generateReport();
    }
    
    async loadBackendAnalysis(databaseGameId) {
        try {
            console.log(`📊 Loading backend analysis for report game ${databaseGameId}`);
            
            // 加载游戏级别分析
            await this.loadGameAnalysis_Backend(databaseGameId);
            
            // 加载轮次级别分析
            await this.loadRoundAnalysis_Backend(databaseGameId);
            
        } catch (error) {
            console.warn('⚠️ Failed to load backend analysis for report:', error);
        }
    }
    
    // 安全地处理后端返回的数据，确保始终返回数组
    safeParseBackendData(data, defaultValue = []) {
        if (!data) return defaultValue;
        
        // 如果已经是数组，直接返回
        if (Array.isArray(data)) {
            return data;
        }
        
        // 如果是字符串，尝试解析JSON
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                console.warn('Failed to parse backend data as JSON:', data);
                return data ? [data] : defaultValue;
            }
        }
        
        // 其他情况，尝试转换为数组
        return data ? [data] : defaultValue;
    }
    
    async loadGameAnalysis_Backend(databaseGameId) {
        try {
            const response = await fetch(`${CONFIG.API_URLS.ANALYSIS_GAME}?gid=${databaseGameId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.analysis) {
                    console.log(`✅ Loaded game analysis for report game ${databaseGameId}`);
                    
                    // 调试信息：显示后端返回的数据结构
                    console.log('🔍 Backend game analysis raw data:', data.analysis);
                    console.log('🔍 A_type:', data.analysis.A_type, typeof data.analysis.A_type);
                    console.log('🔍 A_analysis:', data.analysis.A_analysis, typeof data.analysis.A_analysis);
                    console.log('🔍 B_type:', data.analysis.B_type, typeof data.analysis.B_type);
                    console.log('🔍 B_analysis:', data.analysis.B_analysis, typeof data.analysis.B_analysis);
                    
                    this.currentGame.backendAnalysis = {
                        playerA: {
                            errorTypes: this.safeParseBackendData(data.analysis.A_type, []),
                            analysis: this.safeParseBackendData(data.analysis.A_analysis, []),
                            timestamp: new Date().toISOString()
                        },
                        playerB: {
                            errorTypes: this.safeParseBackendData(data.analysis.B_type, []),
                            analysis: this.safeParseBackendData(data.analysis.B_analysis, []),
                            timestamp: new Date().toISOString()
                        }
                    };
                } else {
                    console.log(`ℹ️ No game analysis data for report: ${data.message || 'Unknown error'}`);
                }
            } else if (response.status === 404) {
                console.log(`ℹ️ No game analysis found for report (404)`);
            } else {
                console.log(`⚠️ Game analysis request failed for report: HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.warn('⚠️ Failed to load game analysis for report:', error);
        }
    }
    
    async loadRoundAnalysis_Backend(databaseGameId) {
        try {
            const response = await fetch(CONFIG.getRoundAnalysisUrl(databaseGameId), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.analyses) {
                    console.log(`✅ Loaded ${data.analyses.length} round analyses for report`);
                    
                    if (this.currentGame && this.currentGame.rounds) {
                        data.analyses.forEach(analysis => {
                            const roundId = analysis.rid;
                            const gameRound = this.currentGame.rounds.find(round => round.id === roundId);
                            
                            if (gameRound) {
                                // 调试信息：显示轮次分析的数据结构
                                console.log(`🔍 Round ${roundId} backend analysis raw data:`, analysis);
                                console.log(`🔍 Round ${roundId} A_type:`, analysis.A_type, typeof analysis.A_type);
                                console.log(`🔍 Round ${roundId} A_analysis:`, analysis.A_analysis, typeof analysis.A_analysis);
                                console.log(`🔍 Round ${roundId} B_type:`, analysis.B_type, typeof analysis.B_type);
                                console.log(`🔍 Round ${roundId} B_analysis:`, analysis.B_analysis, typeof analysis.B_analysis);
                                
                                gameRound.backendAnalysis = {
                                    playerA: {
                                        errorTypes: this.safeParseBackendData(analysis.A_type, []),
                                        analysis: this.safeParseBackendData(analysis.A_analysis, []),
                                        timestamp: new Date().toISOString()
                                    },
                                    playerB: {
                                        errorTypes: this.safeParseBackendData(analysis.B_type, []),
                                        analysis: this.safeParseBackendData(analysis.B_analysis, []),
                                        timestamp: new Date().toISOString()
                                    }
                                };
                                
                                // 更新round的analysis对象以包含错误类型信息
                                const playerAErrors = this.safeParseBackendData(analysis.A_type, []);
                                const playerBErrors = this.safeParseBackendData(analysis.B_type, []);
                                
                                // 不再更新round.analysis，因为round对象现在不包含analysis属性
                                // 错误类型信息已经存储在gameRound.backendAnalysis中
                            }
                        });
                    }
                } else {
                    console.log(`ℹ️ No round analysis data for report: ${data.message || 'Unknown error'}`);
                }
            } else if (response.status === 404) {
                console.log(`ℹ️ No round analysis found for report (404)`);
            } else {
                console.log(`⚠️ Round analysis request failed for report: HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.warn('⚠️ Failed to load round analysis for report:', error);
        }
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
        console.log('🔄 Starting report generation...');
        console.log('🔍 Current game data:', this.currentGame);
        console.log('🔍 Game data:', this.gameData);
        
        if (this.currentGame && this.gameData) {
            console.log('📊 Using current game data with backend analysis');
            this.updateFinalScore();
            this.generateErrorChart();
            this.generateAISuggestions();
        } else if (this.gameData) {
            console.log('📊 Using game data without backend analysis');
            this.updateFinalScore();
            this.generateErrorChart();
            this.generateAISuggestions();
        } else if (window.smartCourtApp && window.smartCourtApp.gameState) {
            console.log('📊 Using SmartCourtApp game state');
            this.gameData = window.smartCourtApp.getGameState();
            this.updateFinalScore();
            this.generateErrorChart();
            this.generateAISuggestions();
        } else {
            console.log('❌ No game data available for report generation');
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
        
        console.log('📊 Calculating error stats...');
        console.log('🔍 currentGame:', this.currentGame);
        console.log('🔍 gameData:', this.gameData);
        
        // 安全处理后端分析数据
        const safeProcessErrorTypes = (errorTypes, source) => {
            if (!errorTypes) return;
            
            if (Array.isArray(errorTypes)) {
                errorTypes.forEach(errorType => {
                    const translatedError = this.translateErrorType(errorType);
                    errors[translatedError] = (errors[translatedError] || 0) + 1;
                    console.log(`📈 Found error: ${translatedError} from ${source}`);
                });
            } else {
                console.warn('⚠️ errorTypes is not an array:', errorTypes, 'from', source);
            }
        };
        
        // 优先使用后端分析数据
        if (this.currentGame && this.currentGame.rounds) {
            console.log('📊 Using currentGame rounds data');
            this.currentGame.rounds.forEach((round, index) => {
                if (round.backendAnalysis) {
                    console.log(`📊 Round ${index + 1} has backend analysis`);
                    // 收集playerA的错误类型
                    if (round.backendAnalysis.playerA && round.backendAnalysis.playerA.errorTypes) {
                        safeProcessErrorTypes(round.backendAnalysis.playerA.errorTypes, `Round ${index + 1} PlayerA`);
                    }
                    
                    // 收集playerB的错误类型
                    if (round.backendAnalysis.playerB && round.backendAnalysis.playerB.errorTypes) {
                        safeProcessErrorTypes(round.backendAnalysis.playerB.errorTypes, `Round ${index + 1} PlayerB`);
                    }
                }
                // 如果没有后端分析数据，跳过这个轮次
                else {
                    console.log(`📊 Round ${index + 1} has no backend analysis`);
                }
            });
        }
        // 如果没有currentGame，使用gameData（兼容性）
        else if (this.gameData && this.gameData.rounds) {
            console.log('📊 Using gameData rounds data');
            this.gameData.rounds.forEach((round, index) => {
                // 只处理有analysis对象的轮次（兼容旧数据）
            if (round.analysis && round.analysis.errorType) {
                errors[round.analysis.errorType] = (errors[round.analysis.errorType] || 0) + 1;
                    console.log(`📈 Found gameData error: ${round.analysis.errorType} from Round ${index + 1}`);
            }
        });
        }
        
        console.log('📊 Final error stats:', errors);
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
        
        console.log('📊 Generating AI suggestions...');
        console.log('🔍 currentGame backend analysis:', this.currentGame?.backendAnalysis);
        console.log('🔍 gameData:', this.gameData);
        
        if (!this.gameData || !this.gameData.rounds || this.gameData.rounds.length === 0) {
            suggestionsContainer.innerHTML = '<div class="suggestion-item">Complete a match to see AI analysis suggestions</div>';
            return;
        }
        
        // 优先显示后端AI分析结果
        if (this.currentGame && this.currentGame.backendAnalysis) {
            console.log('📊 Using backend AI analysis for report');
            this.generateBackendAIAnalysis();
            return;
        }
        
        // 检查是否有轮次级别的后端分析
        const hasRoundBackendAnalysis = this.currentGame && this.currentGame.rounds && 
            this.currentGame.rounds.some(round => round.backendAnalysis);
        
        if (hasRoundBackendAnalysis) {
            console.log('📊 Using round-level backend analysis for report');
            this.generateRoundBackendAnalysis();
            return;
        }
        
        // 如果没有后端分析数据，显示等待分析的消息
        console.log('📊 No backend analysis data available');
            suggestionsContainer.innerHTML = `
                <div class="suggestion-item">
                <h5>⏳ Analysis in Progress</h5>
                <p>AI analysis data is not available yet. Please wait for the backend analysis to complete or try refreshing the page.</p>
                <p><em>Note: AI suggestions are generated by the backend analysis system and require analysis data to be available.</em></p>
                </div>
            `;
    }
    
    // 生成后端AI分析结果
    generateBackendAIAnalysis() {
        const suggestionsContainer = document.getElementById('aiSuggestions');
        if (!suggestionsContainer) return;
        
        const analysis = this.currentGame.backendAnalysis;
        const playerAName = this.getPlayerName('playerA');
        const playerBName = this.getPlayerName('playerB');
        
        const analysisHTML = `
            <div class="backend-ai-analysis">
                <div class="ai-analysis-header">
                    <div class="ai-icon">🤖</div>
                    <h4>AI Analysis Results</h4>
                    <div class="ai-timestamp">
                        Analysis Time: ${new Date(analysis.playerA.timestamp).toLocaleString()}
            </div>
                </div>
                
                <div class="ai-players-analysis">
                    ${(analysis.playerA.errorTypes.length > 0 || analysis.playerA.analysis.length > 0) ? `
                        <div class="ai-player-analysis">
                            <div class="ai-player-header">
                                <span class="player-icon">🔵</span>
                                <span class="player-name">${playerAName}</span>
                            </div>
                            
                            ${analysis.playerA.errorTypes.length > 0 ? `
                                <div class="ai-identified-issues">
                                    <h5>🎯 Identified Issues</h5>
                                    <div class="ai-error-badges">
                                        ${analysis.playerA.errorTypes.map(errorType => 
                                            `<span class="ai-error-badge">${this.translateErrorType(errorType)}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${analysis.playerA.analysis.length > 0 ? `
                                <div class="ai-improvement-suggestions">
                                    <h5>💡 Improvement Suggestions</h5>
                                    <div class="ai-suggestions-list">
                                        ${analysis.playerA.analysis.map(suggestion => `
                                            <div class="ai-suggestion-item">
                                                <span class="suggestion-icon">💡</span>
                                                <span class="suggestion-text">${this.translateAnalysisSuggestion(suggestion)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${(analysis.playerB.errorTypes.length > 0 || analysis.playerB.analysis.length > 0) ? `
                        <div class="ai-player-analysis">
                            <div class="ai-player-header">
                                <span class="player-icon">🔴</span>
                                <span class="player-name">${playerBName}</span>
                            </div>
                            
                            ${analysis.playerB.errorTypes.length > 0 ? `
                                <div class="ai-identified-issues">
                                    <h5>🎯 Identified Issues</h5>
                                    <div class="ai-error-badges">
                                        ${analysis.playerB.errorTypes.map(errorType => 
                                            `<span class="ai-error-badge">${this.translateErrorType(errorType)}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${analysis.playerB.analysis.length > 0 ? `
                                <div class="ai-improvement-suggestions">
                                    <h5>💡 Improvement Suggestions</h5>
                                    <div class="ai-suggestions-list">
                                        ${analysis.playerB.analysis.map(suggestion => `
                                            <div class="ai-suggestion-item">
                                                <span class="suggestion-icon">💡</span>
                                                <span class="suggestion-text">${this.translateAnalysisSuggestion(suggestion)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        suggestionsContainer.innerHTML = analysisHTML;
    }
    
    generateRoundBackendAnalysis() {
        const suggestionsContainer = document.getElementById('aiSuggestions');
        if (!suggestionsContainer) return;
        
        const playerAName = this.getPlayerName('playerA');
        const playerBName = this.getPlayerName('playerB');
        
        // 收集所有轮次的分析数据
        const playerAErrors = new Set();
        const playerBErrors = new Set();
        const playerASuggestions = new Set();
        const playerBSuggestions = new Set();
        
        this.currentGame.rounds.forEach(round => {
            if (round.backendAnalysis) {
                // 收集playerA的数据
                if (round.backendAnalysis.playerA) {
                    if (Array.isArray(round.backendAnalysis.playerA.errorTypes)) {
                        round.backendAnalysis.playerA.errorTypes.forEach(error => playerAErrors.add(error));
                    }
                    if (Array.isArray(round.backendAnalysis.playerA.analysis)) {
                        round.backendAnalysis.playerA.analysis.forEach(suggestion => playerASuggestions.add(suggestion));
                    }
                }
                
                // 收集playerB的数据
                if (round.backendAnalysis.playerB) {
                    if (Array.isArray(round.backendAnalysis.playerB.errorTypes)) {
                        round.backendAnalysis.playerB.errorTypes.forEach(error => playerBErrors.add(error));
                    }
                    if (Array.isArray(round.backendAnalysis.playerB.analysis)) {
                        round.backendAnalysis.playerB.analysis.forEach(suggestion => playerBSuggestions.add(suggestion));
                    }
                }
            }
        });
        
        const analysisHTML = `
            <div class="backend-ai-analysis">
                <div class="ai-analysis-header">
                    <div class="ai-icon">🤖</div>
                    <h4>AI Analysis Results (Round-based)</h4>
                    <div class="ai-timestamp">
                        Analysis Time: ${new Date().toLocaleString()}
                    </div>
                </div>
                
                <div class="ai-players-analysis">
                    ${(playerAErrors.size > 0 || playerASuggestions.size > 0) ? `
                        <div class="ai-player-analysis">
                            <div class="ai-player-header">
                                <span class="player-icon">🔵</span>
                                <span class="player-name">${playerAName}</span>
                            </div>
                            
                            ${playerAErrors.size > 0 ? `
                                <div class="ai-identified-issues">
                                    <h5>🎯 Identified Issues</h5>
                                    <div class="ai-error-badges">
                                        ${Array.from(playerAErrors).map(errorType => 
                                            `<span class="ai-error-badge">${this.translateErrorType(errorType)}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${playerASuggestions.size > 0 ? `
                                <div class="ai-improvement-suggestions">
                                    <h5>💡 Improvement Suggestions</h5>
                                    <div class="ai-suggestions-list">
                                        ${Array.from(playerASuggestions).map(suggestion => `
                                            <div class="ai-suggestion-item">
                                                <span class="suggestion-icon">💡</span>
                                                <span class="suggestion-text">${this.translateAnalysisSuggestion(suggestion)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${(playerBErrors.size > 0 || playerBSuggestions.size > 0) ? `
                        <div class="ai-player-analysis">
                            <div class="ai-player-header">
                                <span class="player-icon">🔴</span>
                                <span class="player-name">${playerBName}</span>
                            </div>
                            
                            ${playerBErrors.size > 0 ? `
                                <div class="ai-identified-issues">
                                    <h5>🎯 Identified Issues</h5>
                                    <div class="ai-error-badges">
                                        ${Array.from(playerBErrors).map(errorType => 
                                            `<span class="ai-error-badge">${this.translateErrorType(errorType)}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${playerBSuggestions.size > 0 ? `
                                <div class="ai-improvement-suggestions">
                                    <h5>💡 Improvement Suggestions</h5>
                                    <div class="ai-suggestions-list">
                                        ${Array.from(playerBSuggestions).map(suggestion => `
                                            <div class="ai-suggestion-item">
                                                <span class="suggestion-icon">💡</span>
                                                <span class="suggestion-text">${this.translateAnalysisSuggestion(suggestion)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        suggestionsContainer.innerHTML = analysisHTML;
    }
    
    // 翻译错误类型 - 后端分析器的5种错误类型
    translateErrorType(errorType) {
        const errorTypeMap = {
            'Slow Reaction': 'Slow Reaction',
            'Low Activity': 'Low Activity',
            'Weak Defense': 'Weak Defense',
            'Poor Alignment': 'Poor Alignment',
            'Coverage Gap': 'Coverage Gap',
            
            // 兼容下划线格式
            'slow_reaction': 'Slow Reaction',
            'low_activity': 'Low Activity',
            'weak_defense': 'Weak Defense',
            'poor_alignment': 'Poor Alignment',
            'coverage_gap': 'Coverage Gap'
        };
        
        return errorTypeMap[errorType] || this.formatErrorTypeName(errorType);
    }
    
    formatErrorTypeName(errorType) {
        if (typeof errorType !== 'string') return 'Unknown';
        
        return errorType.replace(/_/g, ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
    }
    
    // 翻译分析建议 - 后端分析器的5种建议
    translateAnalysisSuggestion(suggestion) {
        const suggestionMap = {
            'Try to react more quickly to incoming plays.': 'Try to react more quickly to incoming plays',
            'Move more actively to stay engaged in the game.': 'Move more actively to stay engaged in the game',
            'Improve your defense to prevent goals when under threat.': 'Improve your defense to prevent goals when under threat',
            'Align your movement better with the direction of the ball.': 'Align your movement better with the direction of the ball',
            'Increase your coverage area to better influence the game.': 'Increase your coverage area to better influence the game'
        };
        
        return suggestionMap[suggestion] || this.formatSuggestionText(suggestion);
    }
    
    formatSuggestionText(suggestion) {
        if (typeof suggestion !== 'string') return 'Continue practicing';
        
        return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
    }
    
    // 获取玩家名称
    getPlayerName(player) {
        if (this.currentGame && this.currentGame.playerNames) {
            return this.currentGame.playerNames[player] || (player === 'playerA' ? 'Player A' : 'Player B');
        }
        return player === 'playerA' ? 'Player A' : 'Player B';
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