// Game Analysis Manager - 重构版本，专注于后端API集成
class AnalysisManager {
    constructor() {
        this.games = [];
        this.currentGame = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createGameSelector();
        this.refreshAnalysis();
    }
    
    setupEventListeners() {
        // 监听游戏状态变化
        document.addEventListener('gameStateChange', () => {
            this.refreshAnalysis(); // 刷新分析
        });
    }
    
    createGameSelector() {
        const toolbar = document.querySelector('.analysis-toolbar');
        if (!toolbar) return;
        
        const gameSelectorHTML = `
            <div class="game-selector-section">
                <label class="selector-label">Select Game for Analysis:</label>
                <select id="gameSelector" class="game-selector">
                    <option value="">Choose a game...</option>
                </select>
                <button id="analyzeGameBtn" class="btn btn-primary" disabled>Analyze Game</button>
            </div>
        `;
        
        toolbar.insertAdjacentHTML('afterbegin', gameSelectorHTML);
        
        // 添加事件监听器
        const selector = document.getElementById('gameSelector');
        const analyzeBtn = document.getElementById('analyzeGameBtn');
        
        selector.addEventListener('change', (e) => {
            const selectedGameId = e.target.value;
            analyzeBtn.disabled = !selectedGameId;
            
            if (!selectedGameId) {
                this.currentGame = null;
                this.displayNoGameMessage();
            } else {
                this.displayWaitingForAnalysis();
            }
        });
        
        analyzeBtn.addEventListener('click', () => {
            const selectedGameId = selector.value;
            if (selectedGameId) {
                this.loadGameAnalysis(selectedGameId);
            }
        });
    }
    

    
    // 从数据库加载游戏记录
    async loadGamesFromDatabase() {
        try {
            console.log('🔄 Loading games from database...');
            
            const response = await fetch(CONFIG.API_URLS.GAMES, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    limit: 100
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.games) {
                    console.log(`✅ Loaded ${data.games.length} games from database`);
                    
                    return data.games.map((game) => {
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
                            rounds: [],
                            databaseGameId: game.gid,
                            playerNames: {
                                playerA: game.playerAname || 'Player A',
                                playerB: game.playerBname || 'Player B'
                            }
                        };
                    });
                } else {
                    throw new Error(data.message || 'Failed to load games');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Failed to load games:', error);
            return [];
        }
    }
    
    async refreshAnalysis() {
        try {
            console.log('🔄 Refreshing analysis data...');
            
            const gamesFromDB = await this.loadGamesFromDatabase();
            
            if (gamesFromDB && gamesFromDB.length > 0) {
                this.games = gamesFromDB;
                console.log(`✅ Analysis refreshed with ${gamesFromDB.length} games`);
            } else {
                this.games = [];
                console.log('💾 No games available');
            }
            
            this.populateGameSelector();
            
            if (this.currentGame) {
                this.displayGameAnalysis();
            } else {
                this.displayNoGameMessage();
            }
            
        } catch (error) {
            console.error('❌ Error refreshing analysis:', error);
            this.games = [];
            this.populateGameSelector();
            this.displayNoGameMessage();
        }
    }
    
    populateGameSelector() {
        const selector = document.getElementById('gameSelector');
        if (!selector || this.games.length === 0) return;
        
        selector.innerHTML = '<option value="">Choose a game...</option>';
        
        const sortedGames = [...this.games].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        
        sortedGames.forEach(game => {
            const option = document.createElement('option');
            option.value = game.gameId;
            const startTime = new Date(game.startTime).toLocaleString();
            const status = game.status === 'ended' ? '✓' : '🔴';
            const winner = game.winner ? ` (${this.getPlayerName(game, game.winner)} wins)` : '';
            option.textContent = `${status} ${game.gameType} - ${startTime}${winner}`;
            selector.appendChild(option);
        });
    }
    
