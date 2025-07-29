window.onload = () => {
  const socket = io(); // подключение к сокету
  const isMobile = window.innerWidth <= 768;
  let activePrivate = null;
  const currentUser = window.currentUser || "Вы";

  // 🔄 Переключение экранов
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      const target = tab.dataset.screen;
      const activeScreen = document.querySelector(`#screen-${target}`);
      if (activeScreen) activeScreen.classList.add("active");

      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
    });
  });

  // 💬 Отправка общего сообщения
  const chatInput = document.getElementById(isMobile ? "chat-input-mobile" : "chat-input");
  const chatSend = document.getElementById(isMobile ? "chat-send-mobile" : "chat-send");

  if (chatSend) {
    chatSend.addEventListener("click", () => {
      const msg = chatInput.value.trim();
      if (!msg) return;
      socket.emit("chat message", msg);
      chatInput.value = "";
    });
  }

  // ✉️ Отправка лички
  const privateInput = document.getElementById(isMobile ? "private-input-mobile" : "private-input");
  const privateSend = document.getElementById(isMobile ? "private-send-mobile" : "private-send");
  const history = document.getElementById(isMobile ? "private-history-mobile" : "private-history");

  if (privateSend) {
    privateSend.addEventListener("click", async () => {
      const text = privateInput.value.trim();
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
          if (history) history.appendChild(line);
          privateInput.value = "";
        }
      } catch (err) {
        console.error("🚫 Ошибка отправки лички:", err.message);
      }
    });
  }

  // 🟢 Получение общего сообщения
  socket.on("chat message", msg => {
    const list = document.getElementById("chat-list");
    if (list) {
      const item = document.createElement("li");
      item.textContent = msg;
      list.appendChild(item);
    }
  });

  // 🔔 Получение лички
  socket.on("private message", ({ from, text }) => {
    const line = document.createElement("div");
    line.textContent = `${from}: ${text}`;
    if (history) history.appendChild(line);
  });

  // 📌 Выбор собеседника
  document.querySelectorAll(".user-item").forEach(user => {
    user.addEventListener("click", () => {
      activePrivate = user.dataset.username;
      document.querySelectorAll(".user-item").forEach(u => u.classList.remove("active"));
      user.classList.add("active");
    });
  });
};