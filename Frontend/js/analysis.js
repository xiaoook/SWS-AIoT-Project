// Round Analysis Manager
class AnalysisManager {
    constructor() {
        this.rounds = [];
        this.currentFilter = 'all';
        this.expandedRounds = new Set();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.refreshAnalysis();
    }
    
    setupEventListeners() {
        // Filter button events
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
        
        // Listen for game state changes
        document.addEventListener('gameStateChange', () => {
            this.refreshAnalysis();
        });
    }
    
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter button states
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            }
        });
        
        this.displayRounds();
    }
    
    refreshAnalysis() {
        if (window.smartCourtApp && window.smartCourtApp.gameState) {
            this.rounds = [...window.smartCourtApp.gameState.rounds];
            this.displayRounds();
        }
    }
    
    addRound(round) {
        this.rounds.push(round);
        this.displayRounds();
    }
    
    displayRounds() {
        const container = document.getElementById('pointBreakdown');
        if (!container) return;
        
        const filteredRounds = this.getFilteredRounds();
        
        if (filteredRounds.length === 0) {
            container.innerHTML = '<div class="no-data">No match data available</div>';
            return;
        }
        
        const roundsHTML = filteredRounds.map(round => this.createRoundHTML(round)).join('');
        container.innerHTML = roundsHTML;
        
        // Add click events
        this.addRoundClickEvents();
    }
    
    getFilteredRounds() {
        switch (this.currentFilter) {
            case 'playerA':
                return this.rounds.filter(round => round.winner === 'playerA');
            case 'playerB':
                return this.rounds.filter(round => round.winner === 'playerB');
            default:
                return this.rounds;
        }
    }
    
    createRoundHTML(round) {
        const isExpanded = this.expandedRounds.has(round.id);
        const winnerText = round.winner === 'playerA' ? 'Player A' : 'Player B';
        const timeStr = this.formatTime(round.timestamp);
        
        return `
            <div class="point-item" data-round-id="${round.id}">
                <div class="point-header">
                    <span class="round-number">Round ${round.id}</span>
                    <span class="point-winner">${winnerText} scored</span>
                    <span class="point-timestamp">${timeStr}</span>
                </div>
                
                <div class="point-score">
                    Current Score: ${round.playerAScore} - ${round.playerBScore}
                </div>
                
                <div class="point-details ${isExpanded ? 'expanded' : ''}">
                    ${this.createAnalysisHTML(round.analysis)}
                </div>
                
                <div class="expand-indicator ${isExpanded ? 'expanded' : ''}">
                    ${isExpanded ? '▼ Hide Details' : '▶ Show Details'}
                </div>
            </div>
        `;
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
    
    calculateRoundScore(analysis) {
        // Simple scoring algorithm
        let score = 7; // Base score
        
        if (analysis.feedback.includes('excellent')) score += 2;
        if (analysis.feedback.includes('good')) score += 1;
        if (analysis.feedback.includes('standard')) score += 1;
        if (analysis.errorType) score -= 1;
        
        return Math.max(1, Math.min(10, score));
    }
    
    addRoundClickEvents() {
        document.querySelectorAll('.point-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const roundId = parseInt(e.currentTarget.dataset.roundId);
                this.toggleRoundExpansion(roundId);
            });
        });
    }
    
    toggleRoundExpansion(roundId) {
        if (this.expandedRounds.has(roundId)) {
            this.expandedRounds.delete(roundId);
        } else {
            this.expandedRounds.add(roundId);
        }
        
        this.displayRounds();
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
        if (this.rounds.length === 0) return null;
        
        const stats = {
            totalRounds: this.rounds.length,
            playerAWins: this.rounds.filter(r => r.winner === 'playerA').length,
            playerBWins: this.rounds.filter(r => r.winner === 'playerB').length,
            averageScore: 0,
            commonErrors: {},
            improvements: {},
            timeline: []
        };
        
        // Calculate average score
        let totalScore = 0;
        this.rounds.forEach(round => {
            if (round.analysis) {
                totalScore += this.calculateRoundScore(round.analysis);
            }
        });
        stats.averageScore = (totalScore / this.rounds.length).toFixed(1);
        
        // Count common errors
        this.rounds.forEach(round => {
            if (round.analysis && round.analysis.errorType) {
                stats.commonErrors[round.analysis.errorType] = 
                    (stats.commonErrors[round.analysis.errorType] || 0) + 1;
            }
        });
        
        // Count improvement suggestions
        this.rounds.forEach(round => {
            if (round.analysis && round.analysis.suggestions) {
                round.analysis.suggestions.forEach(suggestion => {
                    stats.improvements[suggestion] = 
                        (stats.improvements[suggestion] || 0) + 1;
                });
            }
        });
        
        // Timeline data
        stats.timeline = this.rounds.map(round => ({
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
            rounds: this.rounds,
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
        a.download = `analysis_${new Date().toISOString().split('T')[0]}.json`;
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
                playerAWinRate: ((stats.playerAWins / stats.totalRounds) * 100).toFixed(1),
                playerBWinRate: ((stats.playerBWins / stats.totalRounds) * 100).toFixed(1),
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
        
        // 一致性百分比（标准差越小，一致性越高）
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
    
    // 清空分析数据
    clearAnalysis() {
        this.rounds = [];
        this.expandedRounds.clear();
        this.displayRounds();
    }
    
    // 高级筛选功能
    setupAdvancedFilters() {
        const container = document.querySelector('.analysis-controls');
        if (!container) return;
        
        const advancedFilters = document.createElement('div');
        advancedFilters.className = 'advanced-filters';
        advancedFilters.innerHTML = `
            <div class="filter-group">
                <label>时间范围：</label>
                <select id="timeFilter">
                    <option value="all">全部</option>
                    <option value="last10">最近10回合</option>
                    <option value="last20">最近20回合</option>
                    <option value="first-half">上半场</option>
                    <option value="second-half">下半场</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label>评分范围：</label>
                <select id="scoreFilter">
                    <option value="all">全部</option>
                    <option value="high">高分(8-10)</option>
                    <option value="medium">中分(5-7)</option>
                    <option value="low">低分(1-4)</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label>错误类型：</label>
                <select id="errorFilter">
                    <option value="all">全部</option>
                    <option value="has-error">有错误</option>
                    <option value="no-error">无错误</option>
                </select>
            </div>
        `;
        
        container.appendChild(advancedFilters);
        
        // 添加高级筛选事件
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
        // 应用高级筛选逻辑
        let filteredRounds = this.getFilteredRounds();
        
        // 时间筛选
        const timeFilter = document.getElementById('timeFilter');
        if (timeFilter && timeFilter.value !== 'all') {
            filteredRounds = this.applyTimeFilter(filteredRounds, timeFilter.value);
        }
        
        // 评分筛选
        const scoreFilter = document.getElementById('scoreFilter');
        if (scoreFilter && scoreFilter.value !== 'all') {
            filteredRounds = this.applyScoreFilter(filteredRounds, scoreFilter.value);
        }
        
        // 错误筛选
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
            container.innerHTML = '<div class="no-data">没有符合条件的数据</div>';
            return;
        }
        
        const roundsHTML = filteredRounds.map(round => this.createRoundHTML(round)).join('');
        container.innerHTML = roundsHTML;
        
        this.addRoundClickEvents();
    }
}

// 初始化分析管理器
document.addEventListener('DOMContentLoaded', () => {
    window.analysisManager = new AnalysisManager();
}); 