const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../../..');

test('emoji catalogue contains every fully-qualified sequence and component from Unicode, once',()=>{
  const source=fs.readFileSync(path.join(root,'tools/emoji/emoji-test.txt'),'utf8');
  const expected=source.split(/\r?\n/).filter(line=>/;\s*(fully-qualified|component)\s*#/.test(line))
    .map(line=>String.fromCodePoint(...line.split(';')[0].trim().split(/\s+/).map(hex=>parseInt(hex,16))));
  const data=JSON.parse(fs.readFileSync(path.join(root,'src/main/webapp/js/emoji-data.json'),'utf8'));
  assert.deepEqual(data.entries.map(item=>item.emoji),expected);
  assert.equal(new Set(expected).size,expected.length);
  assert.equal(data.fullyQualified+data.components,expected.length);
  assert.equal(data.version,source.match(/^# Version: (.+)$/m)[1]);
  assert.ok(expected.length>3900);
  for(const emoji of ['👩🏽‍💻','👨‍👩‍👧‍👦','🏳️‍🌈','🇨🇳','1️⃣','🫩']) assert.ok(expected.includes(emoji),emoji);
  const groups=new Set(data.groups.map(group=>group.id));
  assert.equal(groups.size,10);
  for(const item of data.entries) {
    assert.ok(groups.has(item.group),item.group);
    // CLDR uses short labels such as OK, DVD and DNA; Chinese aliases still work.
    assert.ok(/[\u3400-\u9fff]/.test(item.name+' '+item.keywords),item.name);
    assert.ok(item.keywords.length>0);
  }
});
