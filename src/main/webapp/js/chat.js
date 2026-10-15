/* Kept outside JSP so JavaScript expressions cannot be evaluated as JSP EL. */
(() => {
  'use strict';
  const box = document.getElementById('chatBox');
  const status = document.getElementById('connectionStatus');
  const historyStatus = document.getElementById('historyStatus');
  const list = document.getElementById('messageList');
  const olderButton = document.getElementById('loadOlder');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const imageInput = document.getElementById('chatImage');
  const sendButton = document.getElementById('sendButton');
  const sendStatus = document.getElementById('sendStatus');
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
  let historyRequest = null;
  let olderRequest = null;
  let loadAgain = false;
  let historyCursor = 0;
  let historyLoaded = false;
  let oldestMessageId = null;
  let hasMoreOlder = false;
  let followingBottom = true;
  let lastScrollTop = 0;
  let sending = null;
  const PAGE_SIZE = 30;

  function isAtBottom() {
    return box.scrollHeight - box.scrollTop - box.clientHeight <= 48;
  }

  function scrollToBottom() {
    box.scrollTop = box.scrollHeight;
    lastScrollTop = box.scrollTop;
    followingBottom = true;
  }

  function showError(element, message = '') {
    element.textContent = message;
    element.hidden = !message;
  }

  function updateOlderButton() {
    olderButton.hidden = !historyLoaded;
    olderButton.disabled = !hasMoreOlder || olderRequest !== null;
    olderButton.textContent = hasMoreOlder ? '加载更早记录' : '已显示全部聊天记录';
  }

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
    window.UserProfiles?.setAvatar(avatar, message.avatar);
    const name = document.createElement('span');
    name.textContent = message.senderName || '';
    if (Number(message.senderId) !== userId && Number(message.senderId) > 0) {
      const addFriend = document.createElement('button');
      addFriend.type = 'button';
      addFriend.className = 'avatar-button';
      addFriend.title = '查看 ' + (message.senderName || '此用户') + ' 的资料';
      avatar.alt = addFriend.title;
      addFriend.append(avatar);
      addFriend.addEventListener('click', () => window.UserProfiles?.open(Number(message.senderId)));
      from.append(addFriend, name);
    } else from.append(avatar, name);
    const content = document.createElement('div');
    content.style.whiteSpace = 'pre-wrap';
    content.textContent = message.content || '';
    row.append(from, content);
    if (message.image) {
      const image = document.createElement('img');
      image.className = 'chat-img';
      // Reserve dimensions before starting the download, including failed images.
      image.width = 200;
      image.height = 200;
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
    list.insertBefore(row, next);
    rows.set(id, row);
    return true;
  }

  function appendMessages(messages, mode) {
    const stick = mode === 'initial' || (mode !== 'older' && followingBottom);
    // Preserve the first visible message while prepending a page, even if a live
    // message arrives while that page is downloading.
    const top = box.getBoundingClientRect().top;
    const anchor = stick ? null : [...list.children].find(row => row.getBoundingClientRect().bottom > top);
    const anchorTop = anchor?.getBoundingClientRect().top;
    messages.forEach(appendMessage);
    if (stick) scrollToBottom();
    else if (anchor) {
      box.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
      lastScrollTop = box.scrollTop;
    }
  }

  function stop() {
    stopped = true;
    clearTimeout(reconnectTimer);
    clearTimeout(historyRetryTimer);
    if (historyRequest) {
      clearTimeout(historyRequest.timeout);
      historyRequest.controller.abort();
      historyRequest = null;
    }
    if (olderRequest) {
      clearTimeout(olderRequest.timeout);
      olderRequest.controller.abort();
      olderRequest = null;
    }
    if (sending) sending.controller.abort();
    loadAgain = false;
    const previous = socket;
    socket = null;
    if (previous) previous.close();
  }

  async function loadHistory() {
    if (stopped) return;
    if (historyRequest) { loadAgain = true; return; }
    const pending = { controller: new AbortController() };
    const initial = !historyLoaded;
    historyRequest = pending;
    pending.timeout = setTimeout(() => pending.controller.abort(), 10000);
    clearTimeout(historyRetryTimer);
    try {
      const response = await fetch(contextPath + '/GetMessagesServlet?chatWith=' + chatWith +
        (initial ? '' : '&after=' + historyCursor) + '&limit=' + PAGE_SIZE, {
        credentials: 'same-origin', cache: 'no-store', signal: pending.controller.signal
      });
      if (stopped || historyRequest !== pending) return;
      if (response.status === 401 || response.status === 403) {
        stop();
        setStatus('登录已失效或无法访问此聊天，请重新登录或返回主页');
        showError(historyStatus, '无法读取聊天记录，请重新登录或确认好友关系。');
        return;
      }
      if (!response.ok) throw new Error('History HTTP ' + response.status);
      const messages = await response.json();
      if (!Array.isArray(messages)) throw new Error('Invalid history response');
      if (!stopped && historyRequest === pending) {
        if (initial) {
          historyLoaded = true;
          hasMoreOlder = response.headers.get('X-Has-More') === 'true';
          updateOlderButton();
        }
        appendMessages(messages, initial ? 'initial' : 'new');
        // Advance only using completed history responses, never a live message that may race ahead.
        messages.forEach(message => {
          const id = Number(message.id);
          if (belongsToChat(message) && Number.isSafeInteger(id)) {
            historyCursor = Math.max(historyCursor, id);
            oldestMessageId = oldestMessageId == null ? id : Math.min(oldestMessageId, id);
          }
        });
        // A live push may race ahead of unseen rows. Acknowledge only the completed HTTP cursor.
        window.ChatSidebar?.historyRead(historyCursor);
        // Polling new messages must never change the independent older-page state.
        if (!olderRequest) showError(historyStatus);
        if (!initial && response.headers.get('X-Has-More') === 'true') loadAgain = true;
        // HTTP keeps messages current even if an apparently open socket silently stops receiving.
        historyRetryTimer = setTimeout(loadHistory, 5000);
      }
    } catch (error) {
      if (!stopped && historyRequest === pending) {
        showError(historyStatus, '聊天记录加载失败或超时，5 秒后自动重试…');
        historyRetryTimer = setTimeout(loadHistory, 5000);
      }
    } finally {
      clearTimeout(pending.timeout);
      if (historyRequest !== pending) return;
      historyRequest = null;
      if (loadAgain && !stopped) {
        loadAgain = false;
        void loadHistory();
      }
    }
  }

  async function loadOlder() {
    if (stopped || !hasMoreOlder || oldestMessageId == null || olderRequest) return;
    const pending = { controller: new AbortController() };
    olderRequest = pending;
    pending.timeout = setTimeout(() => pending.controller.abort(), 10000);
    updateOlderButton();
    try {
      const response = await fetch(contextPath + '/GetMessagesServlet?chatWith=' + chatWith + '&before=' + oldestMessageId + '&limit=' + PAGE_SIZE, {
        credentials: 'same-origin', cache: 'no-store', signal: pending.controller.signal
      });
      if (stopped || olderRequest !== pending) return;
      if (response.status === 401 || response.status === 403) {
        stop();
        showError(historyStatus, '无法读取更早的聊天记录，请重新登录或确认好友关系。');
        return;
      }
      if (!response.ok) throw new Error('History HTTP ' + response.status);
      const messages = await response.json();
      if (stopped || olderRequest !== pending) return;
      if (!Array.isArray(messages)) throw new Error('Invalid history response');
      appendMessages(messages, 'older');
      messages.forEach(message => {
        const id = Number(message.id);
        if (belongsToChat(message) && Number.isSafeInteger(id)) {
          oldestMessageId = oldestMessageId == null ? id : Math.min(oldestMessageId, id);
        }
      });
      hasMoreOlder = response.headers.get('X-Has-More') === 'true';
      showError(historyStatus);
    } catch (error) {
      if (!stopped && olderRequest === pending) showError(historyStatus, '更早记录加载失败，请点击加载更早记录重试。');
    } finally {
      clearTimeout(pending.timeout);
      if (olderRequest === pending) {
        olderRequest = null;
        updateOlderButton();
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
      try {
        const message = JSON.parse(event.data);
        appendMessages([message], 'new');
        window.MessageAlerts?.receive(message);
        window.ChatSidebar?.refresh();
      }
      catch (error) { void loadHistory(); }
    };
    connection.onerror = () => {
      if (socket === connection && !stopped) connection.close();
    };
    connection.onclose = event => {
      if (socket !== connection || stopped) return;
      socket = null;
      // Only the HTTP endpoint decides whether history access is allowed.
      // A rejected socket upgrade must not discard a valid private-history response.
      reconnect();
    };
  }

  window.deleteFriend = async friendId => {
    if (!confirm('确定要删除该好友吗？删除后将无法继续私聊。')) return;
    try {
      const response = await fetch(contextPath + '/DeleteFriendServlet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRF-Token': document.getElementById('chatSidebar').dataset.loginToken },
        body: 'friendId=' + encodeURIComponent(friendId)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      alert(await response.text());
      location.href = contextPath + '/chat.jsp';
    } catch (error) { alert('删除失败：' + error.message); }
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || stopped) return;
    if (!input.value.trim() && !imageInput.files.length) return;
    const data = new FormData(form);
    const pending = { controller: new AbortController() };
    sending = pending;
    pending.timeout = setTimeout(() => pending.controller.abort(), 30000);
    input.disabled = imageInput.disabled = sendButton.disabled = true;
    showError(sendStatus);
    try {
      const response = await fetch(contextPath + '/ChatServlet', {
        method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' },
        body: data, signal: pending.controller.signal
      });
      if (!response.ok || response.redirected) throw new Error(response.status === 401 || response.status === 403
        ? '无法发送，请确认登录状态和好友关系。' : '发送失败，请检查消息或图片后重试。');
      const message = await response.json();
      if (stopped || sending !== pending) return;
      if (!belongsToChat(message) || !Number.isSafeInteger(Number(message.id)) || Number(message.id) <= 0) throw new Error('服务器未确认消息，请检查记录后重试。');
      appendMessages([message], 'new');
      scrollToBottom();
      form.reset();
    } catch (error) {
      if (!stopped) showError(sendStatus, error.name === 'AbortError'
        ? '发送超时，消息可能已送达。请查看聊天记录后再重试。'
        : error.message);
    } finally {
      clearTimeout(pending.timeout);
      if (sending === pending) {
        sending = null;
        input.disabled = imageInput.disabled = sendButton.disabled = false;
        if (!stopped) input.focus({ preventScroll: true });
      }
    }
  });
  sendButton.disabled = false;
  olderButton.addEventListener('click', loadOlder);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      stopped = false;
      updateOlderButton();
      connect();
      void loadHistory();
    }
  });
  box.addEventListener('scroll', () => {
    const movingUp = box.scrollTop < lastScrollTop;
    lastScrollTop = box.scrollTop;
    followingBottom = isAtBottom();
    if (movingUp && box.scrollTop <= 2) void loadOlder();
  });
  box.addEventListener('wheel', event => {
    if (event.deltaY < 0) followingBottom = false;
    if (event.deltaY < 0 && box.scrollTop <= 2) void loadOlder();
  }, { passive: true });
  input.focus({ preventScroll: true });
  connect();
  void loadHistory();
})();
