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

  // Мобильное переключение экранов
  const tabs = document.querySelectorAll('.tab');
  const screens = document.querySelectorAll('.screen');
  function activateTab(tabName) {
    screens.forEach(s => s.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active'));
    const activeScreen = document.getElementById('screen-' + tabName);
    if (activeScreen) activeScreen.classList.add('active');
    const activeTab = document.querySelector('.tab[data-screen="' + tabName + '"]');
    if (activeTab) activeTab.classList.add('active');
  }
  if (tabs.length) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        activateTab(tab.dataset.screen);
      });
    });
    // По умолчанию показываем общий чат
    activateTab('chat');
  }

  // 💬 Отправка общего сообщения
  const chatInput = document.getElementById("chat-input-desktop");
  const chatSend = document.getElementById("chat-send-desktop");
  const chatHistory = document.getElementById("chat-history-desktop");

  if (chatSend && chatInput) {
    chatSend.addEventListener("click", () => {
      const msg = chatInput.value.trim();
      if (!msg) return;
      socket.emit("chat message", msg);
      chatInput.value = "";
    });
  }

  // ✉️ Отправка лички
  const privateInput = document.getElementById("private-input-desktop");
  const privateSend = document.getElementById("private-send-desktop");
  const privateHistory = document.getElementById("private-history-desktop");

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
      item.textContent = msg.text || msg; // поддержка формата {text, time}
      chatHistory.appendChild(item);
    }
  });

  // 🔔 Получение лички
  socket.on("private notify", ({ from, text }) => {
    const line = document.createElement("div");
    line.textContent = `${from}: ${text}`;
    if (privateHistory) privateHistory.appendChild(line);
    if (notifSound) notifSound.play();
  });

  // 📌 Обновление списка онлайн
  socket.on("online users", users => {
    const onlineListDesktop = document.getElementById("online-users-desktop");
    const onlineListMobile = document.getElementById("online-users-mobile");

    [onlineListDesktop, onlineListMobile].forEach(onlineList => {
      if (!onlineList) return;
      onlineList.innerHTML = "";
      users.forEach(user => {
        const li = document.createElement("li");
        li.textContent = user;
        li.classList.add("user-item");
        li.dataset.username = user;
        onlineList.appendChild(li);
        // 📌 Привязка обработчика выбора юзера
        li.addEventListener("click", () => {
          activePrivate = user;
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
  });
};