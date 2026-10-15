const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor() { this.children = []; this.dataset = {}; this.events = {}; this.open = false; }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  addEventListener(name, action) { this.events[name] = action; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  reset() { this.resetCalled = true; }
}
function page(script, { token = 'login-a', storage = new Map(), admin = false } = {}) {
  const elements = {}, requests = [], timers = new Map(), events = {};
  let id = 0;
  function element(name) {
    if (name === 'announcementForm' && !admin) return null;
    return elements[name] ||= new Element();
  }
  element('announcementDialog').dataset = { contextPath: '/chat', loginToken: token };
  element('chatBox').dataset = { contextPath: '/chat', userId: '7' };
  const context = {
    document: { getElementById: element, createElement: () => new Element() },
    window: { addEventListener: (name, action) => { events[name] = action; } },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    AbortController, URLSearchParams,
    FormData: class { *[Symbol.iterator]() { yield ['title', '标题']; yield ['content', '正文']; } },
    fetch: (url, options) => new Promise((resolve, reject) => {
      requests.push({ url, options, resolve });
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../main/webapp/js', script), 'utf8'), context);
  return { element, requests, events, storage,
    async respond(index, data, status = 200) {
      requests[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => data });
      await new Promise(resolve => setImmediate(resolve));
    },
    tick(ms) {
      const [id, timer] = [...timers].find(([, timer]) => timer.ms === ms);
      timers.delete(id); timer.fn();
    }
  };
}

test('announcements open once on home for each login and can always be opened manually', () => {
  const storage = new Map();
  const first = page('announcements.js', { storage });
  assert.equal(first.element('announcementDialog').open, true);
  const returnHome = page('announcements.js', { storage });
  assert.equal(returnHome.element('announcementDialog').open, false);
  returnHome.element('announcementButton').events.click();
  assert.equal(returnHome.element('announcementDialog').open, true);
  const nextLogin = page('announcements.js', { storage, token: 'login-b' });
  assert.equal(nextLogin.element('announcementDialog').open, true);
});

test('announcement text is rendered literally and empty announcements have a useful state', async () => {
  const p = page('announcements.js');
  await p.respond(0, [{ title: '<script>bad()</script>', content: '<img onerror=bad()>', time: 'now' }]);
  const article = p.element('announcementList').children[0];
  assert.equal(article.children[0].textContent, '<script>bad()</script>');
  assert.equal(article.children[2].textContent, '<img onerror=bad()>');
  p.element('announcementRefresh').events.click();
  await p.respond(1, []);
  assert.equal(p.element('announcementStatus').textContent, '暂无公告');
});

test('admin publication sends the login token, disables double clicks and refreshes after success', async () => {
  const p = page('announcements.js', { admin: true });
  await p.respond(0, []);
  p.element('announcementForm').events.submit({ preventDefault() {} });
  assert.equal(p.element('announcementPublish').disabled, true);
  assert.equal(p.requests[1].options.headers['X-CSRF-Token'], 'login-a');
  assert.equal(p.requests[1].options.body.get('title'), '标题');
  await p.respond(1, { ok: true }, 201);
  await p.respond(2, [{ title: '标题', content: '正文', time: 'now' }]);
  assert.equal(p.element('announcementForm').resetCalled, true);
  assert.equal(p.element('announcementPublish').disabled, false);
});

test('online count and clickable list update without reloading the page', async () => {
  const p = page('presence.js');
  assert.equal(p.requests[0].url, '/chat/online-users');
  await p.respond(0, [{ id: 7, name: '<script>', username: 'alice' }]);
  assert.equal(p.element('onlineButton').textContent, '在线人数：1');
  assert.equal(p.element('onlineList').children[0].textContent, '<script>（alice） · 我');
  p.element('onlineButton').events.click();
  assert.equal(p.element('onlineDialog').open, true);
  await p.respond(1, [{ id: 7, name: 'Alice', username: 'alice' }, { id: 9, name: 'Bob', username: 'bob' }]);
  assert.equal(p.element('onlineButton').textContent, '在线人数：2');
  p.tick(10000);
  await p.respond(2, [{ id: 7, name: 'Alice', username: 'alice' }]);
  assert.equal(p.element('onlineList').children.length, 1);
});

test('presence cancels on navigation and resumes after browser back', async () => {
  const p = page('presence.js');
  p.events.pagehide();
  assert.equal(p.requests[0].options.signal.aborted, true);
  p.events.pageshow({ persisted: true });
  await p.respond(1, [{ id: 7, name: 'Alice', username: 'alice' }]);
  assert.equal(p.element('onlineButton').textContent, '在线人数：1');
});
