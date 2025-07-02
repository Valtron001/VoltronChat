const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const io = new Server(server);


io.on('connection', socket => {
  socket.on('message', msg => {
    socket.broadcast.emit('message', msg);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});