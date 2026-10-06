/* Nudge Buddy — service worker: scheduling, delivery, tab-chasing, sounds, stats. */
import { DEFAULT_SETTINGS, uid, dayKey, computeNext, inQuietHours, quietEnd, streakInfo, fmtMin } from './shared.js';

const local = chrome.storage.local;
const session = chrome.storage.session;
const PREFIX = 'r:';
const PREVIEW_ID = '__preview';
const BLOCKED = /^(chrome|edge|brave|opera|vivaldi|about|chrome-extension|chrome-search|devtools|view-source|data|blob|javascript):/i;
const STORE = /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i;

/* ---------------- state helpers ---------------- */
async function load() {
  const d = await local.get(['settings', 'reminders', 'customChars', 'stats']);
  const s = d.settings || {};
  return {
    settings: { ...DEFAULT_SETTINGS, ...s, quiet: { ...DEFAULT_SETTINGS.quiet, ...(s.quiet || {}) } },
    reminders: d.reminders || [],
    customChars: d.customChars || [],
    stats: d.stats || { history: {}, streak: 0, best: 0, total: 0, snoozed: 0, lastDone: null },
  };
}
// Serialize all mutations so alarms/messages never race on storage.
let chain = Promise.resolve();
function locked(fn) {
  const run = chain.then(fn);
  chain = run.catch((e) => console.warn('[NudgeBuddy]', e));
  return run;
}
const getRing = async () => (await session.get('ringing')).ringing || null;
const setRing = (ringing) => (ringing ? session.set({ ringing }) : session.remove('ringing'));

/* ---------------- alarms ---------------- */
async function schedule(r) {
  await chrome.alarms.clear(PREFIX + r.id);
  if (r.enabled && r.nextAt) chrome.alarms.create(PREFIX + r.id, { when: Math.max(r.nextAt, Date.now() + 1500) });
}
async function syncAll() {
  const { reminders } = await load();
  const all = await chrome.alarms.getAll();
  const ids = new Set(reminders.map((r) => PREFIX + r.id));
  await Promise.all(all.filter((a) => a.name.startsWith(PREFIX) && !ids.has(a.name)).map((a) => chrome.alarms.clear(a.name)));
  for (const r of reminders) await schedule(r);
  chrome.alarms.create('nb:tick', { periodInMinutes: 1 });
  updateBadge();
}

async function updateBadge() {
  const { reminders, settings } = await load();
  const ring = await getRing();
  let text = '', color = '#7c4dff';
  if (ring && ring.id !== PREVIEW_ID) { text = '!'; color = '#ff3d6e'; }
  else if (settings.pausedUntil > Date.now()) { text = 'zz'; color = '#9aa0b4'; }
  else {
    const next = reminders.filter((r) => r.enabled && r.nextAt).map((r) => r.nextAt).sort((a, b) => a - b)[0];
    if (next) {
      const m = Math.max(0, Math.ceil((next - Date.now()) / 60000));
      text = m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : '';
    }
  }
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

/* ---------------- audio + voice ---------------- */
async function ensureOffscreen() {
  try {
    if (chrome.offscreen.hasDocument && (await chrome.offscreen.hasDocument())) return;
    await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: 'Play reminder alarm and celebration sounds' });
  } catch (e) { /* already exists */ }
}
async function toOffscreen(msg) {
  await ensureOffscreen();
  try { await chrome.runtime.sendMessage({ target: 'offscreen', ...msg }); } catch (e) { /* noop */ }
}
async function startRing(settings, once) {
  toOffscreen({ type: 'ring', sound: settings.sound, volume: settings.volume, loop: !once && settings.ringUntilAnswered, maxMs: 90000 });
}
const stopRing = () => { toOffscreen({ type: 'stop' }); try { chrome.tts.stop(); } catch (e) { /* noop */ } };
async function sfx(name) { const { settings } = await load(); if (settings.sound !== 'none') toOffscreen({ type: 'sfx', name, volume: settings.volume * 0.8 }); }
function speak(settings, payload) {
  if (!settings.voice) return;
  const text = `${payload.headline} ${payload.message}`.replace(/\p{Extended_Pictographic}|️/gu, '').trim();
  try { chrome.tts.speak(text, { rate: 1.0, pitch: 1.15, volume: Math.min(1, settings.volume + 0.2) }); } catch (e) { /* noop */ }
}

