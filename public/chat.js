let currentUser = "";
let activePrivate = "";

const socket = io();

socket.on("your nickname", nick => {
  currentUser = nick;
});

socket.on("online users", users => {
  const ul = document.getElementById("online-users");
  ul.innerHTML = "";
  users.forEach(user => {
    const li = document.createElement("li");
    li.textContent = user;
    li.className = "user";
    if (user !== currentUser) {
      li.onclick = () => openPrivateChat(user);
    }
    ul.appendChild(li);
  });
});

socket.on("chat message", msg => {
  const div = document.getElementById("chat-history");
  const line = document.createElement("div");
  line.textContent = msg.text;
  div.appendChild(line);
});

socket.on("private notify", ({ from, text }) => {
  const list = document.getElementById("private-notify");
  const exists = [...list.children].some(li => li.textContent === from);
  if (!exists) {
    const li = document.createElement("li");
    li.textContent = from;
    li.onclick = () => openPrivateChat(from);
    list.appendChild(li);
  }

  // Всплывающая анимация или сигнал можно добавить здесь
});

function sendMessage() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (msg) {
    socket.emit("chat message", msg);
    input.value = "";
  }
}

function openPrivateChat(nick) {
  activePrivate = nick;
  document.querySelector(".chat-container").style.display = "none";
  document.getElementById("private-chat").style.display = "block";
  document.getElementById("private-title").textContent = `Личка с ${nick}`;
  loadPrivateHistory();
}

function closePrivateChat() {
  activePrivate = "";
  document.querySelector(".chat-container").style.display = "flex";
  document.getElementById("private-chat").style.display = "none";
}

function sendPrivateMessage() {
  const input = document.getElementById("private-input");
  const text = input.value.trim();
  if (!text || !activePrivate) return;

  fetch("/private/send", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `to=${activePrivate}&text=${encodeURIComponent(text)}`
  });

  const line = document.createElement("div");
  line.textContent = `${currentUser}: ${text}`;
  document.getElementById("private-history").appendChild(line);
  input.value = "";
}

function loadPrivateHistory() {
  fetch("/private/inbox")
    .then(r => r.json())
    .then(msgs => {
      const div = document.getElementById("private-history");
      div.innerHTML = "";
      msgs
        .filter(m => m.sender === activePrivate || m.recipient === activePrivate)
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach(m => {
          const who = m.sender === currentUser ? currentUser : m.sender;
          const line = document.createElement("div");
          line.textContent = `${who}: ${m.message}`;
          div.appendChild(line);
        });
    });
}