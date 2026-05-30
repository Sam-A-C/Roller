// Socket.io client for Dice Roller
// This file handles all WebSocket communication for multiplayer sessions

let socket = null;
let currentSessionToken = null;

function initializeSocket(serverUrl = window.location.origin) {
  // Load Socket.io library dynamically
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `${serverUrl}/socket.io/socket.io.js`;
    script.onload = () => {
      socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      setupSocketListeners();
      resolve(socket);
    };
    document.head.appendChild(script);
  });
}

function setupSocketListeners() {
  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('session:playerJoined', (data) => {
    updateSessionPlayers(data.players);
  });

  socket.on('session:playerLeft', (data) => {
    updateSessionPlayers(data.players);
  });

  socket.on('roll:received', (data) => {
    addSessionRoll(data);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });
}

function createSession(callback) {
  if (!socket) {
    callback({ success: false, error: 'Socket not initialized' });
    return;
  }

  socket.emit('session:create', (response) => {
    currentSessionToken = response.token;
    sessionStorage.setItem('sessionId', response.token);
    callback(response);
  });
}

function joinSession(token, username, callback) {
  if (!socket) {
    callback({ success: false, error: 'Socket not initialized' });
    return;
  }

  socket.emit('session:join', { token, username }, (response) => {
    if (response.success) {
      currentSessionToken = token;
      // Add existing rolls to the session panel
      if (response.rolls && response.rolls.length > 0) {
        response.rolls.forEach((roll) => addSessionRoll(roll, true));
      }
      // Update players list
      updateSessionPlayers(response.players);
    }
    callback(response);
  });
}

function emitRoll(sides, count, rolls) {
  if (!socket || !currentSessionToken) {
    return;
  }

  socket.emit(
    'roll:submit',
    { sides, count, rolls },
    (response) => {
      if (!response.success) {
        console.error('Failed to submit roll:', response.error);
      }
    }
  );
}

function addSessionRoll(rollData, isInitial = false) {
  const { username, sides, count, rolls, timestamp } = rollData;
  const li = document.createElement('li');
  li.className = 'session-roll-item';

  const timeStr = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Format roll counts (e.g., "3x1  2x2  1x6")
  const counts = new Map();
  rolls.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const rollFormat = [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([v, c]) => `${c}x${v}`)
    .join('  ');

  li.innerHTML = `<span class="session-roll-item-user">${username}</span>: ${count}d${sides} = ${rollFormat}<br><span class="session-roll-item-time">${timeStr}</span>`;

  sessionRollsList.insertBefore(li, sessionRollsList.firstChild);

  // Keep only last 30 rolls visible
  while (sessionRollsList.children.length > 30) {
    sessionRollsList.lastChild.remove();
  }
}

function updateSessionPlayers(players) {
  sessionPlayersList.innerHTML = '';

  players.forEach((player) => {
    const li = document.createElement('li');
    li.className = 'session-player-item';
    li.innerHTML = `<span class="session-player-dot"></span>${player.name}`;
    sessionPlayersList.appendChild(li);
  });
}

function disconnectSession() {
  if (socket) {
    socket.disconnect();
    currentSessionToken = null;
    sessionPlayersList.innerHTML = '';
    sessionRollsList.innerHTML = '';
  }
}

// Export functions for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeSocket,
    createSession,
    joinSession,
    emitRoll,
    disconnectSession,
  };
}
