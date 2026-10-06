/* Runs inside a sandboxed extension page (eval allowed) and cartoonizes images for the popup. */
NudgeToon.configure({ base: 'ml/' });
addEventListener('message', async (e) => {
  const { id, type, blob } = e.data || {};
  if (type === 'preload') { NudgeToon.preload(); return; }
  if (type !== 'cartoonize') return;
  try {
    const r = await NudgeToon.cartoonize(blob, { onStep: (t) => e.source.postMessage({ id, step: t }, '*') });
    e.source.postMessage({ id, result: r }, '*');
  } catch (err) {
    e.source.postMessage({ id, result: { ok: false, reason: 'model', error: String(err) } }, '*');
  }
});