/* ---------------- payload ---------------- */
function resolveCharacter(st, charId) {
  if (charId && charId.startsWith('custom:')) {
    const c = st.customChars.find((x) => x.id === charId.slice(7));
    if (c) return { kind: 'custom', dataUrl: c.dataUrl, mode: c.mode, color: c.color, crop: c.crop, skin: c.skin };
    return { kind: 'preset', id: 'arjun' };
  }
  return { kind: 'preset', id: charId || 'arjun' };
}
function buildPayload(st, r, extra = {}) {
  const s = st.settings;
  const charId = r.characterId && r.characterId !== 'default' ? r.characterId : s.characterId;
  return {
    reminderId: r.id,
    emoji: r.emoji || '⏰',
    name: s.name,
    headline: s.name ? `Hey, ${s.name}!` : 'Hey there!',
    message: r.message || r.title || 'Time for a break!',
    yesLabel: r.yesLabel || 'YES',
    celebrate: r.celebrate || 'Legend! 🎉',
    character: resolveCharacter(st, charId),
    settings: {
      mischief: s.mischief, escalate: s.escalate, snoozeOptions: s.snoozeOptions, defaultSnooze: s.defaultSnooze,
      entrance: s.entrance, celebration: s.celebration,
    },
    ...extra,
  };
}

/* ---------------- delivery ---------------- */
function canInject(tab) { return tab && tab.id >= 0 && tab.url && !BLOCKED.test(tab.url) && !STORE.test(tab.url) && !tab.discarded; }
async function inject(tab, payload) {
  if (!canInject(tab)) return false;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['characters.js', 'overlay.js'] });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (p) => { globalThis.NudgeOverlay.show(p); return true; },
      args: [payload],
    });
    return !!(res && res.result);
  } catch (e) { return false; }
}
async function hideIn(tabId) {
  if (tabId == null) return;
  try { await chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.NudgeOverlay && globalThis.NudgeOverlay.hide() }); } catch (e) { /* tab gone */ }
}
async function lastNormalWindow() {
  try { return await chrome.windows.getLastFocused({ windowTypes: ['normal'] }); } catch (e) { return null; }
}
async function openMini(ring, nearWin) {
  if (ring.miniWindowId) { try { await chrome.windows.update(ring.miniWindowId, { focused: true, drawAttention: true }); return; } catch (e) { /* gone */ } }
  const w = 480, h = 640;
  const opts = { url: chrome.runtime.getURL('reminder.html'), type: 'popup', width: w, height: h, focused: true };
  if (nearWin && nearWin.width) { opts.left = Math.max(0, Math.round(nearWin.left + (nearWin.width - w) / 2)); opts.top = Math.max(0, Math.round(nearWin.top + (nearWin.height - h) / 2)); }
  try { const win = await chrome.windows.create(opts); ring.miniWindowId = win.id; } catch (e) { /* noop */ }
}
function notify(ring, settings) {
  const p = ring.payload;
  chrome.notifications.create('nb:' + ring.id, {
    type: 'basic', iconUrl: 'icons/icon128.png', title: `${p.emoji} ${p.headline}`, message: p.message,
    buttons: [{ title: p.yesLabel }, { title: `Remind me in ${fmtMin(settings.defaultSnooze)}` }],
    requireInteraction: true, priority: 2,
  }, () => void chrome.runtime.lastError);
}

async function present(ring, settings) {
  const win = await lastNormalWindow();
  let shown = false;
  if (win) {
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    if (tab && (await inject(tab, ring.payload))) { shown = true; ring.tabId = tab.id; }
  }
  const focused = !!(win && win.focused);
  if (!shown && focused) {
    // e.g. a chrome:// page or the Web Store, where pages can't be drawn on
    await openMini(ring, win);
  } else if (!focused) {
    // Chrome is in the background (you're in another app)
    const mode = settings.away;
    if (mode === 'window' || mode === 'both' || (!shown && mode === 'wait' && !win)) await openMini(ring, win);
    if (mode === 'notification' || mode === 'both') notify(ring, settings);
  }
  await setRing(ring);
}

