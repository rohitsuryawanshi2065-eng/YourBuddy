/* Platform adapters. Same interface everywhere:
 *   init({ onAction, onPause })   sync(state)   attention(payload)   openExternal(url)
 *   requestPermission() → Promise<bool>   name   features{} */
import { computeNext } from './shared.js';

const strip = (s) => String(s || '').trim();

/* ---------------- Desktop (Electron, via preload bridge) ---------------- */
function desktop() {
  const d = window.nudgeDesktop;
  return {
    name: 'desktop',
    features: { autoLaunch: true, background: true },
    init({ onAction, onPause }) {
      d.onTray((cmd, arg) => {
        if (cmd === 'pause') onPause(arg);
        if (cmd === 'action') onAction(arg.reminderId, arg.action);
      });
    },
    sync(state) {
      const next = state.reminders.filter((r) => r.enabled && r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
      d.status(next ? { at: next.nextAt, title: `${next.emoji} ${next.title}` } : null);
    },
    // Reminders & previews are shown by the Dock buddy window, over every app.
    present(p) { d.present(p); },
    attention() {},
    openExternal(url) { d.openExternal(url); },
    requestPermission: async () => true,
    getAutoLaunch: () => d.getAutoLaunch(),
    setAutoLaunch: (on) => d.setAutoLaunch(on),
  };
}

/* ---------------- Desktop Dock buddy window (transparent, always on top) ---------------- */
function desktopPet() {
  const d = window.nudgeDesktop;
  return {
    name: 'desktop',
    features: {},
    overDesktop: true,
    init({ onAction, onPause }) {
      d.onTray((cmd, arg) => {
        if (cmd === 'pause') onPause(arg);
        if (cmd === 'action') onAction(arg.reminderId, arg.action);
      });
    },
    sync(state) {
      const next = state.reminders.filter((r) => r.enabled && r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
      d.status(next ? { at: next.nextAt, title: `${next.emoji} ${next.title}` } : null);
    },
    decorate(p) { if (window.__petX != null) p.fromX = window.__petX; },
    attention(p) { d.petAttention({ preview: !!p.preview }); },
    openExternal(url) { d.openExternal(url); },
    requestPermission: async () => true,
  };
}

/* ---------------- Mobile (Capacitor + Local Notifications) ---------------- */
function mobile() {
  const LN = window.Capacitor.Plugins.LocalNotifications;
  const idBase = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (Math.abs(h) % 200000) * 100; };
  let syncing = Promise.resolve();
  return {
    name: 'mobile',
    features: { background: true },
    async init({ onAction }) {
      try {
        await LN.registerActionTypes({ types: [{ id: 'NUDGE', actions: [{ id: 'yes', title: '✅ Yes, done' }, { id: 'later', title: '⏰ Remind me later' }] }] });
      } catch (e) { /* web preview */ }
      LN.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
        const id = notification && notification.extra && notification.extra.reminderId;
        if (!id) return;
        onAction(id, actionId === 'yes' ? 'yes' : actionId === 'later' ? 'later' : 'open');
      });
    },
    /** Pre-schedule upcoming occurrences so nudges arrive even when the app is closed.
     *  iOS allows max 64 pending, so we keep the soonest 60. */
    sync(state) {
      syncing = syncing.then(async () => {
        const s = state.settings;
        const pending = await LN.getPending();
        if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
        const out = [];
        for (const r of state.reminders) {
          if (!r.enabled || !r.nextAt) continue;
          const times = [r.nextAt];
          if (r.type !== 'timer') {
            let t = r.nextAt;
            for (let k = 0; k < 11; k++) { t = computeNext(r, t); if (t - Date.now() > 3 * 86400000) break; times.push(t); }
          }
          times.forEach((t, k) => {
            if (t < Date.now() + 2000) return;
            if (s.pausedUntil > t) return;
            out.push({
              id: idBase(r.id) + k,
              title: `${r.emoji || '⏰'} ${s.name ? `Hey, ${s.name}!` : 'Hey there!'}`,
              body: r.message || r.title,
              schedule: { at: new Date(t), allowWhileIdle: true },
              actionTypeId: 'NUDGE',
              extra: { reminderId: r.id },
            });
          });
        }
        out.sort((a, b) => a.schedule.at - b.schedule.at);
        if (out.length) await LN.schedule({ notifications: out.slice(0, 60) });
      }).catch((e) => console.warn('notification sync failed', e));
      return syncing;
    },
    attention() { /* app is in the foreground; the overlay is the attention */ },
    openExternal(url) { window.open(url, '_blank'); },
    async requestPermission() {
      try {
        let p = await LN.checkPermissions();
        if (p.display !== 'granted') p = await LN.requestPermissions();
        if (LN.checkExactNotificationSetting) {
          const ex = await LN.checkExactNotificationSetting();
          if (ex.exact_alarm !== 'granted') await LN.changeExactNotificationSetting();
        }
        return p.display === 'granted';
      } catch (e) { return false; }
    },
  };
}

/* ---------------- Plain web (browser tab / PWA preview) ---------------- */
function web() {
  return {
    name: 'web',
    features: {},
    init() {},
    sync(state) {
      const next = state.reminders.filter((r) => r.enabled && r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
      document.title = next ? `Nudge Buddy · ${strip(next.title)}` : 'Nudge Buddy';
    },
    attention(p) {
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(`${p.emoji} ${p.headline}`, { body: p.message, icon: 'icons/icon128.png', requireInteraction: true });
        n.onclick = () => { window.focus(); n.close(); };
      }
    },
    openExternal(url) { window.open(url, '_blank', 'noopener'); },
    async requestPermission() {
      if (!('Notification' in window)) return false;
      return (await Notification.requestPermission()) === 'granted';
    },
  };
}

export function createPlatform() {
  if (window.nudgeDesktop) return /pet\.html$/.test(location.pathname) ? desktopPet() : desktop();
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return mobile();
  return web();
}
