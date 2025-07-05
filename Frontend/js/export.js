// Data Export Manager
class ExportManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // PDF export button
        const exportPDFBtn = document.getElementById('exportPDF');
        if (exportPDFBtn) {
            exportPDFBtn.addEventListener('click', () => {
                this.exportToPDF();
            });
        }
        
        // Excel export button
        const exportExcelBtn = document.getElementById('exportExcel');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => {
                this.exportToExcel();
            });
        }
    }
    
    async exportToPDF() {
        if (!window.jsPDF) {
            window.smartCourtApp.showMessage('PDF export feature loading, please try again later', 'error');
            return;
        }
        
        try {
            const gameData = this.getGameData();
            if (!gameData) {
                window.smartCourtApp.showMessage('没有可导出的数据', 'error');
                return;
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Set font support
            this.setupPDFFont(doc);
            
            // Add title
            this.addPDFTitle(doc, gameData);
            
            // Add basic information
            this.addPDFBasicInfo(doc, gameData);
            
            // Add score information
            this.addPDFScoreInfo(doc, gameData);
            
            // Add round analysis
            this.addPDFRoundsAnalysis(doc, gameData);
            
            // Add AI suggestions
            this.addPDFAISuggestions(doc, gameData);
            
            // Save PDF
            const fileName = `SmartCourt_Report_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            window.smartCourtApp.showMessage('PDF report exported successfully', 'success');
            
        } catch (error) {
            console.error('PDF export failed:', error);
            window.smartCourtApp.showMessage('PDF export failed', 'error');
        }
    }
    
    setupPDFFont(doc) {
        // Set default font
        doc.setFont('helvetica');
    }
    
    addPDFTitle(doc, gameData) {
        doc.setFontSize(20);
        doc.text('SmartCourt AIoT Match Report', 20, 30);
        
        doc.setFontSize(12);
        doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, 20, 45);
        
        // Add dividing line
        doc.line(20, 50, 190, 50);
    }
    
    addPDFBasicInfo(doc, gameData) {
        let yPos = 65;
        
        doc.setFontSize(16);
        doc.text('Basic Match Information', 20, yPos);
        yPos += 15;
        
        doc.setFontSize(12);
        doc.text(`Match Status: ${this.getStatusText(gameData.status)}`, 20, yPos);
        yPos += 10;
        
        doc.text(`Duration: ${this.formatDuration(gameData.elapsedTime)}`, 20, yPos);
        yPos += 10;
        
        doc.text(`Total Rounds: ${gameData.rounds.length}`, 20, yPos);
        yPos += 10;
        
        if (gameData.startTime) {
            doc.text(`Start Time: ${new Date(gameData.startTime).toLocaleString('en-US')}`, 20, yPos);
            yPos += 10;
        }
        
        if (gameData.endTime) {
            doc.text(`End Time: ${new Date(gameData.endTime).toLocaleString('en-US')}`, 20, yPos);
            yPos += 10;
        }
    }
    
    addPDFScoreInfo(doc, gameData) {
        let yPos = 150;
        
        doc.setFontSize(16);
        doc.text('Score Statistics', 20, yPos);
        yPos += 15;
        
        doc.setFontSize(14);
        doc.text(`Player A: ${gameData.scores.playerA} points`, 20, yPos);
        doc.text(`Player B: ${gameData.scores.playerB} points`, 100, yPos);
        yPos += 15;
        
        const winner = gameData.scores.playerA > gameData.scores.playerB ? 'Player A' : 
                      gameData.scores.playerB > gameData.scores.playerA ? 'Player B' : 'Tie';
        doc.text(`Winner: ${winner}`, 20, yPos);
    }
    
    addPDFRoundsAnalysis(doc, gameData) {
        if (gameData.rounds.length === 0) return;
        
        let yPos = 200;
        
        // Check if page break is needed
        if (yPos > 250) {
            doc.addPage();
            yPos = 30;
        }
        
        doc.setFontSize(16);
        doc.text('Round Analysis', 20, yPos);
        yPos += 15;
        
        doc.setFontSize(10);
        
        // Only show first 10 rounds to avoid page overflow
        const displayRounds = gameData.rounds.slice(0, 10);
        
        displayRounds.forEach((round, index) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 30;
            }
            
            doc.text(`Round ${round.id} - ${round.winner === 'playerA' ? 'Player A' : 'Player B'} scored`, 20, yPos);
            yPos += 8;
            
            if (round.analysis) {
                doc.text(`  Assessment: ${round.analysis.feedback}`, 25, yPos);
                yPos += 6;
                
                if (round.analysis.errorType) {
                    doc.text(`  Improvement: ${round.analysis.errorType}`, 25, yPos);
                    yPos += 6;
                }
            }
            yPos += 5;
        });
        
        if (gameData.rounds.length > 10) {
            doc.text(`... ${gameData.rounds.length - 10} more rounds of detailed data`, 20, yPos);
        }
    }
    
    addPDFAISuggestions(doc, gameData) {
        const suggestions = this.generateSuggestions(gameData);
        if (suggestions.length === 0) return;
        
        doc.addPage();
        let yPos = 30;
        
        doc.setFontSize(16);
        doc.text('AI Improvement Suggestions', 20, yPos);
        yPos += 20;
        
        doc.setFontSize(12);
        
        suggestions.forEach((suggestion, index) => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 30;
            }
            
            doc.text(`${index + 1}. ${suggestion.title}`, 20, yPos);
            yPos += 8;
            
            doc.text(`   ${suggestion.content}`, 25, yPos);
            yPos += 15;
        });
    }
    
    exportToExcel() {
        if (!window.XLSX) {
            window.smartCourtApp.showMessage('Excel export feature loading, please try again later', 'error');
            return;
        }
        
        try {
            const gameData = this.getGameData();
            if (!gameData) {
                window.smartCourtApp.showMessage('没有可导出的数据', 'error');
                return;
            }
            
            // Create workbook
            const workbook = XLSX.utils.book_new();
            
            // 添加比赛概要表
            this.addExcelSummarySheet(workbook, gameData);
            
            // 添加回合详情表
            this.addExcelRoundsSheet(workbook, gameData);
            
            // 添加统计分析表
            this.addExcelStatsSheet(workbook, gameData);
            
            // 导出文件
            const fileName = `SmartCourt_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            window.smartCourtApp.showMessage('Excel数据已导出', 'success');
            
        } catch (error) {
            console.error('Excel导出失败:', error);
            window.smartCourtApp.showMessage('Excel导出失败', 'error');
        }
    }
    
    addExcelSummarySheet(workbook, gameData) {
        const summaryData = [
            ['项目', '值'],
            ['比赛状态', this.getStatusText(gameData.status)],
            ['比赛时长', this.formatDuration(gameData.elapsedTime)],
            ['总回合数', gameData.rounds.length],
            ['玩家A得分', gameData.scores.playerA],
            ['玩家B得分', gameData.scores.playerB],
            ['获胜者', gameData.scores.playerA > gameData.scores.playerB ? '玩家A' : 
                     gameData.scores.playerB > gameData.scores.playerA ? '玩家B' : '平局'],
            ['开始时间', gameData.startTime ? new Date(gameData.startTime).toLocaleString('zh-CN') : ''],
            ['结束时间', gameData.endTime ? new Date(gameData.endTime).toLocaleString('zh-CN') : '']
        ];
        
        const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, worksheet, '比赛概要');
    }
    
    addExcelRoundsSheet(workbook, gameData) {
        if (gameData.rounds.length === 0) return;
        
        const roundsData = [
            ['Round', 'Winner', 'Score A', 'Score B', 'Time', 'AI Assessment', 'Error Type', 'Suggestions']
        ];
        
        gameData.rounds.forEach(round => {
            roundsData.push([
                round.id,
                round.winner === 'playerA' ? 'Player A' : 'Player B',
                round.playerAScore,
                round.playerBScore,
                new Date(round.timestamp).toLocaleTimeString('en-US'),
                round.analysis ? round.analysis.feedback : '',
                round.analysis ? (round.analysis.errorType || '') : '',
                round.analysis ? (round.analysis.suggestions || []).join('; ') : ''
            ]);
        });
        
        const worksheet = XLSX.utils.aoa_to_sheet(roundsData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Round Details');
    }
    
    addExcelStatsSheet(workbook, gameData) {
        const errorStats = this.calculateErrorStats(gameData);
        
        const statsData = [
            ['Statistics Item', 'Value/Description'],
            ['Total Rounds', gameData.rounds.length],
            ['Player A Win Rate', gameData.rounds.length ? ((gameData.scores.playerA / gameData.rounds.length) * 100).toFixed(1) + '%' : '0%'],
            ['Player B Win Rate', gameData.rounds.length ? ((gameData.scores.playerB / gameData.rounds.length) * 100).toFixed(1) + '%' : '0%'],
            [''],
            ['Error Statistics', 'Count']
        ];
        
        Object.entries(errorStats).forEach(([error, count]) => {
            statsData.push([error, count]);
        });
        
        const worksheet = XLSX.utils.aoa_to_sheet(statsData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Statistical Analysis');
    }
    
    getGameData() {
        if (window.smartCourtApp && window.smartCourtApp.gameState) {
            return window.smartCourtApp.getGameState();
        }
        return null;
    }
    
    getStatusText(status) {
        const statusMap = {
            'idle': 'Not Started',
            'playing': 'Playing',
            'paused': 'Paused',
            'ended': 'Ended'
        };
        return statusMap[status] || 'Unknown';
    }
    
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h${minutes}m${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
    
    calculateErrorStats(gameData) {
        const errors = {};
        
        gameData.rounds.forEach(round => {
            if (round.analysis && round.analysis.errorType) {
                errors[round.analysis.errorType] = (errors[round.analysis.errorType] || 0) + 1;
            }
        });
        
        return errors;
    }
    
    generateSuggestions(gameData) {
        const suggestions = [];
        const errorStats = this.calculateErrorStats(gameData);
        
        // Generate suggestions based on error frequency
        Object.entries(errorStats).forEach(([error, count]) => {
            const percentage = (count / gameData.rounds.length) * 100;
            
            if (percentage > 20) {
                suggestions.push({
                    title: `Key Improvement: ${error}`,
                    content: this.getErrorSuggestion(error)
                });
            }
        });
        
        // Generate suggestions based on overall performance
        if (gameData.rounds.length > 0) {
            const playerAWinRate = (gameData.scores.playerA / gameData.rounds.length) * 100;
            const playerBWinRate = (gameData.scores.playerB / gameData.rounds.length) * 100;
            
            if (Math.abs(playerAWinRate - playerBWinRate) > 30) {
                suggestions.push({
                    title: 'Balance Suggestion',
                    content: 'There is a significant skill gap in the match. Recommend strengthening training for the weaker player.'
                });
            }
        }
        
        return suggestions;
    }
    
    getErrorSuggestion(error) {
        const suggestions = {
            '反应迟缓': 'Recommend more reaction speed training, consider using a metronome or reaction lights for practice.',
            '防守失误': 'Need to improve defensive positioning, suggest watching defense technique videos and specialized practice.',
            '攻击角度不佳': 'Practice different attack angles to improve diversity and accuracy of attacks.',
            '注意力分散': 'Recommend strengthening focus exercises in training, try meditation or attention training.',
            '技术动作不标准': 'Focus on practicing basic technical movements, suggest correction under coach guidance.'
        };
        
        return suggestions[error] || 'Recommend specialized training for this issue.';
    }
    
    // Export raw JSON data
    exportRawData() {
        const gameData = this.getGameData();
        if (!gameData) {
            window.smartCourtApp.showMessage('No data available to export', 'error');
            return;
        }
        
        const exportData = {
            gameData: gameData,
            exportTime: new Date().toISOString(),
            version: '1.0.0',
            systemInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            }
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SmartCourt_RawData_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        window.smartCourtApp.showMessage('Raw data exported successfully', 'success');
    }
    
    // Batch export (all formats)
    exportAll() {
        const gameData = this.getGameData();
        if (!gameData) {
            window.smartCourtApp.showMessage('No data available to export', 'error');
            return;
        }
        
        // Delay execution to avoid browser blocking multiple downloads
        this.exportToPDF();
        
        setTimeout(() => {
            this.exportToExcel();
        }, 1000);
        
        setTimeout(() => {
            this.exportRawData();
        }, 2000);
        
        window.smartCourtApp.showMessage('Exporting all formats...', 'info');
    }
}

// Initialize export manager
document.addEventListener('DOMContentLoaded', () => {
    window.exportManager = new ExportManager();
}); 