// 前端配置文件 - 统一管理所有服务器端口和URL配置
const CONFIG = {
    // 服务器端口配置
    BACKEND_PORT: 3000,
    FRONTEND_PORT: 8080,
    
    // 服务器URL配置
    get BACKEND_URL() {
        return `http://localhost:${this.BACKEND_PORT}`;
    },
    
    get FRONTEND_URL() {
        return `http://localhost:${this.FRONTEND_PORT}`;
    },
    
    // API端点配置
    API_ENDPOINTS: {
        // 游戏相关
        GAMES: '/games',
        GAMES_NEW: '/games/new',
        GAMES_UPDATE: '/games/update',
        GAMES_DELETE: '/games/delete',
        GAMES_DELETE_ALL: '/games/delete/all',
        GAMES_SELECT: '/games/select',
        GOAL: '/goal',
        
        // 轮次相关
        ROUNDS: '/games/{gid}/rounds',
        
        // 玩家相关
        PLAYER_ALL: '/player/all',
        PLAYER_CREATE: '/player/create',
        
        // 分析相关
        ANALYSIS_GAME: '/analysis/game',
        ANALYSIS_GAME_NEW: '/analysis/game/new',
        
        // 其他
        ROOT: '/'
    },
    
    // 完整的API URL生成器
    getApiUrl(endpoint) {
        return this.BACKEND_URL + endpoint;
    },
    
    // 获取轮次数据的URL生成器
    getRoundsUrl(gid) {
        return this.getApiUrl(this.API_ENDPOINTS.ROUNDS.replace('{gid}', gid));
    },
    
    // 常用的完整URL
    get API_URLS() {
        return {
            GAMES: this.getApiUrl(this.API_ENDPOINTS.GAMES),
            GAMES_NEW: this.getApiUrl(this.API_ENDPOINTS.GAMES_NEW),
            GAMES_UPDATE: this.getApiUrl(this.API_ENDPOINTS.GAMES_UPDATE),
            GAMES_DELETE: this.getApiUrl(this.API_ENDPOINTS.GAMES_DELETE),
            GAMES_DELETE_ALL: this.getApiUrl(this.API_ENDPOINTS.GAMES_DELETE_ALL),
            GAMES_SELECT: this.getApiUrl(this.API_ENDPOINTS.GAMES_SELECT),
            GOAL: this.getApiUrl(this.API_ENDPOINTS.GOAL),
            PLAYER_ALL: this.getApiUrl(this.API_ENDPOINTS.PLAYER_ALL),
            PLAYER_CREATE: this.getApiUrl(this.API_ENDPOINTS.PLAYER_CREATE),
            ANALYSIS_GAME: this.getApiUrl(this.API_ENDPOINTS.ANALYSIS_GAME),
            ANALYSIS_GAME_NEW: this.getApiUrl(this.API_ENDPOINTS.ANALYSIS_GAME_NEW),
            ROOT: this.getApiUrl(this.API_ENDPOINTS.ROOT)
        };
    }
};

// 使配置对象全局可用
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

// 用于Node.js环境的导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// 配置变更日志
console.log('🔧 Config loaded:', {
    backendUrl: CONFIG.BACKEND_URL,
    frontendUrl: CONFIG.FRONTEND_URL,
    version: '1.0.0'
}); 