async function fire(id, extra = {}) {
  const st = await load();
  const s = st.settings;
  const r = st.reminders.find((x) => x.id === id);
  if (!r || !r.enabled) return;
  const now = Date.now();
  const defer = async (when) => { r.nextAt = when; await local.set({ reminders: st.reminders }); await schedule(r); updateBadge(); };
  if (s.pausedUntil > now) return defer(s.pausedUntil + 1000);
  if (inQuietHours(s.quiet)) return defer(quietEnd(s.quiet));
  if (s.skipWhenLocked) {
    let state = 'active';
    try { state = await chrome.idle.queryState(300); } catch (e) { /* noop */ }
    if (state === 'locked') {
      const { pending = [] } = await session.get('pending');
      if (!pending.includes(id)) pending.push(id);
      await session.set({ pending });
      return;
    }
  }
  const cur = await getRing();
  if (cur && cur.id !== id) {
    const stale = now - cur.startedAt > 30 * 60000;
    if (!stale && cur.id !== PREVIEW_ID) {
      const { queue = [] } = await session.get('queue');
      if (!queue.includes(id)) queue.push(id);
      await session.set({ queue });
      return;
    }
    await dismissSurfaces(cur, null);
  }
  r.nextAt = null; r.ringingSince = now;
  await local.set({ reminders: st.reminders });
  const ring = { id, startedAt: now, tabId: null, miniWindowId: null, payload: buildPayload(st, r, extra) };
  await present(ring, s);
  startRing(s);
  speak(s, ring.payload);
  updateBadge();
}

async function preview({ characterId, reminderId } = {}) {
  const st = await load();
  const base = (reminderId && st.reminders.find((x) => x.id === reminderId)) ||
    { id: PREVIEW_ID, emoji: '💧', message: 'Did you drink water?', yesLabel: 'YES', celebrate: 'Hydration hero! 💧' };
  const r = { ...base, id: PREVIEW_ID, characterId: characterId || base.characterId };
  const cur = await getRing();
  if (cur) await dismissSurfaces(cur, null);
  const ring = { id: PREVIEW_ID, startedAt: Date.now(), tabId: null, miniWindowId: null, payload: buildPayload(st, r, { preview: true }) };
  await present(ring, st.settings);
  startRing(st.settings, true);
  speak(st.settings, ring.payload);
}

async function dismissSurfaces(ring, sender) {
  stopRing();
  const fromTab = sender && sender.tab ? sender.tab.id : null;
  const fromWin = sender && sender.tab ? sender.tab.windowId : null;
  if (ring.tabId != null && ring.tabId !== fromTab) hideIn(ring.tabId);
  if (ring.miniWindowId && ring.miniWindowId !== fromWin) { try { await chrome.windows.remove(ring.miniWindowId); } catch (e) { /* gone */ } }
  chrome.notifications.clear('nb:' + ring.id, () => void chrome.runtime.lastError);
  await setRing(null);
}

/* ---------------- answers ---------------- */
async function answer({ reminderId, action, minutes }, sender) {
  const ring = await getRing();
  if (ring && ring.id === reminderId) await dismissSurfaces(ring, sender);
  else stopRing();
  sfx(action === 'yes' ? 'tada' : 'womp');
  const st = await load();
  if (reminderId === PREVIEW_ID || !reminderId) { updateBadge(); return streakInfo(st.stats); }

  const r = st.reminders.find((x) => x.id === reminderId);
  const today = dayKey();
  const h = (st.stats.history[today] = st.stats.history[today] || { done: 0, snoozed: 0 });
  if (action === 'yes') {
    h.done++; st.stats.total = (st.stats.total || 0) + 1;
    if (st.stats.lastDone !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      st.stats.streak = st.stats.lastDone === dayKey(y) ? (st.stats.streak || 0) + 1 : 1;
      st.stats.lastDone = today;
    }
    st.stats.best = Math.max(st.stats.best || 0, st.stats.streak);
    if (r) {
      r.doneCount = (r.doneCount || 0) + 1;
      r.ringingSince = null; r.snoozed = false;
      if (r.type === 'timer') { r.enabled = false; r.nextAt = null; r.doneAt = Date.now(); }
      else r.nextAt = computeNext(r);
      if (r.url) chrome.tabs.create({ url: r.url });
    }
  } else {
    h.snoozed++; st.stats.snoozed = (st.stats.snoozed || 0) + 1;
    if (r) { r.nextAt = Date.now() + Math.max(1, minutes || st.settings.defaultSnooze) * 60000; r.snoozed = true; r.ringingSince = null; }
  }
  // keep ~60 days of history
  const keys = Object.keys(st.stats.history).sort();
  while (keys.length > 60) delete st.stats.history[keys.shift()];
  await local.set({ reminders: st.reminders, stats: st.stats });
  if (r) await schedule(r);
  updateBadge();
  setTimeout(() => locked(nextInQueue), 4500);
  return streakInfo(st.stats);
}

async function nextInQueue() {
  if (await getRing()) return;
  const { queue = [] } = await session.get('queue');
  const id = queue.shift();
  await session.set({ queue });
  if (id) await fire(id);
}

