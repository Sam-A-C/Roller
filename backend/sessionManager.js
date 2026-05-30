const { v4: uuidv4 } = require('uuid');

// In-memory session store
const sessions = {}; // { token: { id, players: {}, rolls: [], createdAt } }

function generateToken() {
  // Generate a short, easy-to-share token (6 alphanumeric chars)
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createSession() {
  const token = generateToken();
  sessions[token] = {
    id: uuidv4(),
    players: {},
    rolls: [],
    createdAt: Date.now(),
  };
  return token;
}

function createSessionWithToken(token) {
  sessions[token.toUpperCase()] = {
    id: uuidv4(),
    players: {},
    rolls: [],
    createdAt: Date.now(),
  };
}

function joinSession(token, socketId, username) {
  if (!sessions[token]) return null;

  const session = sessions[token];
  session.players[socketId] = {
    name: username,
    joinedAt: Date.now(),
    lastActive: Date.now(),
  };

  return {
    sessionId: session.id,
    players: getSessionPlayers(token),
    rolls: session.rolls.slice(-50), // Last 50 rolls
  };
}

function leaveSession(token, socketId) {
  if (!sessions[token]) return;

  const session = sessions[token];
  delete session.players[socketId];

  // Cleanup: delete session if empty
  if (Object.keys(session.players).length === 0) {
    delete sessions[token];
  }
}

function addRoll(token, username, sides, count, rolls) {
  if (!sessions[token]) return;

  sessions[token].rolls.push({
    username,
    sides,
    count,
    rolls,
    timestamp: Date.now(),
  });

  // Keep only last 50 rolls
  if (sessions[token].rolls.length > 50) {
    sessions[token].rolls.shift();
  }
}

function getSessionPlayers(token) {
  if (!sessions[token]) return [];
  return Object.entries(sessions[token].players).map(([socketId, player]) => ({
    socketId,
    name: player.name,
  }));
}

function getSessionRolls(token) {
  if (!sessions[token]) return [];
  return sessions[token].rolls;
}

function sessionExists(token) {
  return !!sessions[token];
}

module.exports = {
  createSession,
  createSessionWithToken,
  joinSession,
  leaveSession,
  addRoll,
  getSessionPlayers,
  getSessionRolls,
  sessionExists,
};
