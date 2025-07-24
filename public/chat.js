window.onload = () => {
  const isMobile = window.innerWidth <= 750;
  let currentUser = "";
  let activePrivate = "";
  const socket = io();

  const refs = {
    onlineList: document.getElementById(isMobile ? "online-users-mobile" : "online-users-desktop"),
    chatHistory: document.getElementById(isMobile ? "chat-history-mobile" : "chat-history-desktop"),
    privateList: document.getElementById(isMobile ? "private-notify-mobile" : "private-notify-desktop"),
    privateHistory: document.getElementById(isMobile ? "private-history-mobile" : "private-history-desktop"),
    chatInput: document.getElementById("chat-input"),
    privateInput: document.getElementById("private-input")
  };

  socket.on("your nickname", nick => {
    currentUser = nick;
    console.log("👤 Ваш ник:", currentUser);
  });

  socket.on("online users", users => {
    refs.onlineList.innerHTML = "";
    users.forEach(user => {
      const li = document.createElement("li");
      li.textContent = user;
      li.className = "user";
      if (user !== currentUser) {
        li.onclick = () => openPrivateChat(user);
      }
      refs.onlineList.appendChild(li);
    });
  });

  socket.on("chat message", msg => {
    const line = document.createElement("div");
    line.textContent = msg.text;
    refs.chatHistory.appendChild(line);
  });

  socket.on("private notify", ({ from, text }) => {
    console.log("📩 Личка от:", from, "→", text);
    const exists = [...refs.privateList.children].some(li => li.textContent === from);
    if (!exists) {
      const li = document.createElement("li");
      li.textContent = from;
      li.onclick = () => openPrivateChat(from);
      refs.privateList.appendChild(li);
    }
    if (activePrivate === from) {
      const line = document.createElement("div");
      line.textContent = `${from}: ${text}`;
      refs.privateHistory.appendChild(line);
    }
  });

  function sendMessage() {
    const msg = refs.chatInput.value.trim();
    if (!msg) return;
    socket.emit("chat message", msg);
    refs.chatInput.value = "";
  }

  async function sendPrivateMessage() {
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
      } else {
        console.warn("❌ Личка не отправлена");
      }
    } catch (err) {
      console.error("🚫 Ошибка отправки:", err.message);
    }
  }

  function openPrivateChat(nick) {
    activePrivate = nick;
    const title = document.getElementById("private-title");
    if (title) title.textContent = `Личка с ${nick}`;
    switchScreen("private");
    loadPrivateHistory();
  }

  async function loadPrivateHistory() {
    try {
      const res = await fetch("/private/inbox");
      const msgs = await res.json();
      refs.privateHistory.innerHTML = "";

      const relevantMsgs = msgs.filter(
        m => m.sender === activePrivate || m.recipient === activePrivate
      );

      if (relevantMsgs.length === 0) {
        const hint = document.createElement("div");
        hint.className = "empty-hint";
        hint.textContent = "здесь пока ничего нету";
        refs.privateHistory.appendChild(hint);
        return;
      }

      relevantMsgs
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach(m => {
          const who = m.sender === currentUser ? currentUser : m.sender;
          const line = document.createElement("div");
          line.textContent = `${who}: ${m.message}`;
          refs.privateHistory.appendChild(line);
        });
    } catch (err) {
      console.error("🚫 Ошибка загрузки лички:", err.message);
    }
  }

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

  document.getElementById("chat-send").addEventListener("click", sendMessage);
  document.getElementById("private-send").addEventListener("click", sendPrivateMessage);
};