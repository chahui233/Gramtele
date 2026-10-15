const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'../../..');

test('background tabs accumulate unread without acknowledging history until visible',async t=>{
  const p=await scenario(t);
  const before=p.reads.length;
  await p.page.evaluate(()=>{
    window.testVisible=false;
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.testVisible?'visible':'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const message={id:15,senderId:9,chatWith:-1,content:'后台收到'};
  p.messages.push(message);
  p.sockets[0].send(JSON.stringify(message));
  await p.page.waitForFunction(()=>document.querySelector('[data-unread="-1"]').textContent==='1');
  await p.page.waitForResponse(r=>r.url().includes('GetMessagesServlet') && r.url().includes('after=12'));
  assert.equal(p.reads.length,before);
  await p.page.evaluate(()=>{window.testVisible=true; document.dispatchEvent(new Event('visibilitychange'));});
  await p.page.waitForFunction(()=>document.querySelector('[data-unread="-1"]').hidden);
  assert.ok(p.reads.some(r=>r.chat===-1 && r.through===15));
  assert.deepEqual(p.errors,[]);
});
const webapp = path.join(root,'src/main/webapp');
const catalogue = JSON.parse(fs.readFileSync(path.join(webapp,'js/emoji-data.json'),'utf8'));
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XkAAAAASUVORK5CYII=','base64');
let browser, supportedEntries;
before(async () => {
  browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
  const page=await browser.newPage();
  await page.addScriptTag({path:path.join(webapp,'js/emoji-support.js')});
  supportedEntries=await page.evaluate(entries=>EmojiSupport.filter(entries),catalogue.entries);
  await page.close();
});
after(async () => { await browser?.close(); });

async function scenario(t, {width=1100, height=720, notifications=false, mockAudio=false}={}) {
  const context = await browser.newContext({viewport:{width,height}});
  t.after(() => context.close());
  const page = await context.newPage();
  if(mockAudio) await context.addInitScript(()=>{
    window.soundStarts=0; window.soundResumes=0;
    class MockAudioContext {
      constructor(){this.state='suspended';this.destination={};}
      async resume(){window.soundResumes++;this.state='running';}
      async decodeAudioData(){return {duration:1};}
      createBufferSource(){return {connect(){},start(){window.soundStarts++;},stop(){}};}
    }
    window.AudioContext=MockAudioContext;
  });
  const errors=[], sockets=[], posts=[], reads=[];
  const messages = Array.from({length:12},(_,i) => ({
    id:i+1, senderId:i===7 ? 11 : (i%2 ? 7 : 9), chatWith:-1, senderName:i===7 ? '<script>陌生人</script>' : '朋友',
    content:'消息 '+(i+1), time:'2026-10-12 14:00:00'
  }));
  messages.push({id:13,senderId:9,chatWith:7,content:'私聊1'}, {id:14,senderId:9,chatWith:7,content:'私聊2'});
  const cursors = new Map([[-1,10],[9,10]]);
  const friends = new Map([[9,'朋友']]);
  const requests = [
    {id:2,senderId:11,name:'<img src=x onerror=alert(1)>',time:'2026-10-12 14:00:00',status:'pending'},
    {id:1,senderId:9,name:'朋友',time:'2026-10-12 13:00:00',status:'pending'}
  ];
  let failRequest=false, failInbox=false, failHistory=false, failEmoji=false, emojiLoads=0;
  const count = chat => messages.filter(m => m.id>(cursors.get(chat)??10) && m.senderId!==7 &&
    (chat===-1 ? m.chatWith===-1 : m.senderId===chat && m.chatWith===7)).length;
  page.on('pageerror',error=>errors.push(error.message));
  await page.routeWebSocket('**/chatSocket/*',socket=>sockets.push(socket));
  await context.route('**/*', async route => {
    const req=route.request(), url=new URL(req.url()), name=url.pathname;
    if (name.endsWith('/chat.jsp') || name.endsWith('/notifications.jsp')) {
      const fixture = name.endsWith('/notifications.jsp') ? 'browser-notifications.html' :
        url.searchParams.get('chatWith')==='9' ? 'browser-private-chat.html' : 'browser-chat.html';
      return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(root,'target',fixture))});
    }
    if (name.endsWith('/home.jsp')) return route.fulfill({contentType:'text/html',body:'<h1>Home</h1>'});
    if (name.endsWith('/sound/info.m4a')) return route.fulfill({contentType:'audio/mp4',body:fs.readFileSync(path.join(webapp,'sound/info.m4a'))});
    if (name.includes('/js/') || name.includes('/css/')) {
      const asset=name.slice('/test/'.length);
      if (asset==='js/emoji-data.json') {
        emojiLoads++;
        if (failEmoji) return route.fulfill({status:503});
      }
      return route.fulfill({contentType:asset.endsWith('.js')?'application/javascript':asset.endsWith('.json')?'application/json':'text/css',body:fs.readFileSync(path.join(webapp,asset))});
    }
    if (name.endsWith('/online-users')) return route.fulfill({json:[]});
    if (name.endsWith('/GetMessagesServlet')) {
      if (failHistory) return route.fulfill({status:503});
      const chat=Number(url.searchParams.get('chatWith'));
      const after=Number(url.searchParams.get('after')||0);
      const rows=messages.filter(m=>m.id>after && (chat===-1 ? m.chatWith===-1 : (m.senderId===chat && m.chatWith===7)||(m.senderId===7 && m.chatWith===chat)));
      return route.fulfill({json:rows,headers:{'X-Has-More':'false'}});
    }
    if (name.endsWith('/chat-state')) {
      if (req.method()==='POST') {
        const data=new URLSearchParams(req.postData());
        const chat=Number(data.get('chatWith')), through=Number(data.get('through'));
        reads.push({chat,through,token:req.headers()['x-csrf-token']});
        cursors.set(chat, Math.max(cursors.get(chat)??10,through));
      }
      const incoming=messages.filter(m=>m.senderId!==7 && (m.chatWith===-1 || m.chatWith===7 && friends.has(m.senderId)));
      return route.fulfill({json:{groupUnread:count(-1),friends:[...friends].map(([id,name])=>({id,name,avatar:'/avatar/'+id+'.png',unread:count(id)})),
        loginCursor:10,latestIncoming:Math.max(10,...incoming.map(m=>m.id))}});
    }
    if (name.endsWith('/user-profile')) {
      const id=Number(url.searchParams.get('userId'));
      return route.fulfill({json:{id,name:id===11?'<script>陌生人</script>':'朋友',avatar:'/avatar/'+id+'.png',
        signature:'你好\n个性签名',relationship:friends.has(id)?'friends':'none'}});
    }
    if (name.endsWith('/AddFriendServlet')) {
      posts.push({body:req.postData(),token:req.headers()['x-csrf-token']});
      return route.fulfill({status:failRequest?503:200,contentType:'text/plain',body:'success'});
    }
    if (name.endsWith('/friend-requests')) {
      if (url.searchParams.get('view')==='count') return route.fulfill({json:{pending:requests.filter(r=>r.status==='pending').length}});
      if (req.method()==='POST') {
        posts.push({body:req.postData(),token:req.headers()['x-csrf-token']});
        if (failRequest) return route.fulfill({status:503});
        const data=new URLSearchParams(req.postData());
        const item=requests.find(r=>r.id===Number(data.get('requestId')));
        item.status=data.get('action')==='accept'?'accepted':'rejected';
        if(item.status==='accepted') friends.set(item.senderId,item.name);
        return route.fulfill({json:{status:item.status}});
      }
      if(failInbox) return route.fulfill({status:503});
      const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);
      return route.fulfill({json:requests.filter(r=>r.id<before).slice(0,50)});
    }
    if (name.endsWith('/ChatServlet')) {
      posts.push({body:req.postData()});
      const m={id:Math.max(...messages.map(m=>m.id))+1,senderId:7,chatWith:-1,content:'😀'};
      messages.push(m);
      return route.fulfill({status:201,json:m});
    }
    return route.fulfill({contentType:'image/png',body:pixel});
  });
  await page.goto('https://chat.test/test/'+(notifications?'notifications.jsp':'chat.jsp'),{waitUntil:'networkidle'});
  return {page,errors,posts,reads,sockets,messages,cursors,requests,
    failEmoji(value){failEmoji=value;},emojiLoads(){return emojiLoads;},
    failRequests(value){failRequest=value;},failInbox(value){failInbox=value;},failHistory(value){failHistory=value;}};
}

