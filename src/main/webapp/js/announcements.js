(() => {
  'use strict';
  const dialog = document.getElementById('announcementDialog');
  const status = document.getElementById('announcementStatus');
  const list = document.getElementById('announcementList');
  const endpoint = dialog.dataset.contextPath + '/announcements';
  let request = null;
  async function refresh() {
    if (request) request.abort();
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    status.textContent = '正在加载公告…';
    try {
      const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? '登录已失效，请重新登录。' : '公告加载失败，请稍后重试。');
      const items = await response.json();
      if (request !== controller) return;
      list.replaceChildren();
      items.forEach(item => {
        const article = document.createElement('article');
        const title = document.createElement('h3');
        title.textContent = item.title;
        const content = document.createElement('p');
        content.textContent = item.content;
        const time = document.createElement('time');
        time.textContent = item.time;
        article.append(title, time, content);
        list.append(article);
      });
      status.textContent = items.length ? ' ' : '暂无公告';
    } catch (error) {
      if (request === controller) status.textContent = error.name === 'AbortError' ? '公告加载超时，请重新加载。' : error.message;
    } finally {
      clearTimeout(timeout);
      if (request === controller) request = null;
    }
  }
  function open() {
    if (!dialog.open) dialog.showModal();
    void refresh();
  }
  document.getElementById('announcementButton').addEventListener('click', open);
  document.getElementById('announcementClose').addEventListener('click', () => dialog.close());
  document.getElementById('announcementRefresh').addEventListener('click', refresh);
  const form = document.getElementById('announcementForm');
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('announcementPublish');
    const result = document.getElementById('announcementPublishStatus');
    if (button.disabled) return;
    button.disabled = true;
    result.textContent = '正在发布…';
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'X-CSRF-Token': dialog.dataset.loginToken },
        body: new URLSearchParams(new FormData(form))
      });
      if (!response.ok) throw new Error(response.status === 403 ? '只有 admin 账户可以发布公告，请确认登录状态。' : '发布失败，请检查内容或稍后重试。');
      form.reset();
      result.textContent = '公告已发布';
      await refresh();
    } catch (error) { result.textContent = error.message; }
    finally { button.disabled = false; }
  });
  // A new login creates a new random token. Returning home in the same tab does not reopen it.
  const key = 'announcement-login:' + dialog.dataset.contextPath;
  let seen = false;
  try { seen = sessionStorage.getItem(key) === dialog.dataset.loginToken; } catch (ignored) {}
  if (!seen) {
    open();
    try { sessionStorage.setItem(key, dialog.dataset.loginToken); } catch (ignored) {}
  }
})();
