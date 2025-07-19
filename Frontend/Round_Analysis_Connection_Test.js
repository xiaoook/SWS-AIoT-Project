// 轮次分析连接测试脚本
// 在浏览器控制台中运行这个脚本来测试轮次分析功能

async function testRoundAnalysisConnection() {
    console.log('🧪 Testing Round Analysis Connection...');
    
    // 测试游戏ID
    const testGameId = 11;
    
    // 1. 测试游戏分析接口
    console.log('\n📊 Testing Game Analysis API...');
    try {
        const gameAnalysisUrl = `${CONFIG.API_URLS.ANALYSIS_GAME}?gid=${testGameId}`;
        console.log(`Requesting: ${gameAnalysisUrl}`);
        
        const gameResponse = await fetch(gameAnalysisUrl);
        console.log(`Game Analysis Response Status: ${gameResponse.status}`);
        
        if (gameResponse.ok) {
            const gameData = await gameResponse.json();
            console.log('✅ Game Analysis Data:', gameData);
        } else if (gameResponse.status === 404) {
            console.log('ℹ️ Game Analysis: 404 - No data found (normal)');
        } else {
            console.log('⚠️ Game Analysis: Unexpected status:', gameResponse.status);
        }
    } catch (error) {
        console.error('❌ Game Analysis Error:', error);
    }
    
    // 2. 测试轮次分析接口
    console.log('\n🎯 Testing Round Analysis API...');
    try {
        const roundAnalysisUrl = CONFIG.getRoundAnalysisUrl(testGameId);
        console.log(`Requesting: ${roundAnalysisUrl}`);
        
        const roundResponse = await fetch(roundAnalysisUrl);
        console.log(`Round Analysis Response Status: ${roundResponse.status}`);
        
        if (roundResponse.ok) {
            const roundData = await roundResponse.json();
            console.log('✅ Round Analysis Data:', roundData);
            
            if (roundData.status === 'success') {
                const analyses = roundData.analyses || [];
                console.log(`📊 Found ${analyses.length} round analyses`);
                
                if (analyses.length > 0) {
                    console.log('🔍 First analysis:', analyses[0]);
                } else {
                    console.log('ℹ️ No round analyses found (empty array)');
                }
            }
        } else if (roundResponse.status === 404) {
            console.log('ℹ️ Round Analysis: 404 - No data found (normal)');
        } else {
            console.log('⚠️ Round Analysis: Unexpected status:', roundResponse.status);
        }
    } catch (error) {
        console.error('❌ Round Analysis Error:', error);
    }
    
    // 3. 测试前端分析管理器
    console.log('\n🔧 Testing Frontend Analysis Manager...');
    if (window.analysisManager) {
        console.log('✅ Analysis Manager found');
        
        // 测试当前游戏状态
        if (window.analysisManager.currentGame) {
            console.log('📊 Current Game:', window.analysisManager.currentGame.gameId);
            
            // 测试轮次分析集成
            if (window.analysisManager.currentGame.databaseGameId) {
                console.log('🔄 Testing loadRoundAnalysis...');
                try {
                    await window.analysisManager.loadRoundAnalysis(window.analysisManager.currentGame.databaseGameId);
                    console.log('✅ loadRoundAnalysis completed');
                } catch (error) {
                    console.error('❌ loadRoundAnalysis error:', error);
                }
            } else {
                console.log('ℹ️ No database game ID available');
            }
        } else {
            console.log('ℹ️ No current game selected');
        }
    } else {
        console.log('❌ Analysis Manager not found');
    }
    
    console.log('\n✅ Round Analysis Connection Test Complete!');
}

// 测试后端接口可用性
async function testBackendConnectivity() {
    console.log('🌐 Testing Backend Connectivity...');
    
    try {
        const response = await fetch(CONFIG.API_URLS.ROOT);
        console.log(`Backend Status: ${response.status}`);
        
        if (response.ok) {
            console.log('✅ Backend is accessible');
            return true;
        } else {
            console.log('⚠️ Backend returned non-OK status');
            return false;
        }
    } catch (error) {
        console.error('❌ Backend is not accessible:', error);
        return false;
    }
}

// 主测试函数
async function runFullTest() {
    console.log('🚀 Running Full Round Analysis Test...');
    
    // 1. 测试后端连接
    const backendOk = await testBackendConnectivity();
    if (!backendOk) {
        console.log('❌ Backend not accessible, skipping API tests');
        return;
    }
    
    // 2. 测试轮次分析连接
    await testRoundAnalysisConnection();
    
    // 3. 显示配置信息
    console.log('\n⚙️ Configuration Info:');
    console.log('Backend URL:', CONFIG.BACKEND_URL);
    console.log('Game Analysis URL:', CONFIG.API_URLS.ANALYSIS_GAME);
    console.log('Round Analysis URL Template:', CONFIG.API_ENDPOINTS.ANALYSIS_ROUND);
    console.log('Round Analysis URL (game 11):', CONFIG.getRoundAnalysisUrl(11));
    
    console.log('\n🎉 Full test completed!');
}

// 导出测试函数到全局
window.testRoundAnalysisConnection = testRoundAnalysisConnection;
window.testBackendConnectivity = testBackendConnectivity;
window.runFullTest = runFullTest;

console.log('🧪 Round Analysis Test Functions Loaded!');
console.log('Run: runFullTest() to test everything');
console.log('Run: testRoundAnalysisConnection() to test API connection');
console.log('Run: testBackendConnectivity() to test backend status'); 