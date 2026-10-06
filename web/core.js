/* Nudge Buddy app core — storage, scheduling, firing, answers. Platform-neutral (no chrome.* APIs). */
import { DEFAULT_SETTINGS, uid, dayKey, computeNext, inQuietHours, quietEnd, streakInfo } from './shared.js';

const KEY = 'nudge-buddy-app-v1';
const listeners = new Set();
let platform = null;
let ring = null;            // { id, startedAt, loopTimer }
let tickTimer = null;

export const state = {
  settings: { ...DEFAULT_SETTINGS },
  reminders: [],
  customChars: [],
  stats: { history: {}, streak: 0, best: 0, total: 0, snoozed: 0, lastDone: null },
};

/* ---------- persistence ---------- */
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    state.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}), quiet: { ...DEFAULT_SETTINGS.quiet, ...((d.settings || {}).quiet || {}) } };
    state.reminders = d.reminders || [];
    state.customChars = d.customChars || [];
    state.stats = { ...state.stats, ...(d.stats || {}) };
  } catch (e) { /* first run */ }
}
export function save(what = 'all') {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    emit('error', 'Storage is full — delete a custom buddy to free space.');
    throw e;
  }
  emit(what);
  if (what === 'all' || what === 'reminders' || what === 'settings') platform?.sync(state);
}
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what, data) { listeners.forEach((fn) => { try { fn(what, data); } catch (e) { console.error(e); } }); }

/* ---------- reminders ---------- */
export function upsert(input) {
  const now = Date.now();
  let r = state.reminders.find((x) => x.id === input.id);
  const fresh = !r;
  r = Object.assign(r || { id: uid(), createdAt: now, doneCount: 0 }, input);
  if (!r.id) r.id = uid();
  r.enabled = true; r.snoozed = false;
  r.nextAt = input.nextAt || (r.type === 'clock' ? computeNext(r, now) : now + Math.max(1, Number(r.minutes) || 1) * 60000);
  if (fresh) state.reminders.unshift(r);
  save('reminders');
  return r;
}
export function remove(id) {
  state.reminders = state.reminders.filter((x) => x.id !== id);
  if (ring && ring.id === id) stopRing(true);
  save('reminders');
}
export function toggle(id, enabled) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  r.enabled = enabled; r.snoozed = false;
  r.nextAt = enabled ? (r.type === 'clock' ? computeNext(r) : Date.now() + r.minutes * 60000) : null;
  save('reminders');
}
export function setSettings(patch) { state.settings = { ...state.settings, ...patch }; save('settings'); }
export function pause(minutes) {
  state.settings.pausedUntil = minutes ? Date.now() + minutes * 60000 : 0;
  if (!minutes) for (const r of state.reminders) if (r.enabled && r.nextAt && r.nextAt < Date.now()) r.nextAt = Date.now() + 3000;
  save('all');
}

/* ---------- characters / payload ---------- */
export function charSpec(id) {
  if (id && id.startsWith('custom:')) {
    const c = state.customChars.find((x) => x.id === id.slice(7));
    if (c) return { kind: 'custom', dataUrl: c.dataUrl, mode: c.mode, color: c.color, crop: c.crop, skin: c.skin, body: c.body };
  }
  return { kind: 'preset', id: id && !id.startsWith('custom:') ? id : 'arjun' };
}
export function payloadFor(r, extra = {}) {
  const s = state.settings;
  const cid = r.characterId && r.characterId !== 'default' ? r.characterId : s.characterId;
  return {
    reminderId: r.id, emoji: r.emoji || '⏰', name: s.name,
    headline: s.name ? `Hey, ${s.name}!` : 'Hey there!',
    message: r.message || r.title || 'Time for a break!',
    yesLabel: r.yesLabel || 'YES', celebrate: r.celebrate || 'Legend! 🎉',
    character: charSpec(cid),
    settings: { mischief: s.mischief, escalate: s.escalate, snoozeOptions: s.snoozeOptions, defaultSnooze: s.defaultSnooze, entrance: s.entrance, celebration: s.celebration },
    ...extra,
  };
}

