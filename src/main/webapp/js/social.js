(() => {
  'use strict';
  const sidebar = document.getElementById('chatSidebar');
  if (!sidebar) return;
  const base = sidebar.dataset.contextPath;
  const token = sidebar.dataset.loginToken;
  const box = document.getElementById('chatBox');
  const conversation = box ? Number(box.dataset.chatWith) : null;
  const sidebarStatus = document.getElementById('sidebarStatus');
  let stopped = false, timer = null, scheduled = null, busy = false, again = false;
  let delivered = null, acknowledged = -1;
  const controllers = new Set();

  async function request(path, body) {
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(base + path, {
        method: body ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store',
        headers: body ? { 'X-CSRF-Token':token } : {},
        body: body ? new URLSearchParams(body) : undefined, signal:controller.signal
      });
      if (!response.ok || response.redirected) throw new Error(response.status === 401 || response.status === 403
        ? '登录已失效或操作无权限，请重新登录。' : '请求失败，请稍后重试。');
      return path === '/AddFriendServlet' ? response.text() : response.json();
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  }
  function badge(element, count) {
    count = Number(count) || 0;
    element.textContent = String(count);
    element.hidden = count <= 0;
    element.setAttribute('aria-label', count + ' 条未读');
  }
  function renderState(state) {
    if (!Array.isArray(state.friends) || !Number.isFinite(state.groupUnread)) throw new Error('Invalid state');
    badge(sidebar.querySelector('[data-unread="-1"]'), state.groupUnread);
    const list = document.getElementById('friendList');
    const remaining = new Map([...list.querySelectorAll('[data-conversation]')].map(row => [Number(row.dataset.conversation), row]));
    state.friends.forEach(friend => {
      let row = remaining.get(friend.id);
      remaining.delete(friend.id);
      if (!row) {
        row = document.createElement('a');
        row.className = 'friend conversation-link'; row.dataset.conversation = String(friend.id);
        row.href = base + '/chat.jsp?chatWith=' + friend.id;
        const label = document.createElement('span');
        const counter = document.createElement('span');
        counter.className = 'unread-badge'; counter.dataset.unread = String(friend.id);
        row.append(label, counter);
        const wrapper = document.createElement('div'); wrapper.className = 'friend-row';
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'profile-avatar-button'; button.dataset.profileId = String(friend.id);
        const avatar = document.createElement('img'); avatar.alt = ''; button.append(avatar);
        wrapper.append(button, row); list.append(wrapper);
      }
      const button = row.parentElement.querySelector('.profile-avatar-button');
      button.setAttribute('aria-label', '查看 ' + friend.name + ' 的资料');
      window.UserProfiles.setAvatar(button.querySelector('img'), friend.avatar);
      row.firstElementChild.textContent = friend.name;
      badge(row.lastElementChild, friend.unread);
    });
    remaining.forEach(row => row.closest('.friend-row').remove());
    sidebar.querySelectorAll('[data-conversation]').forEach(row => {
      if (Number(row.dataset.conversation) === conversation) row.setAttribute('aria-current','page');
      else row.removeAttribute('aria-current');
    });
    if (!box) sidebar.querySelector('.notification-link').setAttribute('aria-current','page');
  }
  function refresh() {
    if (stopped) return;
    if (busy) { again = true; return; }
    clearTimeout(scheduled);
    scheduled = setTimeout(sync, 60);
  }
  async function sync() {
    if (stopped || busy) return;
    busy = true; clearTimeout(timer);
    const through = document.visibilityState === 'visible' && delivered !== null && delivered > acknowledged ? delivered : null;
    const results = await Promise.allSettled([
      request('/chat-state', through === null ? null : { chatWith:conversation, through }).then(state => {
        if (stopped) return;
        renderState(state); if (through !== null) acknowledged = through;
        window.MessageAlerts?.observe(state);
      }),
      request('/friend-requests?view=count').then(data => {
        if (!stopped) badge(document.getElementById('notificationBadge'), data.pending);
      })
    ]);
    if (!stopped) {
      const errors = [];
      if (results[0].status === 'rejected') errors.push('未读数暂时无法更新');
      if (results[1].status === 'rejected') errors.push('好友通知暂时无法更新');
      sidebarStatus.textContent = errors.join('；');
    }
    busy = false;
    if (!stopped) {
      timer = setTimeout(refresh, 5000);
      if (again) { again = false; refresh(); }
    }
  }
  window.ChatSidebar = {
    refresh,
    historyRead(through) {
      if (!Number.isSafeInteger(through) || through < 0) return;
      delivered = Math.max(delivered ?? 0, through);
      if (delivered > acknowledged) refresh();
    }
  };

  const notificationList = document.getElementById('notificationList');
  let notifyTimer = null, notifying = false, responding = false, notificationVersion = 0;
  let oldest = null, more = false, notificationSignature = '';
  const requests = new Map();
  const notificationStatus = document.getElementById('notificationStatus');
  const older = document.getElementById('olderNotifications');
  function renderNotifications() {
    const items = [...requests.values()].sort((a,b) => b.id - a.id);
    const signature = JSON.stringify(items);
    if (signature !== notificationSignature) {
      notificationSignature = signature;
      notificationList.replaceChildren();
      items.forEach(item => {
        const card = document.createElement('article');
        card.className = 'request-card'; card.dataset.requestId = String(item.id);
        const avatar = document.createElement('img');
        avatar.src = item.avatar || 'images/taffy1.jpg'; avatar.alt = ''; avatar.className = 'request-avatar';
        const details = document.createElement('div'); details.className = 'request-details';
        const name = document.createElement('h2'); name.textContent = item.name;
        const description = document.createElement('p'); description.textContent = '请求添加你为好友';
        const time = document.createElement('time'); time.className = 'muted'; time.textContent = item.time;
        const actions = document.createElement('div'); actions.className = 'request-actions';
        if (item.status === 'pending') {
          for (const [action, label] of [['accept','同意'],['reject','拒绝']]) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
            button.addEventListener('click', () => respond(item, action, actions)); actions.append(button);
          }
        } else {
          const label = document.createElement('span');
          label.textContent = {accepted:'已同意', rejected:'已拒绝', cancelled:'已取消'}[item.status] || '已处理';
          actions.append(label);
          if (item.status === 'accepted') {
            const chat = document.createElement('a');
            chat.textContent = '查看私聊'; chat.href = base + '/chat.jsp?chatWith=' + item.senderId; actions.append(chat);
          }
        }
        details.append(name, description, time, actions); card.append(avatar, details); notificationList.append(card);
      });
    }
    older.hidden = !more; older.disabled = notifying;
  }
  async function loadNotifications(loadOlder = false) {
    if (!notificationList || stopped || notifying || responding) return;
    notifying = true; older.disabled = true;
    const version = notificationVersion;
    clearTimeout(notifyTimer);
    try {
      const items = await request('/friend-requests' + (loadOlder && oldest ? '?before=' + oldest : ''));
      if (stopped || version !== notificationVersion) return;
      if (!Array.isArray(items)) throw new Error('通知数据无效，请重试。');
      // A burst larger than one page may not overlap anything we have loaded yet.
      // Resume paging from that new boundary so requests in the gap stay reachable.
      const gap = !loadOlder && items.length === 50 && !items.some(item => requests.has(item.id));
      items.forEach(item => requests.set(item.id, item));
      if (oldest === null || loadOlder || gap) {
        more = items.length === 50;
        if (items.length) oldest = items[items.length - 1].id;
      }
      notificationStatus.textContent = requests.size ? '' : '暂无好友申请';
      renderNotifications();
    } catch (error) {
      if (!stopped && version === notificationVersion) notificationStatus.textContent =
        error.name === 'AbortError' ? '通知加载超时，请点击刷新重试。' : '通知加载失败，请点击刷新重试。';
    } finally {
      notifying = false;
      if (!stopped) { older.disabled = false; notifyTimer = setTimeout(() => loadNotifications(), 5000); }
    }
  }
  async function respond(item, action, actions) {
    if (responding) return;
    responding = true; notificationVersion++;
    actions.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      const data = await request('/friend-requests', { requestId:item.id, action });
      if (stopped) return;
      if (data.status === 'accepted' || data.status === 'rejected') item.status = data.status;
      else if (data.status === 'resolved') {
        // Refresh even when this is an older page, so a stale card cannot recreate a deleted friendship.
        const updated = await request('/friend-requests?before=' + (item.id + 1));
        updated.forEach(row => requests.set(row.id, row));
      } else throw new Error('无法处理此申请，请刷新后重试。');
      notificationStatus.textContent = data.status === 'accepted' ? '已成为好友，可以开始私聊。' :
        data.status === 'rejected' ? '已拒绝该申请。' : '该申请已经处理。';
      renderNotifications(); refresh();
    } catch (error) {
      if (!stopped) notificationStatus.textContent = error.name === 'AbortError' ? '操作超时，请刷新确认处理结果。' : error.message;
    } finally {
      responding = false;
      actions.querySelectorAll('button').forEach(button => { button.disabled = false; });
    }
  }
  if (notificationList) {
    document.getElementById('refreshNotifications').addEventListener('click', () => loadNotifications());
    older.addEventListener('click', () => loadNotifications(true));
    void loadNotifications();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { refresh(); void loadNotifications(); }
  });
  window.addEventListener('pagehide', () => {
    stopped = true; clearTimeout(timer); clearTimeout(scheduled); clearTimeout(notifyTimer);
    controllers.forEach(controller => controller.abort());
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { stopped = false; refresh(); void loadNotifications(); }
  });
  refresh();
})();
