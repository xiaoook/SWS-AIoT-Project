# SmartCourt AIoT - Smart Air Hockey System

## Project Overview

SmartCourt AIoT is an intelligent air hockey training system designed to help players and coaches improve their skills through real-time data analysis, AI feedback, and match replay features. The system integrates modern web technologies, data visualization, and artificial intelligence analysis capabilities.

## 🌟 Core Features

### 1. Game Control & Real-time Score Display
- **Real-time Game Control**: Start, pause, and end matches
- **Dynamic Scoreboard**: Real-time score updates and game status
- **Match Timer**: Precise match time recording
- **Live Feed**: Display match progress and important events

### 2. Round-by-Round Analysis Module
- **Detailed Round Records**: Record scores and timestamps for each round
- **AI Smart Analysis**: Provide technical evaluation and improvement suggestions for each round
- **Multi-dimensional Filtering**: Filter rounds by player, time, rating, and other conditions
- **Interactive Display**: Click to expand and view detailed analysis

### 3. Video Replay & AI Feedback
- **Simulated Video Replay**: Provide video replay functionality for each round
- **Synchronized AI Feedback**: Display corresponding AI analysis during video playback
- **Timeline Markers**: Show analysis tips at key time points
- **Fullscreen Support**: Support fullscreen viewing mode

### 4. Smart Match Report
- **Auto-generated Reports**: Automatically generate detailed reports after match completion
- **Visualization Charts**: Use Chart.js to display error distribution and statistical data
- **AI Improvement Suggestions**: Generate personalized suggestions based on match data
- **Winner Display**: Dynamically display match results

### 5. Data Export Features
- **PDF Report Export**: Generate professional PDF format match reports
- **Excel Data Export**: Export detailed match data spreadsheets
- **JSON Raw Data**: Export complete raw data
- **Batch Export**: One-click export of all formats

## 🚀 Technical Features

### Frontend Technology Stack
- **HTML5 + CSS3**: Modern page structure and styling
- **Vanilla JavaScript**: Pure JS implementation without framework dependencies
- **Chart.js**: Dynamic charts and data visualization
- **Responsive Design**: Support for desktop, tablet, mobile and other devices

### Functional Features
- **Modular Architecture**: Independent functional modules, easy to maintain and extend
- **Real-time Data Processing**: Support WebSocket connection to hardware devices
- **Local Data Storage**: Automatically save game progress using localStorage
- **Keyboard Shortcuts**: Support hotkey operations to enhance user experience
- **Accessibility Optimization**: Support high contrast, reduced animation and other accessibility features

### AI Analysis Engine
- **Intelligent Scoring System**: Technical scoring based on multi-dimensional metrics
- **Error Type Recognition**: Automatically identify and categorize common errors
- **Personalized Suggestions**: Generate targeted improvement suggestions based on performance
- **Performance Trend Analysis**: Analyze skill development trends and consistency

## 📁 Project Structure

```
SmartCourt-AIoT/
├── index.html              # Main page
├── README.md               # Project documentation
├── styles/
│   ├── main.css           # Main stylesheet
│   └── responsive.css     # Responsive styles
└── js/
    ├── app.js             # Main application logic
    ├── gameControl.js     # Game control functionality
    ├── analysis.js        # Round-by-round analysis
    ├── replay.js          # Video replay functionality
    ├── report.js          # Match report generation
    └── export.js          # Data export functionality
```

## 🎮 Usage Instructions

### Basic Operations
1. **Start Match**: Click "Start Game" button or press Ctrl+Enter
2. **Control Match**: Use Space to pause/resume, Escape to end match
3. **Switch Pages**: Use top navigation or hotkeys Ctrl+1/2/3/4
4. **View Analysis**: Click "Round Analysis" tab to view detailed data

### Keyboard Shortcuts
- `Ctrl + 1/2/3/4`: Switch to corresponding tab
- `Space`: Start/pause match
- `Enter + Ctrl`: Start new match
- `Escape`: End match
- `Left/Right Arrow`: Fast forward/rewind during video replay

### Export Data
1. Click "Export PDF" or "Export Excel" on the "Match Report" page
2. System will automatically generate and download files in corresponding formats
3. Exported files contain complete match data and AI analysis results

## 🔧 Installation and Setup

### Local Development
1. Clone or download project files
2. Open `index.html` using a web server (Live Server recommended)
3. No additional installation required, project uses CDN to load dependencies

### Dependencies
- Chart.js 3.x (for chart display)
- jsPDF (for PDF export)
- SheetJS (for Excel export)

All dependencies are automatically loaded via CDN, no manual installation required.

## 🎯 AI Analysis Features Detailed

### Technical Scoring Algorithm
- **Base Score**: Starting from 7 points
- **Bonus Points**: Excellent performance (+2), Good performance (+1), Standard actions (+1)
- **Penalty Points**: Error types present (-1)
- **Final Score**: Range from 1-7 points (first to reach 7 points wins)

### Error Type Analysis
- **Slow Reaction**: Detect reaction speed issues
- **Defensive Mistakes**: Identify defensive positioning errors
- **Poor Attack Angles**: Analyze attack technique problems
- **Attention Distraction**: Assess focus issues
- **Non-standard Technical Actions**: Check basic action compliance

### Improvement Suggestion Generation
- **Frequency Analysis**: Generate key improvement suggestions based on error frequency
- **Trend Analysis**: Analyze skill development trends
- **Personalized Suggestions**: Provide targeted suggestions based on individual performance characteristics

## 🌐 Hardware Integration

### WebSocket Support
- Support connection to ESP32, micro:bit and other hardware devices via WebSocket
- Real-time reception of scoring data and sensor information
- Automatic reconnection mechanism ensures connection stability
- Real-time connection status display

### Data Format
```json
{
    "type": "score",
    "player": "playerA",
    "timestamp": "2024-01-01T12:00:00Z"
}
```

## 🎨 Interface Features

### Modern Design
- **Gradient Background**: Blue-purple gradients create a tech-savvy atmosphere
- **Frosted Glass Effect**: backdrop-filter achieves modern UI effects
- **Smooth Animations**: CSS3 animations enhance user experience
- **Responsive Layout**: Adapts to various screen sizes

### User Experience Optimization
- **Loading Status Indicators**: Clear loading and status feedback
- **Error Handling**: Friendly error messages and handling
- **Data Persistence**: Auto-save prevents data loss
- **Accessibility**: Support keyboard navigation and screen readers

## 🔮 Future Expansion Plans

### Feature Extensions
- [ ] Multiplayer battle mode
- [ ] Real-time video stream integration
- [ ] Advanced AI analysis algorithms
- [ ] Cloud data synchronization
- [ ] Social features (leaderboards, match sharing)

### Technical Optimizations
- [ ] Progressive Web App (PWA) support
- [ ] Offline mode
- [ ] More hardware device integrations
- [ ] Real-time multimedia processing
- [ ] Machine learning model integration

## 📞 Contact Information

For questions or suggestions, please contact via:
- Project Repository: [GitHub Link]
- Technical Support: [Email Address]
- Issue Feedback: [Issue Page]

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

---

**SmartCourt AIoT** - Making every training session smarter, every match more rewarding! 🏒✨ 