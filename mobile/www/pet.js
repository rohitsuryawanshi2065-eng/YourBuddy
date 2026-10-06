/* Nudge Buddy — Dock buddy. Lives in a transparent, click-through, always-on-top window whose
 * bottom edge sits on top of the macOS Dock / Windows taskbar. Also the reminder scheduler on desktop. */
import * as core from './core.js';
import { createPlatform } from './platform.js';

const Chars = globalThis.NudgeChars;
const Overlay = globalThis.NudgeOverlay;
const d = window.nudgeDesktop;
const S = core.state;
const $ = (s) => document.querySelector(s);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);

const style = document.createElement('style'); style.textContent = Chars.css; document.head.appendChild(style);

const platform = createPlatform();
core.init(platform, { scheduler: true });
d.onPresent((payload) => core.presentLocal(payload));   // previews / "try it" from the main window

/* ---------------- DOM + character ---------------- */
const petEl = $('#pet'), flipEl = petEl.querySelector('.flip'), bubbleEl = $('#bubble');
const SIZES = { s: 78, m: 100, l: 132 };
let charEl = null, petW = 66, petH = 100, charKey = '';
const petCfg = () => ({ enabled: true, wander: true, size: 'm', ...(S.settings.pet || {}) });

function mountChar() {
  const cfg = petCfg();
  const key = `${S.settings.characterId}|${cfg.size}|${JSON.stringify(core.charSpec(S.settings.characterId)).length}`;
  if (key === charKey) return;
  charKey = key;
  petH = SIZES[cfg.size] || 100; petW = Math.round(petH * 2 / 3);
  petEl.style.setProperty('--w', petW + 'px'); petEl.style.setProperty('--h', petH + 'px');
  flipEl.textContent = '';
  charEl = Chars.mount(flipEl, core.charSpec(S.settings.characterId), '');
  setPose(P.mode);
}

/* ---------------- state ---------------- */
const P = { x: 0, y: 0, vx: 0, vy: 0, dir: 1, mode: 'away', until: 0, target: 0, speed: 46 };
const mouse = { x: -999, y: -999, t: 0, near: false };
let lastNearReact = 0, lastActivity = Date.now(), hiddenUntil = 0, dragging = null;
const W = () => innerWidth, H = () => innerHeight;

function setPose(mode) {
  if (!charEl) return;
  charEl.classList.remove('nb-idle', 'nb-walk', 'nb-running', 'nb-fast', 'nb-dance', 'nb-impatient');
  petEl.classList.remove('sleep', 'look', 'hop');
  if (mode === 'walk' || mode === 'enter') {
    // stride ≈ 0.42 × height per full cycle → feet don't slide
    charEl.style.setProperty('--cyc', Math.max(0.42, Math.min(1.2, (petH * 0.42) / Math.max(20, P.speed))).toFixed(2) + 's');
    charEl.classList.add(P.speed > 85 ? 'nb-running' : 'nb-walk');
  }
  else if (mode === 'drag') charEl.classList.add('nb-running', 'nb-fast');
  else if (mode === 'air') petEl.classList.add('hop');
  else if (mode === 'sleep') { petEl.classList.add('sleep'); charEl.classList.add('nb-idle'); }
  else if (mode === 'dance') charEl.classList.add('nb-dance');
  else if (mode === 'look') { petEl.classList.add('look'); charEl.classList.add('nb-idle'); }
  else charEl.classList.add('nb-idle');
}
function setMode(mode, ms = 0) { P.mode = mode; P.until = performance.now() + ms; setPose(mode); }
function face(dir) { P.dir = dir; flipEl.classList.toggle('left', dir < 0); }

let bubbleT = 0;
function say(text, ms = 2600) {
  bubbleEl.textContent = text; bubbleEl.classList.add('on');
  clearTimeout(bubbleT); bubbleT = setTimeout(() => bubbleEl.classList.remove('on'), ms);
}
function puff(x, y, n = 5) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div'); p.className = 'puff';
    const s = rand(8, 16); p.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px`;
    document.body.appendChild(p);
    p.animate([{ transform: 'scale(.3)', opacity: .95 }, { transform: `translate(${rand(-26, 26)}px,${rand(-18, 2)}px) scale(1.5)`, opacity: 0 }], { duration: rand(380, 620), easing: 'ease-out' }).finished.then(() => p.remove());
  }
}

function nextLine() {
  const n = S.reminders.filter((r) => r.enabled && r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
  if (!n) return 'No nudges yet — right-click me! 🙂';
  const m = Math.max(0, Math.round((n.nextAt - Date.now()) / 60000));
  return `${n.emoji} ${n.title} in ${m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`}`;
}

