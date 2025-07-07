// Match Report Manager
class ReportManager {
    constructor() {
        this.chart = null;
        this.reportData = null;
        this.gameData = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeChart();
        this.generateReport();
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
    
    generateReport() {
        if (window.smartCourtApp && window.smartCourtApp.gameState) {
            this.gameData = window.smartCourtApp.getGameState();
            this.updateFinalScore();
            this.generateErrorChart();
            this.generateAISuggestions();
        }
    }
    
    updateFinalScore() {
        const finalScoreElement = document.getElementById('finalScore');
        if (!finalScoreElement || !this.gameData) return;
        
        finalScoreElement.innerHTML = `
            <div class="score-item ${this.gameData.scores.playerA > this.gameData.scores.playerB ? 'winner' : ''}">
                <span class="player">Player A</span>
                <span class="score">${this.gameData.scores.playerA}</span>
                ${this.gameData.scores.playerA > this.gameData.scores.playerB ? '<div class="winner-badge">🏆</div>' : ''}
            </div>
            <div class="score-item ${this.gameData.scores.playerB > this.gameData.scores.playerA ? 'winner' : ''}">
                <span class="player">Player B</span>
                <span class="score">${this.gameData.scores.playerB}</span>
                ${this.gameData.scores.playerB > this.gameData.scores.playerA ? '<div class="winner-badge">🏆</div>' : ''}
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
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    showNoDataChart() {
        const canvas = document.getElementById('errorChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
                    ctx.fillText('No Data Available', canvas.width / 2, canvas.height / 2);
    }
    
    showNoErrorChart() {
        const canvas = document.getElementById('errorChart');
        if (!canvas) return;
        
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
                        position: 'bottom'
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
        if (canvas) {
            canvas.width = 400;
            canvas.height = 400;
        }
    }
    
    clearReports() {
        this.reportData = null;
        this.gameData = null;
        
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
        
        this.showNoDataChart();
        
        const suggestionsContainer = document.getElementById('aiSuggestions');
        if (suggestionsContainer) {
            suggestionsContainer.innerHTML = '<div class="suggestion-item">Complete a match to see AI analysis suggestions</div>';
        }
    }
    
    generateFinalReport() {
        this.generateReport();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.reportManager = new ReportManager();
}); 