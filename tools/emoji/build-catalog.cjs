// Rebuild the local picker catalogue from the vendored Unicode and CLDR sources.
const fs = require('node:fs');
const path = require('node:path');
const folder = __dirname;
const destination = path.join(folder, '../../src/main/webapp/js');
const normalize = text => text.replace(/\uFE0F/g, '');
const names = new Map(), keywords = new Map();
function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) =>
    entity.startsWith('#x') ? String.fromCodePoint(parseInt(entity.slice(2),16)) :
    entity.startsWith('#') ? String.fromCodePoint(Number(entity.slice(1))) :
    ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[entity]);
}
for (const file of ['cldr-zh.xml','cldr-zh-derived.xml']) {
  const xml = fs.readFileSync(path.join(folder,file),'utf8');
  for (const [,attributes,content] of xml.matchAll(/<annotation\b([^>]+)>([\s\S]*?)<\/annotation>/g)) {
    const cp = attributes.match(/\bcp="([^"]*)"/)?.[1];
    if (!cp || /\balt=/.test(attributes) || content.trim() === '↑↑↑') continue;
    const value = decodeXml(content.trim()), key = normalize(decodeXml(cp));
    if (/\btype="tts"/.test(attributes)) names.set(key,value);
    else keywords.set(key,value.replace(/\s*\|\s*/g,' '));
  }
}
const groups = {
  'Smileys & Emotion':'表情与情感', 'People & Body':'人物与身体', 'Component':'肤色与发型',
  'Animals & Nature':'动物与自然', 'Food & Drink':'食物与饮料', 'Travel & Places':'旅行与地点',
  'Activities':'活动与运动', 'Objects':'物品', 'Symbols':'符号', 'Flags':'旗帜'
};
// Preserve familiar labels as aliases, without limiting the catalogue.
const aliases = new Map([
  ['😀','笑脸'],['😄','开心'],['😂','笑哭'],['🥰','喜爱'],['😍','心动'],['😎','酷'],
  ['🤔','思考'],['😭','大哭'],['😅','冒汗'],['😮','惊讶'],['😴','睡觉'],['🥳','庆祝'],
  ['👍','赞'],['👎','踩'],['👏','鼓掌'],['🙏','感谢'],['💪','加油'],['👋','挥手'],
  ['❤️','爱心'],['💔','伤心'],['🎉','礼花'],['✨','闪耀'],['🔥','火'],['🌹','玫瑰'],
  ['☕','咖啡'],['🍰','蛋糕'],['🐱','猫咪'],['🐶','小狗'],['🌞','太阳'],['🌙','月亮']
]);
const input = fs.readFileSync(path.join(folder,'emoji-test.txt'),'utf8');
const version = input.match(/^# Version: ([\d.]+)/m)?.[1];
if (!version) throw new Error('Missing Unicode version');
let group;
const entries = [];
for (const line of input.split(/\r?\n/)) {
  if (line.startsWith('# group: ')) group = line.slice(9).trim();
  const match = line.match(/^([0-9A-F ]+)\s*;\s*(fully-qualified|component)\s*#\s*\S+\s+E[\d.]+\s+(.+)$/u);
  if (!match) continue;
  if (!groups[group]) throw new Error('Unknown group: '+group);
  const emoji = String.fromCodePoint(...match[1].trim().split(/\s+/).map(code=>parseInt(code,16)));
  const key = normalize(emoji), english = match[3].trim(), chinese = names.get(key);
  entries.push({emoji, name:aliases.get(emoji)||chinese||english, group,
    keywords:[english,chinese,keywords.get(key),aliases.get(emoji)].filter(Boolean).join(' ')});
}
const fullyQualified = Number(input.match(/^# fully-qualified : (\d+)/m)?.[1]);
const components = Number(input.match(/^# component : (\d+)/m)?.[1]);
if (entries.length !== fullyQualified+components || new Set(entries.map(item=>item.emoji)).size !== entries.length)
  throw new Error('Incomplete or duplicated catalogue');
const catalogue = {
  version, fullyQualified, components,
  source:'https://www.unicode.org/Public/emoji/latest/emoji-test.txt',
  cldrRevision:'7cdeb9e7fac52c59f22fc7248b05f989ee5689c2',
  license:'Unicode License V3 — see emoji-data.LICENSE.txt',
  groups:Object.entries(groups).map(([id,name])=>({id,name})), entries
};
fs.writeFileSync(path.join(destination,'emoji-data.json'),JSON.stringify(catalogue)+'\n','utf8');
fs.copyFileSync(path.join(folder,'LICENSE.txt'),path.join(destination,'emoji-data.LICENSE.txt'));
console.log(JSON.stringify({version,count:entries.length,translated:entries.filter(item=>names.has(normalize(item.emoji))).length,
  missingChinese:entries.filter(item=>!names.has(normalize(item.emoji))).map(item=>item.name)}));
