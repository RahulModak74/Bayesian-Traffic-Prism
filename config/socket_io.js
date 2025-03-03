const { Server } = require('socket.io');

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    cookie: false
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join session room
    socket.on('join', (data) => {
      const sessionId = data.sessionId;
      socket.join(sessionId);
      console.log(`User joined session room: ${sessionId}`);
    });

    // Message handling
    socket.on('sendMessage', (data) => {
      const { sessionId, message } = data;
      io.to(sessionId).emit('receiveMessage', message);
    });

    // Session termination handling
    socket.on('terminateSession', (sessionId) => {
      io.to(sessionId).emit('session-terminated', {
        message: 'Your session has been terminated by an administrator.'
      });
      socket.leave(sessionId);
    });

    // CAPTCHA handling
    socket.on('captchaRequired', (sessionId) => {
      io.to(sessionId).emit('captcha-required', {
        message: 'Please solve the CAPTCHA to continue.'
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Error handling
  io.on('error', (error) => {
    console.error('Socket.IO error:', error);
  });

  return io;
}

// Helper function to emit to specific session
function emitToSession(io, sessionId, event, data) {
  io.to(sessionId).emit(event, data);
}

// Helper function to broadcast to all connected clients
function broadcastToAll(io, event, data) {
  io.emit(event, data);
}

module.exports = {
  initializeSocket,
  emitToSession,
  broadcastToAll
};