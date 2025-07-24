window.onload = () => {
  const isMobile = window.innerWidth <= 750;
  let currentUser = "";
  let activePrivate = "";
  const socket = io();
  const contacts = new Set();

  // 🧩 Выбор нужных элементов
  const refs = {
    online: document.getElementById(isMobile ? "online-users-mobile" : "online-users-desktop"),
    chatHistory: document.getElementById(isMobile ? "chat-history-mobile" : "chat-history-desktop"),
    chatInput: document.getElementById(isMobile ? "chat-input-mobile" : "chat-input-desktop"),
    chatSend: document.getElementById(isMobile ? "chat-send-mobile" : "chat-send-desktop"),
    privateHistory: document.getElementById("private-history-desktop"),
    privateInput: document.getElementById("private-input-desktop"),
    privateSend: document.getElementById("private-send-desktop"),
    chatZone: document.getElementById("desktop-chat-zone"),
    privateZone: document.getElementById("private-zone"),
    privateTitle: document.getElementById("private-title-desktop"),
    savedContacts: document.getElementById("saved-contacts")
  };

  // 🔧 Инициализация лички
  if (!isMobile) {
    refs.privateInput.style.display = "none";
    refs.privateSend.style.display = "none";
    refs.privateTitle.textContent = "Личка";
    refs.privateHistory.innerHTML = `<div class="empty-hint">здесь пока ничего нету</div>`;
  }

  // 👤 Ваш ник
  socket.on("your nickname", nick => {
    currentUser = nick;
  });

  // 🟢 Онлайн юзеры
  socket.on("online users", users => {
    refs.online.innerHTML = "";
    users.forEach(user => {
      const li = document.createElement("li");
      li.textContent = user;
      li.className = "user";
      if (user !== currentUser) {
        li.onclick = () => openPrivateChat(user);
      }
      refs.online.appendChild(li);
    });
  });

  // 💬 Общий чат
  socket.on("chat message", msg => {
    const line = document.createElement("div");
    line.textContent = msg.text;
    refs.chatHistory.appendChild(line);
  });

  // ✉️ Личка
  socket.on("private notify", ({ from, text }) => {
    if (!contacts.has(from)) addSavedContact(from);
    if (activePrivate === from) {
      const line = document.createElement("div");
      line.textContent = `${from}: ${text}`;
      refs.privateHistory.appendChild(line);
    }
  });

  // 🟦 Отправка в общий чат
  refs.chatSend.addEventListener("click", () => {
    const msg = refs.chatInput.value.trim();
    if (!msg) return;
    socket.emit("chat message", msg);
    refs.chatInput.value = "";
  });

  // 🟧 Отправка лички
  refs.privateSend.addEventListener("click", async () => {
    const text = refs.privateInput.value.trim();
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
        refs.privateHistory.appendChild(line);
        refs.privateInput.value = "";
        if (!contacts.has(activePrivate)) addSavedContact(activePrivate);
      }
    } catch (err) {
      console.error("🚫 Ошибка отправки лички:", err.message);
    }
  });

  // 💌 Открытие лички
  function openPrivateChat(nick) {
    activePrivate = nick;

    if (!isMobile) {
      refs.chatZone.style.display = "none";
      refs.privateZone.style.display = "block";
      refs.privateInput.style.display = "block";
      refs.privateSend.style.display = "inline-block";
      refs.privateTitle.textContent = `Личка с ${nick}`;

      // ✨ Подсветка
      document.querySelectorAll(".saved-contact").forEach(c => {
        c.classList.remove("active-contact");
      });
      const card = [...refs.savedContacts.children].find(c => c.textContent === nick);
      if (card) card.classList.add("active-contact");
    }

    loadPrivateHistory();
  }

  // 📦 Загрузка истории лички
  async function loadPrivateHistory() {
    try {
      const res = await fetch("/private/inbox");
      const msgs = await res.json();
      refs.privateHistory.innerHTML = "";

      const relevant = msgs.filter(
        m => m.sender === activePrivate || m.recipient === activePrivate
      );

      if (relevant.length === 0) {
        const hint = document.createElement("div");
        hint.className = "empty-hint";
        hint.textContent = "здесь пока ничего нету";
        refs.privateHistory.appendChild(hint);
        return;
      }

      relevant
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach(m => {
          const who = m.sender === currentUser ? currentUser : m.sender;
          const line = document.createElement("div");
          line.textContent = `${who}: ${m.message}`;
          refs.privateHistory.appendChild(line);
        });
    } catch (err) {
      console.error("🚫 Ошибка загрузки истории:", err.message);
    }
  }

  // 🧠 Добавление карточки собеседника
  function addSavedContact(nick) {
    contacts.add(nick);
    const card = document.createElement("div");
    card.className = "saved-contact";
    card.textContent = nick;
    card.onclick = () => openPrivateChat(nick);
    refs.savedContacts.appendChild(card);
  }

  // 📆 Очистка списка раз в 24 часа (временно отключена)
  // setInterval(() => {
  //   contacts.clear();
  //   refs.savedContacts.innerHTML = "";
  // }, 86400000); // каждые 24 часа
};