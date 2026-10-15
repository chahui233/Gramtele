(() => {
  'use strict';
  const dialog = document.getElementById('friendDialog');
  if (!dialog) return;
  const base = dialog.dataset.contextPath, token = dialog.dataset.loginToken;
  const fallback = base + '/images/taffy1.jpg';
  const name = document.getElementById('friendName'), avatar = document.getElementById('friendAvatar');
  const signature = document.getElementById('friendSignature'), status = document.getElementById('friendStatus');
  const send = document.getElementById('sendFriendRequest'), retry = document.getElementById('profileRetry');
  const incoming = document.getElementById('viewFriendRequest'), chat = document.getElementById('friendChat');
  let selected = null, version = 0, loading = null;
  const pending = new Set();
  function setAvatar(image, path) {
    image.dataset.avatar = '';
    const url = path && path.trim() ? path : fallback;
    if (image.dataset.avatarSource === url) return;
    image.dataset.avatarSource = url;
    if (image.getAttribute('src') !== url) image.src = url;
  }
  function replaceBroken(image) {
    if (image.matches?.('img[data-avatar]') && image.src !== new URL(fallback, location.href).href) {
      image.dataset.avatarSource = image.getAttribute('src'); image.src = fallback;
    }
  }
  document.addEventListener('error', event => replaceBroken(event.target), true);
  document.querySelectorAll('img[data-avatar]').forEach(image => {
    if (image.complete && !image.naturalWidth) replaceBroken(image);
  });
  function relationship(value) {
    send.hidden = value === 'self';
    send.disabled = value !== 'none' || pending.has(selected);
    send.textContent = {friends:'已是好友',pending:'申请已发送',incoming:'待处理好友申请'}[value] || '发送好友申请';
    incoming.hidden = value !== 'incoming';
    chat.hidden = value !== 'friends'; chat.href = base + '/chat.jsp?chatWith=' + selected;
    status.textContent = {self:'这是你的个人资料。',friends:'你们已经是好友，可以开始私聊。',
      pending:'好友申请已发送，等待对方同意。',incoming:'对方已向你发送申请，请到通知页面处理。',
      none:'发送申请后，需要对方同意才能成为好友。'}[value] || '';
  }
  async function load() {
    const id = selected, current = ++version;
    loading?.abort();
    const controller = new AbortController(); loading = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    send.disabled = true; retry.hidden = true; status.textContent = '正在加载资料…';
    try {
      const response = await fetch(base + '/user-profile?userId=' + id, {credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if (!response.ok || response.redirected) throw new Error(response.status === 404 ? '用户不存在或暂不可用。' : '资料加载失败，请重试。');
      const profile = await response.json();
      if (current !== version || selected !== id || !dialog.open) return;
      if (profile.id !== id || !['none','self','friends','pending','incoming'].includes(profile.relationship)) throw new Error('资料数据无效，请重试。');
      name.textContent = profile.name; setAvatar(avatar, profile.avatar);
      signature.textContent = profile.signature?.trim() ? profile.signature : '这个人还没有填写个性签名。';
      relationship(profile.relationship);
    } catch (error) {
      if (current === version && dialog.open) {
        status.textContent = error.name === 'AbortError' ? '资料加载超时，请重试。' : error.message;
        retry.hidden = false;
      }
    } finally { clearTimeout(timeout); if (loading === controller) loading = null; }
  }
  function open(id) {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    selected = id; name.textContent = '正在加载…'; signature.textContent = '';
    setAvatar(avatar, null); send.hidden = false; incoming.hidden = chat.hidden = true;
    if (!dialog.open) dialog.showModal();
    void load();
  }
  window.UserProfiles = {open,setAvatar};
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-profile-id]');
    if (target) { event.preventDefault(); open(Number(target.dataset.profileId)); }
  });
  document.getElementById('friendClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    // The close event is queued: a new card may already have opened by then.
    if (dialog.open) return;
    selected = null; version++; loading?.abort();
  });
  retry.addEventListener('click', load);
  send.addEventListener('click', async () => {
    const id = selected, current = version;
    if (!id || send.disabled || pending.has(id)) return;
    pending.add(id); send.disabled = true; retry.hidden = true; status.textContent = '正在发送申请…';
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(base + '/AddFriendServlet', {method:'POST',credentials:'same-origin',
        headers:{'X-CSRF-Token':token},body:new URLSearchParams({friendId:id}),signal:controller.signal});
      if (!response.ok || response.redirected) throw new Error('申请发送失败，请重试。');
      const result = (await response.text()).trim();
      const state = {success:'pending',pending:'pending',incoming:'incoming',already:'friends'}[result];
      if (!state) throw new Error('无法发送申请，请重新加载资料。');
      if (selected === id && dialog.open) { version++; loading?.abort(); relationship(state); }
      window.ChatSidebar?.refresh();
    } catch (error) {
      if (selected === id && current === version && dialog.open) {
        status.textContent = error.name === 'AbortError' ? '请求超时，请重新加载资料确认结果。' : error.message;
        send.disabled = false; retry.hidden = false;
      }
    } finally { clearTimeout(timeout); pending.delete(id); }
  });
})();
