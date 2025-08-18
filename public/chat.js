window.onload = () => {
  const socket = io(); // подключение к сокету
  const isMobile = window.innerWidth <= 768;
  // --- Новый unified input ---
  let activePrivate = null;
  const unifiedInput = document.getElementById("unified-input");
  const chatSendBtn = document.getElementById("chat-send");
  const privateSendBtn = document.getElementById("private-send");
  const chatHistory = document.getElementById("chat-history-desktop");
  const privateHistory = document.getElementById("private-history-desktop");

  // Выбор пользователя для лички
  function setActivePrivate(username) {
    activePrivate = username;
    privateSendBtn.disabled = false;
    // Показываем поле ввода в личке
    const privateInputRow = document.getElementById('private-input-row');
    if (privateInputRow) privateInputRow.style.display = '';
    // Сохраняем выбранного пользователя для лички
    const privateInput = document.getElementById('unified-input-private');
    if (privateInput) {
      privateInput.value = '';
      privateInput.focus();
    }
    // Обновляем заголовок лички
    const privateHeader = document.getElementById('private-header');
    if (privateHeader) {
      privateHeader.textContent = `Личка с ${username}`;
    }
  }

  // Обработка клика по онлайн-пользователю
  function handleUserClick(user) {
    setActivePrivate(user);
    // Переключаемся на личку (моб/десктоп)
    const privateTab = document.querySelector('.tab[data-screen="private"]');
    if (privateTab) privateTab.click();
  }

  // Навешиваем обработчик на онлайн-список (делегирование)
  function updateOnlineList(onlineList, users) {
    if (!onlineList) return;
    onlineList.innerHTML = "";
    users.forEach(user => {
      const li = document.createElement("li");
      li.textContent = user;
      li.classList.add("user-item");
      li.dataset.username = user;
      onlineList.appendChild(li);
      li.addEventListener("click", () => handleUserClick(user));
    });
  }

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

  // --- Отправка в общий чат ---
  if (chatSendBtn && unifiedInput) {
    chatSendBtn.addEventListener("click", () => {
      const msg = unifiedInput.value.trim();
      if (!msg) return;
      socket.emit("chat message", msg);
      unifiedInput.value = "";
      activePrivate = null;
      privateSendBtn.disabled = true;
    });
  }

  // --- Отправка в личку ---
  if (privateSendBtn && unifiedInput) {
    privateSendBtn.addEventListener("click", async () => {
      const text = unifiedInput.value.replace(/^@[^,]+,\s*/, "").trim();
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
          unifiedInput.value = "";
          activePrivate = null;
          privateSendBtn.disabled = true;
        }
      } catch (err) {
        console.error("🚫 Ошибка отправки лички:", err.message);
      }
    });
  }

  // --- Выбор пользователя для лички ---
  function setActivePrivate(username) {
    activePrivate = username;
    privateSendBtn.disabled = false;
    // Показываем поле ввода в личке
    const privateInputRow = document.getElementById('private-input-row');
    if (privateInputRow) privateInputRow.style.display = '';
    // Сохраняем выбранного пользователя для лички
    const privateInput = document.getElementById('unified-input-private');
    if (privateInput) {
      privateInput.value = '';
      privateInput.focus();
    }
    // Обновляем заголовок лички
    const privateHeader = document.getElementById('private-header');
    if (privateHeader) {
      privateHeader.textContent = `Личка с ${username}`;
    }
  }

  // --- Отправка лички из личного поля ---
  const privateInput = document.getElementById('unified-input-private');
  const privateSendBtn2 = document.getElementById('private-send');
  if (privateSendBtn2 && privateInput) {
    privateSendBtn2.addEventListener('click', async () => {
      const text = privateInput.value.trim();
      if (!text || !activePrivate) return;
      try {
        const res = await fetch('/private/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `to=${activePrivate}&text=${encodeURIComponent(text)}`
        });
        if (res.ok) {
          const line = document.createElement('div');
          line.textContent = `${currentUser}: ${text}`;
          if (privateHistory) privateHistory.appendChild(line);
          privateInput.value = '';
        }
      } catch (err) {
        console.error('🚫 Ошибка отправки лички:', err.message);
      }
    });
    privateInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        privateSendBtn2.click();
        e.preventDefault();
      }
    });
  }

  // --- Включение/отключение кнопки лички ---
  if (privateSendBtn) privateSendBtn.disabled = true;

  // --- Enter ---
  if (unifiedInput) {
    unifiedInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        if (activePrivate) {
          privateSendBtn.click();
        } else {
          chatSendBtn.click();
        }
        e.preventDefault();
      }
    });
  }

  // --- Получение общего сообщения ---
  socket.on("chat message", msg => {
    if (chatHistory) {
      const item = document.createElement("div");
      const nickSpan = document.createElement("span");
      nickSpan.textContent = msg.nickname + ": ";
      nickSpan.className = "nickname-color-" + (msg.nickname_color || "blue");
      item.appendChild(nickSpan);
      item.appendChild(document.createTextNode(msg.text));
      chatHistory.appendChild(item);
    }
  });

  // --- Получение лички ---
  socket.on("private notify", ({ from, text, nickname_color }) => {
    const line = document.createElement("div");
    const nickSpan = document.createElement("span");
    nickSpan.textContent = from + ": ";
    nickSpan.className = "nickname-color-" + (nickname_color || "blue");
    line.appendChild(nickSpan);
    line.appendChild(document.createTextNode(text));
    if (privateHistory) privateHistory.appendChild(line);
    if (notifSound) notifSound.play();
  });

  // --- Очистка лички только в общем чате ---
  socket.on("clear private in chat", () => {
    // Если в общем чате отображаются личные сообщения, очистить их
    const privateInChat = document.getElementById("private-in-chat");
    if (privateInChat) privateInChat.innerHTML = "";
  });

  // --- Обновление списка онлайн ---
  socket.on("online users", users => {
    const onlineListDesktop = document.getElementById("online-users-desktop");
    const onlineListMobile = document.getElementById("online-users-mobile");
    updateOnlineList(onlineListDesktop, users);
    updateOnlineList(onlineListMobile, users);
  });

  // --- Смайлики ---
  const emojiToggle = document.getElementById('emoji-toggle');
  const emojiRow = document.querySelector('.emoji-row');
  if (emojiToggle && emojiRow) {
    emojiToggle.addEventListener('click', () => {
      emojiRow.classList.toggle('active');
    });
  }
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('unified-input');
      if (input) {
        input.value += btn.textContent;
        input.focus();
      }
    });
  });
};