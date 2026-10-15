(() => {
  'use strict';
  const root = document.getElementById('messageAlerts');
  if (!root) return;
  const base = root.dataset.contextPath, userId = Number(root.dataset.userId);
  const key = 'chat-alerts:' + base + ':' + root.dataset.loginToken;
  const button = document.getElementById('messageSound');
  const status = document.getElementById('messageSoundStatus');
  const originalTitle = document.title;
  const owner = Math.random().toString(36).slice(2);
  const read = suffix => { try { return localStorage.getItem(key + suffix); } catch (_) { return null; } };
  const write = (suffix, value) => { try { localStorage.setItem(key + suffix, String(value)); } catch (_) {} };
  let seen = read(':seen') === null ? null : Number(read(':seen'));
  let wanted = read(':muted') !== 'true';
  let audio = null, buffer = null, loading = null, playing = null, activating = false;
  let stopped = false, ended = false, pollTimer = null, pollController = null, flashing = null;
  let pendingIncoming = 0;

  function updateSoundButton() {
    const ready = wanted && audio?.state === 'running' && buffer;
    button.textContent = !wanted ? '提示音：关闭' : ready ? '提示音：开启' : '开启提示音';
    button.setAttribute('aria-pressed', String(Boolean(ready)));
    button.title = ready ? '点击关闭新消息提示音' : '点击启用新消息提示音';
  }
  async function loadSound() {
    if (buffer) return buffer;
    if (!loading) loading = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(base + '/sound/info.m4a', {credentials:'same-origin', signal:controller.signal});
        if (!response.ok || response.redirected) throw new Error('Sound unavailable');
        buffer = await audio.decodeAudioData(await response.arrayBuffer());
        return buffer;
      } finally { clearTimeout(timeout); loading = null; }
    })();
    return loading;
  }
  async function activate() {
    if (!wanted || stopped || activating) return;
    activating = true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audio) audio = new AudioContext();
      // resume() is called directly from a user gesture, as required on mobile browsers.
      await audio.resume();
      await loadSound();
      status.textContent = audio.state === 'running' ? '' : '点击开启提示音';
    } catch (_) { status.textContent = '提示音暂不可用，点击重试'; }
    finally { activating = false; updateSoundButton(); }
  }
  function stopSound() {
    if (playing) { try { playing.stop(); } catch (_) {} playing = null; }
  }
  async function playSound(id) {
    if (!wanted || stopped || audio?.state !== 'running') return;
    try {
      await loadSound();
      const play = () => {
        if (stopped || !wanted || audio.state !== 'running' || Number(read(':sound-id')) >= id) return;
        write(':sound-id', id);
        // Coalesce a burst and prevent simultaneous playback in several tabs.
        if (Date.now() - Number(read(':sound-time')) < 1200) return;
        write(':sound-time', Date.now());
        stopSound();
        playing = audio.createBufferSource(); playing.buffer = buffer;
        playing.connect(audio.destination); playing.start();
      };
      if (navigator.locks?.request) await navigator.locks.request(key + ':sound', play);
      else {
        // HTTP deployments do not expose Web Locks. Elect one tab via a short claim window.
        const claim = id + ':' + owner;
        write(':sound-claim', claim);
        await new Promise(resolve => setTimeout(resolve, 100));
        if (read(':sound-claim') === claim || read(':sound-claim') === null) play();
      }
    } catch (_) { status.textContent = '提示音暂不可用，点击重试'; updateSoundButton(); }
  }
  function stopFlashing() {
    clearInterval(flashing); flashing = null; document.title = originalTitle;
  }
  function alert(id) {
    if (stopped || seen === null || id <= seen) return;
    seen = id; write(':seen', Math.max(id, Number(read(':seen')) || 0));
    if (document.visibilityState !== 'visible' || !document.hasFocus()) {
      if (flashing === null) {
        document.title = '【收到新消息】' + originalTitle;
        flashing = setInterval(() => {
          document.title = document.title === originalTitle ? '【收到新消息】' + originalTitle : originalTitle;
        }, 1000);
      }
    }
    void playSound(id);
  }
  function observe(state) {
    if (stopped || !Number.isSafeInteger(state.latestIncoming) || !Number.isSafeInteger(state.loginCursor)) return;
    if (seen === null) seen = state.loginCursor;
    alert(Math.max(state.latestIncoming, pendingIncoming));
    pendingIncoming = 0;
  }
  window.MessageAlerts = {
    observe,
    receive(message) {
      const id = Number(message.id), sender = Number(message.senderId);
      const receiver = message.chatWith == null ? -1 : Number(message.chatWith);
      if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(sender) || sender <= 0 || sender === userId
          || receiver !== -1 && receiver !== userId || stopped) return;
      if (seen === null) pendingIncoming = Math.max(pendingIncoming, id);
      else alert(id);
    }
  };
  async function poll() {
    if (stopped || ended || pollController) return;
    // Chat/notification pages already poll this endpoint; share their completed snapshots.
    if (window.ChatSidebar) { pollTimer = setTimeout(poll, 5000); return; }
    const controller = new AbortController(); pollController = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(base + '/chat-state', {credentials:'same-origin', cache:'no-store', signal:controller.signal});
      if (response.status === 401 || response.status === 403 || response.redirected) { ended = true; stopFlashing(); return; }
      if (response.ok && !stopped && pollController === controller) observe(await response.json());
    } catch (_) { /* Retry quietly; a network outage is not a new message. */ }
    finally {
      clearTimeout(timeout);
      if (pollController === controller) {
        pollController = null;
        if (!stopped && !ended) pollTimer = setTimeout(poll, 5000);
      }
    }
  }
  button.addEventListener('click', () => {
    if (wanted && audio?.state === 'running' && buffer) {
      wanted = false; write(':muted', true); stopSound(); status.textContent = ''; updateSoundButton();
    } else { wanted = true; write(':muted', false); void activate(); }
  });
  const gesture = event => {
    if (event.isTrusted && !button.contains(event.target) && wanted && (!audio || audio.state !== 'running' || !buffer)) void activate();
  };
  document.addEventListener('pointerdown', gesture, {passive:true});
  document.addEventListener('keydown', gesture);
  window.addEventListener('storage', event => {
    if (event.key === key + ':muted') { wanted = event.newValue !== 'true'; if (!wanted) stopSound(); updateSoundButton(); }
  });
  window.addEventListener('focus', stopFlashing);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { stopFlashing(); clearTimeout(pollTimer); void poll(); }
  });
  window.addEventListener('pagehide', () => {
    stopped = true; clearTimeout(pollTimer); stopFlashing(); stopSound();
    pollController?.abort(); pollController = null;
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { stopped = false; clearTimeout(pollTimer); void poll(); updateSoundButton(); }
  });
  updateSoundButton(); pollTimer = setTimeout(poll, 0);
})();