test('group avatar sends only a request with CSRF token; own avatar is not actionable and failures retry',async t=>{
  const p=await scenario(t);
  assert.equal(await p.page.locator('[data-message-id="2"] .avatar-button').count(),0);
  await p.page.locator('[data-message-id="8"] .avatar-button').click();
  await p.page.waitForFunction(()=>!document.getElementById('sendFriendRequest').disabled);
  assert.equal(await p.page.locator('#friendName').textContent(),'<script>陌生人</script>');
  assert.equal(await p.page.locator('#friendName script').count(),0);
  p.failRequests(true);
  await p.page.locator('#sendFriendRequest').click();
  await p.page.waitForFunction(()=>!document.getElementById('sendFriendRequest').disabled);
  assert.match(await p.page.locator('#friendStatus').textContent(),/失败/);
  p.failRequests(false);
  await p.page.locator('#sendFriendRequest').click();
  await p.page.waitForFunction(()=>document.getElementById('friendStatus').textContent.includes('等待对方同意'));
  assert.equal(p.posts.length,2);
  assert.equal(p.posts[1].body,'friendId=11');
  assert.equal(p.posts[1].token,'test-login-token');
  assert.equal(await p.page.locator('#friendList [data-conversation="11"]').count(),0);
  await p.page.screenshot({path:path.join(root,'target/social-friend-dialog.png')});
  assert.deepEqual(p.errors,[]);
});

