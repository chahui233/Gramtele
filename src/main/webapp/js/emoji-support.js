/* Probe the same local font stack used by the picker, rather than guessing by OS/version. */
(() => {
  'use strict';
  const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  function create() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 48;
    const context = canvas.getContext('2d', {willReadFrequently:true});
    if (!context) throw new Error('Emoji rendering check unavailable');
    context.font = '32px ' + FONT;
    context.textBaseline = 'middle';
    const cache = new Map();
    function render(text) {
      if (cache.has(text)) return cache.get(text);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillText(text, 2, 24);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      // Keep compact fingerprints, not thousands of full pixel buffers.
      let hash = 2166136261, ink = 0;
      for (let i = 0; i < pixels.length; i++) {
        hash = Math.imul(hash ^ pixels[i], 16777619);
        if ((i & 3) === 3) ink += pixels[i];
      }
      const result = {key:context.measureText(text).width + ':' + ink + ':' + hash, ink,
        width:context.measureText(text).width};
      cache.set(text, result);
      return result;
    }
    const missing = new Set(['\u0378','\uFFFF','\u{10FFFF}','\uFFFD'].map(text => render(text).key));
    const maxWidth = Math.max(32, render('😀').width) * 1.35;
    return emoji => {
      const glyph = render(emoji);
      if (!glyph.ink || missing.has(glyph.key) || glyph.width > maxWidth) return false;
      const parts = Array.from(emoji);
      for (const part of parts) {
        const code = part.codePointAt(0);
        // Joiners, selectors, tags and the combining keycap have no standalone glyph.
        if (code === 0x200D || code === 0xFE0F || code === 0x20E3 || code >= 0xE0020 && code <= 0xE007F) continue;
        if (missing.has(render(part).key)) return false;
      }
      if (emoji.includes('\u200D') || /^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(emoji)) {
        // Unsupported sequences can render as individual people/letters with no tofu.
        const separated = parts.filter(part => part !== '\u200D').join('\u200C');
        if (render(separated).key === glyph.key) return false;
      }
      if (/[\u{E0020}-\u{E007F}]/u.test(emoji)) {
        const untagged = emoji.replace(/[\u{E0020}-\u{E007F}]/gu, '');
        if (render(untagged).key === glyph.key) return false;
      }
      return true;
    };
  }
  async function filter(entries, onProgress = () => {}) {
    await document.fonts?.ready;
    const supported = create(), result = [];
    for (let i = 0; i < entries.length; i++) {
      if (supported(entries[i].emoji)) result.push(entries[i]);
      if (i % 40 === 39) {
        onProgress(i + 1, entries.length);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    return result;
  }
  window.EmojiSupport = {create, filter};
})();
