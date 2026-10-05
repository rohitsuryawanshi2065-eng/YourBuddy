/* Mini-window fallback: shows the buddy when the page can't be drawn on or Chrome is in the background. */
chrome.runtime.sendMessage({ type: 'nb:getRinging' }, (payload) => {
  void chrome.runtime.lastError;
  if (!payload) { setTimeout(() => window.close(), 1500); return; }
  document.getElementById('empty').remove();
  document.title = `${payload.emoji || '⏰'} ${payload.message}`;
  NudgeOverlay.show(payload);
});
