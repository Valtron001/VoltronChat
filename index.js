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
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🌐 Supabase IPv4 подключение
const pool = new Pool({
  host: "db.lkuscpoliusttczzcnxc.supabase.co",
  port: 5432,
  user: "postgres",
  password: "Valer4k777",
  database: "postgres",
  ssl: { rejectUnauthorized: false }
});

// 🔍 Тест подключения
pool.query("SELECT NOW()")
  .then(() => console.log("🟢 Supabase подключение успешно"))
  .catch(err => console.error("🔴 Ошибка подключения к Supabase:", err));

// 🔒 Сессия
const expressSession = session({
  secret: "voltronSecretKey",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
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
    if (password !== repeat) {
      console.log("⛔ Пароли не совпадают");
      return res.sendFile(__dirname + "/public/error.html");
    }

    if (activeNicknames.includes(nickname)) {
      console.log("⛔ Ник уже используется:", nickname);
      return res.sendFile(__dirname + "/public/error.html");
    }

    const check = await pool.query("SELECT login FROM users WHERE login = $1", [login]);
    if (check.rows.length > 0) {
      console.log("⛔ Логин уже занят:", login);
      return res.sendFile(__dirname + "/public/error.html");
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      "INSERT INTO users (login, password_hash, nickname) VALUES ($1, $2, $3)",
      [login, hash, nickname]
    );
    console.log("📦 Пользователь записан в Supabase:", login);

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
    const result = await pool.query("SELECT password_hash FROM users WHERE login = $1", [login]);
    if (result.rows.length === 0) {
      console.log("⛔ Неверный логин:", login);
      return res.sendFile(__dirname + "/public/error.html");
    }

    const { password_hash } = result.rows[0];
    const match = await bcrypt.compare(password, password_hash);
    if (!match) {
      console.log("⛔ Неверный пароль");
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