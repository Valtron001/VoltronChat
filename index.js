const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const sharedSession = require("express-socket.io-session");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Настройка сессии
const expressSession = session({
  secret: "voltronSecretKey",
  resave: false,
  saveUninitialized: true
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(expressSession);

// Привязываем сессии к Socket.IO
io.use(sharedSession(expressSession));

// Хранилище пользователей (логин → хеш пароля)
const users = {};

app.post("/register", async (req, res) => {
  const { login, password, repeat } = req.body;
  if (users[login]) return res.send("❌ Такой логин уже существует");
  if (password !== repeat) return res.send("❌ Пароли не совпадают");

  const hash = await bcrypt.hash(password, 10);
  users[login] = hash;
  req.session.user = login;
  res.redirect("/chat");
});

app.post("/login", async (req, res) => {
  const { login, password, nickname } = req.body;
  const hash = users[login];
  if (!hash || !(await bcrypt.compare(password, hash))) {
    return res.send("❌ Неверный логин или пароль");
  }

  req.session.user = login;
  req.session.nickname = nickname || "Гость";
  res.redirect("/chat");
});

app.get("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/public/chat.html");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

io.on("connection", (socket) => {
  const nickname = socket.handshake.session.nickname || "Гость";
  console.log(`🟢 Подключился: ${nickname}`);

  socket.on("chat message", (msg) => {
    const fullMsg = `${nickname}: ${msg}`;
    io.emit("chat message", fullMsg);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Отключился: ${nickname}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});