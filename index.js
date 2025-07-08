const messages = [];
const onlineUsers = new Map();
const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const sharedSession = require("express-socket.io-session");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const expressSession = session({
  secret: "voltronSecretKey",
  resave: false,
  saveUninitialized: true
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(expressSession);
io.use(sharedSession(expressSession));

const users = {};

// 📌 Показ страницы входа
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

// 📌 Показ страницы регистрации
app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/public/register.html");
});

// 📌 Регистрация
app.post("/register", async (req, res) => {
  const { login, password, repeat, nickname } = req.body;

  if (users[login]) return res.sendFile(__dirname + "/public/error.html");
  if (password !== repeat) return res.sendFile(__dirname + "/public/error.html");

  const hash = await bcrypt.hash(password, 10);
  users[login] = hash;

  req.session.user = login;
  req.session.nickname = nickname || "Гость";
  res.redirect("/chat");
});

// 📌 Вход
app.post("/login", async (req, res) => {
  const { login, password, nickname } = req.body;
  const hash = users[login];

  if (!hash || !(await bcrypt.compare(password, hash))) {
    return res.sendFile(__dirname + "/public/error.html");
  }

  req.session.user = login;
  req.session.nickname = nickname || "Гость";
  res.redirect("/chat");
});

// 📌 Чат
app.get("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/public/chat.html");
});

// 📌 Выход
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// 📡 Socket.IO
io.on("connection", (socket) => {
  const nickname = socket.handshake.session.nickname || "Гость";
  onlineUsers.set(socket.id, nickname);
  socket.emit("your nickname", nickname);
  io.emit("online users", Array.from(onlineUsers.values()));
  console.log(`🟢 Подключился: ${nickname}`);

  const cutoff = Date.now() - 20 * 60 * 1000;
  const recentMessages = messages.filter(m => m.time > cutoff);
  socket.emit("chat history", recentMessages);

  socket.on("chat message", (msg) => {
    const fullMsg = {
      text: `${nickname}: ${msg}`,
      time: Date.now()
    };
    messages.push(fullMsg);
    io.emit("chat message", fullMsg);
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    io.emit("online users", Array.from(onlineUsers.values()));
    console.log(`🔴 Отключился: ${nickname}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});