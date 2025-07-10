// Video Replay Manager - DISABLED
// This functionality has been disabled to reduce server requests and improve performance

class ReplayManager {
    constructor() {
        console.log('🚫 ReplayManager disabled - Video replay functionality has been turned off');
        this.videoPlayer = null;
        this.currentRound = null;
        this.rounds = [];
        this.currentVideoTime = 0;
        this.feedbackTimeline = [];
        
        // Show disabled message
        this.showDisabledMessage();
    }
    
    showDisabledMessage() {
        console.log('⚠️ Video replay features disabled to reduce server requests');
        console.log('🎯 Focus on Game Control, Analysis, and Reports for optimal experience');
    }
    
    // All methods are now no-ops to prevent errors
    init() {
        console.log('ReplayManager: init() disabled');
    }
    
    setupVideoPlayer() {
        console.log('ReplayManager: setupVideoPlayer() disabled');
    }
    
    setupRoundSelector() {
        console.log('ReplayManager: setupRoundSelector() disabled');
    }
    
    setupEventListeners() {
        console.log('ReplayManager: setupEventListeners() disabled');
    }
    
    refreshReplays() {
        console.log('ReplayManager: refreshReplays() disabled');
    }
    
    updateRoundSelector() {
        console.log('ReplayManager: updateRoundSelector() disabled');
    }
    
    selectRound(roundId) {
        console.log('ReplayManager: selectRound() disabled');
    }
    
    loadRoundVideo(round) {
        console.log('ReplayManager: loadRoundVideo() disabled');
    }
    
    createMockVideo(round) {
        console.log('ReplayManager: createMockVideo() disabled');
    }
    
    displayAIFeedback(round) {
        console.log('ReplayManager: displayAIFeedback() disabled');
    }
    
    onVideoLoaded() {
        console.log('ReplayManager: onVideoLoaded() disabled');
    }
    
    onVideoTimeUpdate() {
        console.log('ReplayManager: onVideoTimeUpdate() disabled');
    }
    
    onVideoEnded() {
        console.log('ReplayManager: onVideoEnded() disabled');
    }
    
    onVideoError(error) {
        console.log('ReplayManager: onVideoError() disabled');
    }
    
    togglePlayPause() {
        console.log('ReplayManager: togglePlayPause() disabled');
    }
    
    replayVideo() {
        console.log('ReplayManager: replayVideo() disabled');
    }
    
    exportReplayData() {
        console.log('ReplayManager: exportReplayData() disabled');
    }
}

// Auto-initialize but disabled
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚫 ReplayManager auto-initialization disabled');
    // window.replayManager = new ReplayManager(); // Disabled
});

// Export for global access (but disabled)
window.ReplayManager = ReplayManager; 