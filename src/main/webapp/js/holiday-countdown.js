(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.HolidayCountdown = api; api.mount(); }
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const parse = date => Date.parse(date + 'T00:00:00+08:00');
  function select(holidays, now) {
    const remaining = holidays.filter(item => parse(item.end) > now)
      .sort((a,b) => parse(a.start)-parse(b.start));
    const active = remaining.filter(item => parse(item.start) <= now);
    const items = active.length ? active : remaining.filter(item => item.start === remaining[0]?.start);
    if (!items.length) return null;
    return {name:items.map(item=>item.name).join('、'),active:active.length>0,
      target:active.length ? Math.min(...items.map(item=>parse(item.end))) : parse(items[0].start)};
  }
  function parts(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds/1000));
    return [Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60];
  }
  function mount() {
    const box = document.getElementById('countdown');
    if (!box) return;
    const label = document.getElementById('holidayLabel');
    const values = box.querySelectorAll('[data-countdown-unit]');
    const retry = document.getElementById('holidayRetry');
    let data = null, timer = null, loading = false;
    function update() {
      if (!data) return;
      const selected = select(data.holidays, Date.now());
      if (!selected) {
        label.textContent = '节假日日历待更新';
        box.querySelector('.holiday-time').hidden = true;
        return;
      }
      box.querySelector('.holiday-time').hidden = false;
      label.textContent = selected.active ? selected.name + '期间，距离结束还有' : '距离' + selected.name + '还有';
      parts(selected.target-Date.now()).forEach((value,index)=>{ values[index].textContent = String(value).padStart(2,'0'); });
    }
    async function load() {
      if (loading) return;
      loading = true; retry.hidden = true;
      label.textContent = '正在加载节假日倒计时…';
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),10000);
      try {
        const response = await fetch(box.dataset.calendar, {signal:controller.signal});
        if (!response.ok) throw new Error('Calendar unavailable');
        const result = await response.json();
        if (!Array.isArray(result.holidays) || !result.holidays.length) throw new Error('Invalid calendar');
        data = result; update();
        clearInterval(timer); timer = setInterval(update,1000);
      } catch (_) {
        label.textContent = '节假日倒计时加载失败'; retry.hidden = false;
      } finally { clearTimeout(timeout); loading = false; }
    }
    retry.addEventListener('click', load);
    document.addEventListener('visibilitychange',()=>{ if (document.visibilityState==='visible') update(); });
    window.addEventListener('pagehide',()=>clearInterval(timer));
    window.addEventListener('pageshow',event=>{ if(event.persisted && data){update();clearInterval(timer);timer=setInterval(update,1000);} });
    void load();
  }
  return {select,parts,mount};
});
