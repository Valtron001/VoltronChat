const messages = [];
const onlineUsers = new Map();
const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");
const sharedSession = require("express-socket.io-session");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const usersFile = path.join(__dirname, "users.json");
let users = {};

// 🔐 Загружаем пользователей
if (fs.existsSync(usersFile)) {
  try {
    users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
    console.log("📖 users.json загружен");
  } catch (err) {
    console.error("⚠️ Ошибка чтения users.json:", err);
    users = {};
  }
}

// 🔒 Сессия
const expressSession = session({
  secret: "voltronSecretKey",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // сутки
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(expressSession);
io.use(sharedSession(expressSession));

// 📝 Лог действий
function logAction(text) {
  const line = `${new Date().toISOString()} — ${text}\n`;
  fs.appendFileSync("logs.txt", line);
}

// 📌 Страницы
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/public/register.html");
});

app.get("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/public/chat.html");
});

// 📌 Регистрация
app.post("/register", async (req, res) => {
  const { login, password, repeat, nickname } = req.body;
  const activeNicknames = Array.from(onlineUsers.values());

  try {
    let currentUsers = {};
    if (fs.existsSync(usersFile)) {
      currentUsers = JSON.parse(fs.readFileSync(usersFile, "utf8"));
    }

    if (currentUsers[login]) {
      console.log("⛔ Логин уже занят:", login);
      return res.sendFile(__dirname + "/public/error.html");
    }

    if (password !== repeat) {
      console.log("⛔ Пароли не совпадают");
      return res.sendFile(__dirname + "/public/error.html");
    }

    if (activeNicknames.includes(nickname)) {
      console.log("⛔ Ник уже используется:", nickname);
      return res.sendFile(__dirname + "/public/error.html");
    }

    const hash = await bcrypt.hash(password, 10);
    currentUsers[login] = hash;

    fs.writeFileSync(usersFile, JSON.stringify(currentUsers, null, 2));
    console.log("✅ Пользователь сохранён:", login);

    users = currentUsers;

    req.session.user = login;
    req.session.nickname = nickname || "Гость";

    logAction(`🔐 Зарегистрировался: ${login} / Ник: ${req.session.nickname}`);
    res.redirect("/chat");
  } catch (err) {
    console.error("❌ Ошибка регистрации:", err);
    res.sendFile(__dirname + "/public/error.html");
  }
});

// 📌 Вход
app.post("/login", async (req, res) => {
  const { login, password, nickname } = req.body;
  const activeNicknames = Array.from(onlineUsers.values());

  try {
    const hash = users[login];
    if (!hash || !(await bcrypt.compare(password, hash))) {
      console.log("⛔ Неверный логин или пароль");
      return res.sendFile(__dirname + "/public/error.html");
    }

    if (activeNicknames.includes(nickname)) {
      console.log("⛔ Ник уже используется:", nickname);
      return res.sendFile(__dirname + "/public/error.html");
    }

    req.session.user = login;
    req.session.nickname = nickname || "Гость";

    logAction(`✅ Вошёл: ${login} / Ник: ${req.session.nickname}`);
    res.redirect("/chat");
  } catch (err) {
    console.error("❌ Ошибка входа:", err);
    res.sendFile(__dirname + "/public/error.html");
  }
});

// 📌 Выход
app.post("/logout", (req, res) => {
  logAction(`🚪 Вышел: ${req.session.user} / Ник: ${req.session.nickname}`);
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
  logAction(`🟢 Socket подключён: ${nickname}`);

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
    logAction(`🔴 Socket отключён: ${nickname}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  logAction(`🚀 Сервер стартовал на порту ${PORT}`);
});