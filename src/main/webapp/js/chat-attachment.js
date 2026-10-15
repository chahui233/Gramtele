(() => {
  'use strict';
  const file = document.getElementById('chatImage'), button = document.getElementById('attachImage');
  const attachment = document.getElementById('chatAttachment'), name = document.getElementById('chatAttachmentName');
  const clear = document.getElementById('clearChatImage');
  function update() {
    const selected = file.files[0];
    attachment.hidden = !selected;
    name.textContent = selected ? selected.name : '';
    button.disabled = clear.disabled = file.disabled;
    button.setAttribute('aria-label', selected ? '更换已选图片' : '选择图片');
    button.title = selected ? '更换已选图片' : '选择图片';
  }
  button.addEventListener('click', () => { if (!file.disabled) file.click(); });
  file.addEventListener('change', update);
  clear.addEventListener('click', () => { if (!file.disabled) { file.value = ''; update(); } });
  document.getElementById('chatForm').addEventListener('reset', () => setTimeout(update, 0));
  new MutationObserver(update).observe(file, {attributes:true,attributeFilter:['disabled']});
  update();
})();