test('notification entry is above friends; accepting updates the list, rejecting does not; names are literal',async t=>{
  const p=await scenario(t);
  const nav=await p.page.locator('.notification-link').boundingBox();
  const friends=await p.page.locator('.sidebar h4').boundingBox();
  assert.ok(nav.y<friends.y);
  assert.equal(await p.page.locator('#notificationBadge').textContent(),'2');
  await p.page.locator('.notification-link').click();
  await p.page.waitForSelector('[data-request-id="2"]');
  assert.equal(await p.page.locator('.request-details h2').first().textContent(),'<img src=x onerror=alert(1)>');
  assert.equal(await p.page.locator('.request-details h2 img').count(),0);
  p.failRequests(true);
  await p.page.locator('[data-request-id="2"]').getByRole('button',{name:'同意',exact:true}).click();
  await p.page.waitForFunction(()=>document.getElementById('notificationStatus').textContent.includes('失败'));
  assert.equal(await p.page.locator('[data-request-id="2"] button:disabled').count(),0);
  p.failRequests(false);
  await p.page.locator('[data-request-id="2"]').getByRole('button',{name:'同意',exact:true}).click();
  await p.page.waitForSelector('#friendList [data-conversation="11"]');
  assert.match(await p.page.locator('[data-request-id="2"]').textContent(),/已同意/);
  await p.page.locator('[data-request-id="1"]').getByRole('button',{name:'拒绝',exact:true}).click();
  await p.page.waitForFunction(()=>document.getElementById('notificationBadge').hidden);
  assert.match(await p.page.locator('[data-request-id="1"]').textContent(),/已拒绝/);
  assert.equal(p.posts.at(-1).token,'test-login-token');
  await p.page.screenshot({path:path.join(root,'target/social-notifications.png')});
  assert.deepEqual(p.errors,[]);
});

