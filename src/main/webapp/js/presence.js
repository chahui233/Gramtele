(() => {
  'use strict';
  const box = document.getElementById('chatBox');
  const button = document.getElementById('onlineButton');
  const dialog = document.getElementById('onlineDialog');
  const status = document.getElementById('onlineStatus');
  const list = document.getElementById('onlineList');
  let stopped = false, timer = null, request = null;
  async function refresh() {
    if (stopped || request) return;
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(box.dataset.contextPath + '/online-users', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const users = await response.json();
      if (stopped || request !== controller) return;
      if (button) button.textContent = '在线人数：' + users.length;
      status.textContent = '共 ' + users.length + ' 人在线';
      list.replaceChildren();
      users.forEach(user => {
        const item = document.createElement('li');
        item.textContent = user.name + '（' + user.username + '）' + (user.id === Number(box.dataset.userId) ? ' · 我' : '');
        list.append(item);
      });
    } catch (error) {
      if (!stopped && request === controller) {
        if (button) button.textContent = '在线人数：暂不可用';
        status.textContent = '在线列表暂不可用，正在重试…';
      }
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = null;
        if (!stopped) timer = setTimeout(refresh, 10000);
      }
    }
  }
  if (button) button.addEventListener('click', () => {
    dialog.showModal(); clearTimeout(timer); void refresh();
  });
  document.getElementById('onlineClose').addEventListener('click', () => dialog.close());
  window.addEventListener('pagehide', () => {
    stopped = true; clearTimeout(timer);
    if (request) request.abort();
    request = null;
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { stopped = false; void refresh(); }
  });
  void refresh();
})();
