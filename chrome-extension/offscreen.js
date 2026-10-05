/* Plays alarm sounds for the service worker (which has no audio). */
let loopTimer = null, stopAt = 0;
function stop() { clearTimeout(loopTimer); loopTimer = null; }
function ring({ sound, volume, loop, maxMs }) {
  stop();
  if (!sound || sound === 'none') return;
  stopAt = Date.now() + (maxMs || 90000);
  const once = () => {
    const d = NudgeSounds.play(sound, volume);
    if (loop && Date.now() + 1000 < stopAt) loopTimer = setTimeout(once, (d + 2.2) * 1000);
  };
  once();
}
chrome.runtime.onMessage.addListener((m) => {
  if (!m || m.target !== 'offscreen') return;
  if (m.type === 'ring') ring(m);
  else if (m.type === 'stop') stop();
  else if (m.type === 'sfx') NudgeSounds.play(m.name, m.volume ?? 0.6);
});
