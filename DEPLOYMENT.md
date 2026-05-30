# Dice Roller - Setup & Deployment Guide

## Project Structure

```
Dice Roller/
├── index.html          # Main HTML
├── app.js              # Frontend logic + home screen
├── socket-client.js    # WebSocket client (Socket.io)
├── style.css           # All styles (home, app, session panel)
├── CLAUDE.md           # Architecture documentation
└── backend/
    ├── server.js       # Express + Socket.io backend
    ├── sessionManager.js # Session management
    ├── package.json    # Node.js dependencies
    ├── .env.example    # Environment template
    └── README.md       # Backend docs
```

## Development Mode

### Solo Play (No Backend Required)

Simply open `index.html` in a browser:
```bash
# Using Python's built-in HTTP server
python -m http.server 8000
# Open: http://localhost:8000

# Or with node/npm
npx http-server
```

Click "Play Solo" on the home screen. Works exactly like the original app.

### Multiplayer Development

1. **Start the backend:**
```bash
cd backend
npm install
npm start
# Backend runs on http://localhost:3000
```

2. **Start the frontend:**
```bash
# In a new terminal
python -m http.server 3000
# Or: npx http-server -p 3000
```

3. **Test multiplayer:**
   - Open browser tab 1: `http://localhost:3000`
   - Click "Join Session"
   - Enter any token (e.g., `demo123`) and a name
   - Click "Join"
   - Open browser tab 2: same URL, join same token with different name
   - Roll in tab 1 → tab 2 sees it in the session sidebar (and vice versa)

## Deployment

### Backend Deployment (Required for Multiplayer)

Choose one:

#### Option 1: **Render.com** (Easiest, Free Tier)

1. Push to GitHub
2. Sign up at https://render.com
3. Create new "Web Service"
4. Connect GitHub repo
5. Build command: `cd backend && npm install`
6. Start command: `npm start`
7. Set environment:
   - `PORT` = 3000
   - `CORS_ORIGIN` = your frontend domain (e.g., `https://my-dice-roller.com`)
8. Deploy

#### Option 2: **Railway.app** (Also easy, Free Tier)

1. Push to GitHub
2. Sign up at https://railway.app
3. Create new project from GitHub
4. Railway auto-detects `package.json` in root (or specify `backend/` as root directory)
5. Set env vars in dashboard
6. Deploy

#### Option 3: **Heroku** (Classic, has free tiers alternatives)

1. `heroku login`
2. `heroku create my-dice-roller-backend`
3. `heroku config:set CORS_ORIGIN=https://my-dice-roller-web.com`
4. `git push heroku main` (may need to push from `backend/` subdirectory)

#### Option 4: **Self-Hosted (VPS)**

Use DigitalOcean, Linode, AWS, or similar:
```bash
# SSH into server
ssh user@server.ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone <your-repo> dice-roller
cd dice-roller/backend

# Setup environment
cp .env.example .env
# Edit .env, set CORS_ORIGIN
nano .env

# Install and run with PM2 (process manager)
npm install -g pm2
npm install
pm2 start server.js --name "dice-roller"
pm2 save

# Setup reverse proxy with Nginx
# ... (Nginx config example below)
```

### Frontend Deployment

#### Option 1: **Vercel** (Recommended for simplicity)

1. Push to GitHub
2. Sign up at https://vercel.com
3. Import repo
4. Root directory: `.` (or root of repo)
5. Build command: (leave empty for static)
6. Output directory: `.` (or just deploy as-is)
7. Deploy

Environment: Set `VITE_BACKEND_URL` or update `socket-client.js` to point to your backend.

#### Option 2: **Netlify**

Similar to Vercel:
1. Connect GitHub repo
2. Build command: (empty)
3. Publish directory: `.` (root)
4. Deploy

#### Option 3: **GitHub Pages**

```bash
# Static deployment (solo play only, no backend)
# Push to GitHub, enable Pages in repo settings
```

#### Option 4: **Deploy with Backend (Same Server)**

If backend and frontend are on the same domain:
```bash
# In backend/server.js, the Express app already serves static files
# Just place frontend files in a `public/` folder, or update the express.static path
# Deploy entire project to VPS

# Updated server.js line (already done):
# app.use(express.static(path.join(__dirname, '../')));
# This serves `index.html`, `app.js`, etc. from parent directory
```

## Configuration

### Backend Environment Variables

Create `backend/.env`:
```
PORT=3000
CORS_ORIGIN=https://my-dice-roller-web.com
```

In production:
- `PORT` — deployment port (usually 3000 or set by host)
- `CORS_ORIGIN` — frontend domain (allows Socket.io connections from that domain)

### Frontend Socket Connection

Edit `socket-client.js` if backend is on different domain:
```javascript
// Line in initializeSocket():
const socket = io(serverUrl);  // defaults to window.location.origin

// Override example:
// const socket = io('https://api.dice-roller.com');
```

## Testing Checklist

### Solo Mode
- [ ] Home screen displays
- [ ] "Play Solo" button works
- [ ] App loads exactly like original
- [ ] Roll, pool, settings all work
- [ ] History works (no persistence needed)

### Multiplayer Mode
- [ ] Home screen "Join Session" button works
- [ ] Join modal accepts input
- [ ] Joining with valid token connects to backend
- [ ] Two clients in same session see each other in players list
- [ ] Rolling in one client shows up in other's session sidebar within 1 sec
- [ ] Closing a tab removes that player from others' view
- [ ] Rolling in solo mode doesn't affect session rolls

### Edge Cases
- [ ] Invalid token shows error
- [ ] Empty token/username shows error
- [ ] Closing browser tab auto-cleans up session
- [ ] Session persists while players connected
- [ ] History recall doesn't broadcast to other players
- [ ] Light mode toggle stays in solo mode only

## Production Deployment Checklist

- [ ] Backend deployed and accessible
- [ ] CORS_ORIGIN set correctly on backend
- [ ] Frontend deployed and accessible
- [ ] Frontend can reach backend (test WebSocket connection)
- [ ] HTTPS enabled for both frontend and backend
- [ ] WebSocket uses WSS (secure) in production
- [ ] Server logs monitored
- [ ] Rate limiting added (optional but recommended)
- [ ] Tested with multiple clients joining same session
- [ ] Tested with network interruptions (disconnect/reconnect)

## Troubleshooting

### "Connection refused" when joining session
- Verify backend is running: `curl http://localhost:3000`
- Check `socket-client.js` has correct server URL
- Check CORS_ORIGIN on backend matches frontend domain

### "Session not found" error
- Token is case-sensitive (e.g., `ABC123` ≠ `abc123`)
- Session expired (all players disconnected)
- Backend restarted (loses ephemeral sessions)

### Rolls don't appear in other players' sidebars
- Check browser console for WebSocket errors
- Verify Socket.io connected (check `io` global in console)
- Ensure `emitRoll()` is being called after roll completes

### "CORS policy" error in console
- Update `CORS_ORIGIN` on backend to match frontend domain
- Ensure frontend is accessing backend, not vice versa

## Future Enhancements

- [ ] Persistent sessions (database-backed)
- [ ] User authentication & accounts
- [ ] Session password protection
- [ ] Replay/record rolls
- [ ] Voting system (consensus roll)
- [ ] Desktop app (Electron)
- [ ] Mobile app (React Native)
- [ ] Spectator mode (read-only join)
- [ ] Roll templates (D&D, Fate, custom systems)

## License

MIT
