const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../../main/webapp/js/chat.js'), 'utf8');

class Element {
  constructor() { this.children = []; this.dataset = {}; this.style = {}; this.scrollTop = 0; this.scrollHeight = 0; this.clientHeight = 400; this.events = {}; this.hidden = true; this.value = ''; this.files = []; }
  append(...children) { this.children.push(...children); }
  insertBefore(row, next) {
    if (next === null) this.children.push(row);
    else this.children.splice(this.children.indexOf(next), 0, row);
  }
  focus() {}
  getBoundingClientRect() { return { top: 0, bottom: 100 }; }
  addEventListener(name, handler) { this.events[name] = handler; }
}
function page({ protocol = 'http:', contextPath = '', chatWith = -1 } = {}) {
  const box = new Element(), status = new Element(), historyStatus = new Element(), list = new Element();
  const elements = { chatBox: box, connectionStatus: status, historyStatus, messageList: list };
  const element = id => elements[id] ||= new Element();
  element('chatForm').reset = () => { element('chatInput').value = ''; element('chatImage').files = []; };
  box.dataset = { userId: '7', chatWith: String(chatWith), contextPath };
  const connections = [], requests = [], timers = new Map(), events = {};
  let timerId = 0;
  class Socket {
    constructor(url) { this.url = url; connections.push(this); }
    close() { this.onclose?.({ code: 1000 }); }
    open() { this.onopen(); }
    message(data) { this.onmessage({ data: JSON.stringify(data) }); }
    disconnect() { this.onclose({ code: 1006 }); }
  }
  const context = {
    document: {
      getElementById: element,
      createElement: () => new Element()
    },
    location: { protocol, host: 'chat.example:8079' },
    WebSocket: Socket,
    AbortController,
    FormData: class {
      constructor() { this.content = element('chatInput').value; this.image = element('chatImage').files[0]; }
    },
    fetch: (url, options) => new Promise((resolve, reject) => {
      requests.push({ url, resolve, options, signal: options.signal });
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    window: { addEventListener: (name, fn) => { events[name] = fn; } },
    alert() {}, confirm() { return false; }
  };
  vm.runInNewContext(script, context);
  return { box, list, element, status, historyStatus, connections, requests, events,
    tick(ms) {
      const [id, timer] = [...timers.entries()].filter(([, t]) => ms == null || t.ms === ms)
        .sort((a, b) => a[1].ms - b[1].ms)[0];
      timers.delete(id); timer.fn();
    },
    ids() { return list.children.map(row => Number(row.dataset.messageId)); },
    async respond(index, messages, statusCode = 200, more = messages.length === 30) {
      requests[index].resolve({ ok: statusCode >= 200 && statusCode < 300, status: statusCode,
        headers: { get: () => String(more) }, json: async () => messages });
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}
const message = (id, senderId = 9, chatWith = -1) => ({
  id, senderId, chatWith, content: '<img src=x onerror=alert(1)>', senderName: '好友', time: 'now'
});

test('ROOT and nested HTTPS deployments get the actual host, context and logged-in ID', () => {
  assert.equal(page().connections[0].url, 'ws://chat.example:8079/chatSocket/7');
  assert.equal(page({ protocol: 'https:', contextPath: '/YYTFSupportSite-1.0-SNAPSHOT' }).connections[0].url,
    'wss://chat.example:8079/YYTFSupportSite-1.0-SNAPSHOT/chatSocket/7');
  const jsp = fs.readFileSync(path.join(__dirname, '../../main/webapp/chat.jsp'), 'utf8');
  assert.match(jsp, /src="js\/chat.js\?v=[^"]+"/);
  assert.ok(!jsp.includes('${socketProtocol}') && !jsp.includes('${location.host}'));
});

test('incoming push renders immediately without a page refresh or a history response', () => {
  const p = page();
  p.connections[0].message(message(1));
  assert.deepEqual(p.ids(), [1]);
  assert.equal(p.list.children[0].children[1].textContent, '<img src=x onerror=alert(1)>');
});

test('late history is sorted and overlapping live messages are not duplicated', async () => {
  const p = page();
  p.connections[0].open();
  p.connections[0].message(message(3));
  await p.respond(0, [message(1), message(2), message(3)]);
  assert.deepEqual(p.ids(), [1, 2, 3]);
  assert.match(p.requests[1].url, /after=3&limit=30$/);
  await p.respond(1, [message(1), message(2), message(3)]);
  assert.deepEqual(p.ids(), [1, 2, 3]);
});

test('group and private chats stay separate, including incoming and outgoing private messages', () => {
  const group = page();
  group.connections[0].message(message(1, 9, 7));
  group.connections[0].message(message(2, 7, 9));
  group.connections[0].message(message(3));
  assert.deepEqual(group.ids(), [3]);
  const privateChat = page({ chatWith: 9 });
  [message(1, 9, 7), message(2, 7, 9), message(3), message(4, 8, 7)]
    .forEach(m => privateChat.connections[0].message(m));
  assert.deepEqual(privateChat.ids(), [1, 2]);
});

test('disconnect reconnects and catches up missed messages without duplication', async () => {
  const p = page();
  await p.respond(0, [message(1)]);
  p.connections[0].disconnect();
  await p.respond(1, [message(1), message(2)]);
  p.tick();
  assert.equal(p.connections.length, 2);
  p.connections[1].open();
  p.connections[1].message(message(4));
  await p.respond(2, [message(1), message(2), message(3), message(4)]);
  assert.deepEqual(p.ids(), [1, 2, 3, 4]);
});

test('history failures retry and session rejection stops reconnecting', async () => {
  const p = page();
  await p.respond(0, [], 503);
  p.tick();
  await p.respond(1, [message(1)]);
  assert.deepEqual(p.ids(), [1]);
  p.connections[0].open();
  await p.respond(2, [], 401);
  assert.match(p.status.textContent, /登录已失效/);
});

test('leaving closes the socket and browser back reconnects', async () => {
  const p = page();
  await p.respond(0, []);
  p.events.pagehide();
  p.connections[0].message(message(1));
  assert.deepEqual(p.ids(), []);
  p.events.pageshow({ persisted: true });
  assert.equal(p.connections.length, 2);
});

test('socket authentication failure does not suppress authorized private history', async () => {
  const p = page({ chatWith: 9 });
  p.connections[0].onclose({ code: 1008 });
  await p.respond(0, [message(1, 9, 7), message(2, 7, 9)]);
  assert.deepEqual(p.ids(), [1, 2]);
});

test('hung private history is aborted and retried automatically', async () => {
  const p = page({ chatWith: 9 });
  p.tick(10000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(p.requests[0].signal.aborted, true);
  assert.match(p.historyStatus.textContent, /超时/);
  p.tick(5000);
  await p.respond(1, [message(1, 9, 7)]);
  assert.deepEqual(p.ids(), [1]);
});

test('back navigation starts fresh history while the old request was pending', async () => {
  const p = page({ chatWith: 9 });
  p.events.pagehide();
  assert.equal(p.requests[0].signal.aborted, true);
  p.events.pageshow({ persisted: true });
  await p.respond(0, [message(99, 9, 7)]);
  await p.respond(1, [message(1, 9, 7)]);
  assert.deepEqual(p.ids(), [1]);
});

test('back navigation re-enables the older-page button after cancelling a pending page', async () => {
  const p = page();
  await p.respond(0, Array.from({ length: 30 }, (_, i) => message(i + 31)));
  p.element('loadOlder').events.click();
  assert.equal(p.element('loadOlder').disabled, true);
  p.events.pagehide();
  p.events.pageshow({ persisted: true });
  assert.equal(p.element('loadOlder').disabled, false);
  await p.respond(1, [message(1)]);
  assert.equal(p.ids().includes(1), false);
});

test('HTTP synchronization catches a message missed by an open socket', async () => {
  const p = page({ chatWith: 9 });
  await p.respond(0, []);
  p.tick(5000);
  await p.respond(1, [message(1, 9, 7)]);
  assert.deepEqual(p.ids(), [1]);
});

test('history is paged and scrolling to the top loads older messages without jumping to the bottom', async () => {
  const p = page({ chatWith: 9 });
  const recent = Array.from({ length: 30 }, (_, index) => message(31 + index, 9, 7));
  await p.respond(0, recent);
  assert.deepEqual(p.ids(), recent.map(item => item.id));
  assert.equal(p.historyStatus.textContent, '');
  p.box.scrollHeight = 1200;
  p.box.scrollTop = 800;
  p.box.events.scroll();
  p.box.scrollTop = 0;
  p.box.events.scroll();
  assert.match(p.requests[1].url, /before=31&limit=30$/);
  const older = Array.from({ length: 30 }, (_, index) => message(1 + index, 9, 7));
  await p.respond(1, older);
  assert.deepEqual(p.ids(), [...older, ...recent].map(item => item.id));
  assert.equal(p.box.scrollTop, 0);
  // Once the user is reading older pages, a new live message must not force a jump.
  p.box.scrollTop = 10;
  p.box.scrollHeight = 1200;
  p.box.events.scroll();
  p.connections[0].message(message(100, 9, 7));
  assert.equal(p.box.scrollTop, 10);
});

test('empty background polls do not disable loading older pages', async () => {
  const p = page();
  await p.respond(0, Array.from({ length: 30 }, (_, i) => message(i + 31)));
  p.tick(5000);
  await p.respond(1, []);
  assert.equal(p.element('loadOlder').disabled, false);
  p.element('loadOlder').events.click();
  assert.match(p.requests[2].url, /before=31&limit=30$/);
  await p.respond(2, Array.from({ length: 30 }, (_, i) => message(i + 1)), 200, false);
  assert.equal(p.element('loadOlder').disabled, true);
  p.tick(5000);
  await p.respond(3, [message(61)]);
  assert.equal(p.element('loadOlder').disabled, true);
});

test('backlog after a disconnect is fetched immediately page by page without advancing from live messages', async () => {
  const p = page();
  await p.respond(0, [message(1)]);
  p.connections[0].message(message(100));
  p.tick(5000);
  assert.match(p.requests[1].url, /after=1&/);
  await p.respond(1, Array.from({ length: 30 }, (_, i) => message(i + 2)), 200, true);
  assert.match(p.requests[2].url, /after=31&/);
  await p.respond(2, [message(32)], 200, false);
  assert.deepEqual(p.ids(), [...Array.from({ length: 32 }, (_, i) => i + 1), 100]);
});

test('empty initial chat uses incremental after=0 so a burst cannot skip messages', async () => {
  const p = page();
  assert.ok(!p.requests[0].url.includes('after='));
  await p.respond(0, []);
  p.tick(5000);
  assert.match(p.requests[1].url, /after=0&/);
});

test('sending uses multipart fetch, blocks double submission and deduplicates the push and response', async () => {
  const p = page({ chatWith: 9 });
  await p.respond(0, []);
  p.element('chatInput').value = 'hello';
  p.element('chatImage').files = [{ name: 'photo.png' }];
  let prevented = 0;
  const submit = () => p.element('chatForm').events.submit({ preventDefault() { prevented++; } });
  void submit(); void submit();
  assert.equal(prevented, 2);
  assert.equal(p.requests.length, 2);
  assert.equal(p.requests[1].options.method, 'POST');
  assert.equal(p.requests[1].options.headers.Accept, 'application/json');
  assert.equal(p.requests[1].options.body.image.name, 'photo.png');
  assert.equal(p.element('sendButton').disabled, true);
  const saved = message(1, 7, 9);
  p.connections[0].message(saved);
  await p.respond(1, saved, 201);
  assert.deepEqual(p.ids(), [1]);
  assert.equal(p.element('chatInput').value, '');
  assert.equal(p.element('sendButton').disabled, false);
});

test('failed and timed out submissions preserve drafts and never retry the POST automatically', async () => {
  const p = page();
  await p.respond(0, []);
  p.element('chatInput').value = 'keep this draft';
  void p.element('chatForm').events.submit({ preventDefault() {} });
  await p.respond(1, {}, 503);
  assert.equal(p.element('chatInput').value, 'keep this draft');
  assert.equal(p.element('sendStatus').hidden, false);
  void p.element('chatForm').events.submit({ preventDefault() {} });
  p.tick(30000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(p.element('chatInput').value, 'keep this draft');
  assert.match(p.element('sendStatus').textContent, /可能已送达/);
  assert.equal(p.requests.filter(r => r.options.method === 'POST').length, 2);
});

test('background history refresh does not show the initial loading message', async () => {
  const p = page();
  await p.respond(0, [message(1)]);
  assert.equal(p.historyStatus.textContent, '');
  p.tick(5000);
  assert.equal(p.historyStatus.textContent, '');
});
