window.onload = () => {
  let currentUser = "";
  let activePrivate = "";
  const socket = io();

  // ✅ Получаем ник
  socket.on("your nickname", nick => {
    currentUser = nick;
    console.log("👤 Ваш ник:", currentUser);
  });

  // ✅ Онлайн-юзеры
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

  // ✅ Общий чат
  socket.on("chat message", msg => {
    const div = document.getElementById("chat-history");
    const line = document.createElement("div");
    line.textContent = msg.text;
    div.appendChild(line);
  });

  // ✅ Личка
  socket.on("private notify", ({ from, text }) => {
    console.log("📩 Личка от:", from, "→", text);
    const list = document.getElementById("private-notify");
    const exists = [...list.children].some(li => li.textContent === from);
    if (!exists) {
      const li = document.createElement("li");
      li.textContent = from;
      li.onclick = () => openPrivateChat(from);
      list.appendChild(li);
    }
    if (activePrivate === from) {
      const line = document.createElement("div");
      line.textContent = `${from}: ${text}`;
      document.getElementById("private-history").appendChild(line);
    }
  });

  // ✅ Отправка общего
  function sendMessage() {
    const input = document.getElementById("chat-input");
    const msg = input.value.trim();
    if (!msg) return;
    socket.emit("chat message", msg);
    input.value = "";
  }

  // ✅ Отправка личного
  async function sendPrivateMessage() {
    const input = document.getElementById("private-input");
    const text = input.value.trim();
    if (!text || !activePrivate) return;

    try {
      const res = await fetch("/private/send", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `to=${activePrivate}&text=${encodeURIComponent(text)}`
      });

      if (res.ok) {
        const line = document.createElement("div");
        line.textContent = `${currentUser}: ${text}`;
        document.getElementById("private-history").appendChild(line);
        input.value = "";
      } else {
        console.warn("❌ Личка не отправлена");
      }
    } catch (err) {
      console.error("🚫 Ошибка отправки:", err.message);
    }
  }

  // ✅ Открытие лички
  function openPrivateChat(nick) {
    activePrivate = nick;
    switchScreen("private");
    document.getElementById("private-title").textContent = `Личка с ${nick}`;
    loadPrivateHistory();
  }

  // ✅ Загрузка истории
  async function loadPrivateHistory() {
    try {
      const res = await fetch("/private/inbox");
      const msgs = await res.json();
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
    } catch (err) {
      console.error("🚫 Ошибка загрузки лички:", err.message);
    }
  }

  // ✅ Вкладки
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => switchScreen(tab.dataset.screen));
  });

  function switchScreen(name) {
    document.querySelectorAll(".screen").forEach(s => {
      s.classList.toggle("active", s.id === "screen-" + name);
    });
    document.querySelectorAll(".tab").forEach(t => {
      t.classList.toggle("active", t.dataset.screen === name);
    });
  }

  // ✅ Свайпы
  let touchStartX = null;
  const screens = ["online", "chat", "private"];
  document.getElementById("screens").addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].clientX;
  });
  document.getElementById("screens").addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 50) return;
    let current = screens.find(s => document.getElementById("screen-" + s).classList.contains("active"));
    let index = screens.indexOf(current);
    if (dx < 0 && index < screens.length - 1) switchScreen(screens[index + 1]);
    else if (dx > 0 && index > 0) switchScreen(screens[index - 1]);
  });

  // ✅ Привязка кнопок через id
  document.getElementById("chat-send").addEventListener("click", sendMessage);
  document.getElementById("private-send").addEventListener("click", sendPrivateMessage);
};