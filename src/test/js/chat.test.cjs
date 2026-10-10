const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../../main/webapp/js/chat.js'), 'utf8');

class Element {
  constructor() { this.children = []; this.dataset = {}; this.style = {}; }
  append(...children) { this.children.push(...children); }
  insertBefore(row, next) {
    if (next === null) this.children.push(row);
    else this.children.splice(this.children.indexOf(next), 0, row);
  }
  focus() {}
}
function page({ protocol = 'http:', contextPath = '', chatWith = -1 } = {}) {
  const box = new Element(), status = new Element();
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
      getElementById: id => id === 'chatBox' ? box : id === 'connectionStatus' ? status : new Element(),
      createElement: () => new Element()
    },
    location: { protocol, host: 'chat.example:8079' },
    WebSocket: Socket,
    fetch: url => new Promise(resolve => requests.push({ url, resolve })),
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    window: { addEventListener: (name, fn) => { events[name] = fn; } },
    alert() {}, confirm() { return false; }
  };
  vm.runInNewContext(script, context);
  return { box, status, connections, requests, events,
    tick() { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); },
    ids() { return box.children.map(row => Number(row.dataset.messageId)); },
    async respond(index, messages, statusCode = 200) {
      requests[index].resolve({ ok: statusCode === 200, status: statusCode, json: async () => messages });
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
  assert.match(jsp, /src="js\/chat.js"/);
  assert.ok(!jsp.includes('${socketProtocol}') && !jsp.includes('${location.host}'));
});

test('incoming push renders immediately without a page refresh or a history response', () => {
  const p = page();
  p.connections[0].message(message(1));
  assert.deepEqual(p.ids(), [1]);
  assert.equal(p.box.children[0].children[1].textContent, '<img src=x onerror=alert(1)>');
});

test('late history is sorted and overlapping live messages are not duplicated', async () => {
  const p = page();
  p.connections[0].open();
  p.connections[0].message(message(3));
  await p.respond(0, [message(1), message(2), message(3)]);
  assert.deepEqual(p.ids(), [1, 2, 3]);
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
