require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sessionManager = require('./sessionManager');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../')));

// Fallback to index.html for SPA routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new session
  socket.on('session:create', (callback) => {
    const token = sessionManager.createSession();
    console.log(`Session created: ${token}`);
    callback({ token });
  });

  // Join an existing session
  socket.on('session:join', (data, callback) => {
    const { token: rawToken, username } = data;
    const token = rawToken.toUpperCase();

    // Auto-create session if it doesn't exist yet (first player creates it)
    if (!sessionManager.sessionExists(token)) {
      sessionManager.createSessionWithToken(token);
    }

    const sessionData = sessionManager.joinSession(token, socket.id, username);
    if (!sessionData) {
      callback({ success: false, error: 'Failed to join session' });
      return;
    }

    // Join the Socket.io room for this session
    socket.join(token);
    socket.sessionToken = token;
    socket.username = username;

    console.log(`${username} joined session: ${token}`);

    // Notify all users in the session
    io.to(token).emit('session:playerJoined', {
      players: sessionManager.getSessionPlayers(token),
    });

    // Send the joining user the session data
    callback({
      success: true,
      players: sessionData.players,
      rolls: sessionData.rolls,
    });
  });

  // Submit a roll
  socket.on('roll:submit', (data, callback) => {
    const { sides, count, rolls } = data;
    const token = socket.sessionToken;
    const username = socket.username;

    if (!token) {
      callback({ success: false, error: 'Not in a session' });
      return;
    }

    // Add roll to session
    sessionManager.addRoll(token, username, sides, count, rolls);

    // Broadcast to all users in the session
    io.to(token).emit('roll:received', {
      username,
      sides,
      count,
      rolls,
      timestamp: Date.now(),
    });

    callback({ success: true });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const token = socket.sessionToken;
    if (token) {
      sessionManager.leaveSession(token, socket.id);
      io.to(token).emit('session:playerLeft', {
        players: sessionManager.getSessionPlayers(token),
      });
      console.log(`${socket.username || 'User'} left session: ${token}`);
    } else {
      console.log(`User disconnected: ${socket.id}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🎲 Dice Roller backend listening on http://localhost:${PORT}`);
  console.log(`Socket.io endpoint: http://localhost:${PORT}/socket.io\n`);
});