/* ---------------- chase across tabs ---------------- */
async function chaseTo(tabId) {
  const ring = await getRing();
  if (!ring || ring.tabId === tabId) return;
  const { settings } = await load();
  if (!settings.chase && ring.tabId != null) return;
  let tab; try { tab = await chrome.tabs.get(tabId); } catch (e) { return; }
  if (!canInject(tab)) return;
  const old = ring.tabId;
  if (await inject(tab, { ...ring.payload, chase: old != null })) {
    ring.tabId = tabId;
    await setRing(ring);
    if (old != null) hideIn(old);
  }
}

/* ---------------- reminder CRUD (popup → bg) ---------------- */
async function upsert(input) {
  const st = await load();
  const now = Date.now();
  let r = st.reminders.find((x) => x.id === input.id);
  const fresh = !r;
  r = Object.assign(r || { id: uid(), createdAt: now, doneCount: 0 }, input);
  if (fresh) r.id = r.id || uid();
  r.enabled = true; r.snoozed = false; r.ringingSince = null;
  r.nextAt = input.nextAt || (r.type === 'clock' ? computeNext(r, now) : now + Math.max(1, Number(r.minutes) || 1) * 60000);
  if (fresh) st.reminders.unshift(r);
  await local.set({ reminders: st.reminders });
  await schedule(r);
  updateBadge();
  return r;
}
async function remove(id) {
  const st = await load();
  st.reminders = st.reminders.filter((x) => x.id !== id);
  await local.set({ reminders: st.reminders });
  await chrome.alarms.clear(PREFIX + id);
  const ring = await getRing();
  if (ring && ring.id === id) await dismissSurfaces(ring, null);
  updateBadge();
}
async function toggle(id, enabled) {
  const st = await load();
  const r = st.reminders.find((x) => x.id === id);
  if (!r) return;
  r.enabled = enabled; r.snoozed = false;
  r.nextAt = enabled ? (r.type === 'clock' ? computeNext(r) : Date.now() + r.minutes * 60000) : null;
  await local.set({ reminders: st.reminders });
  await schedule(r);
  updateBadge();
}
async function pause(minutes) {
  const st = await load();
  st.settings.pausedUntil = minutes ? Date.now() + minutes * 60000 : 0;
  await local.set({ settings: st.settings });
  if (!minutes) {
    // resume: anything that came due during the pause fires shortly
    for (const r of st.reminders) if (r.enabled && r.nextAt && r.nextAt < Date.now()) { r.nextAt = Date.now() + 5000; await schedule(r); }
    await local.set({ reminders: st.reminders });
  }
  updateBadge();
}

/* ---------------- context menu: "nudge me about this page" ---------------- */
const MENU = [
  { id: 'nb:15', title: 'in 15 minutes', minutes: 15 },
  { id: 'nb:60', title: 'in 1 hour', minutes: 60 },
  { id: 'nb:180', title: 'in 3 hours', minutes: 180 },
  { id: 'nb:tmr', title: 'tomorrow at 9:00', minutes: 0 },
];
function setupMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'nb:root', title: 'Nudge me about this', contexts: ['page', 'link'] });
    MENU.forEach((m) => chrome.contextMenus.create({ id: m.id, parentId: 'nb:root', title: m.title, contexts: ['page', 'link'] }));
  });
}
async function menuClicked(info, tab) {
  const m = MENU.find((x) => x.id === info.menuItemId);
  if (!m) return;
  const url = info.linkUrl || (tab && tab.url);
  const label = info.linkUrl ? (info.selectionText || info.linkUrl) : (tab && tab.title) || url;
  let nextAt = null, minutes = m.minutes;
  if (!minutes) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); nextAt = d.getTime(); minutes = Math.round((nextAt - Date.now()) / 60000); }
  const short = label.length > 60 ? label.slice(0, 57) + '…' : label;
  await upsert({ type: 'timer', minutes, nextAt, emoji: '🔖', title: `Revisit: ${short}`, message: `Remember this? “${short}”`, yesLabel: 'Open it', celebrate: 'Back on it! 🔖', url });
  if (tab && canInject(tab)) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [m.title],
      func: (when) => {
        const d = document.createElement('div');
        d.textContent = `🔖 Nudge set — I’ll remind you ${when}!`;
        d.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:50%;top:18px;transform:translate(-50%,-140%);background:#2b2140;color:#fff;font:800 14px system-ui,sans-serif;padding:11px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.3);transition:transform .45s cubic-bezier(.2,1.6,.4,1)';
        document.documentElement.appendChild(d);
        requestAnimationFrame(() => (d.style.transform = 'translate(-50%,0)'));
        setTimeout(() => { d.style.transform = 'translate(-50%,-140%)'; setTimeout(() => d.remove(), 500); }, 2400);
      },
    }).catch(() => {});
  }
}

