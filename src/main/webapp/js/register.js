(() => {
  'use strict';
  const form = document.getElementById('registrationForm');
  const password = document.getElementById('registrationPassword');
  const button = document.getElementById('registerButton');
  const status = document.getElementById('registrationStatus');
  const rows = [...document.querySelectorAll('[data-password-rule]')];
  const challenge = {
    salt: form.dataset.challengeSalt,
    prefix: form.dataset.challengePrefix,
    expiresAt: Number(form.dataset.challengeExpires)
  };
  // Use the server's clock as the starting point, including after restoring a cached tab.
  const serverOffset = Number(form.dataset.serverNow) - Date.now();
  let expiryTimer = null;
  function update() {
    const result = RegistrationPasswordRules.evaluate(password.value);
    const now = Date.now() + serverOffset;
    const random = RegistrationChallenge.evaluate(password.value, challenge, now);
    [...result.rules, random.passes].forEach((valid, index) => {
      rows[index].dataset.valid = String(valid);
      rows[index].querySelector('.rule-symbol').textContent = valid ? '√' : '×';
      rows[index].querySelector('.rule-symbol').setAttribute('aria-label', valid ? '符合' : '不符合');
    });
    document.getElementById('passwordLength').textContent = String(result.length);
    document.getElementById('passwordDigitSum').textContent = String(result.digitSum);
    document.getElementById('challengeDigest').textContent = password.value && random.digest
      ? random.digest : '输入密码后显示';
    const seconds = Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000));
    document.getElementById('challengeTime').textContent = random.expired ? '本次随机挑战已过期。'
      : '挑战剩余：' + Math.floor(seconds / 60) + ' 分 ' + (seconds % 60) + ' 秒';
    document.getElementById('challengeReload').hidden = !random.expired;
    // Retain the existing authentication input-size limit (also enforced server-side).
    const allowed = result.passes && random.passes && password.value.length <= 1024;
    const message = password.value.length > 1024 ? '密码超过输入长度上限（1024）。'
      : random.expired ? '随机挑战已过期，请重新获取。'
      : allowed ? '' : '密码尚未满足全部 11 项要求。';
    password.setCustomValidity(message);
    button.disabled = !allowed;
    status.textContent = allowed ? '全部要求已满足，可以注册。' : message;
    return allowed;
  }
  password.addEventListener('input', update);
  password.addEventListener('change', update);
  function resume() {
    update();
    clearInterval(expiryTimer);
    expiryTimer = setInterval(update, 1000);
  }
  window.addEventListener('pageshow', resume);
  window.addEventListener('pagehide', () => clearInterval(expiryTimer));
  form.addEventListener('submit', event => {
    if (!update()) {
      event.preventDefault();
      password.reportValidity();
    }
  });
  resume();
})();
