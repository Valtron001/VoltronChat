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

const messages = [];
const onlineUsers = new Map(); // socket.id → nickname

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
app.get("/", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/login", (req, res) => res.sendFile(__dirname + "/public/login.html"));
app.get("/register", (req, res) => res.sendFile(__dirname + "/public/register.html"));
app.get("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/public/chat.html");
});

// 📌 Регистрация
app.post("/register", async (req, res) => {
  const { login, password, repeat, nickname, nickname_color } = req.body;
  if (password !== repeat) return res.sendFile(__dirname + "/public/error.html");

  // Проверка уникальности nickname среди всех пользователей
  const { data: nickUsers, error: nickError } = await supabase
    .from("users")
    .select("nickname")
    .eq("nickname", nickname)
    .limit(1);
  if (nickError || (nickUsers && nickUsers.length > 0)) return res.sendFile(__dirname + "/public/error.html");

  // Проверка уникальности login
  const { data: users, error: selectError } = await supabase
    .from("users")
    .select("login")
    .eq("login", login)
    .limit(1);
  if (selectError || (users && users.length > 0)) return res.sendFile(__dirname + "/public/error.html");

  const hash = await bcrypt.hash(password, 10);
  const { error: insertError } = await supabase
    .from("users")
    .insert([{ login, password_hash: hash, nickname, nickname_color }]);

  if (insertError) return res.sendFile(__dirname + "/public/error.html");

  req.session.user = login;
  req.session.nickname = nickname;
  req.session.nickname_color = nickname_color;
  logAction(`🔐 Зарегистрировался: ${login} / Ник: ${nickname} / Цвет: ${nickname_color}`);
  res.redirect("/chat");
});

// 📌 Вход
app.post("/login", async (req, res) => {
  const { login, password, nickname_color } = req.body;
  const { data: user, error } = await supabase
    .from("users")
    .select("password_hash, nickname, nickname_color")
    .eq("login", login)
    .single();

  if (error || !user) return res.sendFile(__dirname + "/public/error.html");

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.sendFile(__dirname + "/public/error.html");

  // Проверка, что nickname не занят среди онлайн
  const activeNicks = Array.from(onlineUsers.values());
  if (activeNicks.includes(user.nickname)) return res.sendFile(__dirname + "/public/error.html");

  req.session.user = login;
  req.session.nickname = user.nickname;
  req.session.nickname_color = user.nickname_color || nickname_color;
  logAction(`✅ Вошёл: ${login} / Ник: ${user.nickname} / Цвет: ${req.session.nickname_color}`);
  res.redirect("/chat");
});

// 📌 Выход
app.post("/logout", (req, res) => {
  logAction(`🚪 Вышел: ${req.session.user} / Ник: ${req.session.nickname}`);
  req.session.destroy(() => res.redirect("/"));
});

// 📌 Отправка личного сообщения
app.post("/private/send", async (req, res) => {
  const { to, text } = req.body;
  const from = req.session.nickname;
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

// 📌 Загрузка лички
app.get("/private/inbox", async (req, res) => {
  const nick = req.session.nickname;
  const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 часа

  const { data, error } = await supabase
    .from("private_messages")
    .select("*")
    .or(`sender.eq.${nick},recipient.eq.${nick}`)
    .gt("timestamp", cutoff)
    .order("timestamp", { ascending: true });

  if (error) return res.status(500).send("Ошибка загрузки");

  res.json(data);
});

// 📡 Socket.IO
io.on("connection", (socket) => {
  const nickname = socket.handshake.session.nickname;
  if (!nickname) return;

  onlineUsers.set(socket.id, nickname);
  socket.emit("your nickname", nickname);
  io.emit("online users", Array.from(onlineUsers.values()));
  logAction(`🟢 Socket подключён: ${nickname}`);

  const cutoff = Date.now() - 20 * 60 * 1000; // 20 минут
  const recentMessages = messages.filter(m => m.time > cutoff);
  socket.emit("chat history", recentMessages);

  socket.on("chat message", (msg) => {
    const fullMsg = { text: `${nickname}: ${msg}`, time: Date.now() };
    messages.push(fullMsg);
    io.emit("chat message", fullMsg);
  });

  // Очищаем историю общего чата и личных сообщений в общем чате, но не в колонке лички
  socket.on("clear chat", () => {
    messages.length = 0;
    io.emit("chat history", []); // Очистить общий чат у всех
    io.emit("clear private in chat"); // Очистить личку только в общем чате (клиент должен обработать)
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    io.emit("online users", Array.from(onlineUsers.values()));
    logAction(`🔴 Отключился: ${nickname}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  logAction(`🚀 Сервер стартовал на порту ${PORT}`);
});