/* Kept outside JSP so JavaScript expressions cannot be evaluated as JSP EL. */
(() => {
  'use strict';
  const box = document.getElementById('chatBox');
  const status = document.getElementById('connectionStatus');
  const userId = Number(box.dataset.userId);
  const chatWith = Number(box.dataset.chatWith);
  const contextPath = box.dataset.contextPath;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = protocol + '//' + location.host + contextPath + '/chatSocket/' + userId;
  const rows = new Map();
  let socket = null;
  let stopped = false;
  let reconnectTimer = null;
  let historyRetryTimer = null;
  let retryDelay = 1000;
  let loading = false;
  let loadAgain = false;

  function setStatus(message) {
    status.textContent = message;
  }

  function belongsToChat(message) {
    const receiver = message.chatWith == null ? -1 : Number(message.chatWith);
    const sender = Number(message.senderId);
    if (chatWith === -1) return receiver === -1;
    return (sender === userId && receiver === chatWith) ||
      (sender === chatWith && receiver === userId);
  }

  function appendMessage(message) {
    const id = Number(message.id);
    if (!belongsToChat(message) || !Number.isSafeInteger(id) || id <= 0 || rows.has(id)) return;
    const row = document.createElement('div');
    row.className = 'message';
    row.dataset.messageId = String(id);
    const from = document.createElement('div');
    from.className = 'from';
    const avatar = document.createElement('img');
    avatar.src = message.avatar || 'images/taffy1.jpg';
    avatar.alt = '头像';
    const name = document.createElement('span');
    name.textContent = message.senderName || '';
    from.append(avatar, name);
    const content = document.createElement('div');
    content.style.whiteSpace = 'pre-wrap';
    content.textContent = message.content || '';
    row.append(from, content);
    if (message.image) {
      const image = document.createElement('img');
      image.className = 'chat-img';
      image.src = message.image;
      image.alt = '图片';
      row.append(image);
    }
    const time = document.createElement('div');
    time.className = 'timestamp';
    time.textContent = message.time || '';
    row.append(time);
    // History may arrive after a live message. Preserve order and deduplicate by DB ID.
    let next = null;
    let nextId = Infinity;
    for (const [existingId, existingRow] of rows) {
      if (existingId > id && existingId < nextId) {
        nextId = existingId;
        next = existingRow;
      }
    }
    box.insertBefore(row, next);
    rows.set(id, row);
    box.scrollTop = box.scrollHeight;
  }

  function stop() {
    stopped = true;
    clearTimeout(reconnectTimer);
    clearTimeout(historyRetryTimer);
    const previous = socket;
    socket = null;
    if (previous) previous.close();
  }

  async function loadHistory() {
    if (stopped) return;
    if (loading) { loadAgain = true; return; }
    loading = true;
    clearTimeout(historyRetryTimer);
    try {
      const response = await fetch(contextPath + '/GetMessagesServlet?chatWith=' + chatWith, {
        credentials: 'same-origin', cache: 'no-store'
      });
      if (response.status === 401 || response.status === 403) {
        stop();
        setStatus('登录已失效或无法访问此聊天，请重新登录或返回主页');
        return;
      }
      if (!response.ok) throw new Error('History HTTP ' + response.status);
      const messages = await response.json();
      if (!stopped) messages.forEach(appendMessage);
    } catch (error) {
      if (!stopped) {
        setStatus('消息同步失败，正在重试…');
        historyRetryTimer = setTimeout(loadHistory, 5000);
      }
    } finally {
      loading = false;
      if (loadAgain && !stopped) {
        loadAgain = false;
        void loadHistory();
      }
    }
  }

  function reconnect() {
    if (stopped) return;
    setStatus('连接已断开，正在重连…');
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10000);
    // Also refresh via HTTP while a proxy/network prevents WebSocket upgrades.
    void loadHistory();
  }

  function connect() {
    if (stopped || socket) return;
    setStatus('正在连接…');
    let connection;
    try {
      connection = new WebSocket(socketUrl);
      socket = connection;
    } catch (error) {
      reconnect();
      return;
    }
    connection.onopen = () => {
      if (socket !== connection || stopped) return;
      retryDelay = 1000;
      setStatus('已连接');
      // Close the history/connect race and recover messages missed during disconnect.
      void loadHistory();
    };
    connection.onmessage = event => {
      if (socket !== connection || stopped) return;
      try { appendMessage(JSON.parse(event.data)); }
      catch (error) { void loadHistory(); }
    };
    connection.onerror = () => {
      if (socket === connection && !stopped) connection.close();
    };
    connection.onclose = event => {
      if (socket !== connection || stopped) return;
      socket = null;
      if (event.code === 1008) {
        stop();
        setStatus('连接身份验证失败，请重新登录');
        return;
      }
      reconnect();
    };
  }

  window.deleteFriend = async friendId => {
    if (!confirm('确定要删除该好友吗？删除后将无法继续私聊。')) return;
    try {
      const response = await fetch(contextPath + '/DeleteFriendServlet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'friendId=' + encodeURIComponent(friendId)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      alert(await response.text());
      location.href = contextPath + '/chat.jsp';
    } catch (error) { alert('删除失败：' + error.message); }
  };

  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      stopped = false;
      connect();
      void loadHistory();
    }
  });
  document.getElementById('chatInput').focus();
  connect();
  void loadHistory();
})();
