const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'), webapp=path.join(root,'src/main/webapp');
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XkAAAAASUVORK5CYII=','base64');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});});
after(async()=>{await browser?.close();});

async function scenario(t,{home=false,profile=false,privateChat=false,width=1100}={}){
  const context=await browser.newContext({viewport:{width,height:800}}); t.after(()=>context.close());
  await context.addInitScript(()=>{
    sessionStorage.setItem('announcement-login:/test','test-login-token');
    localStorage.setItem('chat-alerts:/test:test-login-token:muted','true');
  });
  const page=await context.newPage(), errors=[], posts=[];
  const profiles=new Map([
    [9,{id:9,name:'朋友',avatar:'/avatar/9.png',signature:'第一行\n<b>纯文本 & 😀</b>',relationship:'friends'}],
    [11,{id:11,name:'很长的昵称'.repeat(10),avatar:'/missing.png',signature:'',relationship:'none'}],
    [12,{id:12,name:'新朋友',avatar:'',signature:'你好',relationship:'incoming'}]
  ]);
  const state={failProfile:false,failSend:false,friends:[{id:9,name:'朋友',avatar:'/avatar/9.png',unread:2}]};
  page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket('**/chatSocket/*',()=>{});
  await context.route('**/*',async route=>{
    const req=route.request(), url=new URL(req.url()), name=url.pathname;
    if(name.endsWith('.jsp')){
      const file=profile?'browser-profile.html':home?'browser-message-board.html':privateChat?'browser-private-chat.html':'browser-chat.html';
      return route.fulfill({contentType:'text/html; charset=utf-8',body:fs.readFileSync(path.join(root,'target',file))});
    }
    if(name.includes('/js/')||name.includes('/css/')){
      const asset=name.slice('/test/'.length);
      return route.fulfill({contentType:asset.endsWith('.json')?'application/json':asset.endsWith('.js')?'application/javascript':'text/css',body:fs.readFileSync(path.join(webapp,asset))});
    }
    if(name.endsWith('/user-profile')) return route.fulfill(state.failProfile?{status:503}:{json:profiles.get(Number(url.searchParams.get('userId')))});
    if(name.endsWith('/AddFriendServlet')){
      posts.push({body:req.postData(),token:req.headers()['x-csrf-token']});
      profiles.get(Number(new URLSearchParams(req.postData()).get('friendId'))).relationship='pending';
      return route.fulfill({body:'success'});
    }
    if(name.endsWith('/chat-state')) return route.fulfill({json:{groupUnread:0,friends:state.friends,loginCursor:1,latestIncoming:1}});
    if(name.endsWith('/friend-requests')) return route.fulfill({json:{pending:0}});
    if(name.endsWith('/announcements')||name.endsWith('/online-users')) return route.fulfill({json:[]});
    if(name.endsWith('/GetMessagesServlet'))return route.fulfill({json:url.searchParams.has('after')?[]:[
      {id:1,senderId:privateChat?9:11,senderName:'朋友',avatar:'/avatar/9.png',chatWith:privateChat?7:-1,content:'消息',time:'2026-10-13 16:00:00'}
    ],headers:{'X-Has-More':'false'}});
    if(name.endsWith('/ChatServlet')){
      posts.push({body:req.postData()});
      return route.fulfill(state.failSend?{status:503}:{status:201,json:{id:2,senderId:7,chatWith:privateChat?9:-1,content:'',image:'/sent.png'}});
    }
    if(name==='/missing.png')return route.fulfill({status:404});
    return route.fulfill({contentType:'image/png',body:pixel});
  });
  await page.goto('https://chat.test/test/'+(profile?'profile.jsp':home?'home.jsp':privateChat?'chat.jsp?chatWith=9':'chat.jsp'),{waitUntil:'networkidle'});
  return {page,errors,posts,profiles,state};
}
async function loaded(page){await page.waitForFunction(()=>!document.getElementById('friendStatus').textContent.includes('正在'));}

