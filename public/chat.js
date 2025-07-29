window.onload = () => {
  const socket = io(); // подключение к сокету
  const isMobile = window.innerWidth <= 768;
  let activePrivate = null;
  const currentUser = window.currentUser || "Вы";
  const notifSound = document.getElementById("notif");

  // 🔄 Переключение экранов (мобилка)
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
  const chatInput = document.getElementById(isMobile ? "chat-input-mobile" : "chat-input-desktop");
  const chatSend = document.getElementById(isMobile ? "chat-send-mobile" : "chat-send-desktop");
  const chatHistory = document.getElementById(isMobile ? "chat-history-mobile" : "chat-history-desktop");

  if (chatSend && chatInput) {
    chatSend.addEventListener("click", () => {
      const msg = chatInput.value.trim();
      if (!msg) return;
      socket.emit("chat message", msg);
      chatInput.value = "";
    });
  }

  // ✉️ Отправка лички
  const privateInput = document.getElementById(isMobile ? "private-input-mobile" : "private-input-desktop");
  const privateSend = document.getElementById(isMobile ? "private-send-mobile" : "private-send-desktop");
  const privateHistory = document.getElementById(isMobile ? "private-history-mobile" : "private-history-desktop");

  if (privateSend && privateInput) {
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
          if (privateHistory) privateHistory.appendChild(line);
          privateInput.value = "";
        }
      } catch (err) {
        console.error("🚫 Ошибка отправки лички:", err.message);
      }
    });
  }

  // 🟢 Получение общего сообщения
  socket.on("chat message", msg => {
    if (chatHistory) {
      const item = document.createElement("div");
      item.textContent = msg;
      chatHistory.appendChild(item);
    }
  });

  // 🔔 Получение лички
  socket.on("private message", ({ from, text }) => {
    const line = document.createElement("div");
    line.textContent = `${from}: ${text}`;
    if (privateHistory) privateHistory.appendChild(line);
    if (notifSound) notifSound.play();
  });

  // 📌 Обновление списка онлайн
  socket.on("update online", users => {
    const onlineList = document.getElementById(
      isMobile ? "online-users-mobile" : "online-users-desktop"
    );

    if (!onlineList) return;

    onlineList.innerHTML = "";

    users.forEach(user => {
      const li = document.createElement("li");
      li.textContent = user.username;
      li.classList.add("user-item");
      li.dataset.username = user.username;
      onlineList.appendChild(li);

      // 📌 Привязка обработчика выбора юзера
      li.addEventListener("click", () => {
        activePrivate = user.username;

        document.querySelectorAll(".user-item").forEach(u => u.classList.remove("active"));
        li.classList.add("active");

        // 🎯 Показ десктопной лички
        const privateZone = document.getElementById("private-zone");
        if (privateZone) privateZone.style.display = "block";

        const title = document.getElementById("private-title-desktop");
        if (title) title.textContent = `Личка с ${activePrivate}`;
      });
    });
  });
};