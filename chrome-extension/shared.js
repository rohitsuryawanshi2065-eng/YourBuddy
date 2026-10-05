/* Shared constants & helpers (ES module: background + popup). */
export const DEFAULT_SETTINGS = {
  name: '',
  characterId: 'arjun',          // preset id or 'custom:<id>'
  sound: 'chime',
  volume: 0.7,
  ringUntilAnswered: true,
  voice: false,                  // buddy speaks the reminder aloud
  mischief: true,                // "Remind me later" dodges the cursor (twice)
  escalate: true,                // buddy gets impatient if ignored
  chase: true,                   // follows you when you switch tabs
  entrance: 'random',            // random | run | drop | peek
  celebration: 'random',         // random | zoomies | rocket | clones | disco
  snoozeOptions: [2, 5, 10, 15, 30, 60],
  defaultSnooze: 10,
  away: 'window',                // when Chrome isn't focused: window | notification | both | wait
  skipWhenLocked: true,          // hold reminders while the screen is locked
  quiet: { enabled: false, start: '22:00', end: '08:00' },
  pausedUntil: 0,
};

export const TEMPLATES = [
  { emoji: '💧', title: 'Hydrate', message: 'Did you drink water?', yesLabel: 'YES', celebrate: 'Hydration hero! 💧', type: 'interval', minutes: 45 },
  { emoji: '🧘', title: 'Stretch', message: 'Stretch those limbs!', yesLabel: 'On it!', celebrate: 'So bendy! 🧘', type: 'interval', minutes: 60 },
  { emoji: '👀', title: 'Eye break', message: '20-20-20: look 20 ft away for 20 sec', yesLabel: 'Done', celebrate: 'Eyes refreshed! 👀', type: 'interval', minutes: 20 },
  { emoji: '🪑', title: 'Posture', message: 'Sit up straight, superstar!', yesLabel: 'Fixed it', celebrate: 'Spine of steel! 🦴', type: 'interval', minutes: 30 },
  { emoji: '🚶', title: 'Walk', message: 'Time for a quick walk!', yesLabel: 'Let’s go', celebrate: 'Steps unlocked! 🚶', type: 'interval', minutes: 90 },
  { emoji: '🍅', title: 'Focus sprint', message: 'Pomodoro done — take 5!', yesLabel: 'Break time', celebrate: 'Focus master! 🍅', type: 'timer', minutes: 25 },
  { emoji: '💊', title: 'Meds', message: 'Take your vitamins / meds', yesLabel: 'Taken', celebrate: 'Health boss! 💊', type: 'clock', time: '09:00', days: [] },
  { emoji: '📞', title: 'Meeting', message: 'Your meeting starts soon!', yesLabel: 'Joining', celebrate: 'Punctual legend! ⏱️', type: 'timer', minutes: 10 },
];

export const EMOJIS = ['💧', '🧘', '👀', '🪑', '🚶', '🍅', '💊', '📞', '☕', '🍎', '😴', '📚', '🏋️', '🐶', '🌱', '⏰', '🎯', '💡', '🧹', '🎮'];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function fmtMin(m) {
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440}d`;
  if (m >= 60) return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`;
  return `${m} min`;
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function fmtDays(days) {
  if (!days || !days.length || days.length === 7) return 'every day';
  const s = [...days].sort().join('');
  if (s === '12345') return 'weekdays';
  if (s === '06') return 'weekends';
  return [...days].sort().map((d) => DAY[d]).join(', ');
}

/** Next fire time for a reminder (ms epoch). */
export function computeNext(r, from = Date.now()) {
  if (r.type === 'clock') {
    const [hh, mm] = (r.time || '09:00').split(':').map(Number);
    const days = r.days && r.days.length ? r.days : [0, 1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 8; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      d.setHours(hh, mm, 0, 0);
      if (d.getTime() > from + 1000 && days.includes(d.getDay())) return d.getTime();
    }
    return from + 86400000;
  }
  return from + Math.max(1, Number(r.minutes) || 1) * 60000;
}

export function inQuietHours(q, now = new Date()) {
  if (!q || !q.enabled) return false;
  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const n = now.getHours() * 60 + now.getMinutes(), a = toMin(q.start), b = toMin(q.end);
  return a <= b ? n >= a && n < b : n >= a || n < b;
}
export function quietEnd(q, now = new Date()) {
  const [h, m] = q.end.split(':').map(Number);
  const d = new Date(now); d.setHours(h, m, 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function streakInfo(stats) {
  const today = dayKey();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const alive = stats.lastDone === today || stats.lastDone === dayKey(y);
  return { streak: alive ? stats.streak || 0 : 0, today: (stats.history?.[today]?.done) || 0 };
}