test('emoji replaces the selection, respects maxlength, supports Escape, and sends without navigating',async t=>{
  const p=await scenario(t);
  const input=p.page.locator('#chatInput');
  const send=p.page.locator('#sendButton');
  const emoji=p.page.locator('#emojiButton');
  assert.ok((await emoji.boundingBox()).x < (await send.boundingBox()).x);
  await input.fill('你好朋友');
  await input.evaluate(el=>el.setSelectionRange(2,4));
  await emoji.click();
  await p.page.getByRole('button',{name:'笑脸',exact:true}).click();
  assert.equal(await input.inputValue(),'你好😀');
  assert.equal(await input.evaluate(el=>el.selectionStart),4);
  assert.equal(await input.evaluate(el=>document.activeElement===el),true);
  assert.equal(p.posts.length,0,'opening/inserting does not submit');
  await input.fill('x'.repeat(3999));
  await input.evaluate(el=>el.setSelectionRange(3999,3999));
  await emoji.click();
  await p.page.getByRole('button',{name:'笑脸',exact:true}).click();
  assert.equal((await input.inputValue()).length,3999);
  assert.match(await p.page.locator('#emojiStatus').textContent(),/长度上限/);
  await p.page.keyboard.press('Escape');
  assert.equal(await p.page.locator('#emojiPicker').isHidden(),true);
  await input.fill('😀');
  await p.page.evaluate(()=>window.originalPage=true);
  await send.click();
  await p.page.waitForFunction(()=>document.getElementById('chatInput').value==='');
  assert.equal(await p.page.evaluate(()=>window.originalPage),true);
  assert.deepEqual(p.errors,[]);
});

