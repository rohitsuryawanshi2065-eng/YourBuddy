/* Nudge Buddy landing page — live buddies, a mini Dock pet, and a real on-page nudge demo. */
(function () {
  const C = window.NudgeChars, O = window.NudgeOverlay, Snd = window.NudgeSounds;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const st = document.createElement('style'); st.textContent = C.css; document.head.appendChild(st);

  let current = { kind: 'preset', id: 'arjun' };
  let currentName = 'Arjun';
  const mount = (box, spec, emoji, cls = 'nb-idle') => { box.textContent = ''; const el = C.mount(box, spec, emoji || ''); if (cls) el.classList.add(...cls.split(' ')); return el; };
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2400); }

  /* ---------------- downloads + OS detection ---------------- */
  const cfg = window.NB_CONFIG || {};
  const gh = (f) => `https://github.com/${cfg.repo}/releases/latest/download/${f}`;
  const urls = { mac: cfg.macUrl || gh(cfg.macFile), win: cfg.winUrl || gh(cfg.winFile) };
  const os = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'mac' : /Win/.test(navigator.platform || navigator.userAgent) ? 'win' : null;
  const notConfigured = !cfg.repo || cfg.repo.startsWith('YOUR-');
  $$('.dl').forEach((a) => {
    const k = a.dataset.os;
    if (a.closest('.download') || !a.closest('.hero')) a.href = urls[k];
    else a.href = urls[k];
    if (k === os) a.classList.add('recommended');
    a.addEventListener('click', (e) => {
      if (notConfigured) { e.preventDefault(); toast('Downloads go live after the first release ✨'); return; }
      toast(k === 'mac' ? '⬇️ Downloading for Mac… see you on the Dock!' : '⬇️ Downloading for Windows… see you on the taskbar!');
    });
  });
  // Put the visitor's OS first in the hero
  if (os === 'win') { const row = $('.cta-row'); row.insertBefore(row.children[1], row.children[0]); row.children[0].classList.replace('btn-ghost', 'btn-primary'); row.children[1].classList.replace('btn-primary', 'btn-ghost'); }

  /* ---------------- dock icons (generic, original) ---------------- */
  const ICONS = [
    ['#2b80ff', '<path d="M5 6h14v12H5z" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M5 10h14" stroke="#fff" stroke-width="2.2"/>'],
    ['#ff6b3d', '<circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M12 8v4l3 2" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'],
    ['#22c55e', '<path d="M5 17V7l7 5 7-5v10" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>'],
    ['#241a3a', '<path d="M7 9l3 3-3 3M12 15h5" fill="none" stroke="#4cf0ff" stroke-width="2.2" stroke-linecap="round"/>'],
    ['#ffb800', '<path d="M6 6h12v9H10l-4 3z" fill="#fff"/>'],
    ['#7c4dff', '<path d="M9 17V8l9-2v9" fill="none" stroke="#fff" stroke-width="2.2"/><circle cx="7.5" cy="17" r="2" fill="#fff"/><circle cx="16.5" cy="15" r="2" fill="#fff"/>'],
    ['#ec4899', '<circle cx="9" cy="10" r="2" fill="#fff"/><path d="M5 18l5-5 3 3 2-2 4 4z" fill="#fff"/>'],
    'sep',
    ['#0ea5e9', '<path d="M6 7h12M6 12h12M6 17h7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'],
    ['#10b981', '<path d="M7 13l3 3 7-8" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['#fff', '<image href="/assets/icon128.png" x="0" y="0" width="24" height="24"/>'],
  ];
  $('#dock').innerHTML = ICONS.map((i) => i === 'sep' ? '<div class="sep"></div>' :
    `<div class="app" style="background:${i[0]}"><svg viewBox="0 0 24 24" ${i[0] === '#fff' ? 'style="width:100%;height:100%"' : ''}>${i[1]}</svg></div>`).join('');

  /* ---------------- clock ---------------- */
  const tickClock = () => { $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  tickClock(); setInterval(tickClock, 20000);

  /* ---------------- mini Dock pet ---------------- */
  const screen = $('#screen'), dock = $('#dock'), petEl = $('#pet'), flip = petEl.querySelector('.pet-flip'), bubble = $('#petBubble');
  const P = { x: 120, y: 0, vy: 0, vx: 0, dir: 1, mode: 'idle', until: 0, target: 0, speed: 40 };
  let petChar, pw = 46, ph = 69, drag = null;
  function sizePet() {
    ph = Math.round(Math.max(52, Math.min(84, screen.clientHeight * 0.16))); pw = Math.round(ph * 2 / 3);
    petEl.style.setProperty('--pw', pw + 'px'); petEl.style.setProperty('--ph', ph + 'px');
  }
  function mountPet() { petChar = mount(flip, current, '', 'nb-idle'); setPose(P.mode); }
  function setPose(m) {
    if (!petChar) return;
    petChar.classList.remove('nb-idle', 'nb-walk', 'nb-running', 'nb-fast', 'nb-dance');
    petEl.classList.remove('hop');
    if (m === 'walk') { petChar.style.setProperty('--cyc', Math.max(.45, Math.min(1.2, ph * .42 / P.speed)).toFixed(2) + 's'); petChar.classList.add('nb-walk'); }
    else if (m === 'drag') petChar.classList.add('nb-running', 'nb-fast');
    else if (m === 'air') petEl.classList.add('hop');
    else if (m === 'dance') petChar.classList.add('nb-dance');
    else petChar.classList.add('nb-idle');
  }
  function setMode(m, ms = 0) { P.mode = m; P.until = performance.now() + ms; setPose(m); }
  function face(d) { P.dir = d; flip.classList.toggle('left', d < 0); }
  function say(t, ms = 2400) { bubble.textContent = t; bubble.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => bubble.classList.remove('on'), ms); }
  function groundY() { return dock.offsetTop - ph + 2; }       // stand on top of the dock
  function bounds() { return [dock.offsetLeft + 4, dock.offsetLeft + dock.offsetWidth - pw - 4]; }
  function decide() {
    const [a, b] = bounds(), r = Math.random();
    if (r < .55) { P.target = rand(a, b); if (Math.abs(P.target - P.x) < 30) P.target = P.x < (a + b) / 2 ? b : a; face(P.target > P.x ? 1 : -1); P.speed = rand(32, 52); setMode('walk', 20000); }
    else if (r < .75) setMode('idle', rand(1800, 3800));
    else if (r < .85) hop(rand(170, 230));
    else if (r < .93) { setMode('dance', 1800); say(pick(['🎶', 'Hydrate! 💧', 'Hi there 👋', 'Stretch? 🧘'])); }
    else { face(-P.dir); setMode('idle', 1200); }
  }
  function hop(v) { P.vy = v; P.vx = 0; setMode('air'); }
  let last = performance.now(), visible = true;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const [a, b] = bounds();
    if (O.isShowing()) petEl.style.opacity = '0';
    else {
      petEl.style.opacity = '1';
      if (P.mode === 'walk') { P.x += P.dir * P.speed * dt; if ((P.dir > 0 && P.x >= P.target) || (P.dir < 0 && P.x <= P.target)) { P.x = P.target; setMode('idle', rand(1200, 3000)); } }
      else if (P.mode === 'air' || P.mode === 'fall') {
        P.vy -= 900 * dt; P.y += P.vy * dt; P.x += P.vx * dt;
        if (P.y <= 0) { P.y = 0; P.vx = 0; petEl.classList.remove('land'); void petEl.offsetWidth; petEl.classList.add('land'); const wasFall = P.mode === 'fall'; setMode('idle', rand(900, 1800)); if (wasFall) say(pick(['Oof! 😵', 'Again! Again!', 'Wheee… ouch'])); }
      } else if (P.mode !== 'drag' && now > P.until) decide();
      if (P.mode !== 'drag') P.x = Math.max(a - 10, Math.min(b + 10, P.x));
    }
    petEl.style.transform = `translate(${Math.round(P.x)}px,${Math.round(groundY() - P.y)}px)`;
    if (visible) requestAnimationFrame(frame); else setTimeout(() => requestAnimationFrame(frame), 300);
  }
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(screen);
  // interactions
  petEl.addEventListener('pointerdown', (e) => {
    const r = petEl.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, active: false, vx: 0, vy: 0 };
    petEl.setPointerCapture(e.pointerId);
  });
  petEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.active && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) { drag.active = true; petEl.classList.add('drag'); setMode('drag'); say(pick(['Wheee! 🎈', 'Put me down! 😆', 'Where are we going?']), 1500); $('.s1').style.opacity = '0'; }
    if (drag.active) {
      const sr = screen.getBoundingClientRect();
      P.x = e.clientX - sr.left - drag.ox;
      P.y = Math.max(0, groundY() - (e.clientY - sr.top - drag.oy));
      drag.vx = e.movementX; drag.vy = -e.movementY;
    }
  });
  petEl.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag; drag = null; petEl.classList.remove('drag');
    if (d.active) { P.vx = Math.max(-260, Math.min(260, d.vx * 18)); P.vy = Math.max(-100, Math.min(360, d.vy * 18)); setMode('fall'); return; }
    hop(220); Snd.play('boing', .35);
    say(pick(['Hehe, that tickles!', 'Next: 💧 Hydrate in 12 min', 'Boop! 💥', 'Drag me around!', 'I’m on duty 🫡']));
  });
  petEl.addEventListener('pointerenter', () => { if (P.mode === 'idle' || P.mode === 'walk') { setMode('idle', 1800); if (Math.random() < .5) say(pick(['Hi! 👋', 'Need a nudge?', 'Psst… water? 💧'])); } });

  /* ---------------- real on-page nudge demo ---------------- */
  window.NudgeHost = {
    handle(msg) {
      if (msg.type === 'nb:sfx') Snd.play(msg.name, .5);
      if (msg.type === 'nb:answer') {
        Snd.play(msg.action === 'yes' ? 'tada' : 'womp', .5);
        if (msg.action === 'yes') setTimeout(() => toast('That’s the whole idea. Now imagine it on your Dock 😉'), 4500);
        return msg.action === 'yes' ? { streak: 1, today: 1 } : null;
      }
      return null;
    },
  };
  const DEMOS = [
    { emoji: '💧', message: 'Did you drink water?', yesLabel: 'YES', celebrate: 'Hydration hero! 💧' },
    { emoji: '🧘', message: 'Stretch those limbs!', yesLabel: 'On it!', celebrate: 'So bendy! 🧘' },
    { emoji: '👀', message: 'Look 20 ft away for 20 sec', yesLabel: 'Done', celebrate: 'Eyes refreshed! 👀' },
  ];
  let demoI = 0;
  function nudge(fromPet) {
    if (O.isShowing()) return;
    const d = DEMOS[demoI++ % DEMOS.length];
    Snd.play('chime', .5);
    const r = petEl.getBoundingClientRect();
    O.show({
      reminderId: '__demo', preview: true, emoji: d.emoji, name: '', headline: 'Hey there!', message: d.message, yesLabel: d.yesLabel, celebrate: d.celebrate,
      character: current, fromX: fromPet && r.width ? r.left : undefined,
      settings: { mischief: true, escalate: false, snoozeOptions: [2, 5, 10, 15, 30], defaultSnooze: 10, entrance: fromPet ? 'run' : 'random', celebration: 'random' },
    });
  }
  $('#tryHero').addEventListener('click', () => nudge(true));
  $('#tryVs').addEventListener('click', () => nudge(false));

  /* ---------------- versus mini stage ---------------- */
  const vs = $('#vsStage');
  vs.innerHTML = '<div class="vs-head">Hey! Did you drink water?</div><div class="vs-btns"><span>YES</span><span>Remind me later</span></div><div class="vs-char"></div>';
  mount(vs.querySelector('.vs-char'), { kind: 'preset', id: 'blobby' }, '💧', 'nb-running');
  // switch running/idle with the CSS loop
  setInterval(() => { const el = vs.querySelector('.nb-char'); const t = (performance.now() % 6000) / 6000; el.classList.toggle('nb-running', t < .25 || t > .8); el.classList.toggle('nb-idle', t >= .25 && t <= .8); }, 150);
  $$('.mini-buddy').forEach((b) => mount(b, { kind: 'preset', id: b.dataset.buddy }, '🍅', 'nb-running nb-fast'));

  /* ---------------- buddy gallery ---------------- */
  const grid = $('#buddyGrid');
  grid.innerHTML = C.presets.map((p) => `<button class="bcard${p.id === 'arjun' ? ' on' : ''}" data-id="${p.id}"><div class="bs"></div><b>${p.name}</b><small>${p.tagline}</small></button>`).join('');
  $$('.bcard').forEach((b) => {
    const el = mount(b.querySelector('.bs'), { kind: 'preset', id: b.dataset.id }, '💧');
    b.addEventListener('mouseenter', () => { el.classList.remove('nb-idle'); el.classList.add('nb-dance'); });
    b.addEventListener('mouseleave', () => { el.classList.remove('nb-dance'); el.classList.add('nb-idle'); });
    b.addEventListener('click', () => {
      $$('.bcard').forEach((x) => x.classList.toggle('on', x === b));
      current = { kind: 'preset', id: b.dataset.id }; currentName = C.presets.find((p) => p.id === b.dataset.id).name;
      setBuddy();
      document.querySelector('.hero').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { hop(240); say(`Hi, I’m ${currentName}! 👋`); }, 650);
    });
  });
  function setBuddy() {
    $('#petName').textContent = currentName;
    mountPet();
    mount($('#dlBuddy'), current, '⬇️', 'nb-idle');
  }

  /* ---------------- upload: make you the buddy ---------------- */
  mount($('#uploadStage'), { kind: 'preset', id: 'arjun' }, '📸', 'nb-idle');
  $('#upload').addEventListener('click', () => window.NudgeToon && NudgeToon.preload());
  $('#upload').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const stage = $('#uploadStage');
    stage.innerHTML = '<div class="toon-loading"><div class="toon-spin"></div><span id="toonStep">✨ Turning you into a cartoon…</span></div>';
    try {
      const r = await NudgeToon.cartoonize(f, { onStep: (t) => { const el = $('#toonStep'); if (el) el.textContent = '✨ ' + t; } });
      let spec;
      if (r.ok) spec = { kind: 'custom', dataUrl: r.head, mode: 'toon', color: r.shirt, skin: r.skin, crop: { zoom: 1, x: 0, y: 0 } };
      else spec = { kind: 'custom', dataUrl: r.photo, mode: 'body', color: '#4a7cc4', crop: { zoom: 1, x: 0, y: 0 } };
      mount(stage, spec, '💧', 'nb-dance');
      current = spec; currentName = 'You'; setBuddy();
      $$('.bcard').forEach((x) => x.classList.remove('on'));
      toast(r.ok ? 'Ta-da! Cartoon you is on the Dock now ⬆️' : 'Couldn’t spot a face, so we used your photo ⬆️');
    } catch (err) { mount(stage, { kind: 'preset', id: 'arjun' }, '📸', 'nb-idle'); toast('Couldn’t read that image'); }
  });

  /* ---------------- nav + reveal ---------------- */
  addEventListener('scroll', () => $('.nav').classList.toggle('scrolled', scrollY > 10), { passive: true });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0, rootMargin: '0px 0px -8% 0px' });
  setTimeout(() => $$('.reveal').forEach((s) => s.classList.add('in')), 4000); // safety net
  $$('.versus, .how, .buddies, .features, .download, .faq').forEach((s) => { s.classList.add('reveal'); io.observe(s); });
  $('#yr').textContent = new Date().getFullYear();

  /* ---------------- boot ---------------- */
  sizePet(); setBuddy();
  addEventListener('resize', sizePet);
  P.x = bounds()[0] + 30;
  setTimeout(() => say('Hi! I live here now 👋', 2600), 900);
  requestAnimationFrame(frame);
})();
