// Round Analysis Manager
class AnalysisManager {
    constructor() {
        this.rounds = [];
        this.currentFilter = 'all';
        this.currentView = 'cards';
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
        
        // View button events
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setView(e.target.dataset.view);
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
    
    setView(view) {
        this.currentView = view;
        
        // Update view button states
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === view) {
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
        
        let roundsHTML;
        switch(this.currentView) {
            case 'compact':
                roundsHTML = this.createCompactView(filteredRounds);
                break;
            case 'table':
                roundsHTML = this.createTableView(filteredRounds);
                break;
            case 'summary':
                roundsHTML = this.createSummaryView(filteredRounds);
                break;
            default: // cards
                roundsHTML = filteredRounds.map(round => this.createRoundHTML(round)).join('');
                break;
        }
        
        container.innerHTML = roundsHTML;
        
        // Add click events only for card view
        if (this.currentView === 'cards') {
        this.addRoundClickEvents();
        } else if (this.currentView === 'compact') {
            this.addCompactClickEvents();
        }
    }
    
    getFilteredRounds() {
        switch (this.currentFilter) {
            case 'playerA':
                // Player A losses = rounds where Player B scored
                return this.rounds.filter(round => round.winner === 'playerB');
            case 'playerB':
                // Player B losses = rounds where Player A scored
                return this.rounds.filter(round => round.winner === 'playerA');
            default:
                return this.rounds;
        }
    }
    
    createRoundHTML(round) {
        const isExpanded = this.expandedRounds.has(round.id);
        const winnerText = round.winner === 'playerA' ? 'Player A' : 'Player B';
        const loserText = round.winner === 'playerA' ? 'Player B' : 'Player A';
        const timeStr = this.formatTime(round.timestamp);
        
        return `
            <div class="point-item ${isExpanded ? 'expanded' : ''}" data-round-id="${round.id}">
                <div class="point-header">
                    <span class="round-number">Round ${round.id}</span>
                    <span class="point-winner">${loserText} Lost Point</span>
                    <span class="point-timestamp">${timeStr}</span>
                </div>
                
                <div class="point-score">
                    Score After Loss: ${round.playerAScore} - ${round.playerBScore}
                </div>
                
                <div class="point-details ${isExpanded ? 'expanded' : ''}">
                    ${this.createLossAnalysisHTML(round.analysis, loserText)}
                </div>
                
                <div class="expand-indicator ${isExpanded ? 'expanded' : ''}">
                    ${isExpanded ? 'Hide Loss Analysis' : 'View Loss Analysis'}
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
        // Return error type in English (no translation needed)
        return errorType;
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
        document.querySelectorAll('.point-item').forEach(item => {
            // Remove existing listeners to prevent duplication
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', (e) => {
                // Don't trigger if clicking on expand indicator
                if (e.target.closest('.expand-indicator')) {
                    return;
                }
                
                const roundId = parseInt(e.currentTarget.dataset.roundId);
                this.toggleRoundExpansion(roundId, e.currentTarget);
            });
        });
        
        // Add separate click events for expand indicators
        document.querySelectorAll('.expand-indicator').forEach(indicator => {
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                const roundItem = e.currentTarget.closest('.point-item');
                const roundId = parseInt(roundItem.dataset.roundId);
                this.toggleRoundExpansion(roundId, roundItem);
            });
        });
    }
    
    toggleRoundExpansion(roundId, itemElement) {
        const wasExpanded = this.expandedRounds.has(roundId);
        
        if (wasExpanded) {
            this.expandedRounds.delete(roundId);
        } else {
            this.expandedRounds.add(roundId);
        }
        
        // Update UI immediately for better user experience
        this.updateItemExpansion(itemElement, !wasExpanded);
        
        // Then refresh the full display
        setTimeout(() => {
        this.displayRounds();
        }, 50);
    }

    updateItemExpansion(itemElement, isExpanded) {
        const details = itemElement.querySelector('.point-details');
        const indicator = itemElement.querySelector('.expand-indicator');
        
        if (isExpanded) {
            itemElement.classList.add('expanded');
            details.classList.add('expanded');
            indicator.classList.add('expanded');
        } else {
            itemElement.classList.remove('expanded');
            details.classList.remove('expanded');
            indicator.classList.remove('expanded');
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
        this.rounds = [];
        this.expandedRounds.clear();
        this.displayRounds();
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
        
        const roundsHTML = filteredRounds.map(round => this.createRoundHTML(round)).join('');
        container.innerHTML = roundsHTML;
        
        this.addRoundClickEvents();
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
        const winnerText = round.winner === 'playerA' ? 'Player A' : 'Player B';
        const loserText = round.winner === 'playerA' ? 'Player B' : 'Player A';
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
        const loserText = round.winner === 'playerA' ? 'Player B' : 'Player A';
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
                                <span class="stat-label">Player A Losses:</span>
                                <span class="stat-value">${stats.playerALosses}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Player B Losses:</span>
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
        const loserText = round.winner === 'playerA' ? 'Player B' : 'Player A';
        const score = round.analysis ? this.calculateRoundScore(round.analysis) : 5;
        const riskLevel = round.analysis ? this.getRiskLevel(Math.max(1, 10 - score)) : 'Medium';
        const errorType = round.analysis?.errorType || 'Unknown';
        
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
                
                if (round.analysis.errorType) {
                    stats.commonErrors[round.analysis.errorType] = 
                        (stats.commonErrors[round.analysis.errorType] || 0) + 1;
                }
            }
        });
        
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
        const round = this.rounds.find(r => r.id === roundId);
        if (!round) return;
        
        const loserText = round.winner === 'playerA' ? 'Player B' : 'Player A';
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
}

// Initialize analysis manager
document.addEventListener('DOMContentLoaded', () => {
    window.analysisManager = new AnalysisManager();
}); 