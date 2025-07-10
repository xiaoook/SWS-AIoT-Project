# 🏒 Air Hockey Player Management System Guide

## 🎯 Feature Overview

The new player management system provides the following features:
- **Priority list selection**: Select from existing players in the database
- **Custom player input**: Support for creating new players
- **Database saving**: Save new players to the database
- **Real-time updates**: Automatically refresh the player list

## 🚀 Quick Start

### 1. Select Existing Players
1. Select **Player A** and **Player B** from the dropdown boxes
2. The system will automatically display existing players from the database
3. After selection, directly click **"✅ Confirm Players"**

### 2. Create New Players
1. Select **"✏️ Custom Input"** in the dropdown box
2. The input field will automatically appear
3. Enter the new player's name
4. Click the **"💾 Save to Database"** button (optional)
5. Click **"✅ Confirm Players"** to confirm

### 3. Refresh Player List
- Click the **"🔄 Refresh Players"** button to get the latest player data

## 🔧 Technical Fixes

### Fixed Issues
1. **Port number error**: Changed from 5000 to 5001
2. **CORS issues**: Added multiple saving solutions
3. **Database format**: Support for backend Player table structure
4. **UI design**: Priority list selection with custom input support

### Save Mechanism
The system uses the following 3 methods to save player data:

1. **Normal HTTP Request** (Priority)
   ```javascript
   fetch('/player/create', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ name: playerName })
   })
   ```

2. **No-CORS Mode** (Fallback)
   ```javascript
   fetch('/player/create', {
       method: 'POST',
       mode: 'no-cors',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ name: playerName })
   })
   ```

3. **Local Storage** (Backup)
   ```javascript
   localStorage.setItem('hockey_players', JSON.stringify(players))
   ```

## 🛠️ Testing Tools

Use `test-db-connection.html` to test database connection:

1. Open `Frontend/test-db-connection.html`
2. Test server connection
3. Test get players list
4. Test create player
5. Verify database path

## 📋 Database Structure

```sql
-- Player table
CREATE TABLE Player (
    pid INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

-- Game table
CREATE TABLE Game (
    gid INTEGER PRIMARY KEY AUTOINCREMENT,
    playerAid INTEGER,
    playerBid INTEGER,
    date TEXT,
    time TEXT,
    pointA INTEGER DEFAULT 0,
    pointB INTEGER DEFAULT 0,
    duration INTEGER,
    FOREIGN KEY (playerAid) REFERENCES Player(pid),
    FOREIGN KEY (playerBid) REFERENCES Player(pid)
);

-- Round table
CREATE TABLE Round (
    roundInGame INTEGER,
    gid INTEGER,
    pointA INTEGER,
    pointB INTEGER,
    FOREIGN KEY (gid) REFERENCES Game(gid)
);
```

## 🔍 Troubleshooting

### Common Issues

1. **"Cannot save to database"**
   - Check if backend server is running on `localhost:5001`
   - Use testing tool to verify API connection
   - Check if database file exists

2. **"Player list is empty"**
   - Click "🔄 Refresh Players" button
   - Check if backend database has data
   - Use testing tool to verify `/player/all` API

3. **"WebSocket connection failed"**
   - Confirm backend server is running normally
   - Check if port number is correct (5001)
   - View browser console error messages

### Debug Steps

1. **Check console logs**
   ```javascript
   // View in browser console
   window.playerManager.allPlayers  // View loaded players
   window.playerManager.currentPlayers  // View currently selected players
   ```

2. **Verify API calls**
   - Use `Frontend/test-db-connection.html` to test
   - Check API requests in Network panel

3. **Check database**
   - Ensure `Backend/data/data.db` file exists
   - Verify table structure is correct

## 🎮 Usage Flow

```
1. User opens game page
   ↓
2. System automatically loads player list
   ↓
3. User selects players or enters new players
   ↓
4. (Optional) Save new players to database
   ↓
5. Confirm player settings
   ↓
6. Start game
```

## 📚 API Reference

### GET /player/all
Get all players list
```json
{
    "status": "success",
    "players": [
        {"pid": 1, "name": "Player 1"},
        {"pid": 2, "name": "Player 2"}
    ]
}
```

### POST /player/create
Create new player
```json
// Request
{
    "name": "New Player"
}

// Response
{
    "status": "success",
    "name": "New Player"
}
```

## 🔄 Version Updates

### v2.0 (Current Version)
- ✅ Redesigned player management interface
- ✅ Support for selecting from player list
- ✅ Fixed database saving issues
- ✅ Added multiple saving solutions
- ✅ Optimized user experience

### v1.0 (Old Version)
- ❌ Only supported text input
- ❌ CORS issues
- ❌ Port number error
- ❌ Database saving failure

---

💡 **Tip**: If you encounter problems, first use the testing tool to verify the connection, then check the browser console for error messages. 