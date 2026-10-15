const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'), webapp=path.join(root,'src/main/webapp');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});});
after(async()=>{await browser?.close();});

async function scenario(t,width=1100){
  const context=await browser.newContext({viewport:{width,height:900}});
  t.after(()=>context.close());
  const page=await context.newPage(), errors=[], posts=[];
  await context.addInitScript(()=>{
    sessionStorage.setItem('announcement-login:/test','test-login-token');
    localStorage.setItem('chat-alerts:/test:test-login-token:muted','true');
  });
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const name=new URL(route.request().url()).pathname;
    if(name.endsWith('/home.jsp'))return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(root,'target/browser-message-board.html'))});
    if(name.endsWith('/postMessage')){
      posts.push(new URLSearchParams(route.request().postData()).get('content'));
      return route.fulfill({status:303,headers:{Location:'/test/home.jsp'}});
    }
    if(name.includes('/js/')||name.includes('/css/')){
      const asset=name.slice('/test/'.length);
      return route.fulfill({contentType:asset.endsWith('.json')?'application/json':asset.endsWith('.js')?'application/javascript':'text/css',body:fs.readFileSync(path.join(webapp,asset))});
    }
    if(name.endsWith('/chat-state'))return route.fulfill({json:{latestIncoming:10,loginCursor:10}});
    if(name.endsWith('/announcements'))return route.fulfill({json:[]});
    return route.fulfill({body:''});
  });
  await page.goto('https://chat.test/test/home.jsp',{waitUntil:'networkidle'});
  return {page,errors,posts};
}

test('blank and invisible-only posts stay on the page and editing to visible content permits submission',async t=>{
  const p=await scenario(t), input=p.page.locator('#postContent');
  for(const content of ['', ' \n\t', '\u00a0\u3000', '\u200b\u200d\ufeff', '\ufe0f\u034f\u{E0100}', '\u3164']){
    await input.fill(content);
    await p.page.locator('#postForm input[type=submit]').click();
    assert.equal(p.posts.length,0);
    assert.match(await p.page.locator('#postContentError').textContent(),/不能为空/);
    assert.equal(await p.page.locator('#postContentError').isVisible(),true);
    assert.equal(await input.getAttribute('aria-invalid'),'true');
  }
  const visible='  保留缩进\n第二行 👩🏽‍💻  ';
  await input.fill(visible);
  assert.equal(await p.page.locator('#postContentError').isHidden(),true);
  assert.equal(await input.evaluate(el=>el.checkValidity()),true);
  await Promise.all([p.page.waitForRequest(r=>r.url().endsWith('/postMessage')),p.page.locator('#postForm input[type=submit]').click()]);
  assert.deepEqual(p.posts,[visible.replace(/\n/g,'\r\n')]);
  assert.deepEqual(p.errors,[]);
});

test('long links, unbroken words, names and timestamps remain inside stacked cards on desktop and mobile',async t=>{
  const p=await scenario(t);
  for(const width of [1100,390,320]){
    await p.page.setViewportSize({width,height:900});
    const measurements=await p.page.locator('.message-item').evaluateAll(cards=>cards.map(card=>{
      const bounds=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
      const name=card.querySelector('.username'),text=card.querySelector('.message-content'),time=card.querySelector('.message-time');
      const range=document.createRange();range.selectNodeContents(text);
      return {card:bounds(card),name:bounds(name),text:bounds(text),time:bounds(time),lines:Array.from(range.getClientRects(),r=>({left:r.left,right:r.right})),
        overflow:card.scrollWidth>card.clientWidth,whitespace:getComputedStyle(text).whiteSpace};
    }));
    for(const m of measurements){
      assert.equal(m.overflow,false,JSON.stringify(m));
      for(const child of [m.name,m.text,m.time,...m.lines])assert.ok(child.left>=m.card.left && child.right<=m.card.right+1,JSON.stringify({width,m}));
      assert.ok(m.name.bottom<=m.text.top && m.text.bottom<=m.time.top,JSON.stringify({width,m}));
      assert.ok(m.card.right<=width && m.card.left>=0,JSON.stringify({width,m}));
      assert.equal(m.whitespace,'pre-wrap');
    }
    assert.equal(await p.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await p.page.locator('.message-item').first().hover();
    assert.equal(await p.page.locator('.message-item').first().evaluate(el=>getComputedStyle(el).transform),'none');
    await p.page.locator('.message-item').first().screenshot({path:path.join(root,'target/message-board-'+width+'.png')});
  }
  assert.equal(await p.page.locator('.message-content b').count(),0);
  assert.equal(await p.page.locator('.message-content').last().textContent(),'<b>普通文本</b>\n下一行');
  assert.deepEqual(p.errors,[]);
});
