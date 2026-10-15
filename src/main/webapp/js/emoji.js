(() => {
  'use strict';
  const button = document.getElementById('emojiButton');
  const picker = document.getElementById('emojiPicker');
  const grid = document.getElementById('emojiGrid');
  const input = document.getElementById('chatInput');
  const status = document.getElementById('emojiStatus');
  const previous = document.getElementById('emojiPrev');
  const next = document.getElementById('emojiNext');
  const pageLabel = document.getElementById('emojiPage');
  const search = document.getElementById('emojiSearch');
  const category = document.getElementById('emojiCategory');
  const count = document.getElementById('emojiCount');
  const retry = document.getElementById('emojiRetry');
  const PAGE_SIZE = 24;
  const normalize = value => value.toLowerCase().replace(/\uFE0F/g, '');
  let page = 0, catalogue = null, choices = [], loading = null;

  function close() { picker.hidden = true; button.setAttribute('aria-expanded', 'false'); }
  function positionPicker() {
    if (picker.hidden) return;
    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft || 0) + 8;
    const top = (viewport?.offsetTop || 0) + 8;
    const width = (viewport?.width || window.innerWidth) - 16;
    const height = (viewport?.height || window.innerHeight) - 16;
    const anchor = button.getBoundingClientRect();
    picker.style.width = Math.min(340, width) + 'px';
    // On short screens the panel may overlap the composer; keep its controls on screen
    // and let only the grid shrink and scroll, never the message history underneath.
    picker.style.maxHeight = Math.min(height, Math.max(220, anchor.top - top - 8)) + 'px';
    picker.style.left = Math.max(left, Math.min(anchor.right - picker.offsetWidth, left + width - picker.offsetWidth)) + 'px';
    picker.style.top = Math.max(top, Math.min(anchor.top - 8 - picker.offsetHeight, top + height - picker.offsetHeight)) + 'px';
  }
  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }
  function renderPage() {
    grid.replaceChildren();
    for (const {emoji, name} of choices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
      const choice = document.createElement('button');
      choice.type = 'button'; choice.textContent = emoji; choice.title = name;
      choice.setAttribute('aria-label', name);
      choice.addEventListener('click', () => {
        if (input.disabled) { close(); return; }
        // Focusing search/category controls leaves the message's selection intact.
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        if (input.maxLength >= 0 && input.value.length - (end - start) + emoji.length > input.maxLength) {
          showStatus('消息已达到长度上限，请删减后再插入。'); positionPicker(); return;
        }
        input.setRangeText(emoji, start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        close(); input.focus({ preventScroll: true });
      });
      grid.append(choice);
    }
    grid.scrollTop = 0;
    previous.disabled = page === 0 || !choices.length;
    next.disabled = (page + 1) * PAGE_SIZE >= choices.length;
    pageLabel.textContent = (choices.length ? page + 1 : 0) + ' / ' + Math.ceil(choices.length / PAGE_SIZE) + ' 页';
    if (catalogue) count.textContent = choices.length + ' 个表情';
    positionPicker();
  }
  function filterChoices() {
    if (!catalogue) return;
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    choices = catalogue.filter(item => (!category.value || item.group === category.value)
      && terms.every(term => item.searchText.includes(term)));
    page = 0;
    showStatus(choices.length ? '' : '没有找到表情，请换个关键词或分类。');
    renderPage();
  }
  async function loadCatalogue() {
    if (catalogue || loading) return loading;
    search.disabled = category.disabled = true;
    retry.hidden = true;
    count.textContent = '正在加载…';
    showStatus('');
    picker.setAttribute('aria-busy', 'true');
    renderPage();
    loading = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(button.dataset.catalogue, {signal: controller.signal});
        if (!response.ok) throw new Error('Emoji catalogue unavailable');
        const data = await response.json();
        if (!Array.isArray(data.entries) || !data.entries.length || !Array.isArray(data.groups))
          throw new Error('Invalid emoji catalogue');
        count.textContent = '正在检测表情…';
        const available = await window.EmojiSupport.filter(data.entries, () => {
          count.textContent = '正在适配此设备…';
        });
        if (!available.length) throw new Error('No supported emoji');
        const entries = available.map(item => ({...item,
          searchText: normalize(item.emoji + ' ' + item.name + ' ' + item.keywords)}));
        category.replaceChildren(new Option('全部分类', ''));
        for (const group of data.groups) if (entries.some(item => item.group === group.id))
          category.add(new Option(group.name, group.id));
        catalogue = entries;
        search.disabled = category.disabled = false;
        filterChoices();
      } catch (error) {
        count.textContent = '';
        showStatus('表情加载失败，请重试。');
        retry.hidden = false;
      } finally {
        clearTimeout(timeout);
        picker.removeAttribute('aria-busy');
        loading = null;
        positionPicker();
      }
    })();
    return loading;
  }
  function changePage(delta) {
    page = Math.max(0, Math.min(Math.ceil(choices.length / PAGE_SIZE) - 1, page + delta));
    showStatus(''); renderPage();
    grid.firstElementChild?.focus({ preventScroll: true });
  }
  previous.addEventListener('click', () => changePage(-1));
  next.addEventListener('click', () => changePage(1));
  search.addEventListener('input', filterChoices);
  category.addEventListener('change', filterChoices);
  retry.addEventListener('click', loadCatalogue);
  // Search lives inside the chat form: Enter must never send the draft.
  picker.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.target === search || e.target === category)) e.preventDefault();
  });
  button.addEventListener('click', () => {
    if (input.disabled) return;
    if (!picker.hidden) { close(); return; }
    picker.hidden = false; button.setAttribute('aria-expanded', 'true');
    if (catalogue) {
      showStatus(choices.length ? '' : '没有找到表情，请换个关键词或分类。');
      renderPage(); search.focus({ preventScroll: true });
    } else {
      loadCatalogue();
    }
  });
  document.addEventListener('click', e => { if (!picker.contains(e.target) && !button.contains(e.target)) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !picker.hidden) { close(); input.focus({ preventScroll: true }); e.preventDefault(); }
  });
  new MutationObserver(() => { button.disabled = input.disabled; if (input.disabled) close(); })
    .observe(input, { attributes:true, attributeFilter:['disabled'] });
  window.addEventListener('resize', positionPicker);
  window.addEventListener('scroll', positionPicker);
  window.visualViewport?.addEventListener('resize', positionPicker);
  window.visualViewport?.addEventListener('scroll', positionPicker);
})();
