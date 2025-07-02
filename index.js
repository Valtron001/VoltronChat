const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: "voltronSecretKey",
  resave: false,
  saveUninitialized: true
}));
const server = http.createServer(app);
const io = new Server(server);

// Раздача статических файлов из папки public
app.use(express.static("public"));

// Обработка подключения клиентов
const users = {}; // Простая "база" логинов и паролей

app.post("/register", async (req, res) => {
  const { login, password, repeat } = req.body;
  if (users[login]) return res.send("❌ Такой логин уже есть!");
  if (password !== repeat) return res.send("❌ Пароли не совпадают");

  const hashed = await bcrypt.hash(password, 10);
  users[login] = hashed;
  req.session.user = login;
  res.redirect("/chat");
});

app.post("/login", async (req, res) => {
  const { login, password } = req.body;
  const hashed = users[login];
  if (!hashed || !(await bcrypt.compare(password, hashed))) {
    return res.send("❌ Неверный логин или пароль");
  }

  req.session.user = login;
  res.redirect("/chat");
});

app.get("/chat", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(__dirname + "/public/chat.html");
});
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