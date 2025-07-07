const messages = []; // Хранилище сообщений
const onlineUsers = new Map(); // socket.id → nickname
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

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(expressSession);

// Подключаем сессии к сокетам
io.use(sharedSession(expressSession));

// "База" пользователей: логин → хеш пароля
const users = {};

// 📌 Регистрация
app.post("/register", async (req, res) => {
  const { login, password, repeat, nickname } = req.body;

  if (users[login]) return res.send("❌ Такой логин уже есть");
  if (password !== repeat) return res.send("❌ Пароли не совпадают");

  const hash = await bcrypt.hash(password, 10);
  users[login] = hash;

  req.session.user = login;
  req.session.nickname = nickname || "Гость";

  res.redirect("/chat");
});

// 📌 Вход с логином, паролем и ником
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

// 📌 Страница чата (только после входа)
app.get("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/public/chat.html");
});

// 📌 Выход из чата
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// 📡 Socket.IO соединение
io.on("connection", (socket) => {
  const nickname = socket.handshake.session.nickname || "Гость";
onlineUsers.set(socket.id, nickname);
socket.emit("your nickname", nickname); // ← это твой собственный ник
io.emit("online users", Array.from(onlineUsers.values())); // список всех
  console.log(`🟢 Подключился: ${nickname}`);

  // Отправляем историю за последние 20 минут
  const cutoff = Date.now() - 20 * 60 * 1000;
  const recentMessages = messages.filter(m => m.time > cutoff);
  socket.emit("chat history", recentMessages);

  // Слушаем новые сообщения
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

// 🚀 Запуск сервера
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
});