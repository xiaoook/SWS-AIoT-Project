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
        if (!window.jspdf) {
            window.smartCourtApp.showMessage('PDF export feature loading, please try again later', 'error');
            return;
        }
        
        try {
            const gameData = this.getGameData();
            if (!gameData) {
                window.smartCourtApp.showMessage('No data available to export', 'error');
                return;
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Create professional PDF with modern design
            this.createProfessionalPDF(doc, gameData);
            
            // Save PDF
            const fileName = `Air_Hockey_Assistant_Report_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
            window.smartCourtApp.showMessage('PDF report exported successfully', 'success');
            
        } catch (error) {
            console.error('PDF export failed:', error);
            window.smartCourtApp.showMessage('PDF export failed', 'error');
        }
    }
    
    createProfessionalPDF(doc, gameData) {
        // Page setup
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const contentWidth = pageWidth - 2 * margin;
        
        // Simple colors
        const primaryColor = [41, 128, 185];  // Blue
        const textColor = [33, 33, 33];       // Dark Gray
        
        let currentY = margin;
        
        // Simple header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text('Air Hockey Match Report', margin, currentY);
        currentY += 15;
        
        // Generation date
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`, margin, currentY);
        currentY += 20;
        
        // Game basic info
        currentY = this.addSimpleGameInfo(doc, gameData, margin, currentY, contentWidth);
        
        // Final scores section
        currentY = this.addSimpleScores(doc, gameData, margin, currentY, contentWidth);
        
        // Game statistics
        currentY = this.addSimpleStatistics(doc, gameData, margin, currentY, contentWidth);
        
        // Round details (if available)
        if (gameData.rounds && gameData.rounds.length > 0) {
            currentY = this.addSimpleRoundDetails(doc, gameData, margin, currentY, contentWidth);
        }
        
        // Simple footer
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Air Hockey Assistant - Match Report', margin, pageHeight - 10);
        doc.text(`Page 1 of 1`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    addSimpleGameInfo(doc, gameData, margin, y, contentWidth) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(33, 33, 33);
        doc.text('Game Information', margin, y);
        y += 10;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        doc.text(`Status: ${this.getStatusText(gameData.status)}`, margin, y);
        y += 6;
        
        doc.text(`Duration: ${this.formatDuration(gameData.elapsedTime)}`, margin, y);
        y += 6;
        
        doc.text(`Total Rounds: ${gameData.rounds ? gameData.rounds.length : 0}`, margin, y);
        y += 6;
        
        if (gameData.startTime) {
            doc.text(`Start Time: ${new Date(gameData.startTime).toLocaleString('en-US')}`, margin, y);
            y += 6;
        }
        
        if (gameData.endTime) {
            doc.text(`End Time: ${new Date(gameData.endTime).toLocaleString('en-US')}`, margin, y);
            y += 6;
        }
        
        return y + 15;
    }

    addSimpleScores(doc, gameData, margin, y, contentWidth) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(33, 33, 33);
        doc.text('Final Scores', margin, y);
        y += 15;
        
        // Get player names
        const playerAName = gameData.playerNames?.playerA || 'Player A';
        const playerBName = gameData.playerNames?.playerB || 'Player B';
        const scoreA = gameData.scores?.playerA || 0;
        const scoreB = gameData.scores?.playerB || 0;
        
        // Simple score display
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`${playerAName}: ${scoreA}`, margin, y);
        
        doc.text(`${playerBName}: ${scoreB}`, margin, y + 12);
        
        // Winner
        if (scoreA !== scoreB) {
            const winner = scoreA > scoreB ? playerAName : playerBName;
            doc.setFontSize(12);
            doc.text(`Winner: ${winner}`, margin, y + 26);
        }
        
        return y + 40;
    }

    addSimpleStatistics(doc, gameData, margin, y, contentWidth) {
        if (!gameData.rounds || gameData.rounds.length === 0) return y;
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(33, 33, 33);
        doc.text('Match Statistics', margin, y);
        y += 15;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        const playerAName = gameData.playerNames?.playerA || 'Player A';
        const playerBName = gameData.playerNames?.playerB || 'Player B';
        
        const playerAWins = gameData.rounds.filter(r => r.winner === 'playerA').length;
        const playerBWins = gameData.rounds.filter(r => r.winner === 'playerB').length;
        const totalRounds = gameData.rounds.length;
        
        doc.text(`${playerAName} rounds won: ${playerAWins}`, margin, y);
        y += 6;
        
        doc.text(`${playerBName} rounds won: ${playerBWins}`, margin, y);
        y += 6;
        
        if (totalRounds > 0) {
            const playerARate = (playerAWins / totalRounds * 100).toFixed(1);
            const playerBRate = (playerBWins / totalRounds * 100).toFixed(1);
            
            doc.text(`${playerAName} round win rate: ${playerARate}%`, margin, y);
            y += 6;
            
            doc.text(`${playerBName} round win rate: ${playerBRate}%`, margin, y);
            y += 6;
        }
        
        return y + 15;
    }

    addSimpleRoundDetails(doc, gameData, margin, y, contentWidth) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(33, 33, 33);
        doc.text('Round Details', margin, y);
        y += 15;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        // Show first 10 rounds
        const maxRounds = Math.min(10, gameData.rounds.length);
        
        for (let i = 0; i < maxRounds; i++) {
            const round = gameData.rounds[i];
            
            // Check if page break needed
            if (y > 250) {
                doc.addPage();
                y = margin + 20;
            }
            
            const playerAName = gameData.playerNames?.playerA || 'Player A';
            const playerBName = gameData.playerNames?.playerB || 'Player B';
            const winner = round.winner === 'playerA' ? playerAName : playerBName;
            
            doc.text(`Round ${round.id}: ${winner} scored (${round.playerAScore} - ${round.playerBScore})`, margin, y);
            y += 6;
        }
        
        if (gameData.rounds.length > maxRounds) {
            doc.text(`... and ${gameData.rounds.length - maxRounds} more rounds`, margin, y);
        }
        
        return y + 15;
    }

    // Remove old PDF functions - they are no longer needed
    // The following functions have been replaced by the simplified PDF generation above:
    // - addPDFHeader, addPDFTitle, addPDFMatchOverview, addPDFScoreSection, 
    // - addPDFPerformanceStats, addPDFRoundAnalysis, addPDFAISuggestions, addPDFFooter
    
    getGameData() {
        // Priority 1: Try to get data from report manager first (for selected game reports)
        if (window.reportManager && window.reportManager.currentGame) {
            console.log('📊 Using report manager current game data');
            return this.normalizeGameData(window.reportManager.currentGame);
        }
        
        // Priority 2: Try to get from report manager gameData
        if (window.reportManager && window.reportManager.gameData) {
            console.log('📊 Using report manager game data');
            return this.normalizeGameData(window.reportManager.gameData);
        }
        
        // Priority 3: Try to get from analysis manager current game
        if (window.analysisManager && window.analysisManager.currentGame) {
            console.log('📊 Using analysis manager current game data');
            return this.normalizeGameData(window.analysisManager.currentGame);
        }
        
        // Priority 4: Fallback to current game state
        if (window.smartCourtApp && window.smartCourtApp.gameState) {
            console.log('📊 Using current game state data');
            const gameState = window.smartCourtApp.getGameState();
            return this.normalizeGameData(gameState);
        }
        
        console.warn('📊 No game data found');
        return null;
    }

    // Normalize game data to ensure consistent format
    normalizeGameData(data) {
        if (!data) return null;
        
        // Create normalized data structure
        const normalized = {
            status: data.status || 'idle',
            startTime: data.startTime || null,
            endTime: data.endTime || null,
            scores: {
                playerA: data.scores?.playerA || data.finalScores?.playerA || 0,
                playerB: data.scores?.playerB || data.finalScores?.playerB || 0
            },
            rounds: data.rounds || [],
            currentRound: data.currentRound || 0,
            elapsedTime: data.elapsedTime || data.duration || 0,
            playerNames: data.playerNames || null,
            gameId: data.gameId || null,
            databaseGameId: data.databaseGameId || null
        };
        
        // Handle different data formats
        if (data.finalScores) {
            normalized.scores = {
                playerA: data.finalScores.playerA || 0,
                playerB: data.finalScores.playerB || 0
            };
        }
        
        if (data.duration !== undefined) {
            normalized.elapsedTime = data.duration;
        }
        
        // Ensure rounds have proper structure
        normalized.rounds = normalized.rounds.map((round, index) => ({
            id: round.id || (index + 1),
            winner: round.winner || 'playerA',
            timestamp: round.timestamp || new Date(),
            playerAScore: round.playerAScore || 0,
            playerBScore: round.playerBScore || 0,
            analysis: round.analysis || null
        }));
        
        console.log('📊 Normalized game data:', normalized);
        return normalized;
    }
    
    getStatusText(status) {
        const statusMap = {
            'idle': 'Not Started',
            'playing': 'In Progress',
            'paused': 'Paused',
            'ended': 'Completed'
        };
        return statusMap[status] || status || 'Unknown';
    }
    
    formatDuration(seconds) {
        // Handle invalid or missing values
        if (seconds === null || seconds === undefined || isNaN(seconds)) {
            return '0m 0s';
        }
        
        // Convert to number if it's a string
        seconds = Number(seconds);
        if (isNaN(seconds) || seconds < 0) {
            return '0m 0s';
        }
        
        // Round to nearest second
        seconds = Math.round(seconds);
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
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
        a.download = `Air_Hockey_Assistant_RawData_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        window.smartCourtApp.showMessage('Raw data exported successfully', 'success');
    }
    
    // Export analysis JSON
    exportAnalysisJSON() {
        const gameData = this.getGameData();
        if (!gameData) {
            window.smartCourtApp.showMessage('No data available to export', 'error');
            return;
        }
        
        const analysisData = this.createAnalysisReport(gameData);
        
        const blob = new Blob([JSON.stringify(analysisData, null, 2)], { 
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
    
    createAnalysisReport(gameData) {
        const playerAName = gameData.playerNames?.playerA || 'Player A';
        const playerBName = gameData.playerNames?.playerB || 'Player B';
        
        const report = {
            reportInfo: {
                title: 'Air Hockey Match Analysis Report',
                generated: new Date().toISOString(),
                version: '1.0.0'
            },
            gameInfo: {
                status: this.getStatusText(gameData.status),
                duration: this.formatDuration(gameData.elapsedTime),
                totalRounds: gameData.rounds ? gameData.rounds.length : 0,
                startTime: gameData.startTime ? new Date(gameData.startTime).toISOString() : null,
                endTime: gameData.endTime ? new Date(gameData.endTime).toISOString() : null
            },
            players: {
                playerA: {
                    name: playerAName,
                    finalScore: gameData.scores?.playerA || 0,
                    roundsWon: gameData.rounds ? gameData.rounds.filter(r => r.winner === 'playerA').length : 0
                },
                playerB: {
                    name: playerBName,
                    finalScore: gameData.scores?.playerB || 0,
                    roundsWon: gameData.rounds ? gameData.rounds.filter(r => r.winner === 'playerB').length : 0
                }
            },
            matchResult: {
                winner: gameData.scores?.playerA > gameData.scores?.playerB ? playerAName : 
                       gameData.scores?.playerB > gameData.scores?.playerA ? playerBName : 'Tie',
                finalScore: `${gameData.scores?.playerA || 0} - ${gameData.scores?.playerB || 0}`
            },
            rounds: gameData.rounds ? gameData.rounds.map(round => ({
                roundNumber: round.id,
                winner: round.winner === 'playerA' ? playerAName : playerBName,
                scoreAfterRound: `${round.playerAScore} - ${round.playerBScore}`,
                timestamp: round.timestamp,
                notes: round.analysis?.feedback || 'Round completed'
            })) : []
        };
        
        return report;
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
            this.exportAnalysisJSON();
        }, 2000);
        
        window.smartCourtApp.showMessage('Exporting all formats...', 'info');
    }

    exportToExcel() {
        if (!window.XLSX) {
            window.smartCourtApp.showMessage('Excel export feature loading, please try again later', 'error');
            return;
        }
        
        try {
            const gameData = this.getGameData();
            if (!gameData) {
                window.smartCourtApp.showMessage('No data available to export', 'error');
                return;
            }
            
            // Create workbook
            const workbook = XLSX.utils.book_new();
            
            // Add match overview sheet
            this.addExcelOverviewSheet(workbook, gameData);
            
            // Add scores sheet
            this.addExcelScoresSheet(workbook, gameData);
            
            // Add round details sheet (if available)
            if (gameData.rounds && gameData.rounds.length > 0) {
                this.addExcelRoundDetailsSheet(workbook, gameData);
            }
            
            // Export file
            const fileName = `Air_Hockey_Assistant_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            window.smartCourtApp.showMessage('Excel data exported successfully', 'success');
            
        } catch (error) {
            console.error('Excel export failed:', error);
            window.smartCourtApp.showMessage('Excel export failed', 'error');
        }
    }

    addExcelOverviewSheet(workbook, gameData) {
        const playerAName = gameData.playerNames?.playerA || 'Player A';
        const playerBName = gameData.playerNames?.playerB || 'Player B';
        
        const overviewData = [
            ['Air Hockey Match Report'],
            ['Generated:', new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })],
            [''],
            ['Game Information'],
            ['Status', this.getStatusText(gameData.status)],
            ['Duration', this.formatDuration(gameData.elapsedTime)],
            ['Total Rounds', gameData.rounds ? gameData.rounds.length : 0],
            ['Start Time', gameData.startTime ? new Date(gameData.startTime).toLocaleString('en-US') : 'N/A'],
            ['End Time', gameData.endTime ? new Date(gameData.endTime).toLocaleString('en-US') : 'N/A'],
            [''],
            ['Final Scores'],
            [playerAName, gameData.scores?.playerA || 0],
            [playerBName, gameData.scores?.playerB || 0],
            ['Winner', gameData.scores?.playerA > gameData.scores?.playerB ? playerAName : 
                     gameData.scores?.playerB > gameData.scores?.playerA ? playerBName : 'Tie']
        ];
        
        const worksheet = XLSX.utils.aoa_to_sheet(overviewData);
        
        // Set column widths
        worksheet['!cols'] = [
            { wch: 20 },
            { wch: 30 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Game Overview');
    }

    addExcelScoresSheet(workbook, gameData) {
        const playerAName = gameData.playerNames?.playerA || 'Player A';
        const playerBName = gameData.playerNames?.playerB || 'Player B';
        
        const scoreA = gameData.scores?.playerA || 0;
        const scoreB = gameData.scores?.playerB || 0;
        
        const scoresData = [
            ['Match Scores & Statistics'],
            [''],
            ['Final Scores'],
            ['Player', 'Score', 'Winner'],
            [playerAName, scoreA, scoreA > scoreB ? 'Winner' : ''],
            [playerBName, scoreB, scoreB > scoreA ? 'Winner' : ''],
            [''],
            ['Round Statistics']
        ];
        
        if (gameData.rounds && gameData.rounds.length > 0) {
            const playerAWins = gameData.rounds.filter(r => r.winner === 'playerA').length;
            const playerBWins = gameData.rounds.filter(r => r.winner === 'playerB').length;
            const totalRounds = gameData.rounds.length;
            
            scoresData.push(
                ['Statistic', 'Value', 'Percentage'],
                [`${playerAName} rounds won`, playerAWins, `${(playerAWins / totalRounds * 100).toFixed(1)}%`],
                [`${playerBName} rounds won`, playerBWins, `${(playerBWins / totalRounds * 100).toFixed(1)}%`],
                ['Total rounds', totalRounds, '100%']
            );
        } else {
            scoresData.push(['No round data available']);
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(scoresData);
        
        // Set column widths
        worksheet['!cols'] = [
            { wch: 25 },
            { wch: 15 },
            { wch: 15 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Scores & Stats');
    }

    addExcelRoundDetailsSheet(workbook, gameData) {
        const playerAName = gameData.playerNames?.playerA || 'Player A';
        const playerBName = gameData.playerNames?.playerB || 'Player B';
        
        const roundsData = [
            ['Round-by-Round Details'],
            [''],
            ['Round', 'Winner', 'Score After Round', 'Time', 'Notes'],
            ['', '', `${playerAName} - ${playerBName}`, '', '']
        ];
        
        gameData.rounds.forEach(round => {
            const winner = round.winner === 'playerA' ? playerAName : playerBName;
            const scoreAfter = `${round.playerAScore} - ${round.playerBScore}`;
            const time = round.timestamp ? new Date(round.timestamp).toLocaleTimeString('en-US') : 'N/A';
            const notes = round.analysis?.feedback || 'Round completed';
            
            roundsData.push([
                round.id,
                winner,
                scoreAfter,
                time,
                notes
            ]);
        });
        
        const worksheet = XLSX.utils.aoa_to_sheet(roundsData);
        
        // Set column widths
        worksheet['!cols'] = [
            { wch: 8 },   // Round
            { wch: 15 },  // Winner
            { wch: 15 },  // Score
            { wch: 12 },  // Time
            { wch: 35 }   // Notes
        ];
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Round Details');
    }
}

// Initialize export manager
document.addEventListener('DOMContentLoaded', () => {
    window.exportManager = new ExportManager();
}); 