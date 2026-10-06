/* Popup-side proxy: same API as NudgeToon, but the work happens in the sandboxed iframe. */
(function () {
  let frame = null, ready = null, seq = 0;
  const pending = new Map();
  function ensure() {
    if (ready) return ready;
    ready = new Promise((res) => {
      frame = document.createElement('iframe');
      frame.src = 'toon-sandbox.html'; frame.style.display = 'none';
      frame.onload = () => res(frame);
      document.body.appendChild(frame);
    });
    addEventListener('message', (e) => {
      if (!frame || e.source !== frame.contentWindow) return;
      const p = pending.get(e.data.id); if (!p) return;
      if (e.data.step) p.onStep && p.onStep(e.data.step);
      if (e.data.result) { pending.delete(e.data.id); p.resolve(e.data.result); }
    });
    return ready;
  }
  async function toBlob(src) {
    if (src instanceof Blob) return src;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return new Promise((r) => c.toBlob(r, 'image/png'));
  }
  globalThis.NudgeToon = {
    configure() {},
    preload() { ensure().then((f) => f.contentWindow.postMessage({ type: 'preload' }, '*')); },
    async cartoonize(src, { onStep } = {}) {
      const f = await ensure(); const blob = await toBlob(src); const id = ++seq;
      return new Promise((resolve) => {
        pending.set(id, { resolve, onStep });
        f.contentWindow.postMessage({ id, type: 'cartoonize', blob }, '*');
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ ok: false, reason: 'timeout' }); } }, 60000);
      });
    },
  };
})();