/* ---------- firing ---------- */
function startRing(once) {
  const s = state.settings;
  stopRing();
  ring = ring || {};
  if (s.sound === 'none') return;
  const until = Date.now() + 90000;
  const play = () => {
    const d = globalThis.NudgeSounds.play(s.sound, s.volume);
    if (!once && s.ringUntilAnswered && Date.now() + 1000 < until) ring.loopTimer = setTimeout(play, (d + 2.2) * 1000);
  };
  play();
}
function stopRing(hideOverlay) {
  if (ring && ring.loopTimer) clearTimeout(ring.loopTimer);
  try { speechSynthesis.cancel(); } catch (e) { /* noop */ }
  if (hideOverlay) globalThis.NudgeOverlay.hide();
}
function speak(p) {
  if (!state.settings.voice || !globalThis.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(`${p.headline} ${p.message}`.replace(/\p{Extended_Pictographic}|️/gu, ''));
  u.pitch = 1.15; u.volume = Math.min(1, state.settings.volume + 0.2);
  speechSynthesis.speak(u);
}
function present(payload) {
  // Desktop main window hands reminders to the always-on-top Dock buddy window.
  if (platform && platform.present) return platform.present(payload);
  presentLocal(payload);
}
export function presentLocal(payload) {
  ring = { id: payload.reminderId, startedAt: Date.now() };
  payload.scene = !(platform && platform.overDesktop); // warm backdrop inside apps, transparent over the desktop
  payload.bottomInset = platform && platform.name === 'mobile' ? 28 : 0;
  if (platform && platform.decorate) platform.decorate(payload);
  globalThis.NudgeOverlay.show(payload);
  startRing(!!payload.preview);
  speak(payload);
  platform?.attention(payload);
}

export function fire(id, extra = {}) {
  const r = state.reminders.find((x) => x.id === id);
  if (!r) return;
  present(payloadFor(r, extra));
  emit('ringing', id);
}
export function preview({ reminderId, characterId } = {}) {
  const base = (reminderId && state.reminders.find((x) => x.id === reminderId)) ||
    { emoji: '💧', message: 'Did you drink water?', yesLabel: 'YES', celebrate: 'Hydration hero! 💧' };
  present(payloadFor({ ...base, id: '__preview', characterId: characterId || base.characterId }, { preview: true, settings: { ...payloadFor(base).settings, escalate: false } }));
}

/** Every second: fire anything due (one at a time). */
function tick() {
  if (globalThis.NudgeOverlay.isShowing()) return;
  const now = Date.now(), s = state.settings;
  const due = state.reminders.filter((r) => r.enabled && r.nextAt && r.nextAt <= now).sort((a, b) => a.nextAt - b.nextAt)[0];
  if (!due) return;
  if (s.pausedUntil > now) { due.nextAt = s.pausedUntil + 1000; return save('reminders'); }
  if (inQuietHours(s.quiet)) { due.nextAt = quietEnd(s.quiet); return save('reminders'); }
  fire(due.id, { welcomeBack: now - due.nextAt > 5 * 60000 });
}

/* ---------- answers ---------- */
export function answer(reminderId, action, minutes) {
  stopRing();
  globalThis.NudgeSounds.play(action === 'yes' ? 'tada' : 'womp', state.settings.volume * 0.8);
  ring = null;
  if (!reminderId || reminderId === '__preview') return streakInfo(state.stats);
  const r = state.reminders.find((x) => x.id === reminderId);
  const st = state.stats, today = dayKey();
  const h = (st.history[today] = st.history[today] || { done: 0, snoozed: 0 });
  if (action === 'yes') {
    h.done++; st.total = (st.total || 0) + 1;
    if (st.lastDone !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      st.streak = st.lastDone === dayKey(y) ? (st.streak || 0) + 1 : 1;
      st.lastDone = today;
    }
    st.best = Math.max(st.best || 0, st.streak);
    if (r) {
      r.doneCount = (r.doneCount || 0) + 1; r.snoozed = false;
      if (r.type === 'timer') { r.enabled = false; r.nextAt = null; r.doneAt = Date.now(); }
      else r.nextAt = computeNext(r);
      if (r.url) platform?.openExternal(r.url);
    }
  } else {
    h.snoozed++; st.snoozed = (st.snoozed || 0) + 1;
    if (r) { r.nextAt = Date.now() + Math.max(1, minutes || state.settings.defaultSnooze) * 60000; r.snoozed = true; }
  }
  const keys = Object.keys(st.history).sort();
  while (keys.length > 60) delete st.history[keys.shift()];
  save('all');
  return streakInfo(st);
}

/* ---------- boot ---------- */
export function init(p, opts = {}) {
  platform = p;
  load();
  // The overlay reports back through this host hook.
  globalThis.NudgeHost = {
    handle(msg) {
      if (msg.type === 'nb:answer') return answer(msg.reminderId, msg.action, msg.minutes);
      if (msg.type === 'nb:sfx' && state.settings.sound !== 'none') globalThis.NudgeSounds.play(msg.name, state.settings.volume * 0.8);
      return null;
    },
  };
  platform.init({
    // From a notification action (mobile/desktop/web) while the overlay isn't open
    onAction(reminderId, action) {
      if (action === 'open') { if (!globalThis.NudgeOverlay.isShowing()) fire(reminderId); return; }
      globalThis.NudgeOverlay.hide();
      answer(reminderId, action === 'yes' ? 'yes' : 'snooze', state.settings.defaultSnooze);
    },
    onPause: (m) => pause(m),
  });
  platform.sync(state);
  // Another window (desktop: main app ⇄ Dock buddy) changed the data → reload.
  addEventListener('storage', (e) => { if (e.key === KEY) { load(); emit('all'); } });
  clearInterval(tickTimer);
  if (opts.scheduler === false) return;   // UI-only window; the Dock buddy schedules
  tickTimer = setInterval(tick, 1000);
  setTimeout(tick, 600);
}
export { streakInfo };
