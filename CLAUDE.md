Please always write a plan, review it, and then test any generated code

# Dice Roller

A single-page vanilla JS dice roller app with optional multiplayer support via WebSocket sessions.

## Single-Player Mode

No build step, no dependencies — just open `index.html` directly in a browser.

## Multiplayer Mode

Requires a Node.js backend server (see `backend/` directory).

### Quick Start

1. Start the backend:
```bash
cd backend
npm install
npm start
```

2. Open frontend in browser (defaults to `http://localhost:3000`)

3. Click "Join Session" to create or join a multiplayer session

## Frontend Architecture

All logic lives in `app.js`. Structure:

- **Home Screen** — Solo play or join session (new in Phase 1)
- **Session Sidebar** — Shows active players and recent rolls (new in Phase 1)
- **DOM refs** — Top of file, organized by feature (home, app, session)
- **State** — Flat module-scope variables + sessionStorage for persistence
- **Roll flow** — `roll()` → `runRoll()` → `animateDie()` → `sortDiceByValue()` → emit to session
- **Row operations** — `addDiceToRow`, `removeDiceFromRow`, `clearRowAndBelow`, `adjustPool`
- **History** — Last 20 rolls stored in DOM (solo mode); session rolls managed by backend
- **Settings** — Light/dark mode toggle (localStorage), die type selector (local)

### Key Behaviors

- **d6 rolling 6** renders a skull emoji instead of pips
- **Pip layouts** for d6 and below use `PIP_PATTERNS`; d8+ show numbers
- **Skip animation** — clicking results area during roll skips to end
- **Side pool** — independent counter; "Add to roll" appends unresolved dice
- **Unresolved dice** — dashed border, `?` label; clicking Roll re-rolls them
- **Session rolls** — Non-intrusive sidebar shows other players' rolls in real-time
- **Session disconnect** — Auto-cleanup on server when all players leave

### Files

- `index.html` — Structure with home screen, app container, session sidebar, settings
- `app.js` — All logic (home/session mode, roll mechanics, UI updates)
- `socket-client.js` — WebSocket client (Socket.io) for session sync
- `style.css` — Styles for home screen, modal, session sidebar, existing app (responsive)

### CSS Conventions

- CSS custom properties on `:root` for colors; `.light-mode` on `<html>` overrides
- Responsive breakpoint at `600px` (stacks layout, session sidebar floats right)
- Animation classes: `.spinning`, `.revealed`, `.max`, `.min`
- Session sidebar slides in on mobile (fixed overlay)

## Backend Architecture

Node.js + Express + Socket.io (in `backend/` directory).

### Files

- `server.js` — Express app, Socket.io setup, event handlers
- `sessionManager.js` — In-memory session store, CRUD operations
- `package.json` — Dependencies (express, socket.io, uuid, dotenv)
- `.env.example` — Environment variables template

### Key Behaviors

- **Ephemeral sessions** — In-memory only, auto-delete when empty
- **Token format** — 6-char alphanumeric (e.g., `ABC123`)
- **Events** — `session:create`, `session:join`, `roll:submit`, `session:playerJoined`, `session:playerLeft`, `roll:received`
- **Roll tracking** — Last 50 rolls per session
- **No persistence** — All data lost on server restart (acceptable for casual play)

## Integration Points

### Frontend-Backend

1. **Home → Join Session**
   - User enters token + username
   - Frontend initializes Socket.io → `initializeSocket()`
   - Emits `session:join` with token/username
   - Receives `players` + `rolls` history
   - Shows session sidebar with existing rolls

2. **Roll Submission**
   - User rolls dice in solo or session mode
   - `runRoll()` completes, sorts dice
   - If in session mode: `emitRoll(sides, count, rolls)` via Socket.io
   - Backend broadcasts `roll:received` to all players
   - Other players' sidebars update with new roll

3. **Session Disconnect**
   - User clicks "Exit Session" → `disconnectSession()`
   - Backend removes player, auto-deletes empty session
   - Frontend returns to home screen

## Deployment

### Production Checklist

- [ ] Backend: Deploy Node.js server (Heroku, Railway, Render, etc.)
- [ ] Environment: Set `CORS_ORIGIN` to frontend domain in `.env`
- [ ] Token generation: Uses cryptographically secure randomness (`crypto.randomBytes` if needed)
- [ ] Rate limiting: Consider adding to prevent abuse (DoS, spam sessions)
- [ ] Logging: Add structured logging for debugging
- [ ] Monitoring: Set up error alerts for production server
- [ ] HTTPS: Ensure Socket.io uses secure WebSocket (WSS) in production

### Frontend Deployment

- [ ] Update `socket-client.js` server URL if not same origin
- [ ] Deploy frontend as static site (Vercel, Netlify, etc.) or with backend
- [ ] Ensure CORS_ORIGIN matches frontend domain on backend