    async loadGameAnalysis(gameId) {
        const game = this.games.find(g => g.gameId === gameId);
        if (!game) return;
        
        // 更新UI状态
        const selector = document.getElementById('gameSelector');
        if (selector) selector.value = gameId;
        
        const analyzeBtn = document.getElementById('analyzeGameBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = 'Loading...';
        }
        
        try {
            const databaseGameId = game.databaseGameId;
            if (!databaseGameId) {
                console.warn('No database game ID found');
                this.currentGame = game;
                this.displayGameAnalysis();
                return;
            }
            
            console.log(`📊 Loading analysis for game ${gameId} (Database ID: ${databaseGameId})`);
            
            // 加载轮次数据
            await this.loadRoundsData(game, databaseGameId);
            
            // 加载后端分析数据
            await this.loadBackendAnalysis(databaseGameId);
            
        } catch (error) {
            console.error('❌ Error loading game analysis:', error);
            this.currentGame = game;
        } finally {
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = 'Analyze Game';
            }
        }
        
        this.displayGameAnalysis();
    }
    
    async loadRoundsData(game, databaseGameId) {
        try {
            console.log(`📊 Loading rounds for game ${databaseGameId}`);
            
            const roundsResponse = await fetch(CONFIG.getRoundsUrl(databaseGameId), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (roundsResponse.ok) {
                const roundsData = await roundsResponse.json();
                if (roundsData.status === 'success' && roundsData.rounds) {
                    console.log(`✅ Loaded ${roundsData.rounds.length} rounds`);
                    
                    const formattedRounds = roundsData.rounds.map((round, index) => {
                        let winner = 'playerA';
                        
                        if (index === 0) {
                            winner = round.pointA > round.pointB ? 'playerA' : 'playerB';
                        } else {
                            const prevRound = roundsData.rounds[index - 1];
                            const playerAScoreIncrease = round.pointA - prevRound.pointA;
                            const playerBScoreIncrease = round.pointB - prevRound.pointB;
                            
                            if (playerAScoreIncrease > playerBScoreIncrease) {
                                winner = 'playerA';
                            } else if (playerBScoreIncrease > playerAScoreIncrease) {
                                winner = 'playerB';
                            } else {
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
                    
                    this.currentGame = {
                        ...game,
                        rounds: formattedRounds
                    };
                    
                    console.log(`✅ Game data prepared with ${formattedRounds.length} rounds`);
                } else {
                    console.warn('No rounds data received');
                    this.currentGame = game;
                }
            } else if (roundsResponse.status === 404) {
                console.log('ℹ️ No rounds found (404)');
                this.currentGame = game;
            } else {
                console.error(`Failed to load rounds: HTTP ${roundsResponse.status}`);
                this.currentGame = game;
            }
            
        } catch (error) {
            console.error('❌ Error loading rounds:', error);
            this.currentGame = game;
        }
    }
    
    async loadBackendAnalysis(databaseGameId) {
        try {
            console.log(`📊 Loading backend analysis for game ${databaseGameId}`);
            
            // 加载游戏级别分析
            await this.loadGameAnalysis_Backend(databaseGameId);
            
            // 加载轮次级别分析
            await this.loadRoundAnalysis_Backend(databaseGameId);
            
        } catch (error) {
            console.warn('⚠️ Failed to load backend analysis:', error);
        }
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
                    console.log(`✅ Loaded game analysis for game ${databaseGameId}`);
                    
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
                    console.log(`ℹ️ No game analysis data: ${data.message || 'Unknown error'}`);
                }
            } else if (response.status === 404) {
                console.log(`ℹ️ No game analysis found (404)`);
            } else {
                console.log(`⚠️ Game analysis request failed: HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.warn('⚠️ Failed to load game analysis:', error);
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
                    console.log(`✅ Loaded ${data.analyses.length} round analyses`);
                    
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
                            }
                        });
                    }
                } else {
                    console.log(`ℹ️ No round analysis data: ${data.message || 'Unknown error'}`);
                }
            } else if (response.status === 404) {
                console.log(`ℹ️ No round analysis found (404)`);
            } else {
                console.log(`⚠️ Round analysis request failed: HTTP ${response.status}`);
            }
            
        } catch (error) {
            console.warn('⚠️ Failed to load round analysis:', error);
        }
    }
    
    // 错误类型翻译
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
    
    // 建议文本翻译
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
    
    // 显示游戏分析 - 整合视图
    displayGameAnalysis() {
        if (!this.currentGame) {
            this.displayNoGameMessage();
            return;
        }
        
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        const gameHeaderHTML = this.createGameHeaderHTML();
        const gameRounds = this.currentGame.rounds || [];
        
        if (gameRounds.length === 0) {
            container.innerHTML = gameHeaderHTML + '<div class="no-data">No round data available for this game</div>';
            return;
        }
        
        // 创建整合的分析视图
        const analysisHTML = this.createIntegratedAnalysisView(gameRounds);
        
        container.innerHTML = gameHeaderHTML + analysisHTML;
    }
    
    createGameHeaderHTML() {
        if (!this.currentGame) return '';
        
        const startTime = new Date(this.currentGame.startTime).toLocaleString();
        const endTime = this.currentGame.endTime ? new Date(this.currentGame.endTime).toLocaleString() : 'Ongoing';
        const duration = this.formatDuration(this.currentGame.duration);
        const status = this.currentGame.status;
        const statusIcon = status === 'ended' ? '✅' : status === 'paused' ? '⏸️' : '🔴';
        
        return `
            <div class="game-analysis-header">
                <div class="game-info-card">
                    <h3>${statusIcon} Game Analysis</h3>
                    <div class="game-meta">
                        <div class="meta-item">
                            <strong>Type:</strong> ${this.currentGame.gameType}
                        </div>
                        <div class="meta-item">
                            <strong>Status:</strong> ${status.toUpperCase()}
                        </div>
                        <div class="meta-item">
                            <strong>Final Score:</strong> ${this.currentGame.finalScores.playerA} - ${this.currentGame.finalScores.playerB}
                        </div>
                        ${this.currentGame.winner ? `
                            <div class="meta-item">
                                <strong>Winner:</strong> <span class="winner-badge">🏆 ${this.getWinnerName()}</span>
                            </div>
                        ` : ''}
                        <div class="meta-item">
                            <strong>Total Rounds:</strong> ${this.currentGame.rounds.length}
                        </div>
                        <div class="meta-item">
                            <strong>Duration:</strong> ${duration}
                        </div>
                        <div class="meta-item">
                            <strong>Started:</strong> ${startTime}
                        </div>
                        ${this.currentGame.endTime ? `
                            <div class="meta-item">
                                <strong>Ended:</strong> ${endTime}
                            </div>
                        ` : ''}
                    </div>
                </div>

            </div>
        `;
    }
    
    // 创建整合的分析视图
    createIntegratedAnalysisView(rounds) {
        const playerAName = this.getPlayerName(this.currentGame, 'playerA');
        const playerBName = this.getPlayerName(this.currentGame, 'playerB');
        
        return `
            <div class="integrated-analysis-view">
                <div class="analysis-header">
                    <h3>🤖 AI Analysis Results</h3>
                    <div class="analysis-summary">
                        <div class="summary-item">
                            <span class="summary-label">Total Rounds:</span>
                            <span class="summary-value">${rounds.length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Analyzed Rounds:</span>
                            <span class="summary-value">${rounds.filter(r => r.backendAnalysis).length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Game Analysis:</span>
                            <span class="summary-value">${this.currentGame.backendAnalysis ? 'Available' : 'Not Available'}</span>
                        </div>
                    </div>
                </div>
                
                ${this.createGameLevelAnalysisSection()}
                ${this.createPlayerAnalysisSection(playerAName, playerBName, rounds)}
                ${this.createRoundByRoundAnalysisSection(rounds)}
            </div>
        `;
    }
    
    // 创建游戏级别分析区域
    createGameLevelAnalysisSection() {
        if (!this.currentGame || !this.currentGame.backendAnalysis) {
            return '';
        }
        
        const analysis = this.currentGame.backendAnalysis;
        const playerAName = this.getPlayerName(this.currentGame, 'playerA');
        const playerBName = this.getPlayerName(this.currentGame, 'playerB');
        
        return `
            <div class="game-level-section">
                <h4>🎮 Overall Game Analysis</h4>
                <div class="game-level-players">
                    <div class="game-level-player">
                        <div class="player-header">
                            <span class="player-icon">🔵</span>
                            <span class="player-name">${playerAName}</span>
                        </div>
                        <div class="player-analysis-content">
                            ${this.formatPlayerAnalysis(analysis.playerA)}
                        </div>
                    </div>
                    <div class="game-level-player">
                        <div class="player-header">
                            <span class="player-icon">🔴</span>
                            <span class="player-name">${playerBName}</span>
                        </div>
                        <div class="player-analysis-content">
                            ${this.formatPlayerAnalysis(analysis.playerB)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 创建玩家分析汇总区域
    createPlayerAnalysisSection(playerAName, playerBName, rounds) {
        const playerAWins = rounds.filter(r => r.winner === 'playerA').length;
        const playerBWins = rounds.filter(r => r.winner === 'playerB').length;
        
        // 收集每个玩家的所有错误类型
        const playerAErrors = this.collectPlayerErrors('playerA', rounds);
        const playerBErrors = this.collectPlayerErrors('playerB', rounds);
        
        return `
            <div class="player-analysis-section">
                <h4>👥 Player Performance Summary</h4>
                <div class="player-summaries">
                    <div class="player-summary">
                        <div class="player-header">
                            <span class="player-icon">🔵</span>
                            <span class="player-name">${playerAName}</span>
                        </div>
                        <div class="player-stats">
                            <div class="stat-item">
                                <span class="stat-label">Wins:</span>
                                <span class="stat-value">${playerAWins}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Win Rate:</span>
                                <span class="stat-value">${rounds.length > 0 ? Math.round((playerAWins / rounds.length) * 100) : 0}%</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Common Issues:</span>
                                <div class="stat-value">
                                    ${playerAErrors.length > 0 ? 
                                        playerAErrors.map(error => 
                                            `<span class="error-type-badge">${error}</span>`
                                        ).join('') : 
                                        '<span class="no-issues">None identified</span>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="player-summary">
                        <div class="player-header">
                            <span class="player-icon">🔴</span>
                            <span class="player-name">${playerBName}</span>
                        </div>
                        <div class="player-stats">
                            <div class="stat-item">
                                <span class="stat-label">Wins:</span>
                                <span class="stat-value">${playerBWins}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Win Rate:</span>
                                <span class="stat-value">${rounds.length > 0 ? Math.round((playerBWins / rounds.length) * 100) : 0}%</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Common Issues:</span>
                                <div class="stat-value">
                                    ${playerBErrors.length > 0 ? 
                                        playerBErrors.map(error => 
                                            `<span class="error-type-badge">${error}</span>`
                                        ).join('') : 
                                        '<span class="no-issues">None identified</span>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 创建逐轮分析区域
    createRoundByRoundAnalysisSection(rounds) {
        const roundsWithAnalysis = rounds.filter(round => round.backendAnalysis);
        
        if (roundsWithAnalysis.length === 0) {
            return `
                <div class="round-analysis-section">
                    <h4>🎯 Round-by-Round Analysis</h4>
                    <div class="no-round-analysis">
                        <p>No round-level analysis data available.</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="round-analysis-section">
                <h4>🎯 Round-by-Round Analysis</h4>
                <div class="rounds-grid">
                    ${roundsWithAnalysis.map(round => this.createRoundAnalysisCard(round)).join('')}
                </div>
            </div>
        `;
    }
    
    // 创建轮次分析卡片
    createRoundAnalysisCard(round) {
        const winnerName = this.getPlayerName(this.currentGame, round.winner);
        const loserKey = round.winner === 'playerA' ? 'playerB' : 'playerA';
        const loserName = this.getPlayerName(this.currentGame, loserKey);
        
        // 安全地获取分析数据
        const analysis = round.backendAnalysis || {};
        const playerAData = analysis.playerA || {};
        const playerBData = analysis.playerB || {};
        
        // 使用安全的数据处理函数
        const playerAErrors = this.safeParseBackendData(playerAData.errorTypes, []);
        const playerBErrors = this.safeParseBackendData(playerBData.errorTypes, []);
        
        return `
            <div class="round-analysis-card">
                <div class="round-card-header">
                    <div class="round-number">Round ${round.id}</div>
                    <div class="round-score">${round.playerAScore} - ${round.playerBScore}</div>
                    <div class="round-winner">🏆 ${winnerName}</div>
                </div>
                
                <div class="round-card-content">
                    <div class="round-player-analysis">
                        <div class="round-player">
                            <div class="round-player-header">
                                <span class="player-icon">🔵</span>
                                <span class="player-name">${this.getPlayerName(this.currentGame, 'playerA')}</span>
                            </div>
                            <div class="round-player-errors">
                                ${playerAErrors.length > 0 ? 
                                    playerAErrors.map(error => 
                                        `<span class="round-error-badge">${this.translateErrorType(error)}</span>`
                                    ).join('') :
                                    '<span class="no-errors">No issues</span>'
                                }
                            </div>
                        </div>
                        
                        <div class="round-player">
                            <div class="round-player-header">
                                <span class="player-icon">🔴</span>
                                <span class="player-name">${this.getPlayerName(this.currentGame, 'playerB')}</span>
                            </div>
                            <div class="round-player-errors">
                                ${playerBErrors.length > 0 ? 
                                    playerBErrors.map(error => 
                                        `<span class="round-error-badge">${this.translateErrorType(error)}</span>`
                                    ).join('') :
                                    '<span class="no-errors">No issues</span>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 收集玩家的所有错误类型
    collectPlayerErrors(playerKey, rounds) {
        const errorTypes = new Set();
        
        // 安全地处理错误类型数据
        const safeProcessErrorTypes = (errorTypesData) => {
            const processedTypes = this.safeParseBackendData(errorTypesData, []);
            processedTypes.forEach(type => 
                errorTypes.add(this.translateErrorType(type))
            );
        };
        
        // 游戏级别错误
        if (this.currentGame && this.currentGame.backendAnalysis && this.currentGame.backendAnalysis[playerKey]) {
            const gameErrorTypes = this.currentGame.backendAnalysis[playerKey].errorTypes;
            safeProcessErrorTypes(gameErrorTypes);
        }
        
        // 轮次级别错误
        rounds.forEach(round => {
            if (round.backendAnalysis && round.backendAnalysis[playerKey]) {
                const roundErrorTypes = round.backendAnalysis[playerKey].errorTypes;
                safeProcessErrorTypes(roundErrorTypes);
            }
        });
        
        return Array.from(errorTypes);
    }
    
    formatPlayerAnalysis(playerData) {
        // 确保playerData存在并且errorTypes和analysis是数组
        const safePlayerData = playerData || {};
        
        // 使用安全的数据处理函数
        const errorTypes = this.safeParseBackendData(safePlayerData.errorTypes, []);
        const analysis = this.safeParseBackendData(safePlayerData.analysis, []);
        
        let content = '';
        
        if (errorTypes.length > 0) {
            content += `
                <div class="error-types-section">
                    <h5>🎯 Identified Issues</h5>
                    <div class="error-types">
                        ${errorTypes.map(errorType => 
                            `<span class="error-type-badge">${this.translateErrorType(errorType)}</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        if (analysis.length > 0) {
            content += `
                <div class="analysis-suggestions">
                    <h5>💡 Improvement Suggestions</h5>
                    <ul class="suggestions-list">
                        ${analysis.map(suggestion => 
                            `<li>${this.translateAnalysisSuggestion(suggestion)}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (!content) {
            content = '<div class="no-issues">✅ No major issues identified</div>';
        }
        
        return content;
    }
    

    
    // 工具函数
    getPlayerName(game, playerType) {
        if (!game || !playerType) return '';
        
        const playerNames = game.playerNames || {
            playerA: 'Player A',
            playerB: 'Player B'
        };
        
        if (playerType === 'playerA') {
            return playerNames.playerA;
        } else if (playerType === 'playerB') {
            return playerNames.playerB;
        }
        
        return `Player ${playerType.slice(-1)}`;
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
    
    getWinnerName() {
        if (!this.currentGame || !this.currentGame.winner) return '';
        
        const playerNames = this.currentGame.playerNames || {
            playerA: 'Player A',
            playerB: 'Player B'
        };
        
        if (this.currentGame.winner === 'playerA') {
            return playerNames.playerA;
        } else if (this.currentGame.winner === 'playerB') {
            return playerNames.playerB;
        }
        
        return `Player ${this.currentGame.winner.slice(-1)}`;
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
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    displayNoGameMessage() {
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        container.innerHTML = `
            <div class="no-game-selected">
                <div class="no-game-icon">🎮</div>
                <h3>No Game Selected</h3>
                <p>Please select a game from the dropdown above to view detailed analysis.</p>
                ${this.games.length === 0 ? 
                    '<p><em>No games available. Start a new game to begin analysis.</em></p>' : 
                    '<p><em>Choose from available games in the selector.</em></p>'
                }
            </div>
        `;
    }
    
    displayWaitingForAnalysis() {
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        const selectedGame = document.getElementById('gameSelector').value;
        if (!selectedGame) return;
        
        container.innerHTML = `
            <div class="waiting-for-analysis">
                <div class="waiting-icon">⏳</div>
                <h3>Game Selected</h3>
                <p>Click the <strong>"Analyze Game"</strong> button to view detailed analysis.</p>
                <p><em>Selected game: ${selectedGame}</em></p>
            </div>
        `;
    }
    
    // 测试函数
    testBackendConnection() {
        console.log('🧪 Testing Backend Connection...');
        
        // 测试游戏分析API
        fetch(`${CONFIG.API_URLS.ANALYSIS_GAME}?gid=11`)
            .then(response => {
                console.log('📡 Game Analysis API Response:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('✅ Game Analysis Data:', data);
            })
            .catch(error => {
                console.error('❌ Game Analysis Error:', error);
            });
        
        // 测试轮次分析API
        fetch(CONFIG.getRoundAnalysisUrl(11))
            .then(response => {
                console.log('📡 Round Analysis API Response:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('✅ Round Analysis Data:', data);
            })
            .catch(error => {
                console.error('❌ Round Analysis Error:', error);
            });
    }
    
    testErrorTypeTranslation() {
        console.log('🧪 Testing Error Type Translation...');
        
        const backendErrorTypes = ['Slow Reaction', 'Low Activity', 'Weak Defense', 'Poor Alignment', 'Coverage Gap'];
        
        backendErrorTypes.forEach(errorType => {
            const translated = this.translateErrorType(errorType);
            console.log(`  ${errorType} → ${translated}`);
        });
        
        console.log('✅ Error type translation test completed');
    }
}

// 初始化分析管理器
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Analysis Manager...');
    window.analysisManager = new AnalysisManager();
    console.log('✅ Analysis Manager initialized');
});

// 为了向后兼容，保留旧的全局函数
function addRound(round) {
    if (window.analysisManager) {
        window.analysisManager.refreshAnalysis();
    }
}

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnalysisManager };
}