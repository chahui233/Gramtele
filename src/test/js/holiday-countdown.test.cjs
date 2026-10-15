const {test}=require('node:test');
const assert=require('node:assert/strict');
const data=require('../../main/webapp/js/holidays.json');
const {select,parts}=require('../../main/webapp/js/holiday-countdown.js');
const at=text=>select(data.holidays,Date.parse(text));

test('calendar covers all seven national holidays every year and known lunar/solar-term dates',()=>{
  for(let year=2025;year<=2100;year++) assert.equal(data.holidays.filter(h=>h.start.startsWith(year+'-')).length,7);
  const date=(year,name)=>data.holidays.find(h=>h.start.startsWith(year+'-')&&h.name===name).start;
  assert.equal(date(2026,'春节'),'2026-02-16');
  assert.equal(date(2027,'春节'),'2027-02-05'); // Eve before Lunar New Year, February 6.
  assert.equal(date(2026,'清明节'),'2026-04-05');
  assert.equal(date(2028,'清明节'),'2028-04-04');
  assert.equal(date(2026,'端午节'),'2026-06-19');
  assert.equal(date(2027,'端午节'),'2027-06-09');
  assert.equal(date(2026,'中秋节'),'2026-09-25');
  assert.equal(date(2027,'中秋节'),'2027-09-15');
});
test('nearest holiday rolls across years and changes exactly at Beijing midnight',()=>{
  assert.equal(at('2026-10-13T12:00:00+08:00').name,'元旦');
  assert.equal(at('2026-12-31T15:59:59Z').active,false);
  assert.equal(at('2026-12-31T16:00:00Z').active,true);
  assert.equal(at('2027-01-01T15:59:59Z').name,'元旦');
  assert.equal(at('2027-01-01T16:00:00Z').name,'春节');
  assert.equal(at('2027-02-04T16:00:00Z').active,true);
  assert.equal(at('2027-02-08T16:00:00Z').name,'清明节');
  assert.equal(at('2027-05-02T12:00:00+08:00').name,'劳动节');
  assert.equal(at('2027-05-03T00:00:00+08:00').name,'端午节');
});
test('overlapping festivals keep both names and seconds never go negative',()=>{
  const current=at('2028-10-03T12:00:00+08:00');
  assert.equal(current.active,true);
  assert.equal(current.name,'国庆节、中秋节');
  assert.equal(at('2028-10-04T00:00:00+08:00').name,'元旦');
  assert.deepEqual(parts(90061000),[1,1,1,1]);
  assert.deepEqual(parts(-1),[0,0,0,0]);
  assert.equal(select([],Date.now()),null);
});