test('private unread survives reload and duplicate push, clears on entering its chat; own sends never count',async t=>{
  const p=await scenario(t);
  assert.equal(await p.page.locator('[data-unread="-1"]').isHidden(),true);
  assert.equal(await p.page.locator('[data-unread="9"]').textContent(),'2');
  assert.equal(await p.page.locator('[data-unread="9"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(198, 40, 40)');
  const incoming={id:15,senderId:9,chatWith:7,content:'新私聊'};
  p.messages.push(incoming);
  p.sockets[0].send(JSON.stringify(incoming)); p.sockets[0].send(JSON.stringify(incoming));
  await p.page.waitForFunction(()=>document.querySelector('[data-unread="9"]').textContent==='3');
  p.messages.push({id:16,senderId:7,chatWith:9,content:'自己的消息'});
  await p.page.reload({waitUntil:'networkidle'});
  assert.equal(await p.page.locator('[data-unread="9"]').textContent(),'3');
  assert.ok(p.reads.every(r=>r.chat===-1 && r.token==='test-login-token'));
  await p.page.locator('[data-conversation="9"]').click();
  await p.page.waitForFunction(()=>document.querySelector('[data-unread="9"]')?.hidden);
  assert.ok(p.reads.some(r=>r.chat===9 && r.through===16));
  const group={id:17,senderId:11,chatWith:-1,content:'新的群消息'};
  p.messages.push(group); p.sockets.at(-1).send(JSON.stringify(group));
  await p.page.waitForFunction(()=>document.querySelector('[data-unread="-1"]').textContent==='1');
  assert.equal(await p.page.locator('[data-message-id="17"]').count(),0);
  assert.deepEqual(p.errors,[]);
});

test('failed history does not clear unread; notifications poll and paginate more than 50 requests',async t=>{
  const p=await scenario(t,{notifications:true});
  p.failHistory(true);
  const readsBefore=p.reads.length;
  await p.page.locator('[data-conversation="9"]').click();
  await p.page.waitForSelector('#historyStatus:not([hidden])');
  assert.equal(p.reads.length,readsBefore);
  assert.equal(await p.page.locator('[data-unread="9"]').textContent(),'2');
  await p.page.locator('.notification-link').click();
  await p.page.waitForSelector('[data-request-id="2"]');
  for(let id=3;id<=53;id++) p.requests.unshift({id,senderId:9,name:'申请'+id,time:'2026-10-12',status:'pending'});
  await p.page.locator('#refreshNotifications').click();
  await p.page.waitForSelector('[data-request-id="53"]');
  await p.page.locator('#olderNotifications').click();
  await p.page.waitForSelector('[data-request-id="3"]');
  assert.equal(await p.page.locator('.request-card').count(),53);
  await Promise.all([p.page.waitForResponse(r=>r.url().endsWith('/friend-requests')),
    p.page.locator('#refreshNotifications').click()]);
  assert.equal(await p.page.locator('.request-card').count(),53);
  assert.deepEqual(p.errors,[]);
});

test('emoji pages expose every supported glyph and the final choice inserts at the saved selection',async t=>{
  const p=await scenario(t);
  const input=p.page.locator('#chatInput');
  await input.fill('你好朋友');
  await input.evaluate(el=>el.setSelectionRange(2,4));
  await p.page.locator('#emojiButton').click();
  await p.page.waitForSelector('#emojiGrid button');
  const first=await p.page.locator('#emojiGrid button').allTextContents();
  assert.equal(first.length,24);
  assert.equal(await p.page.locator('#emojiPrev').isDisabled(),true);
  await p.page.locator('#emojiNext').click();
  assert.equal(await p.page.locator('#emojiPage').textContent(),'2 / '+Math.ceil(supportedEntries.length/24)+' 页');
  await p.page.locator('#emojiPrev').click();
  assert.deepEqual(await p.page.locator('#emojiGrid button').allTextContents(),first);
  const all=await p.page.evaluate(()=>{
    const entries=[];
    do {
      entries.push(...Array.from(document.querySelectorAll('#emojiGrid button'),button=>button.textContent));
      if(document.getElementById('emojiNext').disabled) return entries;
      document.getElementById('emojiNext').click();
    } while(entries.length<5000);
    throw new Error('Pagination did not end');
  });
  assert.deepEqual(all,supportedEntries.map(item=>item.emoji));
  assert.equal(await p.page.locator('#emojiNext').isDisabled(),true);
  await p.page.locator('#emojiGrid button').last().click();
  assert.equal(await input.inputValue(),'你好'+supportedEntries.at(-1).emoji);
  await p.page.locator('#emojiButton').click();
  assert.equal(p.emojiLoads(),1,'catalogue is cached across opens');
  await p.page.keyboard.press('Escape');
  assert.equal(p.posts.length,0);
  assert.deepEqual(p.errors,[]);
});

test('emoji grid scrolls in a short viewport while page controls stay visible, including after resizing',async t=>{
  const p=await scenario(t,{width:390,height:280});
  await p.page.locator('#emojiButton').click();
  await p.page.waitForSelector('#emojiGrid button');
  const grid=p.page.locator('#emojiGrid');
  assert.ok(await grid.evaluate(el=>el.scrollHeight>el.clientHeight));
  const picker=await p.page.locator('#emojiPicker').boundingBox();
  assert.ok(picker.y>=0 && picker.y+picker.height<=280,JSON.stringify(picker));
  const chatTop=await p.page.locator('#chatBox').evaluate(el=>el.scrollTop);
  await grid.hover();
  await p.page.mouse.wheel(0,500);
  await p.page.waitForFunction(()=>document.getElementById('emojiGrid').scrollTop>0);
  assert.equal(await p.page.locator('#chatBox').evaluate(el=>el.scrollTop),chatTop);
  await p.page.locator('#emojiGrid button').last().click();
  assert.equal(await p.page.locator('#chatInput').inputValue(),supportedEntries[23].emoji);
  await p.page.locator('#emojiButton').click();
  await p.page.setViewportSize({width:390,height:240});
  await p.page.waitForFunction(()=>{
    const rect=document.getElementById('emojiPicker').getBoundingClientRect();
    return rect.top>=0 && rect.bottom<=innerHeight;
  });
  await p.page.locator('#emojiNext').click();
  const footer=await p.page.locator('.emoji-pagination').boundingBox();
  assert.ok(footer.y>=0 && footer.y+footer.height<=240,JSON.stringify(footer));
  await p.page.locator('#emojiGrid button').last().click();
  assert.equal(await p.page.locator('#chatInput').inputValue(),supportedEntries[23].emoji+supportedEntries[47].emoji);
  assert.equal(p.posts.length,0);
  assert.deepEqual(p.errors,[]);
});

test('emoji picker stays within a narrow viewport and notification page stays readable',async t=>{
  const p=await scenario(t,{width:390});
  await p.page.locator('#emojiButton').click();
  await p.page.waitForSelector('#emojiGrid button');
  const picker=await p.page.locator('#emojiPicker').boundingBox();
  assert.ok(picker.x>=0 && picker.x+picker.width<=390,JSON.stringify(picker));
  await p.page.screenshot({path:path.join(root,'target/social-mobile.png')});
  await p.page.keyboard.press('Escape');
  await p.page.locator('.notification-link').click();
  assert.equal(await p.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(p.errors,[]);
});

test('emoji search handles Chinese, English, skin tones, ZWJ and flags without submitting the draft',async t=>{
  const p=await scenario(t);
  assert.equal(p.emojiLoads(),0,'catalogue is lazy loaded');
  const input=p.page.locator('#chatInput'), search=p.page.locator('#emojiSearch');
  await input.fill('你好朋友');
  await input.evaluate(el=>el.setSelectionRange(2,4));
  await p.page.locator('#emojiButton').click();
  await p.page.waitForSelector('#emojiSearch:enabled');
  assert.equal(await p.page.locator('#emojiCategory option').count(),new Set(supportedEntries.map(item=>item.group)).size+1);
  await p.page.locator('#emojiCategory').selectOption('Flags');
  assert.equal(await p.page.locator('#emojiCount').textContent(),supportedEntries.filter(item=>item.group==='Flags').length+' 个表情');
  await search.fill('中国');
  assert.deepEqual(await p.page.locator('#emojiGrid button').allTextContents(),supportedEntries.filter(item=>item.group==='Flags' && item.keywords.includes('中国')).map(item=>item.emoji));
  await search.press('Enter');
  assert.equal(await input.inputValue(),'你好朋友');
  assert.equal(p.posts.length,0);
  await p.page.locator('#emojiCategory').selectOption('');
  await search.fill('WOMAN TECHNOLOGIST medium skin tone');
  const developer=catalogue.entries.find(item=>item.emoji==='👩🏽‍💻');
  await p.page.getByRole('button',{name:developer.name,exact:true}).click();
  assert.equal(await input.inputValue(),'你好👩🏽‍💻');
  assert.equal(await input.evaluate(el=>el.selectionStart),'你好👩🏽‍💻'.length);
  await p.page.locator('#emojiButton').click();
  await search.fill('不存在的表情关键词');
  assert.equal(await p.page.locator('#emojiGrid button').count(),0);
  assert.equal(await p.page.locator('#emojiNext').isDisabled(),true);
  assert.equal(await p.page.locator('#emojiPrev').isDisabled(),true);
  assert.match(await p.page.locator('#emojiStatus').textContent(),/没有找到/);
  await search.fill('🏁');
  await p.page.locator('#emojiGrid button').click();
  assert.equal(await input.inputValue(),'你好👩🏽‍💻🏁');
  assert.equal(p.posts.length,0);
  assert.deepEqual(p.errors,[]);
});

test('emoji detection hides missing glyphs and retains common emoji on desktop and touch layouts',async t=>{
  const p=await scenario(t,{width:390});
  await p.page.locator('#emojiButton').click();
  await p.page.waitForSelector('#emojiSearch:enabled');
  const result=await p.page.evaluate(()=>{
    const supported=EmojiSupport.create();
    return {smile:supported('😀'),heart:supported('❤️'),missing:supported('\u{10FFFF}'),unassigned:supported('\u0378')};
  });
  assert.deepEqual(result,{smile:true,heart:true,missing:false,unassigned:false});
  const missing=catalogue.entries.find(item=>!supportedEntries.some(valid=>valid.emoji===item.emoji));
  if(missing){
    await p.page.locator('#emojiSearch').fill(missing.emoji);
    assert.equal(await p.page.locator('#emojiGrid button').filter({hasText:missing.emoji}).count(),0);
  }
  await p.page.locator('#emojiSearch').fill('');
  await p.page.screenshot({path:path.join(root,'target/emoji-supported-mobile.png')});
  assert.deepEqual(p.errors,[]);
});

test('new group and private messages play the supplied sound once, flash the title, and restore on focus',async t=>{
  const p=await scenario(t,{mockAudio:true});
  const original=await p.page.title();
  await p.page.locator('#messageSound').click();
  await p.page.waitForFunction(()=>document.getElementById('messageSound').getAttribute('aria-pressed')==='true');
  assert.equal(await p.page.evaluate(()=>window.soundStarts),0,'enabling never plays stale history');
  await p.page.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const incoming={id:15,senderId:9,chatWith:-1,content:'新群聊'};
  p.messages.push(incoming); p.sockets[0].send(JSON.stringify(incoming)); p.sockets[0].send(JSON.stringify(incoming));
  await p.page.waitForFunction(()=>window.soundStarts===1);
  await p.page.waitForFunction(()=>document.title.includes('收到新消息'));
  await p.page.evaluate(()=>ChatSidebar.refresh());
  await p.page.waitForResponse(r=>r.url().endsWith('/chat-state'));
  assert.equal(await p.page.evaluate(()=>window.soundStarts),1,'poll does not replay the push');
  await p.page.waitForFunction(title=>document.title===title,original);
  await p.page.waitForFunction(()=>document.title.includes('收到新消息'));
  await p.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal(await p.page.title(),original);
  const privateMessage={id:16,senderId:9,chatWith:7,content:'新私聊'};
  p.messages.push(privateMessage);p.sockets[0].send(JSON.stringify(privateMessage));
  await p.page.waitForFunction(()=>window.soundStarts===2);
  p.sockets[0].send(JSON.stringify({id:17,senderId:7,chatWith:-1,content:'自己的消息'}));
  assert.equal(await p.page.evaluate(()=>window.soundStarts),2);
  await p.page.locator('#messageSound').click();
  const silent={id:18,senderId:9,chatWith:-1,content:'已静音'};
  p.messages.push(silent);p.sockets[0].send(JSON.stringify(silent));
  await p.page.waitForSelector('[data-message-id="18"]');
  assert.equal(await p.page.evaluate(()=>window.soundStarts),2);
  await p.page.reload({waitUntil:'networkidle'});
  assert.equal(await p.page.locator('#messageSound').textContent(),'提示音：关闭');
  assert.equal(await p.page.evaluate(()=>window.soundStarts),0);
  assert.deepEqual(p.errors,[]);
});

test('HTTP polling notices new messages even if another tab has read them, without alerting on old history',async t=>{
  const p=await scenario(t,{notifications:true,mockAudio:true});
  await p.page.locator('#messageSound').click();
  await p.page.waitForFunction(()=>document.getElementById('messageSound').getAttribute('aria-pressed')==='true');
  const incoming={id:15,senderId:9,chatWith:7,content:'HTTP私聊'};
  p.messages.push(incoming);p.cursors.set(9,15);
  await p.page.evaluate(()=>ChatSidebar.refresh());
  await p.page.waitForFunction(()=>window.soundStarts===1);
  await p.page.evaluate(()=>ChatSidebar.refresh());
  await p.page.waitForResponse(r=>r.url().endsWith('/chat-state'));
  assert.equal(await p.page.evaluate(()=>window.soundStarts),1);
  assert.deepEqual(p.errors,[]);
});

test('multiple tabs share one sound, including HTTP deployments without Web Locks',async t=>{
  for(const withoutLocks of [false,true]) await t.test(withoutLocks?'HTTP fallback':'Web Locks',async t=>{
    const p=await scenario(t,{notifications:true,mockAudio:true});
    const other=await p.page.context().newPage();
    await other.goto('https://chat.test/test/notifications.jsp',{waitUntil:'networkidle'});
    for(const page of [p.page,other]){
      if(withoutLocks) await page.evaluate(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));
      await page.locator('#messageSound').click();
      await page.waitForFunction(()=>document.getElementById('messageSound').getAttribute('aria-pressed')==='true');
    }
    p.messages.push({id:15,senderId:9,chatWith:7,content:'多标签页'});
    await Promise.all([p.page.evaluate(()=>ChatSidebar.refresh()),other.evaluate(()=>ChatSidebar.refresh())]);
    await p.page.waitForFunction(()=>localStorage.getItem('chat-alerts:/test:test-login-token:sound-id')==='15');
    // Let the second response and fallback election finish before counting.
    await Promise.all([p.page.waitForTimeout(250),other.waitForTimeout(250)]);
    assert.equal(await p.page.evaluate(()=>window.soundStarts)+await other.evaluate(()=>window.soundStarts),1);
    assert.deepEqual(p.errors,[]);
  });
});

test('the original M4A is copied intact and decoded by the real browser audio engine',async t=>{
  assert.deepEqual(fs.readFileSync(path.join(root,'sound/info.m4a')),fs.readFileSync(path.join(webapp,'sound/info.m4a')));
  const p=await scenario(t);
  await p.page.locator('#messageSound').click();
  await p.page.waitForFunction(()=>document.getElementById('messageSound').getAttribute('aria-pressed')==='true');
  assert.equal(await p.page.locator('#messageSoundStatus').textContent(),'');
  assert.deepEqual(p.errors,[]);
});

test('emoji load failures retry without losing the draft or sending a message',async t=>{
  const p=await scenario(t);
  await p.page.locator('#chatInput').fill('保留草稿');
  p.failEmoji(true);
  await p.page.locator('#emojiButton').click();
  await p.page.waitForSelector('#emojiRetry:visible');
  assert.match(await p.page.locator('#emojiStatus').textContent(),/加载失败/);
  assert.equal(await p.page.locator('#emojiSearch').isDisabled(),true);
  p.failEmoji(false);
  await p.page.locator('#emojiRetry').click();
  await p.page.getByRole('button',{name:'笑脸',exact:true}).click();
  assert.equal(await p.page.locator('#chatInput').inputValue(),'保留草稿😀');
  assert.equal(p.emojiLoads(),2);
  assert.equal(p.posts.length,0);
  assert.deepEqual(p.errors,[]);
});

test('home navigation sits in the chat header on desktop and mobile for group and private chats',async t=>{
  const p=await scenario(t);
  for(const width of [1100,390,320]) {
    await p.page.setViewportSize({width,height:720});
    for(const destination of ['chat.jsp','chat.jsp?chatWith=9','notifications.jsp']) {
      await p.page.goto('https://chat.test/test/'+destination,{waitUntil:'networkidle'});
      const home=p.page.getByRole('link',{name:'返回主页',exact:true});
      assert.equal(await home.count(),1);
      assert.equal(await p.page.locator('#chatSidebar a[href="home.jsp"]').count(),0);
      const heading=p.page.locator(destination==='notifications.jsp'?'.notifications-heading':'.chat-heading');
      assert.equal(await heading.getByRole('link',{name:'返回主页',exact:true}).count(),1);
      const box=await home.boundingBox(), bounds=await heading.boundingBox();
      assert.ok(box.x>=bounds.x && box.x+box.width<=width && box.y>=bounds.y,JSON.stringify({width,destination,box,bounds}));
      assert.equal(await p.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,destination+' '+width);
      assert.equal(await home.getAttribute('href'),'home.jsp');
      if(width!==320 && destination==='chat.jsp') await p.page.screenshot({path:path.join(root,'target/chat-header-'+width+'.png')});
    }
  }
  await p.page.getByRole('link',{name:'返回主页',exact:true}).click();
  await p.page.waitForURL('**/home.jsp');
  assert.deepEqual(p.errors,[]);
});