/* ---------------- brain ---------------- */
function decide() {
  const cfg = petCfg();
  const idleFor = Date.now() - lastActivity;
  if (idleFor > 4 * 60000 && Math.random() < .7) { setMode('sleep', rand(20000, 60000)); return; }
  const r = Math.random();
  if (cfg.wander && r < .5) {
    const dist = rand(120, Math.min(520, W() * .45)) * (Math.random() < .5 ? -1 : 1);
    P.target = Math.max(8, Math.min(W() - petW - 8, P.x + dist));
    if (Math.abs(P.target - P.x) < 40) P.target = P.x > W() / 2 ? P.x - 160 : P.x + 160;
    face(P.target > P.x ? 1 : -1); P.speed = rand(38, 60);
    setMode('walk', 30000);
  } else if (r < .7) setMode('idle', rand(2500, 6000));
  else if (r < .8) { setMode('look', 1600); }
  else if (r < .88) { hop(rand(260, 380)); }
  else if (r < .94) { setMode('dance', 2200); if (Math.random() < .5) say(pick(['🎶 la la la', 'Stay hydrated! 💧', 'Stretch break soon?', 'You’re doing great ✨'])); }
  else { face(-P.dir); setMode('idle', 1500); }
}
function hop(v) { P.vy = v; P.vx = (Math.random() < .5 ? 0 : P.dir * rand(40, 90)); setMode('air'); }
function land() {
  P.y = 0; P.vy = 0; P.vx = 0;
  petEl.classList.remove('land'); void petEl.offsetWidth; petEl.classList.add('land');
  puff(P.x + petW / 2, H() - 4, 4);
  setMode('idle', rand(700, 1600));
}

