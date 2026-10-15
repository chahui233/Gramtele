// Run after `mvnw test` (which renders these pages with Jasper), using Playwright + Chromium.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const webapp = path.join(root, 'src/main/webapp');
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XkAAAAASUVORK5CYII=', 'base64');
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); });

async function scenario(t, { privateChat = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 720 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [], sockets = [], history = [], posts = [], images = new Map();
  let failPost = false;
  const message = id => ({ id, senderId: privateChat && id % 2 ? 7 : 9,
    chatWith: privateChat ? (id % 2 ? 9 : 7) : -1,
    senderName: '朋友', content: '消息 ' + id, time: '2026-10-12 12:00:00',
    image: [30, 60, 90].includes(id) ? '/slow-' + id + '.svg' : '' });
  const messages = Array.from({ length: 90 }, (_, i) => message(i + 1));
  page.on('pageerror', e => errors.push(e.message));
  await page.routeWebSocket('**/chatSocket/*', socket => sockets.push(socket));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const name = url.pathname;
    if (name.endsWith('/chat.jsp')) return route.fulfill({ contentType: 'text/html; charset=utf-8',
      body: fs.readFileSync(path.join(root, privateChat ? 'target/browser-private-chat.html' : 'target/browser-chat.html')) });
    if (name.includes('/js/') || name.includes('/css/')) {
      const asset = name.slice('/test/'.length);
      return route.fulfill({ contentType: asset.endsWith('.js') ? 'application/javascript' : 'text/css',
        body: fs.readFileSync(path.join(webapp, asset)) });
    }
    if (name.endsWith('/online-users')) return route.fulfill({ json: [{ id: 7, name: 'alice', username: 'alice' }] });
    if (name.endsWith('/chat-state')) return route.fulfill({ json: { groupUnread:0, friends:[{id:9,name:'朋友',unread:0}] } });
    if (name.endsWith('/friend-requests')) return route.fulfill({ json: { pending:0 } });
    if (name.endsWith('/GetMessagesServlet')) {
      history.push(url.search);
      const before = url.searchParams.get('before'), after = url.searchParams.get('after');
      const limit = Number(url.searchParams.get('limit'));
      let rows = before ? messages.filter(m => m.id < Number(before)) : after !== null ? messages.filter(m => m.id > Number(after)) : messages;
      const more = rows.length > limit;
      rows = after !== null ? rows.slice(0, limit) : rows.slice(-limit);
      return route.fulfill({ json: rows, headers: { 'X-Has-More': String(more) } });
    }
    if (name.endsWith('/ChatServlet')) {
      posts.push(route.request().postData());
      if (failPost) return route.fulfill({ status: 503, body: 'unavailable' });
      const saved = { ...message(messages.at(-1).id + 1), senderId: 7, chatWith: privateChat ? 9 : -1, content: 'sent', image: '' };
      messages.push(saved);
      // Deliver the socket event before the HTTP acknowledgement to exercise deduplication.
      sockets.forEach(socket => socket.send(JSON.stringify(saved)));
      return route.fulfill({ status: 201, json: saved });
    }
    if (name.startsWith('/slow-')) {
      images.set(name, () => route.fulfill({ contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="2000"><rect width="1400" height="2000" fill="blue"/></svg>' }));
      return;
    }
    return route.fulfill({ contentType: 'image/png', body: pixel });
  });
  await page.goto('https://chat.test/test/chat.jsp' + (privateChat ? '?chatWith=9' : ''), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#messageList .message').length === 30);
  // Wait for one ordinary background poll before testing pagination: this used to erase hasMoreOlder.
  await page.waitForResponse(response => response.url().includes('GetMessagesServlet') && response.url().includes('after=90'));
  return { page, images, history, posts, errors, sockets, setFailure(value) { failPost = value; } };
}
async function metrics(page) {
  return page.locator('#chatBox').evaluate(box => ({ height: box.scrollHeight, top: box.scrollTop,
    gap: box.scrollHeight - box.clientHeight - box.scrollTop, viewport: box.clientHeight }));
}
async function frames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('slow pictures reserve space and never shift the viewport before or after decoding', async t => {
  const p = await scenario(t);
  const initial = await metrics(p.page);
  assert.ok(initial.gap <= 1, JSON.stringify(initial));
  assert.ok(initial.viewport < 720, 'the message pane, not the entire document, scrolls');
  const image = p.page.locator('[data-message-id="90"] .chat-img');
  assert.equal(await image.evaluate(img => img.complete), false);
  const size = await image.boundingBox();
  assert.equal(size.height, 200);
  await p.images.get('/slow-90.svg')();
  await image.evaluate(img => img.decode());
  await frames(p.page);
  assert.deepEqual(await metrics(p.page), initial);
  // No stale image-load callback is allowed to pull someone reading history back down.
  await p.page.locator('#chatBox').evaluate(box => { box.scrollTop -= 350; });
  await frames(p.page);
  const reading = await metrics(p.page);
  p.sockets[0].send(JSON.stringify({ id: 200, senderId: 9, chatWith: -1, content: 'new message' }));
  await p.page.waitForSelector('[data-message-id="200"]');
  assert.equal((await metrics(p.page)).top, reading.top);
  assert.deepEqual(p.errors, []);
});

test('top scrolling after background sync loads multiple pages and anchors old images; routine notices stay hidden', async t => {
  const p = await scenario(t);
  await p.page.evaluate(() => {
    window.historyNotices = [];
    new MutationObserver(() => { const s = document.getElementById('historyStatus'); if (!s.hidden) window.historyNotices.push(s.textContent); })
      .observe(document.getElementById('historyStatus'), { childList: true, attributes: true, subtree: true });
  });
  await p.page.locator('#chatBox').evaluate(box => { box.scrollTop = 0; });
  await p.page.waitForFunction(() => document.querySelectorAll('#messageList .message').length === 60);
  assert.ok(p.history.some(query => query.includes('before=61')));
  const beforeDecode = await metrics(p.page);
  assert.ok(beforeDecode.top > 0 && beforeDecode.gap > 0, 'reading position preserved, not forced to bottom');
  await p.images.get('/slow-60.svg')();
  await p.page.locator('[data-message-id="60"] .chat-img').evaluate(img => img.decode());
  await frames(p.page);
  assert.deepEqual(await metrics(p.page), beforeDecode);
  await p.page.locator('#chatBox').evaluate(box => { box.scrollTop = 0; });
  await p.page.waitForFunction(() => document.querySelectorAll('#messageList .message').length === 90);
  assert.equal(await p.page.locator('#loadOlder').isDisabled(), true);
  assert.deepEqual(await p.page.locator('.message').evaluateAll(rows => rows.map(row => Number(row.dataset.messageId))),
    Array.from({ length: 90 }, (_, i) => i + 1));
  await p.page.waitForResponse(response => response.url().includes('GetMessagesServlet') && response.url().includes('after=90'));
  assert.deepEqual(await p.page.evaluate(() => window.historyNotices), []);
  assert.equal(await p.page.locator('#historyStatus').isHidden(), true);
  assert.deepEqual(p.errors, []);
});

test('private text and image sends stay on the same page and failed submissions preserve the draft', async t => {
  const p = await scenario(t, { privateChat: true });
  await p.page.evaluate(() => { window.pageIdentity = 'original'; });
  let navigations = 0;
  p.page.on('framenavigated', () => navigations++);
  await p.page.locator('#chatInput').fill('first message');
  await p.page.locator('#chatInput').press('Enter');
  await p.page.waitForSelector('[data-message-id="91"]');
  await p.page.waitForFunction(() => !document.getElementById('sendButton').disabled);
  assert.equal(await p.page.locator('[data-message-id="91"]').count(), 1);
  await p.page.locator('#chatImage').setInputFiles({ name: 'picture.png', mimeType: 'image/png', buffer: pixel });
  await p.page.locator('#sendButton').click();
  await p.page.waitForSelector('[data-message-id="92"]');
  await p.page.waitForFunction(() => !document.getElementById('sendButton').disabled);
  assert.match(p.posts[1], /filename="picture.png"/);
  assert.match(p.posts[1], /name="chatWithId"\r\n\r\n9/);
  p.setFailure(true);
  await p.page.locator('#chatInput').fill('keep my draft');
  await p.page.locator('#sendButton').click();
  await p.page.waitForFunction(() => !document.getElementById('sendStatus').hidden);
  assert.equal(await p.page.locator('#chatInput').inputValue(), 'keep my draft');
  assert.equal(await p.page.evaluate(() => window.pageIdentity), 'original');
  assert.equal(navigations, 0);
  assert.deepEqual(p.errors, []);
});
