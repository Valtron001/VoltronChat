const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздача статических файлов из папки public
app.use(express.static("public"));

// Обработка подключения клиентов
io.on("connection", (socket) => {
  console.log("🔌 Пользователь подключился");

  // При получении сообщения — рассылаем всем
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg); // ✅ видно всем клиентам
  });

  socket.on("disconnect", () => {
    console.log("❌ Пользователь отключился");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});