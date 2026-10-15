// Statutory dates under State Council Order 795, effective 2025-01-01.
// Annual adjusted workdays/weekend breaks are deliberately not inferred.
const fs = require('node:fs');
const path = require('node:path');
const {Lunar,Solar} = require('./lunar.js');
const holidays = [];
function add(name, start, days) {
  const end = new Date(Date.parse(start+'T00:00:00Z') + days*86400000).toISOString().slice(0,10);
  holidays.push({name,start,end}); // end is exclusive, in China Standard Time.
}
for(let year=2025; year<=2100; year++) {
  add('元旦',year+'-01-01',1);
  add('春节',Lunar.fromYmd(year,1,1).getSolar().next(-1).toYmd(),4);
  add('清明节',Solar.fromYmd(year,6,1).getLunar().getJieQiTable()['清明'].toYmd(),1);
  add('劳动节',year+'-05-01',2);
  add('端午节',Lunar.fromYmd(year,5,5).getSolar().toYmd(),1);
  add('中秋节',Lunar.fromYmd(year,8,15).getSolar().toYmd(),1);
  add('国庆节',year+'-10-01',3);
}
holidays.sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
const data={timeZone:'Asia/Shanghai',firstYear:2025,lastYear:2100,
  source:'https://www.gov.cn/zhengce/content/202411/content_6986380.htm',
  calendar:'lunar-javascript 1.7.7',holidays};
fs.writeFileSync(path.join(__dirname,'../../src/main/webapp/js/holidays.json'),JSON.stringify(data)+'\n');
console.log('Generated '+holidays.length+' statutory holiday entries (2025–2100).');
