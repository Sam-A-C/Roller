# Dice Roller Backend

Real-time multiplayer dice roller server using Node.js, Express, and Socket.io.

## Quick Start

### Prerequisites
- Node.js 14+ and npm

### Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Start the server:
```bash
npm start
```

The server will listen on `http://localhost:3000` by default.

For development with auto-restart on file changes:
```bash
npm run dev
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - CORS origin for Socket.io (default: * for development)

## Frontend Connection

The frontend connects to the backend via WebSocket. Update the server URL in `socket-client.js` if running on a different domain.

### Development
Frontend and backend run on the same `localhost:3000` in development.

### Production
Set `CORS_ORIGIN` to your frontend domain when deploying.

## API

### Socket.io Events

#### Client → Server

- **session:create**
  - Emits: `{ token: string }`
  - Creates a new session and returns a shareable token

- **session:join(data, callback)**
  - Params: `{ token: string, username: string }`
  - Callback: `{ success: boolean, players: [], rolls: [] }`
  - Joins an existing session

- **roll:submit(data, callback)**
  - Params: `{ sides: number, count: number, rolls: number[] }`
  - Callback: `{ success: boolean }`
  - Submits a roll and broadcasts to all players in the session

#### Server → Clients

- **session:playerJoined**
  - Data: `{ players: { socketId, name }[] }`
  - Broadcasts when a new player joins

- **session:playerLeft**
  - Data: `{ players: { socketId, name }[] }`
  - Broadcasts when a player leaves

- **roll:received**
  - Data: `{ username: string, sides: number, count: number, rolls: number[], timestamp: number }`
  - Broadcasts when a roll is submitted

## Session Management

- Sessions are **ephemeral** — they live only while at least one player is connected
- Sessions are stored **in-memory** — they're lost on server restart
- Sessions have a **6-character alphanumeric token** for easy sharing
- Each session tracks **up to 50 rolls** and current players
- Empty sessions are **automatically deleted**

## Deployment

### Option 1: Traditional VPS (Recommended)
Deploy to any Node.js hosting (Heroku, Railway, Render, DigitalOcean, AWS, etc.)

```bash
git push <remote> main  # Deploy using your host's git workflow
npm install  # Or automatic on push
npm start
```

### Option 2: Serverless
Socket.io works with serverless functions but requires additional configuration for WebSocket support.

## Troubleshooting

**Connection refused**: Ensure the backend is running and accessible at the configured URL.

**CORS errors**: Update `CORS_ORIGIN` in `.env` to match your frontend domain.

**Session not found**: Session tokens are case-sensitive. Verify the exact token.

**No rolls appearing**: Check browser console for WebSocket errors. Ensure `socket-client.js` is loading.
