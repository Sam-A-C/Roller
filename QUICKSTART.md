# Quick Start Guide

## For Testing (Local Development)

```bash
# Terminal 1: Start backend
cd backend
npm install
npm start
# Output: 🎲 Dice Roller backend listening on http://localhost:3000

# Terminal 2: Start frontend
python -m http.server 3000
# Or: npx http-server -p 3000
# Output: Server running at http://localhost:3000

# Browser: Open http://localhost:3000
```

## Test Solo Mode
1. Click "Play Solo"
2. Roll dice as before
3. Everything works like the original app

## Test Multiplayer
**Browser Tab 1:**
1. Click "Join Session"
2. Token: `test123` (or any token)
3. Name: `Alice`
4. Click "Join"
5. Roll some dice

**Browser Tab 2:**
1. Click "Join Session"
2. Token: `test123` (same token!)
3. Name: `Bob`
4. Click "Join"
5. You see Alice in the players list
6. You see Alice's rolls in the sidebar

**Roll in Tab 2:**
- Watch Tab 1's sidebar update instantly with your roll

## For Production

See **DEPLOYMENT.md** for full details.

Quick deployment path:
1. Push code to GitHub
2. Backend: Deploy to Render.com (free tier available)
3. Frontend: Deploy to Vercel or Netlify (free tier available)
4. Set `CORS_ORIGIN` on backend to match frontend domain
5. Done!

## Troubleshooting

**Backend won't start**: 
```bash
cd backend && npm install
npm start
```

**"Connection refused" when joining session**:
- Is backend running on port 3000?
- Try: `curl http://localhost:3000`

**Rolls don't sync across browsers**:
- Check browser console (F12) for errors
- Verify both browsers can reach backend

**Still stuck?**
See DEPLOYMENT.md § Troubleshooting for more help.

## Files to Know

- `index.html` — The main page
- `app.js` — All the logic
- `socket-client.js` — WebSocket communication
- `style.css` — All styles
- `backend/server.js` — The backend
- `CLAUDE.md` — Architecture docs
- `DEPLOYMENT.md` — How to deploy
- `IMPLEMENTATION_SUMMARY.md` — What was built

## Key Features

✅ **Home screen** — Choose solo or multiplayer
✅ **Session tokens** — Share with friends (e.g., `ABC123`)
✅ **Live rolls** — See others' rolls in real-time
✅ **No persistence needed** — Solo mode works offline
✅ **Easy to deploy** — Render + Vercel takes 5 minutes
✅ **No breaking changes** — Existing solo mode untouched