/* ---------------- listeners ---------------- */
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const d = await local.get(['settings', 'reminders', 'customChars', 'stats']);
  await local.set({
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
    reminders: d.reminders || [],
    customChars: d.customChars || [],
    stats: d.stats || { history: {}, streak: 0, best: 0, total: 0, snoozed: 0, lastDone: null },
  });
  setupMenus();
  await syncAll();
  if (reason === 'install') chrome.tabs.create({ url: 'popup.html?full=1&welcome=1' });
});
chrome.runtime.onStartup.addListener(async () => { await setRing(null); syncAll(); });

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'nb:tick') return updateBadge();
  if (a.name.startsWith(PREFIX)) locked(() => fire(a.name.slice(PREFIX.length)));
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!msg || msg.target === 'offscreen') return;
  const handlers = {
    'nb:answer': () => answer(msg, sender),
    'nb:sfx': () => sfx(msg.name),
    'nb:getRinging': async () => { const r = await getRing(); return r ? { ...r.payload, standalone: true } : null; },
    'nb:upsert': () => upsert(msg.reminder),
    'nb:delete': () => remove(msg.id),
    'nb:toggle': () => toggle(msg.id, msg.enabled),
    'nb:test': () => preview({ reminderId: msg.id }),
    'nb:preview': () => preview({ characterId: msg.characterId }),
    'nb:pause': () => pause(msg.minutes),
    'nb:badge': () => updateBadge(),
  };
  const h = handlers[msg.type];
  if (!h) return;
  const lockedTypes = ['nb:answer', 'nb:upsert', 'nb:delete', 'nb:toggle', 'nb:pause', 'nb:test', 'nb:preview'];
  const p = lockedTypes.includes(msg.type) ? locked(h) : Promise.resolve().then(h);
  p.then((res) => reply(res ?? null), (e) => reply({ error: String(e) }));
  return true;
});

chrome.tabs.onActivated.addListener(({ tabId }) => locked(() => chaseTo(tabId)));
chrome.windows.onFocusChanged.addListener((winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) return;
  locked(async () => {
    const ring = await getRing();
    if (!ring || winId === ring.miniWindowId) return;
    const [tab] = await chrome.tabs.query({ active: true, windowId: winId });
    if (tab) await chaseTo(tab.id);
  });
});
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.active) return;
  locked(async () => {
    const ring = await getRing();
    if (!ring) return;
    // same tab reloaded/navigated → overlay was wiped, re-show; other tab → chase
    if (ring.tabId === tabId) { ring.tabId = null; await setRing(ring); }
    await chaseTo(tabId);
  });
});
chrome.tabs.onRemoved.addListener((tabId) => locked(async () => {
  const ring = await getRing();
  if (!ring || ring.tabId !== tabId) return;
  ring.tabId = null; await setRing(ring);
  const win = await lastNormalWindow();
  if (win) { const [tab] = await chrome.tabs.query({ active: true, windowId: win.id }); if (tab) await chaseTo(tab.id); }
}));
chrome.windows.onRemoved.addListener((winId) => locked(async () => {
  const ring = await getRing();
  if (!ring || ring.miniWindowId !== winId) return;
  ring.miniWindowId = null; await setRing(ring);
  // Closing the mini window without answering = default snooze (unless it's also on a page).
  if (ring.tabId == null) {
    const { settings } = await load();
    await answer({ reminderId: ring.id, action: 'snooze', minutes: settings.defaultSnooze }, null);
  }
}));

chrome.notifications.onButtonClicked.addListener((nid, idx) => {
  if (!nid.startsWith('nb:')) return;
  locked(async () => {
    const { settings } = await load();
    await answer({ reminderId: nid.slice(3), action: idx === 0 ? 'yes' : 'snooze', minutes: settings.defaultSnooze }, null);
  });
});
chrome.notifications.onClicked.addListener(async (nid) => {
  if (!nid.startsWith('nb:')) return;
  const win = await lastNormalWindow();
  if (win) chrome.windows.update(win.id, { focused: true });
});

chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener((state) => {
  if (state !== 'active') return;
  locked(async () => {
    const { pending = [] } = await session.get('pending');
    if (!pending.length) return;
    await session.remove('pending');
    const [first, ...rest] = pending;
    if (rest.length) { const { queue = [] } = await session.get('queue'); await session.set({ queue: [...queue, ...rest] }); }
    await fire(first, { welcomeBack: true });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => locked(() => menuClicked(info, tab)));
