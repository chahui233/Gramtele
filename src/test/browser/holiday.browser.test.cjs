const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),webapp=path.join(root,'src/main/webapp');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});});
after(async()=>{await browser?.close();});
async function setup(t,{time='2026-10-13T12:00:00+08:00',fail=false}={}){
  const context=await browser.newContext({viewport:{width:1100,height:800},timezoneId:'America/Los_Angeles'});
  t.after(()=>context.close());
  const page=await context.newPage(),errors=[];
  let latestIncoming=10;
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date(time)});
  await page.clock.pauseAt(new Date(time));
  await page.route('**/*',async route=>{
    const name=new URL(route.request().url()).pathname;
    if(name.endsWith('/home.jsp'))return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(root,'target/browser-home.html'))});
    if(name.endsWith('/holidays.json')&&fail)return route.fulfill({status:503});
    if(name.endsWith('/sound/info.m4a'))return route.fulfill({contentType:'audio/mp4',body:fs.readFileSync(path.join(webapp,'sound/info.m4a'))});
    if(name.includes('/js/')||name.includes('/css/')){
      const asset=name.slice('/test/'.length);
      return route.fulfill({contentType:asset.endsWith('.json')?'application/json':asset.endsWith('.js')?'application/javascript':'text/css',body:fs.readFileSync(path.join(webapp,asset))});
    }
    if(name.endsWith('/chat-state'))return route.fulfill({json:{latestIncoming,loginCursor:10}});
    if(name.endsWith('/announcements'))return route.fulfill({json:[]});
    return route.fulfill({body:''});
  });
  await page.goto('https://chat.test/test/home.jsp');
  await page.locator('#announcementClose').click();
  return {page,errors,recover(){fail=false;},incoming(id){latestIncoming=id;}};
}
test('home countdown uses Beijing time abroad and replaces the old clearing notice',async t=>{
  const p=await setup(t);
  await p.page.waitForFunction(()=>document.getElementById('holidayLabel').textContent==='距离元旦还有');
  assert.equal(await p.page.getByText('距离聊天记录清空还有',{exact:false}).count(),0);
  assert.deepEqual(await p.page.locator('[data-countdown-unit]').allTextContents(),['79','12','00','00']);
  await p.page.screenshot({path:path.join(root,'target/home-holiday-countdown.png')});
  assert.deepEqual(p.errors,[]);
});
test('holiday period ends without reloading and automatically selects the next festival',async t=>{
  const p=await setup(t,{time:'2027-01-01T23:59:59+08:00'});
  await p.page.waitForFunction(()=>document.getElementById('holidayLabel').textContent.includes('元旦期间'));
  await p.page.clock.runFor(1100);
  assert.equal(await p.page.locator('#holidayLabel').textContent(),'距离春节还有');
  assert.deepEqual(p.errors,[]);
});
test('calendar download failure offers a working retry instead of a stale countdown',async t=>{
  const p=await setup(t,{fail:true});
  await p.page.waitForSelector('#holidayRetry:visible');
  assert.match(await p.page.locator('#holidayLabel').textContent(),/加载失败/);
  p.recover();await p.page.locator('#holidayRetry').click();
  await p.page.waitForFunction(()=>document.getElementById('holidayLabel').textContent==='距离元旦还有');
  assert.deepEqual(p.errors,[]);
});

test('home page keeps checking arrivals and flashes its title without opening a chat',async t=>{
  const p=await setup(t);
  await p.page.clock.runFor(1);
  await p.page.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  p.incoming(11);
  await p.page.clock.runFor(5001);
  await p.page.waitForFunction(()=>document.title.includes('收到新消息'));
  assert.equal(await p.page.evaluate(()=>window.ChatSidebar===undefined),true);
  assert.deepEqual(p.errors,[]);
});
