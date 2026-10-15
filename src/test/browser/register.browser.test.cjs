// Requires the register.jsp render produced by `mvnw test`, Playwright and Chromium.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createHash } = require('node:crypto');
require('../../main/webapp/js/registration-password-rules.js');
require('../../main/webapp/js/registration-challenge.js');
const root = path.resolve(__dirname, '../../..');
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); });

async function registrationPage(t, width = 1100, { matchingPassword = 'V-VII-may-2024-6-29aaaaaaaaaa', secure = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [], posts = [];
  const salt = '0123456789abcdef0123456789abcdef';
  const prefix = matchingPassword === null ? '000000000000' :
    createHash('sha256').update(salt+'\n'+matchingPassword,'utf8').digest('hex').slice(0,12);
  const challenge = { salt, prefix, expiresAt: Date.now() + 30*60*1000 };
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/register.jsp')) {
      let html = fs.readFileSync(path.join(root, 'target/browser-register.html'),'utf8');
      // Use a known full-difficulty solution to exercise the successful UI path without mining.
      const originalSalt = html.match(/data-challenge-salt="([^"]+)"/)[1];
      const originalPrefix = html.match(/data-challenge-prefix="([^"]+)"/)[1];
      html = html.replaceAll(originalSalt,salt).replaceAll(originalPrefix,prefix)
        .replace(/data-challenge-expires="\d+"/,'data-challenge-expires="'+challenge.expiresAt+'"')
        .replace(/data-server-now="\d+"/,'data-server-now="'+Date.now()+'"');
      return route.fulfill({ contentType:'text/html; charset=utf-8', body:html });
    }
    if (url.pathname.includes('/js/') || url.pathname.includes('/css/')) return route.fulfill({
      contentType: url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css',
      body: fs.readFileSync(path.join(root, 'src/main/webapp', url.pathname.slice('/test/'.length))) });
    if (route.request().method() === 'POST') {
      posts.push(new URLSearchParams(route.request().postData()));
      return route.fulfill({ contentType: 'text/html', body: '<p>Registration accepted by test server</p>' });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto((secure ? 'https' : 'http')+'://registration.test/test/register.jsp');
  return { page, errors, posts, challenge };
}

async function symbols(page) {
  return page.locator('[data-password-rule] .rule-symbol').allTextContents();
}

test('each keystroke updates all eleven checks, and only a matching password can submit', async t => {
  const { page, errors, posts, challenge } = await registrationPage(t);
  const input = page.locator('#registrationPassword');
  await page.locator('#registrationUsername').fill('test-user');
  assert.deepEqual(await symbols(page), Array(11).fill('×'));
  assert.equal(await page.locator('#registerButton').isDisabled(), true);
  const valid = 'V-VII-may-2024-6-29aaaaaaaaaa';
  let prefix = '';
  for (const character of valid) {
    prefix += character;
    await input.pressSequentially(character);
    assert.deepEqual(await symbols(page), [...RegistrationPasswordRules.evaluate(prefix).rules,
      RegistrationChallenge.evaluate(prefix,challenge).passes].map(v => v ? '√' : '×'), prefix);
    assert.equal(await page.locator('#passwordLength').textContent(), String([...prefix].length));
  }
  assert.deepEqual(await symbols(page), Array(11).fill('√'));
  assert.equal(await page.locator('#passwordDigitSum').textContent(), '25');
  assert.equal(await page.locator('#registerButton').isEnabled(), true);
  const field = await input.boundingBox(), rules = await page.locator('.password-requirements').boundingBox();
  assert.ok(rules.x > field.x + field.width, 'requirements are beside the input on desktop');
  await page.screenshot({ path: path.join(root, 'target/register-desktop.png'), fullPage: true });
  await input.press('Backspace');
  assert.equal((await symbols(page))[9], '×');
  assert.equal(await page.locator('#registerButton').isDisabled(), true);
  await input.press('Enter');
  assert.equal(posts.length, 0);
  await input.pressSequentially('a');
  await page.locator('#registerButton').click();
  await page.waitForURL('**/register');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].get('password'), valid);
  assert.match(posts[0].get('challengeId'), /^[0-9a-f]{32}$/);
  assert.equal(posts[0].has('challengePrefix'), false);
  assert.deepEqual(errors, []);
});

test('replacement input counts Unicode correctly and recalculates Roman tokens without reloading', async t => {
  const { page, errors } = await registrationPage(t,1100,{matchingPassword:'V-VII-may-2024-6-29aaaaaaaaa😀'});
  const input = page.locator('#registrationPassword');
  await input.fill('V-VII-may-2024-6-29aaaaaaaaa😀');
  assert.equal(await page.locator('#passwordLength').textContent(), '29');
  assert.deepEqual(await symbols(page), Array(11).fill('√'));
  await input.fill('V-VII-I');
  assert.equal((await symbols(page))[6], '×');
  await input.fill('VII-V');
  assert.equal((await symbols(page))[6], '√');
  await input.fill('XXXV-I');
  assert.equal((await symbols(page))[6], '√');
  await input.fill('I-XXXV');
  assert.equal((await symbols(page))[6], '√');
  await input.fill('VII');
  assert.equal((await symbols(page))[6], '×');
  await input.fill('');
  assert.deepEqual(await symbols(page), Array(11).fill('×'));
  assert.deepEqual(errors, []);
});

test('mobile registration shows all eleven rules and challenge details without horizontal overflow', async t => {
  const { page, errors } = await registrationPage(t, 375);
  const field = await page.locator('#registrationPassword').boundingBox();
  const rules = await page.locator('.password-requirements').boundingBox();
  assert.ok(rules.y > field.y + field.height);
  assert.equal(await page.locator('[data-password-rule]').count(), 11);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(root, 'target/register-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
});

test('passing the original rules alone cannot submit; public random target stays stable on reload',async t=>{
  const {page,posts,errors,challenge}=await registrationPage(t,1100,{matchingPassword:null});
  await page.locator('#registrationUsername').fill('test-user');
  await page.locator('#registrationPassword').fill('V-VII-may-2024-6-29aaaaaaaaaa');
  assert.deepEqual(await symbols(page),[...Array(10).fill('√'),'×']);
  assert.equal(await page.locator('#registerButton').isDisabled(),true);
  await page.locator('#registrationPassword').press('Enter');
  assert.equal(posts.length,0);
  await page.reload();
  assert.equal(await page.locator('#challengeTarget').textContent(),challenge.prefix);
  assert.deepEqual(errors,[]);
});

test('hash feedback works over HTTP without Web Crypto and expiry blocks previously valid input',async t=>{
  const {page,posts,errors}=await registrationPage(t,1100,{secure:false});
  assert.equal(await page.evaluate(()=>window.isSecureContext),false);
  await page.locator('#registrationUsername').fill('test-user');
  await page.locator('#registrationPassword').fill('V-VII-may-2024-6-29aaaaaaaaaa');
  assert.deepEqual(await symbols(page),Array(11).fill('√'));
  await page.evaluate(()=>{
    const current=Date.now;
    Date.now=()=>current()+31*60*1000;
    window.dispatchEvent(new Event('pageshow'));
  });
  assert.equal((await symbols(page))[10],'×');
  assert.equal(await page.locator('#registerButton').isDisabled(),true);
  assert.equal(await page.locator('#challengeReload').isVisible(),true);
  await page.locator('#registrationPassword').press('Enter');
  assert.equal(posts.length,0);
  assert.deepEqual(errors,[]);
});
