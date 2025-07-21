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
const supabase = require("./supabase");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

function logAction(text) {
  const line = `${new Date().toISOString()} — ${text}\n`;
  fs.appendFileSync("logs.txt", line);
}

// 📌 Страницы
app.get("/login", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/register", (req, res) => res.sendFile(__dirname + "/public/register.html"));
app.get("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/public/chat.html");
});

// 📌 Регистрация
app.post("/register", async (req, res) => {
  const { login, password, repeat, nickname } = req.body;
  const activeNicknames = Array.from(onlineUsers.values());
  console.log("📥 Получены данные:", { login, password, repeat, nickname });

  if (password !== repeat) {
    console.log("⛔ Пароли не совпадают");
    return res.sendFile(__dirname + "/public/error.html");
  }

  if (activeNicknames.includes(nickname)) {
    console.log("⛔ Ник уже используется в чате:", nickname);
    return res.sendFile(__dirname + "/public/error.html");
  }

  try {
    const { data: users, error: selectError } = await supabase
      .from("users")
      .select("login")
      .eq("login", login)
      .limit(1);

    if (selectError) {
      console.error("❌ Supabase SELECT error:", selectError.message);
      return res.sendFile(__dirname + "/public/error.html");
    }

    const existingUser = users && users.length > 0 ? users[0] : null;

    if (existingUser) {
      console.log("⛔ Логин уже занят:", login);
      return res.sendFile(__dirname + "/public/error.html");
    }

    const hash = await bcrypt.hash(password, 10);

    const { error: insertError } = await supabase
      .from("users")
      .insert([{ login, password_hash: hash, nickname }]);

    if (insertError) {
      console.error("❌ Supabase INSERT error:", insertError.message);
      return res.sendFile(__dirname + "/public/error.html");
    }

    req.session.user = login;
    req.session.nickname = nickname || "Гость";
    logAction(`🔐 Зарегистрировался: ${login} / Ник: ${req.session.nickname}`);
    console.log("✅ Пользователь добавлен в Supabase:", login);
    res.redirect("/chat");
  } catch (err) {
    console.error("❌ Исключение регистрации:", err.message);
    res.sendFile(__dirname + "/public/error.html");
  }
});

// 📌 Вход
app.post("/login", async (req, res) => {
  const { login, password, nickname } = req.body;
  const activeNicknames = Array.from(onlineUsers.values());
  console.log("🔑 Вход:", { login, nickname });

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("password_hash")
      .eq("login", login)
      .single();

    if (error || !user) {
      console.log("⛔ Логин не найден:", login);
      return res.sendFile(__dirname + "/public/error.html");
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      console.log("⛔ Неверный пароль");
      return res.sendFile(__dirname + "/public/error.html");
    }

    if (activeNicknames.includes(nickname)) {
      console.log("⛔ Ник уже используется в чате:", nickname);
      return res.sendFile(__dirname + "/public/error.html");
    }

    req.session.user = login;
    req.session.nickname = nickname || "Гость";
    logAction(`✅ Вошёл: ${login} / Ник: ${req.session.nickname}`);
    res.redirect("/chat");
  } catch (err) {
    console.error("❌ Ошибка входа:", err.message);
    res.sendFile(__dirname + "/public/error.html");
  }
});

// 📌 Личная переписка: отправка
app.post("/private/send", async (req, res) => {
  const { to, text } = req.body;
  const from = req.session.user;
  const timestamp = Date.now();

  const { error } = await supabase
    .from("private_messages")
    .insert([{ sender: from, recipient: to, message: text, timestamp }]);

  if (error) {
    console.error("❌ Личка не отправлена:", error.message);
    return res.status(500).send("Ошибка");
  }

  for (let [id, nick] of onlineUsers.entries()) {
    if (nick === to) {
      io.to(id).emit("private notify", { from, text, timestamp });
    }
  }

  console.log("✅ Личка от", from, "к", to, ":", text);
  res.sendStatus(200);
});

// 📌 Личная переписка: загрузка входящих
app.get("/private/inbox", async (req, res) => {
  const user = req.session.user;
  const cutoff = Date.now() - 86400000;

  const { data, error } = await supabase
    .from("private_messages")
    .select("*")
    .eq("recipient", user)
    .gt("timestamp", cutoff)
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("❌ Личка не загружена:", error.message);
    return res.status(500).send("Ошибка загрузки");
  }

  res.json(data);
});

// 📌 Выход
app.post("/logout", (req, res) => {
  logAction(`🚪 Вышел: ${req.session.user} / Ник: ${req.session.nickname}`);
  req.session.destroy(() => res.redirect("/"));
});

// 📡 Socket.IO
io.on("connection", (socket) => {
  const nickname = socket.handshake.session.nickname || "Гость";
  onlineUsers.set(socket.id, nickname);
  socket.emit("your nickname", nickname);
  io.emit("online users", Array.from(onlineUsers.values()));
  logAction(`🟢 Socket подключён: ${nickname}`);

  const cutoff = Date.now() - 20 * 60 * 1000;
  const recentMessages = messages.filter(m => m.time > cutoff);
  socket.emit("chat history", recentMessages);

  socket.on("chat message", (msg) => {
    const fullMsg = { text: `${nickname}: ${msg}`, time: Date.now() };
    messages.push(fullMsg);
    io.emit("chat message", fullMsg);
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    io.emit("online users", Array.from(onlineUsers.values()));
    logAction(`🔴 Socket отключён: ${nickname}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  logAction(`🚀 Сервер стартовал на порту ${PORT}`);
});