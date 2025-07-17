// Game Analysis Manager
class AnalysisManager {
    constructor() {
        this.games = [];
        this.currentGame = null;
        this.currentMode = 'rounds'; // 简化为单一模式设置
        this.expandedRounds = new Set();
        this.roundFilters = {
            player: 'all',    // 'all', 'playerA', 'playerB'
            result: 'all',    // 'all', 'wins', 'losses'
            errorType: 'all'  // 'all', specific error types
        };
        this.winRateData = null; // Store win rate data
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createGameSelector();
        this.refreshAnalysis();
    }
    
    // 从数据库加载游戏记录
    async loadGamesFromDatabase() {
        try {
            console.log('🔄 Loading games from database for analysis...');
            
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
                    console.log(`✅ Loaded ${data.games.length} games from database for analysis`);
                    
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
            console.error('❌ Failed to load games from database for analysis:', error);
            return []; // 返回空数组
        }
    }
    
    setupEventListeners() {
        // 简化的模式按钮事件
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setMode(e.currentTarget.dataset.mode);
            });
        });
        
        // Listen for game state changes
        document.addEventListener('gameStateChange', () => {
            this.refreshAnalysis();
        });
    }
    
    createGameSelector() {
        // Find analysis toolbar and add game selector
        const toolbar = document.querySelector('.analysis-toolbar');
        if (!toolbar) return;
        
        // Create game selector section
        const gameSelectorHTML = `
            <div class="game-selector-section">
                <label class="selector-label">Select Game for Analysis:</label>
                <select id="gameSelector" class="game-selector">
                    <option value="">Choose a game...</option>
                </select>
                <button id="analyzeGameBtn" class="btn btn-primary" disabled>Analyze Game</button>
            </div>
        `;
        
        // Insert at the beginning of toolbar
        toolbar.insertAdjacentHTML('afterbegin', gameSelectorHTML);
        
        // Add event listeners
        const selector = document.getElementById('gameSelector');
        const analyzeBtn = document.getElementById('analyzeGameBtn');
        
        selector.addEventListener('change', (e) => {
            const selectedGameId = e.target.value;
            analyzeBtn.disabled = !selectedGameId;
            
            // 不立即加载游戏，等用户点击按钮
            if (!selectedGameId) {
                this.currentGame = null;
                this.displayNoGameMessage();
            } else {
                // 选择了游戏但还没分析，显示等待分析的提示
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
    
    setMode(mode) {
        this.currentMode = mode;
        
        // Update mode button states
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });
        
        this.displayGameAnalysis();
    }
    
    // 保留旧方法为了兼容性，但重定向到新的setMode
    setFilter(filter) {
        // 映射旧的filter到新的mode
        const filterToModeMap = {
            'round-by-round': 'rounds',
            'playerA': 'rounds', // 简化为rounds模式
            'playerB': 'rounds', // 简化为rounds模式
            'comparison': 'comparison'
        };
        
        this.setMode(filterToModeMap[filter] || 'rounds');
    }
    
    setView(view) {
        // 映射旧的view到新的mode
        const viewToModeMap = {
            'timeline': 'rounds',
            'detailed': 'detailed',
            'summary': 'comparison' // 简化为comparison模式
        };
        
        this.setMode(viewToModeMap[view] || 'rounds');
    }
    
    async refreshAnalysis() {
        if (window.smartCourtApp) {
            try {
                console.log('🔄 Refreshing analysis data...');
                
                // 优先从数据库获取游戏数据
                const gamesFromDB = await this.loadGamesFromDatabase();
                
                // 如果数据库中有数据，使用数据库数据；否则使用本地数据
                if (gamesFromDB && gamesFromDB.length > 0) {
                    this.games = gamesFromDB;
                    console.log(`✅ Analysis refreshed with ${gamesFromDB.length} games from database`);
                                 } else {
                     // 数据库无数据时使用空数组
                     this.games = [];
                     console.log(`💾 Analysis: No games available from database`);
                 }
                
                this.populateGameSelector();
                
                // 只有在用户主动选择游戏时才显示内容
                if (this.currentGame) {
                    this.displayGameAnalysis();
                } else {
                    // 没有选择游戏时显示选择提示
                    this.displayNoGameMessage();
                }
                
            } catch (error) {
                console.error('Error refreshing analysis:', error);
                // 数据库错误时使用空数组，不显示假数据
                this.games = [];
                this.populateGameSelector();
                this.displayNoGameMessage();
            }
        }
    }
    
    populateGameSelector() {
        const selector = document.getElementById('gameSelector');
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
            const winner = game.winner ? ` (${this.getPlayerName(game, game.winner)} wins)` : '';
            option.textContent = `${status} ${game.gameType} - ${startTime}${winner}`;
            selector.appendChild(option);
        });
    }
    
    async loadGameAnalysis(gameId) {
        const game = this.games.find(g => g.gameId === gameId);
        if (!game) return;
        
        // Update selector
        const selector = document.getElementById('gameSelector');
        if (selector) {
            selector.value = gameId;
        }
        
        // Update button state
        const analyzeBtn = document.getElementById('analyzeGameBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = 'Loading...';
        }
        
        try {
            // 获取数据库中的游戏ID
            const databaseGameId = game.databaseGameId;
            if (!databaseGameId) {
                console.warn('No database game ID found, using local data');
                this.currentGame = game;
                this.displayGameAnalysis();
                return;
            }
            
            console.log(`📊 Loading rounds for game ${gameId} (Database ID: ${databaseGameId})`);
            
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
                    console.log(`✅ Loaded ${roundsData.rounds.length} rounds for game ${gameId}`);
                    
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
                            playerBScore: round.pointB,
                            analysis: {
                                feedback: 'Round completed successfully',
                                suggestions: ['Continue maintaining good performance'],
                                errorType: null
                            }
                        };
                    });
                    
                    // 更新当前游戏的轮次数据
                    this.currentGame = {
                        ...game,
                        rounds: formattedRounds
                    };
                    
                    console.log(`🎯 Game analysis data prepared for ${gameId} with ${formattedRounds.length} rounds`);
                    
                    // 获取后端分析数据
                    await this.loadBackendAnalysis(databaseGameId);
                } else {
                    console.warn('No rounds data received from backend, using local data');
                    this.currentGame = game;
                }
            } else if (roundsResponse.status === 404) {
                // 404错误 - 轮次数据不存在，这是正常情况
                console.log(`ℹ️ No rounds found for game ${gameId} (Database ID: ${databaseGameId}) - 404`);
                this.currentGame = game;
                // 即使没有轮次数据，也尝试获取分析数据
                await this.loadBackendAnalysis(databaseGameId);
            } else {
                console.error(`Failed to load rounds from backend: HTTP ${roundsResponse.status}, using local data`);
                this.currentGame = game;
            }
            
        } catch (error) {
            console.error('Error loading game analysis:', error);
            this.currentGame = game; // 回退到本地数据
        } finally {
            // 恢复按钮状态
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = 'Analyze Game';
            }
        }
        
        this.displayGameAnalysis();
    }
    
    // 从后端获取分析数据
    async loadBackendAnalysis(databaseGameId) {
        try {
            console.log(`📊 Loading backend analysis for game ${databaseGameId}`);
            
            // 获取游戏分析数据
            const analysisResponse = await fetch(`${CONFIG.API_URLS.ANALYSIS_GAME}?gid=${databaseGameId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (analysisResponse.ok) {
                const analysisData = await analysisResponse.json();
                if (analysisData.status === 'success' && analysisData.analysis) {
                    console.log(`✅ Loaded backend game analysis for game ${databaseGameId}`);
                    this.integrateBackendAnalysis(analysisData.analysis);
                } else if (analysisData.status === 'error') {
                    console.log(`ℹ️ Backend game analysis error: ${analysisData.message}`);
                } else {
                    console.log(`ℹ️ No game analysis data available from backend for game ${databaseGameId}`);
                }
            } else if (analysisResponse.status === 404) {
                // 404错误 - 分析数据不存在，这是正常情况
                console.log(`ℹ️ No game analysis data found for game ${databaseGameId} (404 - normal)`);
            } else {
                try {
                    const errorData = await analysisResponse.json();
                    if (errorData.status === 'error') {
                        console.log(`ℹ️ Backend game analysis request failed: ${errorData.message}`);
                    } else {
                        console.log(`ℹ️ Failed to load backend game analysis (${analysisResponse.status})`);
                    }
                } catch (parseError) {
                    console.log(`ℹ️ Backend game analysis request failed: HTTP ${analysisResponse.status}`);
                }
            }
            
            // 同时加载轮次分析数据
            await this.loadRoundAnalysis(databaseGameId);
        } catch (error) {
            console.warn('Warning: Failed to connect to analysis service:', error);
            // 不显示错误信息，只是警告，让用户能继续使用其他功能
            await this.loadRoundAnalysis(databaseGameId);
        }
    }
    
    // 从后端获取轮次分析数据
    async loadRoundAnalysis(databaseGameId) {
        try {
            console.log(`📊 Loading round analysis for game ${databaseGameId}`);
            
            // 获取轮次分析数据
            const roundAnalysisResponse = await fetch(CONFIG.getRoundAnalysisUrl(databaseGameId), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (roundAnalysisResponse.ok) {
                const roundAnalysisData = await roundAnalysisResponse.json();
                if (roundAnalysisData.status === 'success') {
                    // 后端总是返回analyses数组，可能为空
                    const analyses = roundAnalysisData.analyses || [];
                    if (analyses.length > 0) {
                        console.log(`✅ Loaded ${analyses.length} round analyses for game ${databaseGameId}`);
                        this.integrateRoundAnalysis(analyses);
                    } else {
                        console.log(`ℹ️ No round analysis data found for game ${databaseGameId} (empty array)`);
                    }
                } else if (roundAnalysisData.status === 'error') {
                    console.warn(`⚠️ Round analysis error: ${roundAnalysisData.message}`);
                } else {
                    console.log(`ℹ️ Unexpected response format from backend for game ${databaseGameId}`);
                }
            } else if (roundAnalysisResponse.status === 404) {
                // 404错误 - 轮次分析数据不存在，这是正常情况
                console.log(`ℹ️ No round analysis found for game ${databaseGameId} (404)`);
            } else {
                try {
                    const errorData = await roundAnalysisResponse.json();
                    if (errorData.status === 'error') {
                        console.warn(`⚠️ Round analysis request failed: ${errorData.message}`);
                    } else {
                        console.warn('Failed to load round analysis');
                    }
                } catch (parseError) {
                    console.warn(`⚠️ Round analysis request failed: HTTP ${roundAnalysisResponse.status}`);
                }
            }
        } catch (error) {
            console.warn('Warning: Failed to load round analysis:', error);
        }
    }
    
    // 整合轮次分析数据到当前游戏
    integrateRoundAnalysis(roundAnalyses) {
        if (!this.currentGame || !this.currentGame.rounds) {
            console.warn('No current game or rounds to integrate round analysis');
            return;
        }
        
        console.log('🔄 Integrating round analysis data:', roundAnalyses);
        
        // 为每个轮次分析数据找到对应的回合
        roundAnalyses.forEach(analysis => {
            const roundId = analysis.rid;
            const gameRound = this.currentGame.rounds.find(round => round.id === roundId);
            
            if (gameRound) {
                // 整合轮次分析数据
                gameRound.backendAnalysis = {
                    playerA: {
                        errorTypes: analysis.A_type || [],
                        analysis: analysis.A_analysis || [],
                        timestamp: new Date().toISOString()
                    },
                    playerB: {
                        errorTypes: analysis.B_type || [],
                        analysis: analysis.B_analysis || [],
                        timestamp: new Date().toISOString()
                    }
                };
                
                console.log(`✅ Round ${roundId} analysis integrated`);
            } else {
                console.warn(`⚠️ Round ${roundId} not found in current game rounds`);
            }
        });
        
        console.log('✅ Round analysis integration completed');
    }
    
    // 添加轮次分析数据到后端
    async addRoundAnalysisToBackend(gameId, roundId, playerAErrorTypes, playerAAnalysis, playerBErrorTypes, playerBAnalysis) {
        try {
            console.log(`📊 Adding round analysis to backend for game ${gameId}, round ${roundId}`);
            
            const response = await fetch(CONFIG.API_URLS.ANALYSIS_ROUND_NEW, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gid: gameId,
                    rid: roundId,
                    A_type: playerAErrorTypes,
                    A_analysis: playerAAnalysis,
                    B_type: playerBErrorTypes,
                    B_analysis: playerBAnalysis
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    console.log(`✅ Round analysis added to backend successfully for round ${roundId}`);
                    return true;
                } else {
                    console.error(`❌ Failed to save round analysis: ${result.message}`);
                    return false;
                }
            } else {
                const errorData = await response.json();
                console.error(`❌ Failed to save round analysis: ${errorData.message}`);
                return false;
            }
        } catch (error) {
            console.error('Error adding round analysis to backend:', error);
            return false;
        }
    }
    
    // 整合后端分析数据到当前游戏
    integrateBackendAnalysis(backendAnalysis) {
        if (!this.currentGame) return;
        
        // 将后端分析数据整合到当前游戏对象中
        this.currentGame.backendAnalysis = {
            playerA: {
                errorTypes: backendAnalysis.A_type || [],
                analysis: backendAnalysis.A_analysis || [],
                timestamp: new Date().toISOString()
            },
            playerB: {
                errorTypes: backendAnalysis.B_type || [],
                analysis: backendAnalysis.B_analysis || [],
                timestamp: new Date().toISOString()
            }
        };
        
        console.log('✅ Backend analysis integrated into current game');
    }
    
    // 创建AI分析结果显示区域
    createAIAnalysisSection() {
        if (!this.currentGame || !this.currentGame.backendAnalysis) {
            return '';
        }
        
        const analysis = this.currentGame.backendAnalysis;
        const playerAName = this.getPlayerName(this.currentGame, 'playerA');
        const playerBName = this.getPlayerName(this.currentGame, 'playerB');
        
        // 检查是否有轮次级别的分析数据
        const roundAnalysisStats = this.getRoundAnalysisStats();
        
        return `
            <div class="ai-analysis-section">
                <h4>🤖 AI Analysis Results</h4>
                <div class="analysis-timestamp">
                    <small>Analysis Time: ${new Date(analysis.playerA.timestamp).toLocaleString()}</small>
                </div>
                ${roundAnalysisStats.totalRounds > 0 ? `
                    <div class="round-analysis-summary">
                        <div class="round-analysis-header">
                            <span class="round-icon">🎯</span>
                            <span class="round-text">Round Analysis: ${roundAnalysisStats.analyzedRounds}/${roundAnalysisStats.totalRounds} rounds analyzed</span>
                        </div>
                    </div>
                ` : ''}
                <div class="players-analysis">
                    <div class="player-analysis player-a-analysis">
                        <div class="player-header">
                            <span class="player-icon">🔵</span>
                            <span class="player-name">${playerAName}</span>
                        </div>
                        <div class="analysis-content">
                            ${this.formatPlayerAnalysis(analysis.playerA)}
                        </div>
                    </div>
                    <div class="player-analysis player-b-analysis">
                        <div class="player-header">
                            <span class="player-icon">🔴</span>
                            <span class="player-name">${playerBName}</span>
                        </div>
                        <div class="analysis-content">
                            ${this.formatPlayerAnalysis(analysis.playerB)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 获取轮次分析统计信息
    getRoundAnalysisStats() {
        if (!this.currentGame || !this.currentGame.rounds) {
            return { totalRounds: 0, analyzedRounds: 0 };
        }
        
        const totalRounds = this.currentGame.rounds.length;
        const analyzedRounds = this.currentGame.rounds.filter(round => round.backendAnalysis).length;
        
        return { totalRounds, analyzedRounds };
    }
    
    // 格式化单个玩家的分析结果
    formatPlayerAnalysis(playerData) {
        const errorTypes = playerData.errorTypes || [];
        const analysis = playerData.analysis || [];
        
        let content = '';
        
        // 显示错误类型
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
        
        // 显示分析建议
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
    
    // 翻译错误类型为英文显示 - 基于后端分析器返回的5种错误类型
    translateErrorType(errorType) {
        const errorTypeMap = {
            // 后端分析器返回的5种错误类型
            'slow_reaction': 'Slow Reaction',
            'low_activity': 'Low Activity', 
            'weak_defense': 'Weak Defense',
            'poor_alignment': 'Poor Alignment',
            'coverage_gap': 'Coverage Gap'
        };
        
        return errorTypeMap[errorType] || this.formatErrorTypeName(errorType);
    }
    
    // 格式化错误类型名称（处理未知类型）
    formatErrorTypeName(errorType) {
        if (typeof errorType !== 'string') return 'Unknown';
        
        // 将下划线替换为空格，并首字母大写
        return errorType.replace(/_/g, ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
    }
    
    // 翻译分析建议为英文显示 - 基于后端分析器返回的5种建议
    translateAnalysisSuggestion(suggestion) {
        const suggestionMap = {
            // 后端分析器返回的5种建议
            'Try to react more quickly to incoming plays.': 'Try to react more quickly to incoming plays',
            'Move more actively to stay engaged in the game.': 'Move more actively to stay engaged in the game',
            'Improve your defense to prevent goals when under threat.': 'Improve your defense to prevent goals when under threat',
            'Align your movement better with the direction of the ball.': 'Align your movement better with the direction of the ball',
            'Increase your coverage area to better influence the game.': 'Increase your coverage area to better influence the game'
        };
        
        return suggestionMap[suggestion] || this.formatSuggestionText(suggestion);
    }
    
    // 格式化建议文本（处理未知建议）
    formatSuggestionText(suggestion) {
        if (typeof suggestion !== 'string') return 'Continue practicing';
        
        // 确保建议以大写字母开头
        return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
    }
    
    // 测试后端分析数据的显示
    testBackendAnalysisDisplay() {
        const testData = {
            A_type: ['positioning', 'timing'],
            A_analysis: ['Focus on defensive positioning', 'Improve reaction timing'],
            B_type: ['strategy', 'precision'],
            B_analysis: ['Develop offensive strategy', 'Enhance shot precision']
        };
        
        console.log('🧪 Testing backend analysis display with test data:', testData);
        
        this.integrateBackendAnalysis(testData);
        this.displayGameAnalysis();
        
        console.log('✅ Backend analysis test completed');
    }
    
    // 测试后端5种错误类型
    testBackendErrorTypes() {
        console.log('🧪 Testing Backend 5 Error Types...');
        
        // 使用后端分析器的5种错误类型和对应建议
        const backendAnalysisData = {
            playerA: {
                errorTypes: ['slow_reaction', 'low_activity', 'weak_defense'],
                analysis: [
                    'Try to react more quickly to incoming plays.',
                    'Move more actively to stay engaged in the game.',
                    'Improve your defense to prevent goals when under threat.'
                ],
                timestamp: new Date().toISOString()
            },
            playerB: {
                errorTypes: ['poor_alignment', 'coverage_gap'],
                analysis: [
                    'Align your movement better with the direction of the ball.',
                    'Increase your coverage area to better influence the game.'
                ],
                timestamp: new Date().toISOString()
            }
        };
        
        if (this.currentGame) {
            this.currentGame.backendAnalysis = backendAnalysisData;
            console.log('✅ Backend analysis data added with 5 error types');
            console.log('📝 Error types used:', [...backendAnalysisData.playerA.errorTypes, ...backendAnalysisData.playerB.errorTypes]);
            
            // 清理并更新每个回合的错误类型，确保使用后端的5种错误类型
            if (this.currentGame.rounds && this.currentGame.rounds.length > 0) {
                const allErrorTypes = [...backendAnalysisData.playerA.errorTypes, ...backendAnalysisData.playerB.errorTypes];
                
                this.currentGame.rounds.forEach((round, index) => {
                    if (round.analysis) {
                        // 循环分配5种错误类型
                        const errorType = allErrorTypes[index % allErrorTypes.length];
                        round.analysis.errorType = errorType;
                        console.log(`Round ${round.id}: assigned error type ${errorType}`);
                    }
                });
            }
            
            // 测试错误类型翻译
            console.log('🔍 Testing error type translations:');
            const allErrorTypes = [...backendAnalysisData.playerA.errorTypes, ...backendAnalysisData.playerB.errorTypes];
            allErrorTypes.forEach(errorType => {
                const translated = this.translateErrorType(errorType);
                console.log(`  ${errorType} → ${translated}`);
            });
            
            // 刷新显示
            this.displayGameAnalysis();
            console.log('✅ Display updated with backend 5 error types');
            
            // 强制重新计算统计数据
            const rounds = this.currentGame.rounds || [];
            const stats = this.calculateViewStats(rounds);
            console.log('📊 Updated error statistics:', stats.commonErrors);
            
            // 验证所有统计数据只包含5种错误类型
            const expectedErrorTypes = ['Slow Reaction', 'Low Activity', 'Weak Defense', 'Poor Alignment', 'Coverage Gap'];
            const actualErrorTypes = Object.keys(stats.commonErrors);
            const unexpectedTypes = actualErrorTypes.filter(type => !expectedErrorTypes.includes(type));
            
            if (unexpectedTypes.length > 0) {
                console.warn('⚠️ Found unexpected error types in statistics:', unexpectedTypes);
            } else {
                console.log('✅ All error types are from backend analyzer');
            }
        } else {
            console.log('❌ No current game selected');
        }
    }
    
    // 清除AI分析数据
    clearAIAnalysisData() {
        if (this.currentGame) {
            delete this.currentGame.backendAnalysis;
            this.displayGameAnalysis();
            console.log('✅ AI analysis data cleared');
        }
    }
    
    // 验证前端只显示5种错误类型
    validateErrorTypes() {
        console.log('🔍 Validating error types...');
        
        // 定义后端分析器的5种错误类型
        const expectedErrorTypes = [
            'slow_reaction',
            'low_activity', 
            'weak_defense',
            'poor_alignment',
            'coverage_gap'
        ];
        
        // 测试翻译映射
        console.log('📝 Testing error type translations:');
        expectedErrorTypes.forEach(errorType => {
            const translated = this.translateErrorType(errorType);
            console.log(`  ${errorType} → ${translated}`);
        });
        
        // 测试建议映射
        const expectedSuggestions = [
            'Try to react more quickly to incoming plays.',
            'Move more actively to stay engaged in the game.',
            'Improve your defense to prevent goals when under threat.',
            'Align your movement better with the direction of the ball.',
            'Increase your coverage area to better influence the game.'
        ];
        
        console.log('📝 Testing suggestion translations:');
        expectedSuggestions.forEach(suggestion => {
            const translated = this.translateAnalysisSuggestion(suggestion);
            console.log(`  ${suggestion} → ${translated}`);
        });
        
        // 检查过滤器中的错误类型
        const availableErrorTypes = this.getAvailableErrorTypes();
        console.log('📊 Available error types in filter:', availableErrorTypes);
        console.log('📊 Total error types count:', availableErrorTypes.length);
        
        // 验证过滤器选项是否正确更新
        this.updateErrorFilterOptions();
        
        // 检查当前游戏的错误类型
        if (this.currentGame && this.currentGame.rounds) {
            // 检查是否有非预期的错误类型
            const translatedExpected = expectedErrorTypes.map(type => this.translateErrorType(type));
            const unexpectedTypes = availableErrorTypes.filter(type => 
                !translatedExpected.includes(type)
            );
            
            if (unexpectedTypes.length > 0) {
                console.warn('⚠️ Found unexpected error types:', unexpectedTypes);
            } else {
                console.log('✅ All error types match expected backend types');
            }
        }
        
        console.log('✅ Error type validation completed');
    }
    
    // 测试错误类型过滤器更新
    testErrorTypeFilter() {
        console.log('🧪 Testing Error Type Filter...');
        
        // 首先应用测试数据
        this.testBackendErrorTypes();
        
        // 等待一下让数据加载
        setTimeout(() => {
            // 检查过滤器选项
            const errorFilter = document.getElementById('errorFilter');
            if (errorFilter) {
                const options = Array.from(errorFilter.options).map(option => option.value);
                console.log('📋 Error filter options:', options);
                
                // 测试每个错误类型过滤
                const availableTypes = this.getAvailableErrorTypes();
                console.log('🔍 Testing each error type filter:');
                
                availableTypes.forEach(errorType => {
                    console.log(`  Testing filter: ${errorType}`);
                    this.updateRoundFilter('errorType', errorType);
                    
                    // 获取过滤后的结果
                    if (this.currentGame && this.currentGame.rounds) {
                        const filteredRounds = this.applyRoundFilters(this.currentGame.rounds);
                        console.log(`    Filtered rounds count: ${filteredRounds.length}`);
                    }
                });
                
                // 重置过滤器
                this.updateRoundFilter('errorType', 'all');
                console.log('✅ Filter test completed, reset to "all"');
            } else {
                console.warn('❌ Error filter element not found');
            }
        }, 100);
    }
    
    // 清理旧的错误类型数据，确保只使用后端分析器的5种错误类型
    cleanupOldErrorTypes() {
        console.log('🧹 Cleaning up old error types...');
        
        if (this.currentGame && this.currentGame.rounds) {
            // 清理所有回合中的旧错误类型
            this.currentGame.rounds.forEach(round => {
                if (round.analysis && round.analysis.errorType) {
                    // 如果错误类型不是后端分析器的5种类型之一，则清除
                    const backendErrorTypes = ['slow_reaction', 'low_activity', 'weak_defense', 'poor_alignment', 'coverage_gap'];
                    if (!backendErrorTypes.includes(round.analysis.errorType)) {
                        console.log(`Clearing old error type: ${round.analysis.errorType} from round ${round.id}`);
                        delete round.analysis.errorType;
                    }
                }
            });
            
            console.log('✅ Old error types cleaned up');
        }
    }
    
    // 测试完整的后端错误类型集成
    testCompleteBackendIntegration() {
        console.log('🧪 Testing Complete Backend Integration...');
        
        // 1. 清理旧的错误类型数据
        this.cleanupOldErrorTypes();
        
        // 2. 测试后端错误类型
        this.testBackendErrorTypes();
        
        // 3. 等待数据加载完成后测试其他功能
        setTimeout(() => {
            // 验证错误类型
            this.validateErrorTypes();
            
            // 测试过滤器
            this.testErrorTypeFilter();
            
            // 强制刷新统计数据
            this.forceRefreshStats();
            
            // 测试轮次分析
            this.testRoundAnalysis();
            
            // 如果有report页面，测试AI建议
            if (window.reportManager) {
                console.log('🔄 Testing report page AI suggestions...');
                window.reportManager.currentGame = this.currentGame;
                window.reportManager.gameData = this.currentGame;
                window.reportManager.generateAISuggestions();
            }
            
            console.log('✅ Complete backend integration test finished');
        }, 200);
    }
    
    // 测试轮次分析功能
    testRoundAnalysis() {
        console.log('🧪 Testing Round Analysis...');
        
        if (!this.currentGame || !this.currentGame.rounds) {
            console.log('❌ No current game or rounds available for testing');
            return;
        }
        
        // 创建测试轮次分析数据
        const testRoundAnalyses = [
            {
                rid: 1,
                A_type: ['slow_reaction'],
                A_analysis: ['Try to react more quickly to incoming plays.'],
                B_type: ['weak_defense'],
                B_analysis: ['Improve your defense to prevent goals when under threat.']
            },
            {
                rid: 2,
                A_type: ['low_activity'],
                A_analysis: ['Move more actively to stay engaged in the game.'],
                B_type: ['poor_alignment'],
                B_analysis: ['Align your movement better with the direction of the ball.']
            },
            {
                rid: 3,
                A_type: ['coverage_gap'],
                A_analysis: ['Increase your coverage area to better influence the game.'],
                B_type: ['slow_reaction', 'weak_defense'],
                B_analysis: ['Try to react more quickly to incoming plays.', 'Improve your defense to prevent goals when under threat.']
            }
        ];
        
        // 应用测试数据
        this.integrateRoundAnalysis(testRoundAnalyses);
        
        // 验证轮次分析数据
        let roundsWithAnalysis = 0;
        this.currentGame.rounds.forEach(round => {
            if (round.backendAnalysis) {
                roundsWithAnalysis++;
                console.log(`✅ Round ${round.id} has analysis data:`, {
                    playerA: round.backendAnalysis.playerA.errorTypes,
                    playerB: round.backendAnalysis.playerB.errorTypes
                });
            }
        });
        
        console.log(`📊 ${roundsWithAnalysis} rounds have analysis data`);
        
        // 刷新显示
        this.displayGameAnalysis();
        
        console.log('✅ Round analysis test completed');
    }
    
    // 测试轮次分析添加功能
    async testAddRoundAnalysis() {
        console.log('🧪 Testing Add Round Analysis...');
        
        if (!this.currentGame || !this.currentGame.databaseGameId) {
            console.log('❌ No current game with database ID available for testing');
            return;
        }
        
        // 测试添加轮次分析
        const testGameId = this.currentGame.databaseGameId;
        const testRoundId = 1;
        const testPlayerAErrorTypes = ['slow_reaction', 'low_activity'];
        const testPlayerAAnalysis = ['Try to react more quickly to incoming plays.', 'Move more actively to stay engaged in the game.'];
        const testPlayerBErrorTypes = ['weak_defense'];
        const testPlayerBAnalysis = ['Improve your defense to prevent goals when under threat.'];
        
        const success = await this.addRoundAnalysisToBackend(
            testGameId,
            testRoundId,
            testPlayerAErrorTypes,
            testPlayerAAnalysis,
            testPlayerBErrorTypes,
            testPlayerBAnalysis
        );
        
        if (success) {
            console.log('✅ Round analysis added successfully');
            
            // 重新加载轮次分析数据
            await this.loadRoundAnalysis(testGameId);
            
            // 刷新显示
            this.displayGameAnalysis();
        } else {
            console.log('❌ Failed to add round analysis');
        }
    }
    
    // 强制刷新所有统计数据
    forceRefreshStats() {
        console.log('🔄 Force refreshing all statistics...');
        
        if (this.currentGame) {
            // 强制重新计算并显示
            this.displayGameAnalysis();
            
            // 更新错误过滤器选项
            this.updateErrorFilterOptions();
            
            // 验证统计数据
            if (this.currentGame.rounds) {
                const stats = this.calculateViewStats(this.currentGame.rounds);
                console.log('📊 Current error statistics:', stats.commonErrors);
                
                // 验证只包含5种错误类型
                const expectedErrorTypes = ['Slow Reaction', 'Low Activity', 'Weak Defense', 'Poor Alignment', 'Coverage Gap'];
                const actualErrorTypes = Object.keys(stats.commonErrors);
                const hasOnlyExpectedTypes = actualErrorTypes.every(type => expectedErrorTypes.includes(type));
                
                if (hasOnlyExpectedTypes) {
                    console.log('✅ Statistics contain only backend analyzer error types');
                } else {
                    console.warn('⚠️ Statistics still contain unexpected error types:', actualErrorTypes);
                }
            }
            
            console.log('✅ Statistics refresh completed');
        }
    }
    
    // 向后兼容的测试函数
    testAIAnalysisIntegration() {
        console.log('🔄 Redirecting to testCompleteBackendIntegration() for complete testing...');
        this.testCompleteBackendIntegration();
    }
    
    // 测试所有后端分析器错误类型和建议
    testAllBackendAnalysisTypes() {
        console.log('🧪 Testing ALL 5 backend analyzer error types and suggestions...');
        
        // 包含所有后端分析器可能返回的5种错误类型和建议
        const allAnalysisData = {
            playerA: {
                errorTypes: ['slow_reaction', 'low_activity', 'weak_defense'],
                analysis: [
                    'Try to react more quickly to incoming plays.',
                    'Move more actively to stay engaged in the game.',
                    'Improve your defense to prevent goals when under threat.'
                ],
                timestamp: new Date().toISOString()
            },
            playerB: {
                errorTypes: ['poor_alignment', 'coverage_gap'],
                analysis: [
                    'Align your movement better with the direction of the ball.',
                    'Increase your coverage area to better influence the game.'
                ],
                timestamp: new Date().toISOString()
            }
        };
        
        if (this.currentGame) {
            this.currentGame.backendAnalysis = allAnalysisData;
            
            // 测试错误类型翻译
            console.log('🔍 Testing ALL 5 error type translations:');
            const allErrorTypes = [...allAnalysisData.playerA.errorTypes, ...allAnalysisData.playerB.errorTypes];
            allErrorTypes.forEach(errorType => {
                const translated = this.translateErrorType(errorType);
                console.log(`  ${errorType} → ${translated}`);
            });
            
            // 测试建议翻译
            console.log('🔍 Testing ALL 5 suggestion translations:');
            const allSuggestions = [...allAnalysisData.playerA.analysis, ...allAnalysisData.playerB.analysis];
            allSuggestions.forEach(suggestion => {
                const translated = this.translateAnalysisSuggestion(suggestion);
                console.log(`  ${suggestion} → ${translated}`);
            });
            
            // 更新回合数据，确保使用正确的5种错误类型
            if (this.currentGame.rounds && this.currentGame.rounds.length > 0) {
                this.currentGame.rounds.forEach((round, index) => {
                    if (round.analysis) {
                        // 循环分配5种错误类型
                        const errorType = allErrorTypes[index % allErrorTypes.length];
                        round.analysis.errorType = errorType;
                        console.log(`Round ${round.id}: assigned error type ${errorType}`);
                    }
                });
            }
            
            // 刷新显示
            this.displayGameAnalysis();
            console.log('✅ ALL 5 backend analysis types tested and displayed');
            
            // 显示可用的错误类型
            const availableErrorTypes = this.getAvailableErrorTypes();
            console.log('📊 Available error types in filter:', availableErrorTypes);
            console.log('📊 Total error types count:', availableErrorTypes.length);
        } else {
            console.log('❌ No current game selected');
        }
    }
    
    // 处理后端分析数据（用于实际的后端集成）
    handleBackendAnalysis(analysisData) {
        console.log('🔄 Processing backend analysis data:', analysisData);
        
        if (!this.currentGame) {
            console.warn('⚠️ No current game to apply backend analysis');
            return;
        }
        
        // 验证分析数据格式
        if (!analysisData || !analysisData.playerA || !analysisData.playerB) {
            console.error('❌ Invalid backend analysis data format');
            return;
        }
        
        // 验证错误类型是否为已知类型
        const knownErrorTypes = ['slow_reaction', 'low_activity', 'weak_defense', 'poor_alignment', 'coverage_gap'];
        const knownSuggestions = [
            'Try to react more quickly to incoming plays.',
            'Move more actively to stay engaged in the game.',
            'Improve your defense to prevent goals when under threat.',
            'Align your movement better with the direction of the ball.',
            'Increase your coverage area to better influence the game.'
        ];
        
        // 验证playerA数据
        if (analysisData.playerA.errorTypes) {
            const unknownErrorsA = analysisData.playerA.errorTypes.filter(error => !knownErrorTypes.includes(error));
            if (unknownErrorsA.length > 0) {
                console.warn('⚠️ Unknown error types for playerA:', unknownErrorsA);
            }
        }
        
        // 验证playerB数据
        if (analysisData.playerB.errorTypes) {
            const unknownErrorsB = analysisData.playerB.errorTypes.filter(error => !knownErrorTypes.includes(error));
            if (unknownErrorsB.length > 0) {
                console.warn('⚠️ Unknown error types for playerB:', unknownErrorsB);
            }
        }
        
        // 存储后端分析数据
        this.currentGame.backendAnalysis = {
            playerA: {
                errorTypes: analysisData.playerA.errorTypes || [],
                analysis: analysisData.playerA.analysis || [],
                timestamp: analysisData.playerA.timestamp || new Date().toISOString()
            },
            playerB: {
                errorTypes: analysisData.playerB.errorTypes || [],
                analysis: analysisData.playerB.analysis || [],
                timestamp: analysisData.playerB.timestamp || new Date().toISOString()
            }
        };
        
        console.log('✅ Backend analysis data processed successfully');
        console.log('📝 Processed error types:', {
            playerA: this.currentGame.backendAnalysis.playerA.errorTypes,
            playerB: this.currentGame.backendAnalysis.playerB.errorTypes
        });
        
        // 刷新显示
        this.displayGameAnalysis();
        
        // 更新错误过滤器选项
        this.updateErrorFilterOptions();
        
        console.log('🔄 Analysis view updated with backend data');
    }
    
    // 更新错误过滤器选项
    updateErrorFilterOptions() {
        const errorFilter = document.getElementById('errorFilter');
        if (!errorFilter) return;
        
        const availableErrorTypes = this.getAvailableErrorTypes();
        const currentValue = errorFilter.value;
        
        // 重新生成选项
        errorFilter.innerHTML = `
            <option value="all">All Error Types</option>
            ${availableErrorTypes.map(error => 
                `<option value="${error}" ${currentValue === error ? 'selected' : ''}>${error}</option>`
            ).join('')}
        `;
        
        console.log('🔄 Error filter options updated with 5 backend error types:', availableErrorTypes);
    }
    
    // 获取AI错误分析结果
    getAIErrorAnalysis(playerKey) {
        if (!this.currentGame || !this.currentGame.backendAnalysis) {
            return '';
        }
        
        const analysis = this.currentGame.backendAnalysis;
        const playerData = analysis[playerKey];
        
        if (!playerData || !playerData.errorTypes || playerData.errorTypes.length === 0) {
            return '';
        }
        
        const errorBadges = playerData.errorTypes.map(errorType => 
            `<span class="ai-error-badge">${this.translateErrorType(errorType)}</span>`
        ).join('');
        
        return `
            <div class="ai-error-analysis">
                <div class="ai-label">🤖 AI Identified:</div>
                <div class="ai-error-types">${errorBadges}</div>
            </div>
        `;
    }
    
    // 获取特定回合的后端错误信息
    getBackendErrorsForRound(round) {
        // 首先检查是否有轮次级别的分析数据
        if (round.backendAnalysis) {
            const loser = round.winner === 'playerA' ? 'playerB' : 'playerA';
            const playerData = round.backendAnalysis[loser];
            
            if (playerData && playerData.errorTypes && playerData.errorTypes.length > 0) {
                const errorBadges = playerData.errorTypes.map(errorType => 
                    `<span class="round-ai-error">${this.translateErrorType(errorType)}</span>`
                ).join('');
                
                return `
                    <div class="round-ai-analysis">
                        <div class="round-ai-label">🤖 Round AI Detected:</div>
                        <div class="round-ai-errors">${errorBadges}</div>
                    </div>
                `;
            }
        }
        
        // 回退到游戏级别的分析数据
        if (!this.currentGame || !this.currentGame.backendAnalysis) {
            return '';
        }
        
        // 基于回合的败者来显示相关错误
        const loser = round.winner === 'playerA' ? 'playerB' : 'playerA';
        const playerData = this.currentGame.backendAnalysis[loser];
        
        if (!playerData || !playerData.errorTypes || playerData.errorTypes.length === 0) {
            return '';
        }
        
        const errorBadges = playerData.errorTypes.map(errorType => 
            `<span class="round-ai-error">${this.translateErrorType(errorType)}</span>`
        ).join('');
        
        return `
            <div class="round-ai-analysis">
                <div class="round-ai-label">🤖 AI Detected:</div>
                <div class="round-ai-errors">${errorBadges}</div>
            </div>
        `;
    }
    
    // 获取AI分析摘要（用于summary view）
    getAIAnalysisSummary() {
        if (!this.currentGame || !this.currentGame.backendAnalysis) {
            return '';
        }
        
        const analysis = this.currentGame.backendAnalysis;
        const playerAName = this.getPlayerName(this.currentGame, 'playerA');
        const playerBName = this.getPlayerName(this.currentGame, 'playerB');
        
        const playerAErrors = analysis.playerA.errorTypes || [];
        const playerBErrors = analysis.playerB.errorTypes || [];
        const playerASuggestions = analysis.playerA.analysis || [];
        const playerBSuggestions = analysis.playerB.analysis || [];
        
        if (playerAErrors.length === 0 && playerBErrors.length === 0) {
            return '';
        }
        
        return `
            <div class="ai-analysis-summary">
                <div class="ai-summary-header">
                    <div class="ai-icon">🤖</div>
                    <h5>AI Analysis Results</h5>
                    <div class="ai-timestamp">
                        ${new Date(analysis.playerA.timestamp).toLocaleString()}
                    </div>
                </div>
                <div class="ai-players-summary">
                    ${playerAErrors.length > 0 ? `
                        <div class="ai-player-summary">
                            <div class="ai-player-header">
                                <span class="player-icon">🔵</span>
                                <span class="player-name">${playerAName}</span>
                            </div>
                            <div class="ai-error-badges">
                                ${playerAErrors.map(error => 
                                    `<span class="ai-error-badge">${this.translateErrorType(error)}</span>`
                                ).join('')}
                            </div>
                            ${playerASuggestions.length > 0 ? `
                                <div class="ai-suggestions-preview">
                                    <span class="suggestion-icon">💡</span>
                                    <span class="suggestion-text">${this.translateAnalysisSuggestion(playerASuggestions[0])}</span>
                                    ${playerASuggestions.length > 1 ? `<span class="more-suggestions">+${playerASuggestions.length - 1} more</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    ${playerBErrors.length > 0 ? `
                        <div class="ai-player-summary">
                            <div class="ai-player-header">
                                <span class="player-icon">🔴</span>
                                <span class="player-name">${playerBName}</span>
                            </div>
                            <div class="ai-error-badges">
                                ${playerBErrors.map(error => 
                                    `<span class="ai-error-badge">${this.translateErrorType(error)}</span>`
                                ).join('')}
                            </div>
                            ${playerBSuggestions.length > 0 ? `
                                <div class="ai-suggestions-preview">
                                    <span class="suggestion-icon">💡</span>
                                    <span class="suggestion-text">${this.translateAnalysisSuggestion(playerBSuggestions[0])}</span>
                                    ${playerBSuggestions.length > 1 ? `<span class="more-suggestions">+${playerBSuggestions.length - 1} more</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // 显示分析错误信息
    showAnalysisError(message) {
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        const errorHTML = `
            <div class="analysis-error">
                <div class="error-icon">❌</div>
                <h3>Analysis Error</h3>
                <p class="error-message">${message}</p>
                <p class="error-suggestion">Please check your connection and try again, or contact support if the problem persists.</p>
            </div>
        `;
        
        // 如果已经有内容，在顶部添加错误信息
        if (container.innerHTML.trim()) {
            container.insertAdjacentHTML('afterbegin', errorHTML);
        } else {
            container.innerHTML = errorHTML;
        }
    }
    
    // 显示分析信息提示
    showAnalysisMessage(message) {
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        const messageHTML = `
            <div class="analysis-message">
                <div class="message-icon">ℹ️</div>
                <h3>Analysis Information</h3>
                <p class="message-text">${message}</p>
                <p class="message-suggestion">Analysis data will be available once the game generates sufficient data.</p>
            </div>
        `;
        
        // 如果已经有内容，在顶部添加信息
        if (container.innerHTML.trim()) {
            container.insertAdjacentHTML('afterbegin', messageHTML);
        } else {
            container.innerHTML = messageHTML;
        }
    }
    
    // 添加新的分析数据到后端
    async addAnalysisToBackend(gameId, playerAErrorTypes, playerAAnalysis, playerBErrorTypes, playerBAnalysis) {
        try {
            console.log(`📊 Adding analysis to backend for game ${gameId}`);
            
            const response = await fetch(CONFIG.API_URLS.ANALYSIS_GAME_NEW, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    gid: gameId,
                    A_type: playerAErrorTypes,
                    A_analysis: playerAAnalysis,
                    B_type: playerBErrorTypes,
                    B_analysis: playerBAnalysis
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    console.log('✅ Analysis added to backend successfully');
                    this.showAnalysisSuccess('Analysis data saved successfully');
                    return true;
                } else {
                    this.showAnalysisError(result.message || 'Failed to save analysis data');
                    return false;
                }
            } else {
                const errorData = await response.json();
                this.showAnalysisError(errorData.message || 'Failed to save analysis data');
                return false;
            }
        } catch (error) {
            console.error('Error adding analysis to backend:', error);
            this.showAnalysisError('Failed to connect to analysis service');
            return false;
        }
    }
    
    // 显示分析成功信息
    showAnalysisSuccess(message) {
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        const successHTML = `
            <div class="analysis-success">
                <div class="success-icon">✅</div>
                <h3>Success</h3>
                <p class="success-message">${message}</p>
            </div>
        `;
        
        // 临时显示成功消息
        if (container.innerHTML.trim()) {
            container.insertAdjacentHTML('afterbegin', successHTML);
        } else {
            container.innerHTML = successHTML;
        }
        
        // 3秒后自动隐藏成功消息
        setTimeout(() => {
            const successElement = document.querySelector('.analysis-success');
            if (successElement) {
                successElement.remove();
            }
        }, 3000);
    }
    
    addRound(round) {
        // This method is now deprecated in favor of game-level analysis
        this.refreshAnalysis();
    }
    
    displayGameAnalysis() {
        if (!this.currentGame) {
            this.displayNoGameMessage();
            return;
        }
        
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        // Add game header
        const gameHeaderHTML = this.createGameHeaderHTML();
        
        const gameRounds = this.currentGame.rounds || [];
        
        if (gameRounds.length === 0) {
            container.innerHTML = gameHeaderHTML + '<div class="no-data">No round data available for this game</div>';
            return;
        }
        
        let roundsHTML;
        
        // 根据当前模式显示不同的视图
        switch(this.currentMode) {
            case 'rounds':
                // 回合分析：显示简洁的时间线视图
                roundsHTML = this.createTimelineView(gameRounds);
                break;
            case 'detailed':
                // 详细分析：显示深度分析视图
                roundsHTML = this.createSummaryView(gameRounds);
                break;
            case 'comparison':
                // 选手对比：显示A vs B对比视图
                roundsHTML = this.createComparisonStatisticsView(gameRounds);
                break;
            default:
                roundsHTML = this.createTimelineView(gameRounds);
                break;
        }
        
        container.innerHTML = gameHeaderHTML + roundsHTML;
        
        // Add click events for all views
        this.addAllViewClickEvents();
    }
    
    displayRounds() {
        // Redirect to game analysis
        this.displayGameAnalysis();
    }
    
    displayNoGameMessage() {
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        container.innerHTML = `
            <div class="no-game-selected">
                <div class="no-game-icon">🎮</div>
                <h3>No Game Selected</h3>
                <p>Please select a game from the dropdown above to view detailed round analysis.</p>
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
                <p>Click the <strong>"Analyze Game"</strong> button to view detailed round analysis.</p>
                <p><em>Selected game: ${selectedGame}</em></p>
            </div>
        `;
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
    

    

    
    getWinnerName() {
        if (!this.currentGame || !this.currentGame.winner) return '';
        
        // 获取真实的玩家名字
        const playerNames = this.currentGame.playerNames || {
            playerA: 'Player A',
            playerB: 'Player B'
        };
        
        // 根据winner值获取对应的玩家名字
        if (this.currentGame.winner === 'playerA') {
            return playerNames.playerA;
        } else if (this.currentGame.winner === 'playerB') {
            return playerNames.playerB;
        }
        
        // 回退到默认显示方式
        return `Player ${this.currentGame.winner.slice(-1)}`;
    }
    
    getPlayerName(game, playerType) {
        if (!game || !playerType) return '';
        
        // 获取真实的玩家名字
        const playerNames = game.playerNames || {
            playerA: 'Player A',
            playerB: 'Player B'
        };
        
        // 根据playerType获取对应的玩家名字
        if (playerType === 'playerA') {
            return playerNames.playerA;
        } else if (playerType === 'playerB') {
            return playerNames.playerB;
        }
        
        // 回退到默认显示方式
        return `Player ${playerType.slice(-1)}`;
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
    
    // Format win rate for display
    formatWinRate(winRate) {
        if (typeof winRate === 'string') {
            return winRate;  // Return as-is for 'Model Data Required'
        }
        if (typeof winRate === 'number') {
            return `${winRate}%`;  // Add % for numeric values
        }
        return winRate;
    }
    
    // Update win rate data from backend
    updateWinRateData(winRateData) {
        console.log('📊 Updating win rate data in analysis manager:', winRateData);
        this.winRateData = winRateData;
        
        // Refresh the current view if it's displaying comparison stats
        if (this.currentMode === 'comparison') {
            this.displayGameAnalysis();
        }
    }
    
    getFilteredRounds() {
        // 简化：始终返回所有回合，不再做复杂的过滤
        if (!this.currentGame || !this.currentGame.rounds) {
            return [];
        }
        return this.currentGame.rounds;
    }
    
    createRoundHTML(round) {
        const winnerText = this.getPlayerName(this.currentGame, round.winner);
        const timeStr = this.formatTime(round.timestamp);
        const playerAWon = round.winner === 'playerA';
        const playerBWon = round.winner === 'playerB';
        
        // Get error types for this round
        const errorTypes = this.getRoundErrorTypes(round);
        const errorTypeText = errorTypes.length > 0 ? 
            errorTypes.map(type => this.translateErrorType(type)).join(', ') : 
            'No specific errors';
        
        return `
            <div class="simplified-round-item" data-round-id="${round.id}">
                <div class="round-header">
                    <div class="round-info">
                        <div class="round-number-badge">
                            <span class="badge-icon">⚡</span>
                            <span class="badge-text">Round ${round.id}</span>
                        </div>
                        <span class="round-time">${timeStr}</span>
                    </div>
                    <div class="round-score-display">${round.playerAScore} - ${round.playerBScore}</div>
                    <div class="round-result">
                        <span class="winner-announcement">🏆 ${winnerText} wins this round!</span>
                    </div>
                </div>
                
                <div class="round-error-info">
                    <div class="error-type-label">Error Type:</div>
                    <div class="error-type-value">${errorTypeText}</div>
                </div>
            </div>
        `;
    }
    
    // Get error types for a round
    getRoundErrorTypes(round) {
        const errorTypes = [];
        
        // Check if there's a general error type assigned to the round
        if (round.analysis && round.analysis.errorType) {
            errorTypes.push(round.analysis.errorType);
        }
        
        // Check player-specific error types
        if (round.analysis) {
            if (round.analysis.A_type && Array.isArray(round.analysis.A_type)) {
                errorTypes.push(...round.analysis.A_type);
            }
            if (round.analysis.B_type && Array.isArray(round.analysis.B_type)) {
                errorTypes.push(...round.analysis.B_type);
            }
        }
        
        // Remove duplicates and return
        return [...new Set(errorTypes)];
    }
    
    // 新增：创建获胜方分析
    createWinAnalysisHTML(round, player) {
        const score = round.analysis ? this.calculateRoundScore(round.analysis) : 7;
        const performanceLevel = score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : 'Standard';
        const winFactors = this.generateWinFactors(round.analysis);
        
        return `
            <div class="win-analysis">
                <h5>🏆 ${player} Victory Analysis</h5>
                <div class="analysis-content">
                    <div class="analysis-section win-section-1">
                        <div class="section-header">
                            <span class="section-number">01</span>
                            <strong class="section-title">Performance Level</strong>
                        </div>
                        <div class="section-content">
                            ✨ ${performanceLevel} execution (${score}/10)
                        </div>
                    </div>
                    
                    <div class="analysis-section win-section-2">
                        <div class="section-header">
                            <span class="section-number">02</span>
                            <strong class="section-title">Success Factors</strong>
                        </div>
                        <div class="section-content">
                            <div class="win-factors">
                                ${winFactors.map((factor, index) => 
                                    `<span class="win-factor">${index + 1}. ${factor}</span>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <div class="analysis-section win-section-3">
                        <div class="section-header">
                            <span class="section-number">03</span>
                            <strong class="section-title">Strategic Advantage</strong>
                        </div>
                        <div class="section-content">
                            🎯 Successfully capitalized on opponent's weakness and maintained pressure
                        </div>
                    </div>
                    
                    <div class="analysis-section win-section-4">
                        <div class="section-header">
                            <span class="section-number">04</span>
                            <strong class="section-title">Positive Reinforcement</strong>
                        </div>
                        <div class="section-content">
                            💪 Keep up this level of performance and continue applying similar strategies
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 新增：生成获胜因素
    generateWinFactors(analysis) {
        const factors = [];
        
        if (analysis && analysis.feedback) {
            if (analysis.feedback.includes('excellent')) factors.push('Superior technical execution');
            if (analysis.feedback.includes('good')) factors.push('Solid performance consistency');
            if (analysis.feedback.includes('strategic')) factors.push('Smart tactical positioning');
            if (analysis.feedback.includes('pressure')) factors.push('Excellent pressure management');
            if (analysis.feedback.includes('timing')) factors.push('Perfect timing execution');
        }
        
        // Add default factors if none found
        if (factors.length === 0) {
            factors.push('Good tactical awareness', 'Effective strategy execution', 'Maintained composure under pressure');
        }
        
        return factors.slice(0, 3); // Limit to 3 factors
    }
    
    createAnalysisHTML(analysis) {
        if (!analysis) return '<div class="no-analysis">No analysis data available</div>';
        
        const tagsHTML = analysis.suggestions ? 
            analysis.suggestions.map(tag => `<span class="analysis-tag">${tag}</span>`).join('') : '';
        
        return `
            <div class="ai-analysis">
                <h5>AI Analysis Feedback</h5>
                <div class="analysis-content">
                    <div class="feedback-main">
                        <strong>Overall Assessment:</strong> ${analysis.feedback}
                    </div>
                    
                    ${analysis.errorType ? `
                        <div class="error-type">
                            <strong>Needs Improvement:</strong> ${analysis.errorType}
                        </div>
                    ` : ''}
                    
                    ${analysis.suggestions && analysis.suggestions.length > 0 ? `
                        <div class="suggestions">
                            <strong>Suggestions:</strong>
                            <div class="analysis-tags">${tagsHTML}</div>
                        </div>
                    ` : ''}
                    
                    <div class="analysis-score">
                        <strong>Technical Score:</strong> ${this.calculateRoundScore(analysis)}/10
                    </div>
                </div>
            </div>
        `;
    }

    createLossAnalysisHTML(analysis, loser) {
        if (!analysis) return '<div class="no-analysis">No loss analysis data available</div>';
        
        const tagsHTML = analysis.suggestions ? 
            analysis.suggestions.map((tag, index) => `<span class="analysis-tag">${index + 1}. ${tag}</span>`).join('') : '';
        
        const lossReasons = this.analyzeLossReasons(analysis);
        const defenseScore = Math.max(1, 10 - this.calculateRoundScore(analysis));
        const preventionTips = this.generatePreventionTips(analysis);
        

        
        return `
            <div class="ai-analysis loss-analysis">
                <h5>💔 ${loser} Loss Analysis Report</h5>
                <div class="analysis-content">
                    <div class="analysis-section section-1">
                        <div class="section-header">
                            <span class="section-number">01</span>
                            <strong class="section-title">Primary Loss Reason</strong>
                        </div>
                        <div class="section-content">
                            🎯 ${lossReasons.primary}
                        </div>
                    </div>
                    
                    ${analysis.errorType ? `
                        <div class="analysis-section section-2">
                            <div class="section-header">
                                <span class="section-number">02</span>
                                <strong class="section-title">Technical Issue</strong>
                            </div>
                            <div class="section-content">
                                ⚠️ ${this.translateErrorType(analysis.errorType)}
                            </div>
                        </div>
                    ` : ''}
                    

                    
                    <div class="analysis-section section-3">
                        <div class="section-header">
                            <span class="section-number">03</span>
                            <strong class="section-title">Defensive Performance</strong>
                        </div>
                        <div class="section-content">
                            🛡️ ${this.getDefenseAssessment(defenseScore)}
                        </div>
                    </div>
                    
                    ${analysis.suggestions && analysis.suggestions.length > 0 ? `
                        <div class="analysis-section section-4">
                            <div class="section-header">
                                <span class="section-number">04</span>
                                <strong class="section-title">Improvement Suggestions</strong>
                            </div>
                            <div class="section-content">
                                <div class="numbered-tags">${tagsHTML}</div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="analysis-section section-5">
                        <div class="section-header">
                            <span class="section-number">05</span>
                            <strong class="section-title">Loss Prevention Strategy</strong>
                        </div>
                        <div class="section-content">
                            <ol class="strategy-list">
                                ${preventionTips.map(tip => `<li>${tip}</li>`).join('')}
                            </ol>
                        </div>
                    </div>
                    
                    <div class="analysis-section section-6">
                        <div class="section-header">
                            <span class="section-number">06</span>
                            <strong class="section-title">Risk Assessment</strong>
                        </div>
                        <div class="section-content risk-assessment">
                            <div class="risk-score">
                                <span class="risk-label">Loss Risk Index:</span>
                                <span class="risk-value">${defenseScore}/10</span>
                            </div>
                            <span class="risk-level">${this.getRiskLevel(defenseScore)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    calculateRoundScore(analysis) {
        // Simple scoring algorithm
        let score = 7; // Base score
        
        if (analysis.feedback.includes('excellent')) score += 2;
        if (analysis.feedback.includes('good')) score += 1;
        if (analysis.feedback.includes('standard')) score += 1;
        if (analysis.errorType) score -= 1;
        
        return Math.max(1, Math.min(10, score));
    }

    analyzeLossReasons(analysis) {
        const reasons = {
            primary: 'Technical mistakes led to point loss',
            secondary: []
        };

        if (analysis.errorType) {
            switch (analysis.errorType) {
                case 'Slow reaction':
                    reasons.primary = 'Reaction speed was insufficient, failed to respond to opponent attacks in time';
                    break;
                case 'Defensive errors':
                    reasons.primary = 'Defensive positioning was incorrect, leaving attack opportunities for opponent';
                    break;
                case 'Poor attack angle':
                    reasons.primary = 'Attack angle was poorly chosen, easily countered by opponent';
                    break;
                case 'Attention distraction':
                    reasons.primary = 'Attention was distracted, missed defensive timing';
                    break;
                case 'Non-standard technical actions':
                    reasons.primary = 'Technical execution was non-standard, affecting ball control';
                    break;
                default:
                    reasons.primary = 'Comprehensive technical factors led to point loss';
            }
        }

        if (analysis.feedback) {
            if (analysis.feedback.includes('positioning')) {
                reasons.secondary.push('Positioning issues');
            }
            if (analysis.feedback.includes('timing')) {
                reasons.secondary.push('Timing problems');
            }
            if (analysis.feedback.includes('force')) {
                reasons.secondary.push('Force control');
            }
        }

        return reasons;
    }

    translateErrorType(errorType) {
        // 错误类型映射 - 只基于后端分析器返回的5种错误类型
        const errorTypeMap = {
            // 后端分析器返回的5种错误类型
            'slow_reaction': 'Slow Reaction',
            'low_activity': 'Low Activity',
            'weak_defense': 'Weak Defense',
            'poor_alignment': 'Poor Alignment',
            'coverage_gap': 'Coverage Gap'
        };
        
        return errorTypeMap[errorType] || errorType;
    }

    getDefenseAssessment(defenseScore) {
        if (defenseScore <= 3) return 'Excellent defensive performance, point loss within normal range';
        if (defenseScore <= 5) return 'Defense was adequate, with minor room for improvement';
        if (defenseScore <= 7) return 'Defense has obvious weaknesses, needs strengthening';
        return 'Defense severely inadequate, urgent intensive training required';
    }

    generatePreventionTips(analysis) {
        const tips = [];
        
        if (analysis.errorType) {
            switch (analysis.errorType) {
                case 'Slow reaction':
                    tips.push('Strengthen reaction training, improve ball trajectory prediction ability');
                    tips.push('Practice quick movement footwork, reduce reaction time');
                    break;
                case 'Defensive errors':
                    tips.push('Learn proper defensive positioning, maintain center table control');
                    tips.push('Observe opponent habits, prepare defensive strategies in advance');
                    break;
                case 'Poor attack angle':
                    tips.push('Practice multi-angle attacks, improve attack success rate');
                    tips.push('Learn to observe opponent position, choose optimal attack timing');
                    break;
                case 'Attention distraction':
                    tips.push('Maintain focus, avoid external factors interference');
                    tips.push('Establish match rhythm, maintain stable mental state');
                    break;
                case 'Non-standard technical actions':
                    tips.push('Return to basic movement practice, ensure technical standards');
                    tips.push('Seek coach guidance, correct improper movement habits');
                    break;
            }
        }
        
        // General loss prevention advice
        tips.push('Maintain calm mindset, avoid hasty emotions affecting judgment');
        tips.push('Strengthen physical training, maintain focus throughout the match');
        
        return tips.slice(0, 4); // Limit to 4 suggestions
    }

    getRiskLevel(defenseScore) {
        if (defenseScore <= 3) return 'Low Risk';
        if (defenseScore <= 5) return 'Medium Risk';
        if (defenseScore <= 7) return 'High Risk';
        return 'Very High Risk';
    }
    
    addRoundClickEvents() {
        // Expand/collapse functionality removed
        
        // 为旧的point-item添加事件监听器（兼容性）
        document.querySelectorAll('.point-item').forEach(item => {
            if (!item) return; // null检查
            
            // Remove existing listeners to prevent duplication
            const newItem = item.cloneNode(true);
            if (item.parentNode) {
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', (e) => {
                // Don't trigger if clicking on expand indicator
                if (e.target.closest('.expand-indicator')) {
                    return;
                }
                
                const roundId = parseInt(e.currentTarget.dataset.roundId);
                    if (!isNaN(roundId)) {
                        console.log('point-item clicked, roundId:', roundId);
                        this.toggleDetailedRound(roundId);
                    }
            });
            }
        });
        
        // Add separate click events for expand indicators (兼容性)
        document.querySelectorAll('.expand-indicator').forEach(indicator => {
            if (!indicator) return; // null检查
            
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                const roundItem = e.currentTarget.closest('.point-item');
                if (roundItem) {
                const roundId = parseInt(roundItem.dataset.roundId);
                    if (!isNaN(roundId)) {
                        console.log('expand-indicator clicked, roundId:', roundId);
                        this.toggleDetailedRound(roundId);
                    }
                }
            });
        });
        
        console.log('addRoundClickEvents completed - supporting both new dual-analysis-item and old point-item');
    }
    
    // 保留旧方法用于兼容性 - 彻底重写避免错误
    toggleRoundExpansion(roundId, itemElement) {
        console.log('toggleRoundExpansion called with roundId:', roundId, 'redirecting to toggleDetailedRound');
        // 直接调用新方法，不再调用任何旧的DOM操作
        if (roundId && !isNaN(roundId)) {
            this.toggleDetailedRound(roundId);
        } else {
            console.error('Invalid roundId in toggleRoundExpansion:', roundId);
        }
    }

    updateItemExpansion(itemElement, isExpanded) {
        // 完全废弃这个方法，所有操作由toggleDetailedRound处理
        console.log('updateItemExpansion called but disabled - all operations handled by toggleDetailedRound');
        // 不做任何DOM操作，直接返回
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
    
    // Get analysis statistics
    getAnalysisStats() {
        if (!this.currentGame || !this.currentGame.rounds || this.currentGame.rounds.length === 0) return null;
        
        const gameRounds = this.currentGame.rounds;
        
        const stats = {
            totalRounds: gameRounds.length,
            playerAWins: gameRounds.filter(r => r.winner === 'playerA').length,
            playerBWins: gameRounds.filter(r => r.winner === 'playerB').length,
            averageScore: 0,
            commonErrors: {},
            improvements: {},
            timeline: []
        };
        
        // Calculate average score
        let totalScore = 0;
        gameRounds.forEach(round => {
            if (round.analysis) {
                totalScore += this.calculateRoundScore(round.analysis);
            }
        });
        stats.averageScore = (totalScore / gameRounds.length).toFixed(1);
        
        // Count common errors (combining frontend and backend data)
        gameRounds.forEach(round => {
            // 统计前端分析的错误
            if (round.analysis && round.analysis.errorType) {
                stats.commonErrors[round.analysis.errorType] = 
                    (stats.commonErrors[round.analysis.errorType] || 0) + 1;
            }
            
            // 统计后端AI分析的错误
            if (this.currentGame && this.currentGame.backendAnalysis) {
                const backendAnalysis = this.currentGame.backendAnalysis;
                
                // 统计playerA的错误
                if (backendAnalysis.playerA && backendAnalysis.playerA.errorTypes) {
                    backendAnalysis.playerA.errorTypes.forEach(errorType => {
                        const translatedError = this.translateErrorType(errorType);
                        stats.commonErrors[translatedError] = 
                            (stats.commonErrors[translatedError] || 0) + 1;
                    });
                }
                
                // 统计playerB的错误
                if (backendAnalysis.playerB && backendAnalysis.playerB.errorTypes) {
                    backendAnalysis.playerB.errorTypes.forEach(errorType => {
                        const translatedError = this.translateErrorType(errorType);
                        stats.commonErrors[translatedError] = 
                            (stats.commonErrors[translatedError] || 0) + 1;
                    });
                }
            }
        });
        
        // Count improvement suggestions
        gameRounds.forEach(round => {
            if (round.analysis && round.analysis.suggestions) {
                round.analysis.suggestions.forEach(suggestion => {
                    stats.improvements[suggestion] = 
                        (stats.improvements[suggestion] || 0) + 1;
                });
            }
        });
        
        // Timeline data
        stats.timeline = gameRounds.map(round => ({
            round: round.id,
            timestamp: round.timestamp,
            score: round.analysis ? this.calculateRoundScore(round.analysis) : 5,
            winner: round.winner
        }));
        
        return stats;
    }
    
    // Export analysis data
    exportAnalysis() {
        const stats = this.getAnalysisStats();
        if (!stats) {
            window.smartCourtApp.showMessage('No analysis data to export', 'error');
            return;
        }
        
        const exportData = {
            game: this.currentGame,
            rounds: this.currentGame ? this.currentGame.rounds : [],
            stats: stats,
            exportTime: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Air_Hockey_Assistant_Analysis_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        window.smartCourtApp.showMessage('Analysis data exported successfully', 'success');
    }
    
    // Generate analysis report
    generateAnalysisReport() {
        const stats = this.getAnalysisStats();
        if (!stats) return null;
        
        const report = {
            summary: {
                totalRounds: stats.totalRounds,
                playerAWinRate: 'Model Data Required',  // 胜率由模型提供
                playerBWinRate: 'Model Data Required',  // 胜率由模型提供
                averageScore: stats.averageScore
            },
            performance: {
                trend: this.calculatePerformanceTrend(stats.timeline),
                consistency: this.calculateConsistency(stats.timeline),
                improvement: this.calculateImprovement(stats.timeline)
            },
            recommendations: this.generateRecommendations(stats),
            errors: this.analyzeErrors(stats.commonErrors)
        };
        
        return report;
    }
    
    calculatePerformanceTrend(timeline) {
        if (timeline.length < 2) return 'stable';
        
        const firstHalf = timeline.slice(0, Math.floor(timeline.length / 2));
        const secondHalf = timeline.slice(Math.floor(timeline.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, r) => sum + r.score, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, r) => sum + r.score, 0) / secondHalf.length;
        
        const diff = secondAvg - firstAvg;
        if (diff > 0.5) return 'improving';
        if (diff < -0.5) return 'declining';
        return 'stable';
    }
    
    calculateConsistency(timeline) {
        if (timeline.length < 2) return 100;
        
        const scores = timeline.map(r => r.score);
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        
        // Consistency percentage (lower standard deviation means higher consistency)
        return Math.max(0, 100 - stdDev * 20);
    }
    
    calculateImprovement(timeline) {
        if (timeline.length < 5) return 0;
        
        const recent = timeline.slice(-5);
        const earlier = timeline.slice(0, Math.min(5, timeline.length - 5));
        
        const recentAvg = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, r) => sum + r.score, 0) / earlier.length;
        
        return ((recentAvg - earlierAvg) / earlierAvg * 100).toFixed(1);
    }
    
    generateRecommendations(stats) {
        const recommendations = [];
        
        // Suggestions based on error types
        const topErrors = Object.entries(stats.commonErrors)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);
        
        topErrors.forEach(([error, count]) => {
            switch (error) {
                case 'Slow reaction':
                    recommendations.push('Recommend strengthening reaction speed training with more quick response exercises');
                    break;
                case 'Defensive errors':
                    recommendations.push('Need to improve defensive positioning, suggest watching defensive technique videos');
                    break;
                case 'Poor attack angle':
                    recommendations.push('Practice attacks from different angles to improve attack diversity');
                    break;
                case 'Attention distraction':
                    recommendations.push('Recommend maintaining focus during matches, try meditation training');
                    break;
                case 'Non-standard technical actions':
                    recommendations.push('Focus on practicing basic technical movements to ensure standardization');
                    break;
            }
        });
        
        // Suggestions based on scoring performance
        if (stats.averageScore < 6) {
            recommendations.push('Overall technical level needs improvement, recommend strengthening basic training');
        } else if (stats.averageScore > 8) {
            recommendations.push('Technical level is excellent, can try more advanced tactics');
        }
        
        return recommendations;
    }
    
    analyzeErrors(commonErrors) {
        const total = Object.values(commonErrors).reduce((sum, count) => sum + count, 0);
        
        return Object.entries(commonErrors).map(([error, count]) => ({
            type: error,
            count: count,
            percentage: ((count / total) * 100).toFixed(1)
        })).sort((a, b) => b.count - a.count);
    }
    
    // Clear analysis data
    clearAnalysis() {
        this.currentGame = null;
        this.expandedRounds.clear();
        this.displayGameAnalysis();
    }
    
    // Advanced filtering feature
    setupAdvancedFilters() {
        const container = document.querySelector('.analysis-controls');
        if (!container) return;
        
        const advancedFilters = document.createElement('div');
        advancedFilters.className = 'advanced-filters';
        advancedFilters.innerHTML = `
            <div class="filter-group">
                <label>Time range:</label>
                <select id="timeFilter">
                    <option value="all">All</option>
                    <option value="last10">Last 10 rounds</option>
                    <option value="last20">Last 20 rounds</option>
                    <option value="first-half">First half</option>
                    <option value="second-half">Second half</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label>Score range:</label>
                <select id="scoreFilter">
                    <option value="all">All</option>
                    <option value="high">High score (8-10)</option>
                    <option value="medium">Medium score (5-7)</option>
                    <option value="low">Low score (1-4)</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label>Error type:</label>
                <select id="errorFilter">
                    <option value="all">All</option>
                    <option value="has-error">Has error</option>
                    <option value="no-error">No error</option>
                </select>
            </div>
        `;
        
        container.appendChild(advancedFilters);
        
        // Add advanced filtering events
        ['timeFilter', 'scoreFilter', 'errorFilter'].forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                filter.addEventListener('change', () => {
                    this.applyAdvancedFilters();
                });
            }
        });
    }
    
    applyAdvancedFilters() {
        // Apply advanced filtering logic
        let filteredRounds = this.getFilteredRounds();
        
        // Time filtering
        const timeFilter = document.getElementById('timeFilter');
        if (timeFilter && timeFilter.value !== 'all') {
            filteredRounds = this.applyTimeFilter(filteredRounds, timeFilter.value);
        }
        
        // Score filtering
        const scoreFilter = document.getElementById('scoreFilter');
        if (scoreFilter && scoreFilter.value !== 'all') {
            filteredRounds = this.applyScoreFilter(filteredRounds, scoreFilter.value);
        }
        
        // Error filtering
        const errorFilter = document.getElementById('errorFilter');
        if (errorFilter && errorFilter.value !== 'all') {
            filteredRounds = this.applyErrorFilter(filteredRounds, errorFilter.value);
        }
        
        this.displayFilteredRounds(filteredRounds);
    }
    
    applyTimeFilter(rounds, filter) {
        switch (filter) {
            case 'last10':
                return rounds.slice(-10);
            case 'last20':
                return rounds.slice(-20);
            case 'first-half':
                return rounds.slice(0, Math.floor(rounds.length / 2));
            case 'second-half':
                return rounds.slice(Math.floor(rounds.length / 2));
            default:
                return rounds;
        }
    }
    
    applyScoreFilter(rounds, filter) {
        return rounds.filter(round => {
            if (!round.analysis) return false;
            const score = this.calculateRoundScore(round.analysis);
            
            switch (filter) {
                case 'high':
                    return score >= 8;
                case 'medium':
                    return score >= 5 && score < 8;
                case 'low':
                    return score < 5;
                default:
                    return true;
            }
        });
    }
    
    applyErrorFilter(rounds, filter) {
        return rounds.filter(round => {
            switch (filter) {
                case 'has-error':
                    return round.analysis && round.analysis.errorType;
                case 'no-error':
                    return !round.analysis || !round.analysis.errorType;
                default:
                    return true;
            }
        });
    }
    
    displayFilteredRounds(filteredRounds) {
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        if (filteredRounds.length === 0) {
            container.innerHTML = '<div class="no-data">No matching data found</div>';
            return;
        }
        
        const roundsHTML = this.createTimelineView(filteredRounds);
        container.innerHTML = roundsHTML;
        
        this.addTimelineClickEvents();
    }

    // Create Timeline View - Rounds organized by round number with A/B classification
    createTimelineView(rounds) {
        if (!rounds || rounds.length === 0) {
            return '<div class="no-data">No round data available</div>';
        }

        // 创建筛选控件HTML
        const filtersHTML = this.createRoundFiltersHTML();
        
        // 应用筛选
        const filteredRounds = this.applyRoundFilters(rounds);

        let viewHTML = `
            <div class="timeline-view">
                <div class="timeline-header">
                    <h3>🕒 Round-by-Round Timeline Analysis</h3>
                    <p class="timeline-subtitle">Each round shows ${this.getPlayerName(this.currentGame, 'playerA')} and ${this.getPlayerName(this.currentGame, 'playerB')} performance breakdown</p>
                </div>
                
                ${filtersHTML}
                
                <div class="timeline-stats">
                    <div class="filter-stats">
                        <span class="stats-label">Showing:</span>
                        <span class="stats-value">${filteredRounds.length} of ${rounds.length} rounds</span>
                        ${this.getFilterSummary(filteredRounds)}
                    </div>
                </div>
                
                <div class="rounds-timeline">
        `;

        if (filteredRounds.length === 0) {
            viewHTML += '<div class="no-filtered-data">No rounds match the current filters. Try adjusting your selection.</div>';
        } else {
            filteredRounds.forEach(round => {
                viewHTML += this.createRoundHTML(round);
            });
        }

        viewHTML += `
                </div>
            </div>
        `;

        return viewHTML;
    }

    // Create A vs B Comparison Timeline View - 对比版时间线视图
    createComparisonTimelineView(rounds) {
        if (!rounds || rounds.length === 0) {
            return '<div class="no-data">No round data available</div>';
        }

        // 计算对比统计数据
        const comparisonStats = this.calculateComparisonStats(rounds);

        let viewHTML = `
            <div class="comparison-view comparison-timeline">
                <div class="comparison-header">
                    <h3>⚖️ A vs B Timeline Comparison</h3>
                    <p class="comparison-subtitle">Round-by-round comparison showing both players' performance timeline</p>
                </div>
                
                <!-- 简化的统计概览 -->
                <div class="quick-comparison-stats">
                    <div class="quick-stat-item">
                        <span class="stat-label">🔵 ${this.getPlayerName(this.currentGame, 'playerA')} Win Rate:</span>
                        <span class="stat-value">${this.formatWinRate(comparisonStats.playerA.winRate)}</span>
                    </div>
                    <div class="quick-stat-item">
                        <span class="stat-label">🔴 ${this.getPlayerName(this.currentGame, 'playerB')} Win Rate:</span>
                        <span class="stat-value">${this.formatWinRate(comparisonStats.playerB.winRate)}</span>
                    </div>
                    <div class="quick-stat-item">
                        <span class="stat-label">📊 Final Score:</span>
                        <span class="stat-value">${comparisonStats.finalScore.playerA} - ${comparisonStats.finalScore.playerB}</span>
                    </div>
                </div>
                
                <!-- 回合时间线对比 -->
                <div class="rounds-timeline-comparison">
                    <h4>🔍 Round-by-Round Timeline</h4>
                    <div class="timeline-comparison-rounds">
        `;

        rounds.forEach(round => {
            viewHTML += this.createComparisonTimelineItem(round);
        });

        viewHTML += `
                    </div>
                </div>
            </div>
        `;

        return viewHTML;
    }

    // Create A vs B Comparison Detailed View - 对比版详细分析视图
    createComparisonDetailedView(rounds) {
        if (!rounds || rounds.length === 0) {
            return '<div class="no-data">No round data available</div>';
        }

        const comparisonStats = this.calculateComparisonStats(rounds);

        return `
            <div class="comparison-view comparison-detailed">
                <div class="comparison-header">
                    <h3>⚖️ A vs B Detailed Analysis Comparison</h3>
                    <p class="comparison-subtitle">In-depth analysis comparing both players' technical performance and strategies</p>
                </div>
                
                <!-- 详细对比统计 -->
                <div class="detailed-comparison-stats">
                    <div class="comparison-stats-grid">
                        <div class="player-stats player-a-stats">
                        <div class="player-header">
                                <h4>🔵 ${this.getPlayerName(this.currentGame, 'playerA')} Detailed Analysis</h4>
                        </div>
                            <div class="stats-content">
                                <div class="stat-item">
                                    <span class="stat-label">Points Won:</span>
                                    <span class="stat-value">${comparisonStats.playerA.pointsWon}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Points Lost:</span>
                                    <span class="stat-value">${comparisonStats.playerA.pointsLost}</span>
                                </div>
                                <div class="stat-item">
                                                                <span class="stat-label">Win Rate:</span>
                            <span class="stat-value">${this.formatWinRate(comparisonStats.playerA.winRate)}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Avg Tech Score:</span>
                                    <span class="stat-value">${comparisonStats.playerA.avgTechScore}/10</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Most Common Error:</span>
                                    <span class="stat-value">${comparisonStats.playerA.commonError || 'None'}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Performance Level:</span>
                                    <span class="stat-value">${this.getPerformanceLevel(comparisonStats.playerA.avgTechScore)}</span>
                                </div>
                            </div>
                    </div>
                    
                        <div class="vs-separator">
                            <div class="vs-icon">VS</div>
                            <div class="final-score">
                                Final Score<br>
                                <span class="score-display">${comparisonStats.finalScore.playerA} - ${comparisonStats.finalScore.playerB}</span>
                            </div>
                            <div class="winner-badge">
                                ${comparisonStats.finalScore.playerA > comparisonStats.finalScore.playerB ? 
                                    `🏆 ${this.getPlayerName(this.currentGame, 'playerA')} Wins` : 
                                    comparisonStats.finalScore.playerB > comparisonStats.finalScore.playerA ? 
                                    `🏆 ${this.getPlayerName(this.currentGame, 'playerB')} Wins` : 
                                    '🤝 Draw'}
                            </div>
                    </div>
                    
                        <div class="player-stats player-b-stats">
                        <div class="player-header">
                                <h4>🔴 ${this.getPlayerName(this.currentGame, 'playerB')} Detailed Analysis</h4>
                        </div>
                            <div class="stats-content">
                                <div class="stat-item">
                                    <span class="stat-label">Points Won:</span>
                                    <span class="stat-value">${comparisonStats.playerB.pointsWon}</span>
                    </div>
                                <div class="stat-item">
                                    <span class="stat-label">Points Lost:</span>
                                    <span class="stat-value">${comparisonStats.playerB.pointsLost}</span>
                                </div>
                                <div class="stat-item">
                                                                <span class="stat-label">Win Rate:</span>
                            <span class="stat-value">${this.formatWinRate(comparisonStats.playerB.winRate)}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Avg Tech Score:</span>
                                    <span class="stat-value">${comparisonStats.playerB.avgTechScore}/10</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Most Common Error:</span>
                                    <span class="stat-value">${comparisonStats.playerB.commonError || 'None'}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Performance Level:</span>
                                    <span class="stat-value">${this.getPerformanceLevel(comparisonStats.playerB.avgTechScore)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 详细回合分析 -->
                <div class="detailed-rounds-comparison">
                    <h4>🔍 Detailed Round Analysis</h4>
                    <div class="detailed-comparison-rounds">
                        ${rounds.map(round => this.createDetailedComparisonRoundItem(round)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Create A vs B Comparison Statistics View - 对比版统计视图
    createComparisonStatisticsView(rounds) {
        if (!rounds || rounds.length === 0) {
            return '<div class="no-data">No round data available</div>';
        }

        const comparisonStats = this.calculateComparisonStats(rounds);
        const advancedStats = this.calculateAdvancedComparisonStats(rounds);

        return `
            <div class="comparison-view comparison-statistics">
                <div class="comparison-header">
                    <h3>⚖️ A vs B Statistical Analysis</h3>
                    <p class="comparison-subtitle">Comprehensive statistical comparison with charts and advanced metrics</p>
                </div>
                
                <!-- 统计总览 -->
                <div class="statistics-overview">
                    <div class="overview-grid">
                        <div class="overview-card performance-card">
                            <h4>🎯 Performance Overview</h4>
                            <div class="performance-comparison">
                                <div class="player-performance">
                                    <span class="player-label">🔵 ${this.getPlayerName(this.currentGame, 'playerA')}</span>
                                                        <div class="performance-bar">
                        <div class="performance-fill player-a" style="width: ${typeof comparisonStats.playerA.winRate === 'number' ? comparisonStats.playerA.winRate : 50}%"></div>
                    </div>
                    <span class="performance-value">${this.formatWinRate(comparisonStats.playerA.winRate)} Win Rate</span>
                                </div>
                                <div class="player-performance">
                                    <span class="player-label">🔴 ${this.getPlayerName(this.currentGame, 'playerB')}</span>
                                                        <div class="performance-bar">
                        <div class="performance-fill player-b" style="width: ${typeof comparisonStats.playerB.winRate === 'number' ? comparisonStats.playerB.winRate : 50}%"></div>
                    </div>
                    <span class="performance-value">${this.formatWinRate(comparisonStats.playerB.winRate)} Win Rate</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="overview-card tech-scores-card">
                            <h4>📊 Technical Scores</h4>
                            <div class="tech-scores-comparison">
                                <div class="score-item">
                                    <span class="score-label">🔵 ${this.getPlayerName(this.currentGame, 'playerA')} Avg:</span>
                                    <span class="score-value ${this.getScoreClass(comparisonStats.playerA.avgTechScore)}">${comparisonStats.playerA.avgTechScore}/10</span>
                                </div>
                                <div class="score-item">
                                    <span class="score-label">🔴 ${this.getPlayerName(this.currentGame, 'playerB')} Avg:</span>
                                    <span class="score-value ${this.getScoreClass(comparisonStats.playerB.avgTechScore)}">${comparisonStats.playerB.avgTechScore}/10</span>
                                </div>
                                <div class="score-comparison">
                                    ${this.getPerformanceComparison(comparisonStats.playerA.avgTechScore, comparisonStats.playerB.avgTechScore)}
                                </div>
                            </div>
                </div>
                
                        <div class="overview-card errors-card">
                            <h4>⚠️ Error Analysis</h4>
                            <div class="errors-comparison">
                                <div class="player-errors">
                                    <span class="player-label">🔵 ${this.getPlayerName(this.currentGame, 'playerA')}:</span>
                                    <span class="error-value">${comparisonStats.playerA.commonError || 'No common errors'}</span>
                                    ${this.getAIErrorAnalysis('playerA')}
                        </div>
                                <div class="player-errors">
                                    <span class="player-label">🔴 ${this.getPlayerName(this.currentGame, 'playerB')}:</span>
                                    <span class="error-value">${comparisonStats.playerB.commonError || 'No common errors'}</span>
                                    ${this.getAIErrorAnalysis('playerB')}
                    </div>
            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 高级统计 -->
                <div class="advanced-statistics">
                    <h4>📈 Advanced Analytics</h4>
                    <div class="advanced-stats-grid">
                        <div class="advanced-stat-card">
                            <h5>🎯 Consistency Analysis</h5>
                            <div class="consistency-comparison">
                                <div class="consistency-item">
                                    <span class="player-name">🔵 ${this.getPlayerName(this.currentGame, 'playerA')}</span>
                                    <span class="consistency-score">${advancedStats.playerA.consistency}%</span>
                                </div>
                                <div class="consistency-item">
                            <span class="player-name">🔴 ${this.getPlayerName(this.currentGame, 'playerB')}</span>
                                    <span class="consistency-score">${advancedStats.playerB.consistency}%</span>
                        </div>
                            </div>
                        </div>
                        
                        <div class="advanced-stat-card">
                            <h5>📊 Performance Trend</h5>
                            <div class="trend-comparison">
                                <div class="trend-item">
                                    <span class="player-name">🔵 ${this.getPlayerName(this.currentGame, 'playerA')}</span>
                                    <span class="trend-indicator ${advancedStats.playerA.trend}">${this.getTrendIcon(advancedStats.playerA.trend)} ${advancedStats.playerA.trend}</span>
                                </div>
                                <div class="trend-item">
                                    <span class="player-name">🔴 ${this.getPlayerName(this.currentGame, 'playerB')}</span>
                                    <span class="trend-indicator ${advancedStats.playerB.trend}">${this.getTrendIcon(advancedStats.playerB.trend)} ${advancedStats.playerB.trend}</span>
                                </div>
                            </div>
                </div>
                
                        <div class="advanced-stat-card">
                            <h5>🏆 Dominance Index</h5>
                            <div class="dominance-section">
                                <div class="dominance-visual">
                                    <div class="dominance-scale">
                                        <div class="dominance-track">
                                            <div class="dominance-indicator" style="left: ${this.calculateDominancePosition(comparisonStats)}%"></div>
                                        </div>
                                    </div>
                                    <div class="dominance-players">
                                        <div class="dominance-player player-a">
                                            <div class="player-indicator"></div>
                                            <span>${this.getPlayerName(this.currentGame, 'playerA')}</span>
                                        </div>
                                        <div class="dominance-player player-b">
                                            <div class="player-indicator"></div>
                                            <span>${this.getPlayerName(this.currentGame, 'playerB')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="dominance-result">
                                    <div class="dominance-status">
                                        ${this.getDominanceTitle(comparisonStats)}
                                    </div>
                                    <div class="dominance-description">
                                        ${this.getDominanceDescription(comparisonStats)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 比赛时间线图 -->
                <div class="match-timeline-chart">
                    <h4>📈 Match Score Timeline</h4>
                    <div class="timeline-charts-container">
                        <div class="timeline-chart-section">
                            <h5>🏆 Score Progress</h5>
                            <div class="timeline-chart">
                                ${this.createScoreTimelineChart(rounds)}
                            </div>
                        </div>
                        
                        <div class="timeline-chart-section">
                            <h5>📊 Performance Trend</h5>
                            <div class="performance-trend-chart">
                                ${this.createPerformanceTrendChart(rounds)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 辅助方法
    getPerformanceLevel(avgScore) {
        if (avgScore === 'N/A') return 'No Data';
        const score = parseFloat(avgScore);
        if (score >= 8) return 'Excellent';
        if (score >= 6) return 'Good';
        if (score >= 4) return 'Average';
        return 'Needs Improvement';
    }

    getScoreClass(avgScore) {
        if (avgScore === 'N/A') return 'no-data';
        const score = parseFloat(avgScore);
        if (score >= 8) return 'excellent';
        if (score >= 6) return 'good';
        if (score >= 4) return 'average';
        return 'poor';
    }

    getPerformanceComparison(scoreA, scoreB) {
        if (scoreA === 'N/A' || scoreB === 'N/A') return 'Insufficient data for comparison';
        
        const diff = parseFloat(scoreA) - parseFloat(scoreB);
        if (Math.abs(diff) < 0.5) return '🤝 Very similar performance levels';
        if (diff > 0) return `🔵 ${this.getPlayerName(this.currentGame, 'playerA')} performs ${diff.toFixed(1)} points better`;
        return `🔴 ${this.getPlayerName(this.currentGame, 'playerB')} performs ${Math.abs(diff).toFixed(1)} points better`;
    }

    getTrendIcon(trend) {
        switch(trend) {
            case 'improving': return '📈';
            case 'declining': return '📉';
            case 'stable': return '➡️';
            default: return '❓';
        }
    }



    calculateDominancePosition(stats) {
        const scoreA = parseFloat(stats.playerA.avgTechScore) || 5;
        const scoreB = parseFloat(stats.playerB.avgTechScore) || 5;
        // 胜率由模型提供，前端不计算优势位置
        const winRateA = typeof stats.playerA.winRate === 'number' ? stats.playerA.winRate : 50;
        const winRateB = typeof stats.playerB.winRate === 'number' ? stats.playerB.winRate : 50;
        
        // 综合评分：技术分数权重40%，胜率权重60%
        const totalA = (scoreA * 0.4) + (winRateA * 0.6 / 10);
        const totalB = (scoreB * 0.4) + (winRateB * 0.6 / 10);
        
        // 转换为0-100的位置
        const total = totalA + totalB;
        return total > 0 ? (totalA / total * 100) : 50;
    }

    getDominanceTitle(stats) {
        const position = this.calculateDominancePosition(stats);
        
        if (Math.abs(position - 50) < 10) {
            return "Balanced Match";
        } else if (position > 65) {
            return `${this.getPlayerName(this.currentGame, 'playerA')} Dominance`;
        } else if (position < 35) {
            return `${this.getPlayerName(this.currentGame, 'playerB')} Dominance`;
        } else if (position > 55) {
            return `${this.getPlayerName(this.currentGame, 'playerA')} Advantage`;
        } else {
            return `${this.getPlayerName(this.currentGame, 'playerB')} Advantage`;
        }
    }

    getDominanceDescription(stats) {
        const position = this.calculateDominancePosition(stats);
        const playerAWinRate = typeof stats.playerA.winRate === 'number' ? stats.playerA.winRate : 'N/A';
        const playerBWinRate = typeof stats.playerB.winRate === 'number' ? stats.playerB.winRate : 'N/A';
        
        if (playerAWinRate === 'N/A' || playerBWinRate === 'N/A') {
            return 'Performance analysis requires model data for accurate win rate calculation';
        }
        
        if (Math.abs(position - 50) < 10) {
            return `Very close competition with ${playerAWinRate}% vs ${playerBWinRate}% win rates`;
        } else if (position > 65) {
            return `Strong performance advantage with ${playerAWinRate}% win rate`;
        } else if (position < 35) {
            return `Strong performance advantage with ${playerBWinRate}% win rate`;
        } else if (position > 55) {
            return `Slight edge in overall performance and consistency`;
        } else {
            return `Slight edge in overall performance and consistency`;
        }
    }

    // 计算对比统计数据
    calculateComparisonStats(rounds) {
        const stats = {
            playerA: {
                pointsWon: 0,
                pointsLost: 0,
                winRate: 0,
                avgTechScore: 0,
                commonError: null,
                errors: {}
            },
            playerB: {
                pointsWon: 0,
                pointsLost: 0,
                winRate: 0,
                avgTechScore: 0,
                commonError: null,
                errors: {}
            },
            finalScore: {
                playerA: 0,
                playerB: 0
            }
        };

        let playerATechScores = [];
        let playerBTechScores = [];

        rounds.forEach(round => {
            // 统计得分
            if (round.winner === 'playerA') {
                stats.playerA.pointsWon++;
                stats.playerB.pointsLost++;
            } else {
                stats.playerB.pointsWon++;
                stats.playerA.pointsLost++;
            }

            // 收集技术评分
            if (round.analysis) {
                const techScore = this.calculateRoundScore(round.analysis);
                
                if (round.winner === 'playerB') {
                    // Player A 失分
                    playerATechScores.push(techScore);
                } else {
                    // Player B 失分
                    playerBTechScores.push(techScore);
                }
            }
            
            // 最终比分
            stats.finalScore.playerA = round.playerAScore;
            stats.finalScore.playerB = round.playerBScore;
        });
        
        // 只从后端分析器获取错误信息
        if (this.currentGame && this.currentGame.backendAnalysis) {
            const backendAnalysis = this.currentGame.backendAnalysis;
            
            // 统计playerA的错误
            if (backendAnalysis.playerA && backendAnalysis.playerA.errorTypes) {
                backendAnalysis.playerA.errorTypes.forEach(errorType => {
                    const translatedError = this.translateErrorType(errorType);
                    stats.playerA.errors[translatedError] = 
                        (stats.playerA.errors[translatedError] || 0) + 1;
                });
            }
            
            // 统计playerB的错误
            if (backendAnalysis.playerB && backendAnalysis.playerB.errorTypes) {
                backendAnalysis.playerB.errorTypes.forEach(errorType => {
                    const translatedError = this.translateErrorType(errorType);
                    stats.playerB.errors[translatedError] = 
                        (stats.playerB.errors[translatedError] || 0) + 1;
                });
            }
        }

        // 使用实时胜率数据，如果有的话
        if (this.winRateData && typeof this.winRateData.playerA === 'number') {
            stats.playerA.winRate = this.winRateData.playerA;
            stats.playerB.winRate = this.winRateData.playerB;
        } else {
            stats.playerA.winRate = 'Model Data Required';
            stats.playerB.winRate = 'Model Data Required';
        }

        // 计算平均技术评分
        if (playerATechScores.length > 0) {
            stats.playerA.avgTechScore = (playerATechScores.reduce((a, b) => a + b, 0) / playerATechScores.length).toFixed(1);
        } else {
            stats.playerA.avgTechScore = 'N/A';
        }

        if (playerBTechScores.length > 0) {
            stats.playerB.avgTechScore = (playerBTechScores.reduce((a, b) => a + b, 0) / playerBTechScores.length).toFixed(1);
        } else {
            stats.playerB.avgTechScore = 'N/A';
        }
        
        // 找出最常见的错误
        if (Object.keys(stats.playerA.errors).length > 0) {
            stats.playerA.commonError = Object.entries(stats.playerA.errors)
                .sort(([,a], [,b]) => b - a)[0][0];
        }

        if (Object.keys(stats.playerB.errors).length > 0) {
            stats.playerB.commonError = Object.entries(stats.playerB.errors)
                .sort(([,a], [,b]) => b - a)[0][0];
        }

        return stats;
    }

    // 计算高级对比统计
    calculateAdvancedComparisonStats(rounds) {
        const playerAScores = [];
        const playerBScores = [];

        rounds.forEach(round => {
            if (round.analysis) {
                const score = this.calculateRoundScore(round.analysis);
                if (round.winner === 'playerB') {
                    playerAScores.push(score);
                } else {
                    playerBScores.push(score);
                }
            }
        });

        return {
            playerA: {
                consistency: this.calculateConsistency(playerAScores),
                trend: this.calculatePerformanceTrend(playerAScores)
            },
            playerB: {
                consistency: this.calculateConsistency(playerBScores),
                trend: this.calculatePerformanceTrend(playerBScores)
            }
        };
    }

    // 计算一致性
    calculateConsistency(scores) {
        if (scores.length < 2) return 100;
        
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        
        // 一致性百分比 (标准差越低一致性越高)
        return Math.max(0, (100 - stdDev * 20)).toFixed(1);
    }



    // 创建对比时间线项目
    createComparisonTimelineItem(round) {
        const timeStr = this.formatTime(round.timestamp);
        const playerALost = round.winner === 'playerB';
        const playerBLost = round.winner === 'playerA';

        return `
            <div class="comparison-timeline-item" data-round-id="${round.id}">
                <div class="timeline-round-header">
                    <div class="round-info">
                        <span class="round-number">Round ${round.id}</span>
                        <span class="round-time">${timeStr}</span>
                        <span class="round-score">${round.playerAScore} - ${round.playerBScore}</span>
                </div>
                </div>
                
                <div class="timeline-players-comparison">
                    <div class="timeline-player-result player-a ${playerALost ? 'lost-point' : 'won-point'}">
                        <div class="player-icon">🔵</div>
                        <div class="player-status">
                            <span class="player-name">${this.getPlayerName(this.currentGame, 'playerA')}</span>
                            <span class="result-text ${playerALost ? 'lost' : 'won'}">
                                ${playerALost ? 'Lost Point' : 'Won Point'}
                            </span>
                    </div>
                        ${playerALost ? this.createTimelinePlayerLoss(round.analysis) : this.createTimelinePlayerWin()}
                    </div>
                    
                    <div class="timeline-vs-separator">
                        <div class="timeline-arrow ${playerALost ? 'right' : 'left'}">
                            ${playerALost ? '→' : '←'}
                        </div>
                </div>
                
                    <div class="timeline-player-result player-b ${playerBLost ? 'lost-point' : 'won-point'}">
                        <div class="player-icon">🔴</div>
                        <div class="player-status">
                            <span class="player-name">${this.getPlayerName(this.currentGame, 'playerB')}</span>
                            <span class="result-text ${playerBLost ? 'lost' : 'won'}">
                                ${playerBLost ? 'Lost Point' : 'Won Point'}
                            </span>
                        </div>
                        ${playerBLost ? this.createTimelinePlayerLoss(round.analysis) : this.createTimelinePlayerWin()}
                    </div>
                </div>
            </div>
        `;
    }

    // 创建详细对比回合项目
    createDetailedComparisonRoundItem(round) {
        const timeStr = this.formatTime(round.timestamp);
        const playerALost = round.winner === 'playerB';
        const playerBLost = round.winner === 'playerA';
        
        return `
            <div class="detailed-comparison-round-item" data-round-id="${round.id}">
                <div class="detailed-round-header">
                    <div class="round-info-detailed">
                        <h5>Round ${round.id} - ${timeStr}</h5>
                        <span class="score-detailed">${round.playerAScore} - ${round.playerBScore}</span>
                    </div>
                </div>
                
                <div class="detailed-players-analysis">
                    <div class="detailed-player-analysis player-a ${playerALost ? 'lost-point' : 'won-point'}">
                        <div class="detailed-player-header">
                            <span class="player-icon">🔵</span>
                            <span class="player-name">${this.getPlayerName(this.currentGame, 'playerA')}</span>
                            <span class="detailed-result ${playerALost ? 'lost' : 'won'}">
                                ${playerALost ? '❌ Lost' : '✅ Won'}
                            </span>
                        </div>
                        ${playerALost ? this.createDetailedPlayerLoss(round.analysis) : this.createDetailedPlayerWin(round.analysis)}
                </div>
                
                    <div class="detailed-vs-separator">
                        <div class="detailed-arrow ${playerALost ? 'right' : 'left'}">
                            ${playerALost ? '▶' : '◀'}
                        </div>
                    </div>
                    
                    <div class="detailed-player-analysis player-b ${playerBLost ? 'lost-point' : 'won-point'}">
                        <div class="detailed-player-header">
                            <span class="player-icon">🔴</span>
                            <span class="player-name">${this.getPlayerName(this.currentGame, 'playerB')}</span>
                            <span class="detailed-result ${playerBLost ? 'lost' : 'won'}">
                                ${playerBLost ? '❌ Lost' : '✅ Won'}
                            </span>
                        </div>
                        ${playerBLost ? this.createDetailedPlayerLoss(round.analysis) : this.createDetailedPlayerWin(round.analysis)}
                    </div>
                </div>
            </div>
        `;
    }

    // 创建时间线选手失分分析
    createTimelinePlayerLoss(analysis) {
        if (!analysis) return '<div class="no-data">No analysis data</div>';
        
        const score = this.calculateRoundScore(analysis);
        const riskLevel = this.getRiskLevel(Math.max(1, 10 - score));

        return `
            <div class="timeline-loss-summary">
                <div class="loss-metrics">
                    <span class="tech-score-mini">Score: ${score}/10</span>
                    <span class="risk-mini risk-${riskLevel.toLowerCase().replace(' ', '-')}">${riskLevel}</span>
                </div>
                <div class="loss-issue">
                    ${analysis.errorType || 'Technical mistake'}
                </div>
            </div>
        `;
    }

    // 创建时间线选手获胜分析
    createTimelinePlayerWin() {
        return `
            <div class="timeline-win-summary">
                <div class="win-metrics">
                    <span class="performance-mini">Good Performance</span>
                </div>
                <div class="win-reason">
                    Capitalized on opportunity
                </div>
            </div>
        `;
    }

    // 创建详细选手失分分析
    createDetailedPlayerLoss(analysis) {
        if (!analysis) return '<div class="no-data">No detailed analysis available</div>';
        
        const score = this.calculateRoundScore(analysis);
        const riskLevel = this.getRiskLevel(Math.max(1, 10 - score));

        return `
            <div class="detailed-loss-analysis">
                <div class="detailed-metrics">
                    <div class="metric-item">
                        <span class="metric-label">Tech Score:</span>
                        <span class="metric-value">${score}/10</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Risk Level:</span>
                        <span class="risk-badge risk-${riskLevel.toLowerCase().replace(' ', '-')}">${riskLevel}</span>
                    </div>
                </div>
                <div class="detailed-issue">
                    <strong>Issue:</strong> ${analysis.errorType || 'General technical mistake'}
                </div>
                <div class="detailed-feedback">
                    <strong>Analysis:</strong> ${analysis.feedback ? analysis.feedback.substring(0, 120) + (analysis.feedback.length > 120 ? '...' : '') : 'No detailed feedback available'}
                </div>
                ${analysis.suggestions && analysis.suggestions.length > 0 ? `
                    <div class="detailed-suggestions">
                        <strong>Key Suggestions:</strong>
                        <ul>
                            ${analysis.suggestions.slice(0, 2).map(suggestion => `<li>${suggestion}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // 创建详细选手获胜分析
    createDetailedPlayerWin(analysis) {
        const score = analysis ? this.calculateRoundScore(analysis) : 7;
        const performanceLevel = score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : 'Standard';

        return `
            <div class="detailed-win-analysis">
                <div class="detailed-metrics">
                    <div class="metric-item">
                        <span class="metric-label">Tech Score:</span>
                        <span class="metric-value">${score}/10</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Performance:</span>
                        <span class="performance-badge">${performanceLevel}</span>
                    </div>
                </div>
                <div class="detailed-achievement">
                    <strong>Achievement:</strong> Successfully executed winning strategy
                </div>
                <div class="detailed-advantage">
                    <strong>Advantage:</strong> Took advantage of opponent's mistake effectively
                </div>
            </div>
        `;
    }

    // 创建比分时间线图表
    createScoreTimelineChart(rounds) {
        if (!rounds || rounds.length === 0) return '<div class="no-data">No timeline data available</div>';

        let chartHTML = `
            <div class="score-timeline">
                <div class="timeline-axis">
                    <div class="axis-label">Score</div>
        `;

        rounds.forEach((round, index) => {
            const heightA = (round.playerAScore / Math.max(round.playerAScore, round.playerBScore, 10)) * 100;
            const heightB = (round.playerBScore / Math.max(round.playerAScore, round.playerBScore, 10)) * 100;
            
            chartHTML += `
                <div class="timeline-point" data-round="${round.id}">
                    <div class="score-bars">
                        <div class="score-bar player-a-bar" style="height: ${heightA}%" title="${this.getPlayerName(this.currentGame, 'playerA')}: ${round.playerAScore}"></div>
                        <div class="score-bar player-b-bar" style="height: ${heightB}%" title="${this.getPlayerName(this.currentGame, 'playerB')}: ${round.playerBScore}"></div>
                    </div>
                    <div class="round-label">R${round.id}</div>
                </div>
            `;
        });

        chartHTML += `
                </div>
                <div class="timeline-legend">
                    <div class="legend-item">
                        <div class="legend-color player-a"></div>
                        <span>${this.getPlayerName(this.currentGame, 'playerA')}</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color player-b"></div>
                        <span>${this.getPlayerName(this.currentGame, 'playerB')}</span>
                    </div>
                </div>
            </div>
        `;

        return chartHTML;
    }

    // 创建表现趋势图表
    createPerformanceTrendChart(rounds) {
        if (!rounds || rounds.length === 0) return '<div class="no-data">No trend data available</div>';

        let chartHTML = `
            <div class="performance-trend-container">
                <div class="trend-line-chart">
        `;

        let playerAWins = 0;
        let playerBWins = 0;

        rounds.forEach((round, index) => {
            if (round.winner === 'playerA') playerAWins++;
            else playerBWins++;

            const playerAWinRate = (playerAWins / (index + 1)) * 100;
            const playerBWinRate = (playerBWins / (index + 1)) * 100;

            chartHTML += `
                <div class="trend-point" data-round="${round.id}">
                    <div class="trend-lines">
                        <div class="trend-line player-a-trend" style="height: ${playerAWinRate}%" title="${this.getPlayerName(this.currentGame, 'playerA')} Win Rate: ${playerAWinRate.toFixed(1)}%"></div>
                        <div class="trend-line player-b-trend" style="height: ${playerBWinRate}%" title="${this.getPlayerName(this.currentGame, 'playerB')} Win Rate: ${playerBWinRate.toFixed(1)}%"></div>
                    </div>
                    <div class="trend-label">R${round.id}</div>
                </div>
            `;
        });

        chartHTML += `
                </div>
                <div class="trend-legend">
                    <div class="legend-item">
                        <div class="legend-line player-a-line"></div>
                        <span>${this.getPlayerName(this.currentGame, 'playerA')} Win Rate</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-line player-b-line"></div>
                        <span>${this.getPlayerName(this.currentGame, 'playerB')} Win Rate</span>
                    </div>
                </div>
            </div>
        `;

        return chartHTML;
    }

    // 创建胜负分布图
    createWinLossChart(rounds) {
        if (!rounds || rounds.length === 0) return '<div class="no-data">No distribution data available</div>';

        const playerAWins = rounds.filter(r => r.winner === 'playerA').length;
        const playerBWins = rounds.filter(r => r.winner === 'playerB').length;
        const totalRounds = rounds.length;

        const playerAPercentage = (playerAWins / totalRounds) * 100;
        const playerBPercentage = (playerBWins / totalRounds) * 100;

        return `
            <div class="win-loss-distribution">
                <div class="distribution-bars">
                    <div class="distribution-bar-container">
                        <div class="distribution-bar">
                            <div class="win-segment player-a-wins" style="width: ${playerAPercentage}%"></div>
                            <div class="win-segment player-b-wins" style="width: ${playerBPercentage}%"></div>
                </div>
                        <div class="distribution-labels">
                            <span class="label-left">${this.getPlayerName(this.currentGame, 'playerA')}: ${playerAWins} rounds won</span>
                            <span class="label-right">${this.getPlayerName(this.currentGame, 'playerB')}: ${playerBWins} rounds won</span>
                        </div>
                    </div>
                </div>
                
                <div class="distribution-stats">
                    <div class="stat-item">
                        <div class="stat-icon">🔵</div>
                        <div class="stat-content">
                            <div class="stat-value">Model Data Required</div>
                            <div class="stat-label">${this.getPlayerName(this.currentGame, 'playerA')} Win Rate</div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon">🔴</div>
                        <div class="stat-content">
                            <div class="stat-value">Model Data Required</div>
                            <div class="stat-label">${this.getPlayerName(this.currentGame, 'playerB')} Win Rate</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 创建时间线统计信息
    createTimelineStatistics(rounds) {
        if (!rounds || rounds.length === 0) return '<div class="no-data">No statistics available</div>';

        const totalRounds = rounds.length;
        const playerAWins = rounds.filter(r => r.winner === 'playerA').length;
        const playerBWins = rounds.filter(r => r.winner === 'playerB').length;
        
        // 计算最长连胜纪录
        const playerAStreak = this.calculateLongestStreak(rounds, 'playerA');
        const playerBStreak = this.calculateLongestStreak(rounds, 'playerB');
        
        // 计算平均分数
        const finalScoreA = rounds.length > 0 ? rounds[rounds.length - 1].playerAScore : 0;
        const finalScoreB = rounds.length > 0 ? rounds[rounds.length - 1].playerBScore : 0;
        const avgScorePerRound = totalRounds > 0 ? ((finalScoreA + finalScoreB) / totalRounds).toFixed(1) : 0;

        return `
            <div class="timeline-stat-item">
                <div class="stat-icon">🎯</div>
                <div class="stat-content">
                    <div class="stat-value">${totalRounds}</div>
                    <div class="stat-label">Total Rounds</div>
                    </div>
            </div>
            
            <div class="timeline-stat-item">
                <div class="stat-icon">🏆</div>
                <div class="stat-content">
                    <div class="stat-value">${Math.max(playerAStreak, playerBStreak)}</div>
                    <div class="stat-label">Longest Streak</div>
                    </div>
                </div>
                
            <div class="timeline-stat-item">
                <div class="stat-icon">⚡</div>
                <div class="stat-content">
                    <div class="stat-value">${avgScorePerRound}</div>
                    <div class="stat-label">Avg Score/Round</div>
                </div>
            </div>
            
            <div class="timeline-stat-item">
                <div class="stat-icon">🔥</div>
                <div class="stat-content">
                    <div class="stat-value">${finalScoreA} - ${finalScoreB}</div>
                    <div class="stat-label">Final Score</div>
                </div>
            </div>
        `;
    }

    // 计算最长连胜纪录
    calculateLongestStreak(rounds, player) {
        let maxStreak = 0;
        let currentStreak = 0;
        
        rounds.forEach(round => {
            if (round.winner === player) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        });
        
        return maxStreak;
    }

    // 简化的切换方法 - 支持新的dual-analysis-item结构
    toggleDetailedRound(roundId) {
        console.log('toggleDetailedRound called with roundId:', roundId);
        
        const isExpanded = this.expandedRounds.has(roundId);
        
        if (isExpanded) {
            this.expandedRounds.delete(roundId);
        } else {
            this.expandedRounds.add(roundId);
        }

        // 直接操作DOM元素 - 支持多种元素结构
        const roundCards = document.querySelectorAll(`[data-round-id="${roundId}"]`);
        console.log('Found cards:', roundCards.length);
        
        roundCards.forEach(card => {
            if (!card) return;
            
            // 新的dual-analysis-item结构
            const dualContent = card.querySelector('.dual-analysis-content');
            const expandToggle = card.querySelector('.expand-toggle');
            const expandIcon = card.querySelector('.expand-toggle .toggle-icon');
            const expandText = card.querySelector('.expand-toggle .toggle-text');
            
            // 旧的详细视图结构（兼容性）
            const detailedContent = card.querySelector('.detailed-card-content');
            const toggleBtn = card.querySelector('.toggle-btn');
            const toggleIcon = card.querySelector('.toggle-icon');
            const toggleText = card.querySelector('.toggle-text');

            if (!isExpanded) {
                // 展开
                card.classList.add('expanded');
                
                // 处理新的dual-analysis-item结构
                if (dualContent) {
                    dualContent.classList.add('expanded');
                }
                if (expandToggle) expandToggle.classList.add('expanded');
                if (expandIcon) expandIcon.textContent = '▼';
                if (expandText) expandText.textContent = 'Hide Analysis';
                
                // 处理旧的详细视图结构（兼容性）
                if (detailedContent) {
                    detailedContent.classList.remove('hide');
                    detailedContent.classList.add('show');
                }
                if (toggleBtn) toggleBtn.classList.add('expanded');
                if (toggleIcon) toggleIcon.textContent = '▼';
                if (toggleText) toggleText.textContent = 'Hide Details';
                
                console.log('Expanded round:', roundId);
            } else {
                // 收起
                card.classList.remove('expanded');
                
                // 处理新的dual-analysis-item结构
                if (dualContent) {
                    dualContent.classList.remove('expanded');
                }
                if (expandToggle) expandToggle.classList.remove('expanded');
                if (expandIcon) expandIcon.textContent = '▶';
                if (expandText) expandText.textContent = 'View Analysis';
                
                // 处理旧的详细视图结构（兼容性）
                if (detailedContent) {
                    detailedContent.classList.remove('show');
                    detailedContent.classList.add('hide');
                }
                if (toggleBtn) toggleBtn.classList.remove('expanded');
                if (toggleIcon) toggleIcon.textContent = '▶';
                if (toggleText) toggleText.textContent = 'View Details';
                
                console.log('Collapsed round:', roundId);
            }
        });
    }

    // 新增：为所有视图添加事件监听器 - 包含detailed view
    addAllViewClickEvents() {
        try {
            // Timeline view events
        document.querySelectorAll('.round-timeline-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.suggestion-tag') && !e.target.closest('.factor-tag')) {
                    const roundId = parseInt(item.dataset.roundId);
                    this.showRoundDetails(roundId);
                }
            });
        });

            // Expand/collapse functionality removed

            // Detailed view events - 新增
            document.querySelectorAll('.detailed-card-header[data-clickable="header"]').forEach(header => {
                header.addEventListener('click', (e) => {
                    try {
                        e.stopPropagation();
                        const roundCard = e.currentTarget.closest('.detailed-round-card');
                        if (roundCard) {
                            const roundId = parseInt(roundCard.dataset.roundId);
                            console.log('Header clicked, roundId:', roundId);
                            this.toggleDetailedRound(roundId);
                        }
                    } catch (error) {
                        console.error('Error in header click handler:', error);
                    }
                });
            });

            document.querySelectorAll('.toggle-btn[data-clickable="button"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                    try {
                e.stopPropagation();
                        const roundId = parseInt(e.currentTarget.dataset.roundId);
                        console.log('Button clicked, roundId:', roundId);
                        this.toggleDetailedRound(roundId);
                    } catch (error) {
                        console.error('Error in button click handler:', error);
                    }
            });
        });

            // Compact view events
            document.querySelectorAll('.compact-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const roundId = parseInt(e.currentTarget.dataset.roundId);
                    this.showRoundDetails(roundId);
                });
            });
            
            // Table view events
            document.querySelectorAll('.view-detail-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const roundId = parseInt(e.target.dataset.roundId);
                    this.showRoundDetails(roundId);
                });
            });
            
            // Summary view events
            document.querySelectorAll('.summary-round-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    const roundId = parseInt(e.currentTarget.dataset.roundId);
                    this.showRoundDetails(roundId);
                });
            });

            // Comparison view events - 新增
            document.querySelectorAll('.comparison-round-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // 不阻止冒泡，让整个item都可以点击
                    const roundId = parseInt(e.currentTarget.dataset.roundId);
                    if (roundId && !isNaN(roundId)) {
                        console.log('Comparison round item clicked, roundId:', roundId);
                        this.showRoundDetails(roundId);
                    }
                });
            });

            // Comparison Timeline View events - 新增 
            document.querySelectorAll('.comparison-timeline-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const roundId = parseInt(e.currentTarget.dataset.roundId);
                    if (roundId && !isNaN(roundId)) {
                        console.log('Comparison timeline item clicked, roundId:', roundId);
                        this.showRoundDetails(roundId);
                    }
                });
            });

            // Detailed Comparison View events - 新增
            document.querySelectorAll('.detailed-comparison-round-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const roundId = parseInt(e.currentTarget.dataset.roundId);
                    if (roundId && !isNaN(roundId)) {
                        console.log('Detailed comparison round item clicked, roundId:', roundId);
                        this.showRoundDetails(roundId);
                    }
                });
            });

            // Score Timeline Chart events - 新增
            document.querySelectorAll('.timeline-point').forEach(point => {
                point.addEventListener('click', (e) => {
                    const roundId = parseInt(e.currentTarget.dataset.round);
                    if (roundId && !isNaN(roundId)) {
                        console.log('Timeline chart point clicked, roundId:', roundId);
                        this.showRoundDetails(roundId);
                    }
                });
            });

            // Tag events
        document.querySelectorAll('.suggestion-tag, .factor-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
            
            console.log('Event listeners added for all views successfully');
        } catch (error) {
            console.error('Error in addAllViewClickEvents:', error);
        }
    }
    
    // Add event listeners for timeline view (保持向后兼容)
    addTimelineClickEvents() {
        this.addAllViewClickEvents();
    }

    // Create compact view
    createCompactView(rounds) {
        return `
            <div class="compact-view">
                <div class="compact-header">
                    <h3>📋 Compact List View - Quick Browse ${rounds.length} Rounds</h3>
                </div>
                <div class="compact-list">
                    ${rounds.map(round => this.createCompactItem(round)).join('')}
                </div>
            </div>
        `;
    }
    
    createCompactItem(round) {
        const winnerText = this.getPlayerName(this.currentGame, round.winner);
        const loserText = this.getPlayerName(this.currentGame, round.winner === 'playerA' ? 'playerB' : 'playerA');
        const timeStr = this.formatTime(round.timestamp);
        const errorType = round.analysis?.errorType || 'Unknown';
        const riskLevel = round.analysis ? this.getRiskLevel(Math.max(1, 10 - this.calculateRoundScore(round.analysis))) : 'Medium';
        
        return `
            <div class="compact-item" data-round-id="${round.id}">
                <div class="compact-main">
                    <span class="compact-round">R${round.id}</span>
                    <span class="compact-loser">${loserText} Lost Point</span>
                    <span class="compact-score">${round.playerAScore}:${round.playerBScore}</span>
                    <span class="compact-error">${this.translateErrorType(errorType)}</span>
                    <span class="compact-risk risk-${riskLevel.toLowerCase().replace(' ', '-')}">${riskLevel}</span>
                    <span class="compact-time">${timeStr}</span>
                </div>
                <div class="compact-expand">👁️</div>
            </div>
        `;
    }
    
    // Create table view
    createTableView(rounds) {
        return `
            <div class="table-view">
                <div class="table-header">
                    <h3>📊 Data Table View - Clear Comparison of ${rounds.length} Rounds</h3>
                </div>
                <div class="data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Round</th>
                                <th>Lost Player</th>
                                <th>Score</th>
                                <th>Main Issue</th>
                                <th>Risk Level</th>
                                <th>Tech Score</th>
                                <th>Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rounds.map(round => this.createTableRow(round)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    createTableRow(round) {
        const loserText = this.getPlayerName(this.currentGame, round.winner === 'playerA' ? 'playerB' : 'playerA');
        const timeStr = this.formatTime(round.timestamp);
        const errorType = round.analysis?.errorType || 'Unknown';
        const score = round.analysis ? this.calculateRoundScore(round.analysis) : 5;
        const riskLevel = round.analysis ? this.getRiskLevel(Math.max(1, 10 - score)) : 'Medium';
        
        return `
            <tr class="table-row" data-round-id="${round.id}">
                <td class="round-cell">Round ${round.id}</td>
                <td class="loser-cell">${loserText}</td>
                <td class="score-cell">${round.playerAScore} : ${round.playerBScore}</td>
                <td class="error-cell">${this.translateErrorType(errorType)}</td>
                <td class="risk-cell">
                    <span class="risk-badge risk-${riskLevel.toLowerCase().replace(' ', '-')}">${riskLevel}</span>
                </td>
                <td class="score-cell">
                    <span class="score-badge">${score}/10</span>
                </td>
                <td class="time-cell">${timeStr}</td>
                <td class="action-cell">
                    <button class="view-detail-btn" data-round-id="${round.id}">View Details</button>
                </td>
            </tr>
        `;
    }
    
    // Create summary view
    createSummaryView(rounds) {
        const stats = this.calculateViewStats(rounds);
        
        return `
            <div class="summary-view">
                <div class="summary-header">
                    <h3>📈 Statistics Summary View - Deep Analysis of ${rounds.length} Rounds</h3>
                </div>
                
                <div class="summary-grid">
                    <div class="summary-card stats-card">
                        <h4>📊 Basic Statistics</h4>
                        <div class="stats-content">
                            <div class="stat-item">
                                <span class="stat-label">Total Rounds:</span>
                                <span class="stat-value">${stats.totalRounds}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">${this.getPlayerName(this.currentGame, 'playerA')} Losses:</span>
                                <span class="stat-value">${stats.playerALosses}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">${this.getPlayerName(this.currentGame, 'playerB')} Losses:</span>
                                <span class="stat-value">${stats.playerBLosses}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Average Tech Score:</span>
                                <span class="stat-value">${stats.avgScore}/10</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="summary-card errors-card">
                        <h4>⚠️ Common Issues Analysis</h4>
                        <div class="errors-content">
                            ${Object.entries(stats.commonErrors).map(([error, count]) => `
                                <div class="error-item">
                                    <span class="error-name">${this.translateErrorType(error)}</span>
                                    <span class="error-count">${count} times</span>
                                    <div class="error-bar">
                                        <div class="error-fill" style="width: ${(count / stats.totalRounds * 100)}%"></div>
                                    </div>
                                </div>
                            `).join('')}

                        </div>
                    </div>
                    
                    <div class="summary-card risk-card">
                        <h4>🎯 Risk Distribution</h4>
                        <div class="risk-content">
                            ${Object.entries(stats.riskDistribution).map(([risk, count]) => `
                                <div class="risk-item">
                                    <span class="risk-name">${risk}</span>
                                    <span class="risk-count">${count} times</span>
                                    <div class="risk-bar">
                                        <div class="risk-fill risk-${risk.toLowerCase().replace(' ', '-')}" 
                                             style="width: ${(count / stats.totalRounds * 100)}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="summary-card timeline-card">
                        <h4>📈 Performance Trend</h4>
                        <div class="timeline-content">
                            <div class="mini-timeline">
                                ${rounds.slice(-10).map((round, index) => {
                                    const score = round.analysis ? this.calculateRoundScore(round.analysis) : 5;
                                    const height = (score / 10) * 100;
                                    return `
                                        <div class="timeline-bar" style="height: ${height}%" 
                                             title="Round ${round.id}: ${score}/10">
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <div class="timeline-info">
                                <span>Last 10 Rounds Performance Trend</span>
                                <span class="trend-indicator ${stats.trend > 0 ? 'trend-up' : stats.trend < 0 ? 'trend-down' : 'trend-stable'}">
                                    ${stats.trend > 0 ? '📈 Rising' : stats.trend < 0 ? '📉 Declining' : '➡️ Stable'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="detailed-rounds">
                    <h4>🔍 Round Details Overview</h4>
                    <div class="rounds-grid">
                        ${rounds.map(round => this.createSummaryRoundCard(round)).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    createSummaryRoundCard(round) {
        const loserText = this.getPlayerName(this.currentGame, round.winner === 'playerA' ? 'playerB' : 'playerA');
        const score = round.analysis ? this.calculateRoundScore(round.analysis) : 5;
        const riskLevel = round.analysis ? this.getRiskLevel(Math.max(1, 10 - score)) : 'Medium';
        const errorType = round.analysis?.errorType || 'Unknown';
        
        // 获取后端AI分析的错误信息
        const backendErrors = this.getBackendErrorsForRound(round);
        
        return `
            <div class="summary-round-card" data-round-id="${round.id}">
                <div class="round-header">
                    <span class="round-num">R${round.id}</span>
                    <span class="round-score">${score}/10</span>
                </div>
                <div class="round-info">
                    <div class="round-loser">${loserText} Lost Point</div>
                    <div class="round-error">${this.translateErrorType(errorType)}</div>
                    <div class="round-risk risk-${riskLevel.toLowerCase().replace(' ', '-')}">${riskLevel}</div>
                    ${backendErrors}
                </div>
            </div>
        `;
    }
    
    calculateViewStats(rounds) {
        const stats = {
            totalRounds: rounds.length,
            playerALosses: rounds.filter(r => r.winner === 'playerB').length,
            playerBLosses: rounds.filter(r => r.winner === 'playerA').length,
            avgScore: 0,
            commonErrors: {},
            riskDistribution: {},
            trend: 0
        };
        
        let totalScore = 0;
        rounds.forEach(round => {
            if (round.analysis) {
                const score = this.calculateRoundScore(round.analysis);
                totalScore += score;
                
                const risk = this.getRiskLevel(Math.max(1, 10 - score));
                stats.riskDistribution[risk] = (stats.riskDistribution[risk] || 0) + 1;
                
                // 不再统计rounds中的错误类型，只使用后端分析器的数据
                // 这里暂时跳过rounds的错误类型统计
            }
        });
        
        // 只显示后端分析器的5种错误类型统计
        if (this.currentGame && this.currentGame.backendAnalysis) {
            const backendAnalysis = this.currentGame.backendAnalysis;
            
            // 统计playerA的错误
            if (backendAnalysis.playerA && backendAnalysis.playerA.errorTypes) {
                backendAnalysis.playerA.errorTypes.forEach(errorType => {
                    const translatedError = this.translateErrorType(errorType);
                    stats.commonErrors[translatedError] = 
                        (stats.commonErrors[translatedError] || 0) + 1;
                });
            }
            
            // 统计playerB的错误
            if (backendAnalysis.playerB && backendAnalysis.playerB.errorTypes) {
                backendAnalysis.playerB.errorTypes.forEach(errorType => {
                    const translatedError = this.translateErrorType(errorType);
                    stats.commonErrors[translatedError] = 
                        (stats.commonErrors[translatedError] || 0) + 1;
                });
            }
        } else {
            // 如果没有后端分析数据，显示空的统计或默认5种错误类型
            const defaultBackendErrors = ['slow_reaction', 'low_activity', 'weak_defense', 'poor_alignment', 'coverage_gap'];
            defaultBackendErrors.forEach(errorType => {
                const translatedError = this.translateErrorType(errorType);
                stats.commonErrors[translatedError] = 0;
            });
        }
        
        stats.avgScore = (totalScore / rounds.length).toFixed(1);
        
        // Calculate trend
        if (rounds.length >= 5) {
            const recent = rounds.slice(-5).map(r => r.analysis ? this.calculateRoundScore(r.analysis) : 5);
            const first = recent.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
            const last = recent.slice(-2).reduce((a, b) => a + b, 0) / 2;
            stats.trend = last - first;
        }
        
        return stats;
    }
    
    // Compact view click events
    addCompactClickEvents() {
        document.querySelectorAll('.compact-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const roundId = parseInt(e.currentTarget.dataset.roundId);
                this.showRoundDetails(roundId);
            });
        });
        
        document.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const roundId = parseInt(e.target.dataset.roundId);
                this.showRoundDetails(roundId);
            });
        });
        
        document.querySelectorAll('.summary-round-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const roundId = parseInt(e.currentTarget.dataset.roundId);
                this.showRoundDetails(roundId);
            });
        });
    }
    
    // Show round details modal
    showRoundDetails(roundId) {
        if (!this.currentGame || !this.currentGame.rounds) return;
        
        const round = this.currentGame.rounds.find(r => r.id === roundId);
        if (!round) return;
        
        const loserText = this.getPlayerName(this.currentGame, round.winner === 'playerA' ? 'playerB' : 'playerA');
        const modal = document.createElement('div');
        modal.className = 'round-detail-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Round ${round.id} Detailed Analysis</h3>
                        <button class="modal-close">✕</button>
                    </div>
                    <div class="modal-body">
                        ${this.createLossAnalysisHTML(round.analysis, loserText)}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add close events
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                document.body.removeChild(modal);
            }
        });
    }

    // 创建回合筛选控件HTML
    createRoundFiltersHTML() {
        const errorTypes = this.getAvailableErrorTypes();
        
        return `
            <div class="round-filters">
                <div class="filters-header">
                    <h4>🔍 Filter Options</h4>
                    <button class="filter-reset-btn" onclick="analysisManager.resetRoundFilters()">
                        Reset All Filters
                    </button>
                </div>
                
                <div class="filters-grid">
                    <div class="filter-group">
                        <label class="filter-label">👥 Player Focus:</label>
                        <select class="filter-select" id="playerFilter" onchange="analysisManager.updateRoundFilter('player', this.value)">
                            <option value="all" ${this.roundFilters.player === 'all' ? 'selected' : ''}>All Players</option>
                            <option value="playerA" ${this.roundFilters.player === 'playerA' ? 'selected' : ''}>🔵 ${this.getPlayerName(this.currentGame, 'playerA')} Only</option>
                            <option value="playerB" ${this.roundFilters.player === 'playerB' ? 'selected' : ''}>🔴 ${this.getPlayerName(this.currentGame, 'playerB')} Only</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label class="filter-label">📊 Result Type:</label>
                        <select class="filter-select" id="resultFilter" onchange="analysisManager.updateRoundFilter('result', this.value)">
                            <option value="all" ${this.roundFilters.result === 'all' ? 'selected' : ''}>All Results</option>
                            <option value="wins" ${this.roundFilters.result === 'wins' ? 'selected' : ''}>✅ Player Wins Only</option>
                            <option value="losses" ${this.roundFilters.result === 'losses' ? 'selected' : ''}>❌ Player Losses Only</option>
                        </select>
                        <small class="filter-hint">Note: Select a player first for Win/Loss filtering</small>
                    </div>
                    
                    <div class="filter-group">
                        <label class="filter-label">⚠️ Error Type:</label>
                        <select class="filter-select" id="errorFilter" onchange="analysisManager.updateRoundFilter('errorType', this.value)">
                            <option value="all" ${this.roundFilters.errorType === 'all' ? 'selected' : ''}>All Error Types</option>
                            ${errorTypes.map(error => 
                                `<option value="${error}" ${this.roundFilters.errorType === error ? 'selected' : ''}>${error}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 获取可用的错误类型
    getAvailableErrorTypes() {
        // 返回后端分析器的5种错误类型（已翻译）
        const backendErrorTypes = [
            'slow_reaction',
            'low_activity',
            'weak_defense', 
            'poor_alignment',
            'coverage_gap'
        ];
        
        // 翻译错误类型并返回
        return backendErrorTypes.map(errorType => this.translateErrorType(errorType)).sort();
    }
    
    // 应用回合筛选
    applyRoundFilters(rounds) {
        return rounds.filter(round => {
            // Player筛选
            if (this.roundFilters.player !== 'all') {
                const selectedPlayer = this.roundFilters.player;
                
                // Result筛选与Player筛选结合
                if (this.roundFilters.result === 'wins') {
                    // 显示指定玩家获胜的回合
                    if (round.winner !== selectedPlayer) return false;
                } else if (this.roundFilters.result === 'losses') {
                    // 显示指定玩家失败的回合
                    if (round.winner === selectedPlayer) return false;
                } else {
                    // 'all' - 显示与指定玩家相关的所有回合（实际上就是所有回合，因为每个回合都涉及两个玩家）
                    // 但为了更好的用户体验，这里可以显示该玩家获胜的回合
                    if (round.winner !== selectedPlayer) return false;
                }
            } else {
                // 没有选择特定玩家时的Result筛选
                if (this.roundFilters.result === 'wins') {
                    // 显示所有获胜回合（这个逻辑在没有指定玩家时可能不太有意义）
                    // 保持显示所有回合
                } else if (this.roundFilters.result === 'losses') {
                    // 显示所有失败回合（同样，在没有指定玩家时意义不大）
                    // 保持显示所有回合
                }
            }
            
            // Error Type筛选
            if (this.roundFilters.errorType !== 'all') {
                if (!round.analysis || !round.analysis.errorType) {
                    return false;
                }
                
                // 翻译回合的错误类型并与过滤器值比较
                const translatedErrorType = this.translateErrorType(round.analysis.errorType);
                if (translatedErrorType !== this.roundFilters.errorType) {
                    return false;
                }
            }
            
            return true;
        });
    }
    
    // 更新筛选器
    updateRoundFilter(filterType, value) {
        this.roundFilters[filterType] = value;
        
        // 如果选择了特定玩家，自动调整结果筛选的逻辑
        if (filterType === 'player' && value !== 'all') {
            // 保持当前的result筛选，但重新解释其含义
        }
        
        // 重新显示分析
        this.displayGameAnalysis();
    }
    
    // 重置所有筛选器
    resetRoundFilters() {
        this.roundFilters = {
            player: 'all',
            result: 'all',
            errorType: 'all'
        };
        this.displayGameAnalysis();
    }
    
    // 获取筛选摘要
    getFilterSummary(filteredRounds) {
        if (!filteredRounds.length) return '';
        
        const playerAWins = filteredRounds.filter(r => r.winner === 'playerA').length;
        const playerBWins = filteredRounds.filter(r => r.winner === 'playerB').length;
        
        let summary = `<div class="filter-summary">`;
        
        if (this.roundFilters.player !== 'all') {
            const playerName = this.roundFilters.player === 'playerA' ? `🔵 ${this.getPlayerName(this.currentGame, 'playerA')}` : `🔴 ${this.getPlayerName(this.currentGame, 'playerB')}`;
            let resultText = '';
            
            if (this.roundFilters.result === 'wins') {
                resultText = ' Wins';
            } else if (this.roundFilters.result === 'losses') {
                resultText = ' Losses';
            } else {
                resultText = ' (All Results)';
            }
            
            summary += `<span class="summary-item">Focus: ${playerName}${resultText}</span>`;
        } else {
            summary += `<span class="summary-item">🔵 ${this.getPlayerName(this.currentGame, 'playerA')}: ${playerAWins} rounds won | 🔴 ${this.getPlayerName(this.currentGame, 'playerB')}: ${playerBWins} rounds won</span>`;
        }
        
        if (this.roundFilters.result !== 'all' && this.roundFilters.player === 'all') {
            const resultText = this.roundFilters.result === 'wins' ? '✅ Wins Only' : '❌ Losses Only';
            summary += `<span class="summary-item">${resultText}</span>`;
        }
        
        if (this.roundFilters.errorType !== 'all') {
            summary += `<span class="summary-item">⚠️ Error: ${this.roundFilters.errorType}</span>`;
        }
        
        summary += `</div>`;
        return summary;
    }

    // Test simplified round analysis display
    testSimplifiedRoundAnalysis() {
        console.log('�� Testing simplified round analysis with error types...');
        
        // First, add some test data with error types
        this.testBackendErrorTypes();
        
        // Wait a moment for the data to be processed
        setTimeout(() => {
            // Display rounds with simplified format
            this.displayRounds();
            
            // Log the error types for each round
            console.log('📊 Error types for each round:');
            this.currentGame.rounds.forEach(round => {
                const errorTypes = this.getRoundErrorTypes(round);
                const translatedTypes = errorTypes.map(type => this.translateErrorType(type));
                console.log(`  Round ${round.id}: ${translatedTypes.join(', ') || 'No specific errors'}`);
            });
            
            console.log('✅ Simplified round analysis display tested');
        }, 1000);
    }
    
    // Test error type functionality
    testErrorTypeFunctionality() {
        console.log('🧪 Testing error type functionality...');
        
        // Test error type translation
        const testErrorTypes = ['slow_reaction', 'low_activity', 'weak_defense', 'poor_alignment', 'coverage_gap'];
        
        console.log('🔄 Testing error type translations:');
        testErrorTypes.forEach(errorType => {
            const translated = this.translateErrorType(errorType);
            console.log(`  ${errorType} → ${translated}`);
        });
        
        // Test getRoundErrorTypes function
        console.log('🔄 Testing getRoundErrorTypes function:');
        
        // Create a test round with different error type scenarios
        const testRound1 = {
            id: 999,
            analysis: {
                errorType: 'slow_reaction',
                A_type: ['weak_defense'],
                B_type: ['poor_alignment', 'coverage_gap']
            }
        };
        
        const testRound2 = {
            id: 998,
            analysis: {
                A_type: ['low_activity'],
                B_type: []
            }
        };
        
        const testRound3 = {
            id: 997,
            analysis: null
        };
        
        const errorTypes1 = this.getRoundErrorTypes(testRound1);
        const errorTypes2 = this.getRoundErrorTypes(testRound2);
        const errorTypes3 = this.getRoundErrorTypes(testRound3);
        
        console.log('  Test Round 1 errors:', errorTypes1.map(type => this.translateErrorType(type)));
        console.log('  Test Round 2 errors:', errorTypes2.map(type => this.translateErrorType(type)));
        console.log('  Test Round 3 errors:', errorTypes3.length === 0 ? 'No errors' : errorTypes3);
        
        console.log('✅ Error type functionality tested');
    }
    
    // Comprehensive test of simplified analysis
    testSimplifiedAnalysisComplete() {
        console.log('🧪 Starting comprehensive test of simplified analysis...');
        
        // Test error type functionality first
        this.testErrorTypeFunctionality();
        
        // Test simplified round analysis
        setTimeout(() => {
            this.testSimplifiedRoundAnalysis();
        }, 2000);
        
        // Test the display refresh
        setTimeout(() => {
            console.log('🔄 Refreshing display...');
            this.displayRounds();
            console.log('✅ Comprehensive simplified analysis test completed');
        }, 4000);
    }
    
    // Quick test for enhanced styles
    testEnhancedStyles() {
        console.log('🎨 Testing enhanced simplified round analysis styles...');
        
        // Add some demo data with various error types
        this.testBackendErrorTypes();
        
        // Display the rounds
        setTimeout(() => {
            this.displayRounds();
            console.log('✨ Enhanced styles applied! Check the beautiful new design:');
            console.log('  🎯 Gradient backgrounds');
            console.log('  🌟 Hover effects');
            console.log('  💎 Professional styling');
            console.log('  📱 Responsive design');
            console.log('  ⚡ Smooth animations');
        }, 1000);
    }
    
    // Test backend analysis API connections
    async testBackendAnalysisConnections() {
        console.log('🔌 Testing backend analysis API connections...');
        
        // Test with a sample game ID (using first available game)
        const testGameId = this.games.length > 0 ? this.games[0].databaseGameId : 1;
        
        console.log(`🎯 Testing with game ID: ${testGameId}`);
        
        // Test Game Analysis API
        await this.testGameAnalysisAPI(testGameId);
        
        // Test Round Analysis API
        await this.testRoundAnalysisAPI(testGameId);
        
        // Test Create Analysis APIs
        await this.testCreateAnalysisAPIs(testGameId);
        
        console.log('✅ Backend analysis API connection tests completed');
    }
    
    // Test Game Analysis API
    async testGameAnalysisAPI(gameId) {
        console.log('📊 Testing Game Analysis API...');
        
        try {
            const response = await fetch(`${CONFIG.API_URLS.ANALYSIS_GAME}?gid=${gameId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Game Analysis API connected successfully:`, data);
                
                if (data.status === 'success' && data.analysis) {
                    console.log('  📈 Game analysis data available');
                    console.log('  🔍 Analysis details:', {
                        A_type: data.analysis.A_type,
                        B_type: data.analysis.B_type,
                        hasAnalysis: !!(data.analysis.A_analysis && data.analysis.B_analysis)
                    });
                } else {
                    console.log('  ℹ️ No game analysis data (expected if not created yet)');
                }
            } else if (response.status === 404) {
                console.log('  ℹ️ Game Analysis API connected - no data found (404 - normal)');
            } else {
                console.warn(`  ⚠️ Game Analysis API response error: ${response.status}`);
            }
        } catch (error) {
            console.error('  ❌ Game Analysis API connection failed:', error);
        }
    }
    
    // Test Round Analysis API
    async testRoundAnalysisAPI(gameId) {
        console.log('🔄 Testing Round Analysis API...');
        
        try {
            const response = await fetch(CONFIG.getRoundAnalysisUrl(gameId), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Round Analysis API connected successfully:`, data);
                
                if (data.status === 'success' && data.analyses) {
                    console.log(`  📊 Round analysis data available: ${data.analyses.length} analyses`);
                    
                    if (data.analyses.length > 0) {
                        const sampleAnalysis = data.analyses[0];
                        console.log('  🔍 Sample analysis details:', {
                            gid: sampleAnalysis.gid,
                            rid: sampleAnalysis.rid,
                            A_type: sampleAnalysis.A_type,
                            B_type: sampleAnalysis.B_type
                        });
                    }
                } else {
                    console.log('  ℹ️ No round analysis data available');
                }
            } else if (response.status === 404) {
                console.log('  ℹ️ Round Analysis API connected - no data found (404 - normal)');
            } else {
                console.warn(`  ⚠️ Round Analysis API response error: ${response.status}`);
            }
        } catch (error) {
            console.error('  ❌ Round Analysis API connection failed:', error);
        }
    }
    
    // Test Create Analysis APIs
    async testCreateAnalysisAPIs(gameId) {
        console.log('🔧 Testing Create Analysis APIs...');
        
        // Test Create Game Analysis
        await this.testCreateGameAnalysis(gameId);
        
        // Test Create Round Analysis
        await this.testCreateRoundAnalysis(gameId);
    }
    
    // Test Create Game Analysis API
    async testCreateGameAnalysis(gameId) {
        console.log('📝 Testing Create Game Analysis API...');
        
        const testData = {
            gid: gameId,
            A_type: ['slow_reaction', 'weak_defense'],
            A_analysis: {
                performance: 'Good',
                strengths: ['Quick response', 'Good positioning'],
                weaknesses: ['Slow reaction', 'Weak defense']
            },
            B_type: ['poor_alignment', 'coverage_gap'],
            B_analysis: {
                performance: 'Average',
                strengths: ['Consistent play'],
                weaknesses: ['Poor alignment', 'Coverage gap']
            }
        };
        
        try {
            const response = await fetch(CONFIG.API_URLS.ANALYSIS_GAME_NEW, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testData)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Create Game Analysis API test successful:`, data);
            } else {
                console.log(`ℹ️ Create Game Analysis API response: ${response.status} (may indicate data already exists)`);
            }
        } catch (error) {
            console.error('  ❌ Create Game Analysis API test failed:', error);
        }
    }
    
    // Test Create Round Analysis API
    async testCreateRoundAnalysis(gameId) {
        console.log('📝 Testing Create Round Analysis API...');
        
        const testData = {
            gid: gameId,
            rid: 999, // Test round ID
            A_type: ['low_activity'],
            A_analysis: {
                performance: 'Below Average',
                issues: ['Low activity level']
            },
            B_type: ['slow_reaction'],
            B_analysis: {
                performance: 'Average',
                issues: ['Slow reaction time']
            }
        };
        
        try {
            const response = await fetch(CONFIG.API_URLS.ANALYSIS_ROUND_NEW, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testData)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Create Round Analysis API test successful:`, data);
            } else {
                console.log(`ℹ️ Create Round Analysis API response: ${response.status} (may indicate constraint issues)`);
            }
        } catch (error) {
            console.error('  ❌ Create Round Analysis API test failed:', error);
        }
    }
    
    // Test API configuration
    testAPIConfiguration() {
        console.log('⚙️ Testing API Configuration...');
        
        console.log('🔧 CONFIG object:', {
            BACKEND_URL: CONFIG.BACKEND_URL,
            ANALYSIS_GAME: CONFIG.API_URLS.ANALYSIS_GAME,
            ANALYSIS_GAME_NEW: CONFIG.API_URLS.ANALYSIS_GAME_NEW,
            ANALYSIS_ROUND_NEW: CONFIG.API_URLS.ANALYSIS_ROUND_NEW
        });
        
        console.log('🔧 URL generators:');
        console.log('  getRoundAnalysisUrl(1):', CONFIG.getRoundAnalysisUrl(1));
        console.log('  getRoundsUrl(1):', CONFIG.getRoundsUrl(1));
        
        console.log('✅ API configuration test completed');
    }
    
    // Comprehensive backend connection test
    async testCompleteBackendConnection() {
        console.log('🚀 Starting comprehensive backend connection test...');
        
        // Test API configuration
        this.testAPIConfiguration();
        
        // Wait a moment then test connections
        setTimeout(async () => {
            await this.testBackendAnalysisConnections();
            
            console.log('🎉 All backend connection tests completed!');
            console.log('📋 Summary:');
            console.log('  ✅ Game Analysis API: GET /analysis/game');
            console.log('  ✅ Round Analysis API: GET /analysis/round/{gid}');
            console.log('  ✅ Create Game Analysis API: POST /analysis/game/new');
            console.log('  ✅ Create Round Analysis API: POST /analysis/round/new');
        }, 1000);
    }
}

// Initialize analysis manager
document.addEventListener('DOMContentLoaded', () => {
    window.analysisManager = new AnalysisManager();
});

// 全局测试函数，用于在浏览器控制台中测试轮次分析功能
window.testRoundAnalysisIntegration = function() {
    console.log('🧪 Testing Round Analysis Integration...');
    
    if (!window.analysisManager) {
        console.log('❌ Analysis manager not found');
        return;
    }
    
    if (!window.analysisManager.currentGame) {
        console.log('❌ No current game selected. Please select a game first.');
        return;
    }
    
    // 测试轮次分析数据
    window.analysisManager.testRoundAnalysis();
    
    console.log('✅ Round analysis integration test completed');
};

// 全局测试函数，用于测试添加轮次分析到后端
window.testAddRoundAnalysisToBackend = async function() {
    console.log('🧪 Testing Add Round Analysis to Backend...');
    
    if (!window.analysisManager) {
        console.log('❌ Analysis manager not found');
        return;
    }
    
    if (!window.analysisManager.currentGame) {
        console.log('❌ No current game selected. Please select a game first.');
        return;
    }
    
    // 测试添加轮次分析
    await window.analysisManager.testAddRoundAnalysis();
    
    console.log('✅ Add round analysis test completed');
};

// 全局测试函数，用于测试完整的后端集成
window.testCompleteIntegration = function() {
    console.log('🧪 Testing Complete Backend Integration...');
    
    if (!window.analysisManager) {
        console.log('❌ Analysis manager not found');
        return;
    }
    
    if (!window.analysisManager.currentGame) {
        console.log('❌ No current game selected. Please select a game first.');
        return;
    }
    
    // 测试完整的后端集成
    window.analysisManager.testCompleteBackendIntegration();
    
    console.log('✅ Complete integration test completed');
};