/* ---------------- loop ---------------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const cfg = petCfg();
  const overlayOn = Overlay.isShowing();
  const shouldHide = overlayOn || !cfg.enabled || Date.now() < hiddenUntil;

  if (shouldHide) {
    if (P.mode !== 'away') { petEl.classList.add('gone'); setMode('away'); if (dragging) dragging = null; }
  } else if (P.mode === 'away') {
    // walk back in from the nearest edge
    mountChar();
    const fromLeft = P.x < W() / 2;
    P.x = fromLeft ? -petW - 10 : W() + 10; P.y = 0;
    P.target = fromLeft ? rand(60, W() * .4) : rand(W() * .6, W() - petW - 60);
    face(fromLeft ? 1 : -1); P.speed = 90;
    petEl.classList.remove('gone');
    setMode('enter', 20000);
  } else {
    switch (P.mode) {
      case 'walk': case 'enter': {
        P.x += P.dir * P.speed * dt;
        if ((P.dir > 0 && P.x >= P.target) || (P.dir < 0 && P.x <= P.target)) { P.x = P.target; setMode('idle', rand(1500, 4000)); }
        break;
      }
      case 'air': case 'fall': {
        P.vy -= 1500 * dt; P.y += P.vy * dt; P.x += P.vx * dt;
        P.x = Math.max(0, Math.min(W() - petW, P.x));
        if (P.y <= 0) { land(); if (P.mode === 'idle' && P._fell) { say(pick(['Oof! 😵', 'Wheee… ouch', 'Again! Again!'])); P._fell = false; } }
        break;
      }
      case 'drag': break;
      default:
        if (now > P.until) decide();
    }
    // react when the cursor comes close (not too often)
    if (['idle', 'walk', 'sleep', 'look'].includes(P.mode) && mouse.near && Date.now() - mouse.t < 400 && Date.now() - lastNearReact > 15000) {
      lastNearReact = Date.now();
      const wasAsleep = P.mode === 'sleep';
      face(mouse.x > P.x + petW / 2 ? 1 : -1);
      setMode('idle', 2200);
      if (wasAsleep) { hop(300); say('Huh?! I’m awake! 😳'); }
      else if (Math.random() < .55) say(pick(['Hi! 👋', 'Need a nudge?', 'Working hard? 💪', 'Psst… water? 💧', nextLine()]));
    }
  }
  window.__petX = P.x;
  petEl.style.transform = `translate(${Math.round(P.x)}px,${Math.round(-P.y)}px)`;
  requestAnimationFrame(frame);
}

/* ---------------- click-through + mouse ---------------- */
let ignoring = true;
function setIgnore(v) { if (v !== ignoring) { ignoring = v; d.petIgnore(v); } }
addEventListener('mousemove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = Date.now(); lastActivity = Date.now();
  const cx = P.x + petW / 2, cy = H() - P.y - petH / 2;
  mouse.near = Math.hypot(mouse.x - cx, mouse.y - cy) < 150;
  if (dragging) {
    if (!dragging.active && Math.hypot(e.clientX - dragging.sx, e.clientY - dragging.sy) > 5) {
      dragging.active = true; petEl.classList.add('dragging'); setMode('drag'); say(pick(['Wheee! 🎈', 'Put me down! 😆', 'Where are we going?']), 1600);
    }
    if (dragging.active) {
      P.x = Math.max(-petW / 2, Math.min(W() - petW / 2, e.clientX - dragging.ox));
      P.y = Math.max(0, H() - (e.clientY - dragging.oy) - petH);
      dragging.vx = e.movementX; dragging.vy = -e.movementY;
    }
    return;
  }
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const hit = !!(el && (el.closest('#pet') || el.tagName === 'NUDGE-BUDDY-OVERLAY'));
  setIgnore(!hit);
});
petEl.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const r = petEl.getBoundingClientRect();
  dragging = { sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, active: false, vx: 0, vy: 0 };
});
addEventListener('mouseup', () => {
  if (!dragging) return;
  const dr = dragging; dragging = null;
  petEl.classList.remove('dragging');
  if (dr.active) {
    P.vx = Math.max(-500, Math.min(500, dr.vx * 30)); P.vy = Math.max(-200, Math.min(600, dr.vy * 30));
    P._fell = true; setMode('fall');
    return;
  }
  clickOnPet();
});
let clickT = 0;
function clickOnPet() {
  clearTimeout(clickT);
  clickT = setTimeout(() => {
    if (P.mode === 'sleep') { hop(320); say('Five more minutes… 😴'); return; }
    hop(rand(300, 380));
    if (S.settings.sound !== 'none') globalThis.NudgeSounds.play('boing', S.settings.volume * 0.5);
    say(Math.random() < .6 ? `Next: ${nextLine()}` : pick(['Hehe, that tickles!', 'Boop! 💥', 'I’m on duty 🫡', 'Double-click to open me!']));
  }, 230);
}
petEl.addEventListener('dblclick', () => { clearTimeout(clickT); d.openMain(); say('Opening! ✨', 1200); });
petEl.addEventListener('contextmenu', (e) => { e.preventDefault(); d.petMenu({ next: nextLine(), paused: S.settings.pausedUntil > Date.now() }); });

/* ---------------- commands from the tray / pet menu ---------------- */
d.onTray((cmd, arg) => {
  if (cmd === 'quick') {
    const r = core.upsert({ type: 'timer', minutes: arg, emoji: '⏰', title: `Quick nudge`, message: `Your ${arg}-minute timer is up!`, yesLabel: 'Got it', celebrate: 'Right on time! ⏱️' });
    hop(320); say(`On it! See you in ${arg} min ⏰`);
    void r;
  } else if (cmd === 'water') {
    if (!S.reminders.some((r) => r.title === 'Hydrate' && r.enabled)) core.upsert({ type: 'interval', minutes: 45, emoji: '💧', title: 'Hydrate', message: 'Did you drink water?', yesLabel: 'YES', celebrate: 'Hydration hero! 💧' });
    setMode('dance', 1800); say('Water every 45 min 💧 deal!');
  } else if (cmd === 'hide') {
    hiddenUntil = Date.now() + arg * 60000; say('Okay, hiding… 🙈', 1000);
  } else if (cmd === 'show') {
    hiddenUntil = 0;
  } else if (cmd === 'try') {
    core.preview({});
  }
});

core.on(() => mountChar());
mountChar();
requestAnimationFrame(frame);
