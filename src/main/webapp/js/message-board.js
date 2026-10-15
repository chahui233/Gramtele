(() => {
  'use strict';
  const form = document.getElementById('postForm');
  if (!form) return;
  const content = document.getElementById('postContent');
  const error = document.getElementById('postContentError');
  // Match the server check, without trimming or rewriting valid text or emoji sequences.
  const invisibleOnly = /^[\p{Z}\p{Cc}\p{Cf}\u034f\u115f\u1160\u3164\uffa0\ufe00-\ufe0f\u{E0100}-\u{E01EF}]*$/u;
  function validate(showError) {
    const valid = !invisibleOnly.test(content.value);
    const message = valid ? '' : '留言内容不能为空或只有空白字符。';
    content.setCustomValidity(message);
    error.textContent = showError ? message : '';
    error.hidden = !error.textContent;
    content.setAttribute('aria-invalid', String(!error.hidden));
    return valid;
  }
  content.addEventListener('input', () => validate(!error.hidden));
  content.addEventListener('invalid', () => validate(true));
  form.addEventListener('submit', event => {
    if (!validate(true)) { event.preventDefault(); content.reportValidity(); }
  });
  // Recheck drafts restored by the browser's back/forward cache.
  window.addEventListener('pageshow', () => validate(false));
  validate(false);
})();