test('board avatars open literal profiles; friend, incoming and pending states prevent duplicate requests',async t=>{
  const p=await scenario(t,{home:true});
  assert.equal(await p.page.locator('.message-item [data-avatar]').count(),3);
  assert.equal(await p.page.locator('.message-item [data-profile-id="9"] img').getAttribute('src'),'/avatar/b.png');
  await p.page.locator('.message-item [data-profile-id="9"]').click(); await loaded(p.page);
  assert.equal(await p.page.locator('#friendSignature').textContent(),'第一行\n<b>纯文本 & 😀</b>');
  assert.equal(await p.page.locator('#friendSignature b').count(),0);
  assert.equal(await p.page.locator('#sendFriendRequest').isDisabled(),true);
  assert.equal(await p.page.locator('#friendChat').isVisible(),true);
  await p.page.locator('#friendClose').click();
  await p.page.locator('.message-item [data-profile-id="12"]').click(); await loaded(p.page);
  assert.equal(await p.page.locator('#viewFriendRequest').isVisible(),true);
  assert.equal(await p.page.locator('#sendFriendRequest').isDisabled(),true);
  await p.page.keyboard.press('Escape');
  await p.page.locator('.message-item [data-profile-id="11"]').click(); await loaded(p.page);
  assert.match(await p.page.locator('#friendSignature').textContent(),/还没有填写/);
  await p.page.waitForFunction(()=>document.getElementById('friendAvatar').src.endsWith('/test/images/taffy1.jpg'));
  await p.page.locator('#sendFriendRequest').click();
  await p.page.waitForFunction(()=>document.getElementById('sendFriendRequest').textContent==='申请已发送');
  assert.deepEqual(p.posts,[{body:'friendId=11',token:'test-login-token'}]);
  await p.page.locator('#friendClose').click();
  await p.page.locator('.message-item [data-profile-id="11"]').click(); await loaded(p.page);
  assert.equal(await p.page.locator('#sendFriendRequest').isDisabled(),true);
  assert.equal(await p.page.locator('#profileRetry').isHidden(),true);
  for(const width of [1100,390,320]){
    await p.page.setViewportSize({width,height:800});
    const box=await p.page.locator('#friendDialog').boundingBox();
    assert.ok(box.x>=0 && box.x+box.width<=width+1);
    assert.equal(await p.page.locator('#friendDialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);
    await p.page.screenshot({path:path.join(root,'target/profile-card-'+width+'.png')});
  }
  assert.deepEqual(p.errors,[]);
});

test('sidebar polling updates avatars, preserves rows and unread counts, removes deleted friends',async t=>{
  const p=await scenario(t);
  const friend=p.page.locator('#friendList .friend-row');
  assert.equal(await friend.count(),1);
  assert.equal(await friend.locator('img').getAttribute('src'),'/avatar/9.png');
  assert.equal(await friend.locator('[data-unread]').textContent(),'2');
  await friend.locator('button').click(); await loaded(p.page);
  assert.equal(await p.page.locator('#friendName').textContent(),'朋友');
  await p.page.locator('#friendClose').click();
  p.state.friends[0].avatar='/avatar/updated.png'; p.state.friends[0].name='新昵称';
  await p.page.evaluate(()=>ChatSidebar.refresh());
  await p.page.waitForFunction(()=>document.querySelector('#friendList img').getAttribute('src')==='/avatar/updated.png');
  assert.equal(await friend.count(),1); assert.equal(await friend.locator('a > span').first().textContent(),'新昵称');
  await friend.locator('a').click(); await p.page.waitForURL('**/chat.jsp?chatWith=9');
  p.state.friends=[]; await p.page.evaluate(()=>ChatSidebar.refresh());
  await p.page.waitForFunction(()=>document.querySelectorAll('#friendList .friend-row').length===0);
  assert.deepEqual(p.errors,[]);
});

test('both group and private message avatars open profile cards',async t=>{
  for(const privateChat of [false,true]){
    const p=await scenario(t,{privateChat});
    await p.page.locator('.message .avatar-button').click(); await loaded(p.page);
    assert.equal(await p.page.locator('#friendName').textContent(),p.profiles.get(privateChat?9:11).name);
    assert.equal(await p.page.locator('#sendFriendRequest').isDisabled(),privateChat);
    assert.deepEqual(p.errors,[]);
  }
});

test('profile load failures retry and a late response cannot replace a newly selected user',async t=>{
  const p=await scenario(t,{home:true}); p.state.failProfile=true;
  await p.page.locator('.message-item [data-profile-id="11"]').click(); await loaded(p.page);
  assert.equal(await p.page.locator('#profileRetry').isVisible(),true);
  assert.equal(await p.page.locator('#sendFriendRequest').isDisabled(),true);
  p.state.failProfile=false; await p.page.locator('#profileRetry').click(); await loaded(p.page);
  assert.equal(await p.page.locator('#sendFriendRequest').isDisabled(),false);
  await p.page.locator('#friendClose').click();
  let release, seen;
  const requested=new Promise(resolve=>seen=resolve), held=new Promise(resolve=>release=resolve);
  await p.page.route('**/user-profile?userId=9',async route=>{seen();await held;await route.fulfill({json:p.profiles.get(9)}).catch(()=>{});});
  await p.page.evaluate(()=>UserProfiles.open(9)); await requested;
  await p.page.evaluate(()=>UserProfiles.open(12)); await loaded(p.page);
  release(); await p.page.waitForTimeout(100);
  assert.equal(await p.page.locator('#friendName').textContent(),'新朋友');
  assert.equal(await p.page.locator('#viewFriendRequest').isVisible(),true);
  await p.page.keyboard.press('Escape'); assert.equal(await p.page.locator('#friendDialog').isVisible(),false);
  assert.deepEqual(p.errors,[]);
});

test('custom image picker opens chooser, wraps long filenames, removes and resets after send without navigation',async t=>{
  const p=await scenario(t), page=p.page;
  const payload={name:'很长的图片名称'.repeat(18)+'.png',mimeType:'image/png',buffer:pixel};
  const choosing=page.waitForEvent('filechooser'); await page.locator('#attachImage').click();
  await (await choosing).setFiles(payload);
  assert.equal(await page.locator('#chatAttachmentName').textContent(),payload.name);
  assert.equal(await page.locator('#chatImage').isHidden(),true);
  for(const width of [1100,390,320]){
    await page.setViewportSize({width,height:800});
    const button=await page.locator('#attachImage').boundingBox(), emoji=await page.locator('#emojiButton').boundingBox();
    assert.equal(button.width,40); assert.equal(button.height,emoji.height);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(root,'target/chat-attachment-'+width+'.png')});
  }
  await page.locator('#clearChatImage').click();
  assert.equal(await page.locator('#chatAttachment').isHidden(),true);
  assert.equal(await page.locator('#chatImage').evaluate(el=>el.files.length),0);
  await page.locator('#chatImage').setInputFiles(payload); p.state.failSend=true;
  await page.locator('#sendButton').click(); await page.waitForFunction(()=>!document.getElementById('sendStatus').hidden);
  assert.equal(await page.locator('#chatImage').evaluate(el=>el.files.length),1);
  assert.equal(await page.locator('#chatAttachment').isVisible(),true);
  p.state.failSend=false; await page.evaluate(()=>window.sameDocument=true);
  await page.locator('#sendButton').click();
  await page.waitForFunction(()=>document.getElementById('chatAttachment').hidden);
  assert.equal(await page.evaluate(()=>window.sameDocument),true);
  assert.equal(await page.locator('#chatImage').evaluate(el=>el.files.length),0);
  assert.match(p.posts.at(-1).body,/name="image"/);
  assert.deepEqual(p.errors,[]);
});

test('personal settings signature is optional, escaped and included in the save form',async t=>{
  const p=await scenario(t,{profile:true,width:390});
  const field=p.page.locator('#profileSignature');
  assert.equal(await field.inputValue(),'第一行\n</textarea><b>纯文本 & 😀</b>');
  assert.equal(await field.getAttribute('maxlength'),'200');
  assert.equal(await field.getAttribute('required'),null);
  await field.fill('');
  assert.equal(await p.page.locator('.profile form').evaluate(form=>new FormData(form).get('signature')),'');
  assert.equal(await p.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.page.screenshot({path:path.join(root,'target/profile-settings-mobile.png')});
  assert.deepEqual(p.errors,[]);
});
