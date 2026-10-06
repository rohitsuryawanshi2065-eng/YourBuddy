/* Nudge Buddy — on-page overlay (classic script). Injected on demand into the active tab,
 * and also used by the mini-window fallback (reminder.html). Exposes globalThis.NudgeOverlay. */
(function () {
  const g = globalThis;
  if (g.NudgeOverlay) return;
  const C = g.NudgeChars;
  const esc = C.esc;
  const reduced = g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmtMin = (m) => (m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`) : `${m} min`);

  const POKES = ['Hehe, that tickles!', 'Hey! Eyes up here 👀', 'Poke me again, I dare you', 'I’m not a button! …ok fine', 'Boop! 💥', 'Focus, champ!'];
  const DODGES = ['Nope! 😜', 'Too slow! 🏃', 'Come onnn, just do it!', 'Catch me if you can!'];
  const NAGS = ['Helloooo? 👀', 'I can wait… *taps foot*', 'Still here. Still waiting.'];

  let S = null; // active session

  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box}
  .stage{position:fixed;inset:0;pointer-events:none;overflow:hidden;font-family:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI Rounded",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#2b2140;-webkit-font-smoothing:antialiased}
  .veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 100%,rgba(20,10,40,.28),rgba(20,10,40,0) 60%);opacity:0;transition:opacity .6s}
  .veil{background:none}
  .veil.disco{opacity:.42!important;background:none;background:conic-gradient(from 0deg,#ff3d6e,#ffb800,#3ddc84,#2bb3ff,#9b5cff,#ff3d6e);animation:disco 1.2s linear infinite;mix-blend-mode:screen}
  @keyframes disco{to{filter:hue-rotate(360deg)}}
  canvas.confetti{position:absolute;inset:0;width:100%;height:100%}
  .actor{position:absolute;left:0;top:0;will-change:transform}
  .charbox{position:absolute;inset:0;pointer-events:auto;cursor:pointer}
  .flip{position:absolute;inset:0;transition:transform .18s}
  .flip.left{transform:scaleX(-1)}
  .panel{position:absolute;bottom:calc(100% - 4px);left:50%;transform:translateX(-50%);width:max-content;max-width:min(380px,94vw);text-align:center;pointer-events:none}
  .headline{font-weight:900;line-height:1.05;letter-spacing:-.01em;color:#ffd84d;-webkit-text-stroke:1.5px #e2391d;paint-order:stroke fill;text-shadow:0 2px 0 #9d1d0c,0 0 12px rgba(255,140,0,.45);margin-bottom:8px}
  .headline .l1{font-size:var(--fs1)}
  .headline .l2{font-size:var(--fs2)}
  .w{display:inline-block;opacity:0;transform:translateY(18px) scale(.6) rotate(-6deg)}
  .panel.show .w{animation:wordpop .5s cubic-bezier(.2,1.8,.4,1) forwards;animation-delay:calc(var(--i) * 55ms)}
  @keyframes wordpop{to{opacity:1;transform:none}}
  .btns,.chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;opacity:0;transform:translateY(10px);transition:opacity .3s .35s,transform .35s .35s cubic-bezier(.2,1.6,.4,1)}
  .panel.show .btns,.panel.show .chips{opacity:1;transform:none}
  .chips[hidden],.btns[hidden]{display:none}
  button{pointer-events:auto;font:inherit;border:0;cursor:pointer;border-radius:10px;padding:7px 13px;font-size:13px;font-weight:800;background:#fff;color:#4a4458;box-shadow:0 4px 0 rgba(0,0,0,.18),0 8px 24px rgba(0,0,0,.18);transition:transform .15s cubic-bezier(.2,1.6,.4,1),box-shadow .15s,background .15s}
  button:hover{transform:translateY(-2px) scale(1.04)}
  button:active{transform:translateY(2px) scale(.98);box-shadow:0 1px 0 rgba(0,0,0,.18)}
  button:focus-visible{outline:3px solid #7c4dff;outline-offset:2px}
  .yes{background:linear-gradient(180deg,#5ef08f,#22c55e);color:#fff;text-shadow:0 1px 0 rgba(0,0,0,.2);padding:7px 18px;font-size:14px;letter-spacing:.04em}
  .later{transition:transform .32s cubic-bezier(.2,1.6,.4,1)}
  .chip{padding:6px 10px;font-size:12px}
  .chip.def{background:#fff4c2;color:#7a4a00}
  .chip.back{background:#efeaf7}
  .tip{margin-top:8px;font-size:11px;font-weight:700;color:rgba(255,255,255,.92);text-shadow:0 1px 2px rgba(0,0,0,.5);opacity:0;transition:opacity .4s 1s}
  .panel.show .tip{opacity:.9}
  @media (hover:none){.tip{display:none}}
  .quip{position:absolute;left:62%;top:4%;background:#fff;color:#2b2140;font-weight:800;font-size:14px;padding:8px 12px;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.2);white-space:nowrap;opacity:0;transform:scale(.4) translateY(10px);transform-origin:0% 100%;transition:opacity .2s,transform .3s cubic-bezier(.2,1.8,.4,1);pointer-events:none;z-index:2}
  .quip:after{content:"";position:absolute;left:10px;bottom:-7px;border:8px solid transparent;border-top-color:#fff;border-bottom:0}
  .quip.on{opacity:1;transform:none}
  .count{position:absolute;font-weight:900;font-size:64px;color:#fff;-webkit-text-stroke:4px #7c4dff;paint-order:stroke fill;text-shadow:0 8px 0 #4b25b8,0 0 40px rgba(124,77,255,.6);pointer-events:none;transform:translate(-50%,-50%);opacity:0}
  .toast{position:absolute;left:50%;top:22px;transform:translate(-50%,-120%);background:#2b2140;color:#fff;font-weight:800;font-size:15px;padding:10px 18px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.3);transition:transform .45s cubic-bezier(.2,1.6,.4,1);white-space:nowrap}
  .toast.on{transform:translate(-50%,0)}
  .puff{position:absolute;border-radius:50%;background:#fff;pointer-events:none;opacity:.95}
  .flame{position:absolute;left:50%;top:92%;font-size:var(--ff,60px);transform:translateX(-50%) rotate(180deg);animation:flick .08s infinite alternate;filter:drop-shadow(0 0 12px #ff8a00)}
  @keyframes flick{to{transform:translateX(-50%) rotate(180deg) scale(1.15,1.3)}}
  .rain{position:absolute;top:-60px;font-size:34px;pointer-events:none}
  .clone{position:absolute;left:0;top:0;pointer-events:none}
  .jump{animation:jump .55s cubic-bezier(.3,1.5,.5,1)}
  @keyframes jump{40%{transform:translateY(-22%) rotate(-8deg)}}
  .grow .flip{transform:scale(1.22)}
  .grow .flip.left{transform:scale(-1.22,1.22)}
  `;

  /* ---------------- helpers ---------------- */
  function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function words(text, start = 0) {
    return esc(text).split(/\s+/).filter(Boolean).map((w, i) => `<span class="w" style="--i:${start + i}">${w}</span>`).join(' ');
  }
  function send(msg) {
    // Standalone apps (desktop/mobile) register a host handler instead of chrome.runtime
    if (g.NudgeHost && typeof g.NudgeHost.handle === 'function') {
      return Promise.resolve().then(() => g.NudgeHost.handle(msg)).catch(() => null);
    }
    return new Promise((resolve) => {
      try {
        if (!g.chrome || !chrome.runtime || !chrome.runtime.id) return resolve(null);
        chrome.runtime.sendMessage(msg, (res) => { void chrome.runtime.lastError; resolve(res || null); });
      } catch (e) { resolve(null); }
    });
  }
  function anim(target, frames, opts) {
    if (!S) return Promise.resolve();
    const a = target.animate(frames, Object.assign({ fill: 'forwards' }, opts));
    S.anims.push(a);
    return a.finished.catch(() => {});
  }
  const T = (x, y, extra = '') => `translate(${x}px,${y}px) ${extra}`;

  function moveTo(x, y, ms, easing = 'cubic-bezier(.2,.8,.3,1)') {
    const from = T(S.x, S.y);
    S.x = x; S.y = y;
    return anim(S.actor, [{ transform: from }, { transform: T(x, y) }], { duration: ms, easing });
  }
  function face(dir) { S.flip.classList.toggle('left', dir < 0); }
  function setChar(...cls) {
    const c = S.char;
    c.classList.remove('nb-idle', 'nb-walk', 'nb-running', 'nb-fast', 'nb-impatient', 'nb-angry', 'nb-dance', 'nb-squash', 'nb-crouch');
    cls.forEach((k) => k && c.classList.add(k));
  }
  function lean(deg) { S.char.style.setProperty('--lean', deg + 'deg'); }
  function quip(text, ms = 1800) {
    S.quip.textContent = text;
    S.quip.classList.add('on');
    clearTimeout(S.quipT);
    S.quipT = setTimeout(() => S && S.quip.classList.remove('on'), ms);
  }
  function later(fn, ms) { const t = setTimeout(() => S && fn(), ms); S.timers.push(t); return t; }
  function sfx(name) { send({ type: 'nb:sfx', name }); }

  /* ---------------- confetti / particles ---------------- */
  function confetti(x, y, n = 150, power = 1) {
    if (!S) return;
    const cv = S.cv, ctx = cv.getContext('2d');
    const dpr = Math.min(2, g.devicePixelRatio || 1);
    if (cv.width !== innerWidth * dpr) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
    const cols = ['#ff3d6e', '#ffb800', '#3ddc84', '#2bb3ff', '#9b5cff', '#ff8a3d', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), sp = rand(6, 17) * power;
      S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(2, 6), r: rand(0, 6.28), vr: rand(-.3, .3), w: rand(6, 12), h: rand(4, 8), c: pick(cols), life: rand(110, 170), shape: Math.random() < .3 ? 1 : 0 });
    }
    if (S.raf) return;
    const tick = () => {
      if (!S) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      S.parts = S.parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
      for (const p of S.parts) {
        p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
        ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 40); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.shape) { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.6, 0, 6.28); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
        ctx.restore();
      }
      S.raf = S.parts.length ? requestAnimationFrame(tick) : 0;
    };
    S.raf = requestAnimationFrame(tick);
  }
  function puffs(x, y, n = 6, size = 26, spread = 40) {
    for (let i = 0; i < n; i++) {
      const p = el('div', 'puff', S.stage);
      const s = rand(size * .6, size * 1.3);
      p.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px`;
      const dx = rand(-spread, spread), dy = rand(-spread * .8, spread * .2);
      p.animate([{ transform: 'scale(.3)', opacity: .95 }, { transform: `translate(${dx}px,${dy}px) scale(1.6)`, opacity: 0 }], { duration: rand(450, 750), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' })
        .finished.then(() => p.remove()).catch(() => {});
    }
  }

  /* ---------------- show ---------------- */
  function show(p) {
    hide();
    p = p || {};
    const settings = Object.assign({ mischief: true, escalate: true, snoozeOptions: [5, 10, 15, 30], defaultSnooze: 10, entrance: 'random', celebration: 'random' }, p.settings || {});
    const host = document.createElement('nudge-buddy-overlay');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;';
    const root = host.attachShadow({ mode: 'closed' });
    const W = innerWidth, H = innerHeight;
    const charH = Math.round(Math.max(110, Math.min(160, H * 0.2)));   // small by default
    const charW = Math.round(charH * 2 / 3);
    const fs1 = Math.round(Math.max(15, Math.min(20, W / 50)));
    const fs2 = Math.round(Math.max(17, Math.min(24, W / 42)));

    const headline1 = p.headline || 'Hey you!';
    const message = p.message || 'Time for a quick break!';
    const yesLabel = p.yesLabel || 'YES';
    const opts = (settings.snoozeOptions || []).slice(0, 6);
    C.setHTML(root, `<style>${CSS}${C.css}</style>
      <div class="stage${p.standalone || p.scene ? ' standalone' : ''}" style="--fs1:${fs1}px;--fs2:${fs2}px">
        <div class="veil"></div><canvas class="confetti"></canvas>
        <div class="actor" style="width:${charW}px;height:${charH}px">
          <div class="panel" role="alertdialog" aria-label="${esc(headline1 + ' ' + message)}">
            <div class="headline"><div class="l1">${words(headline1)}</div><div class="l2">${words(message, 3)}</div></div>
            <div class="btns"><button class="yes">${esc(yesLabel)}</button><button class="later">Remind me later</button></div>
            <div class="chips" hidden>${opts.map((m) => `<button class="chip${m === settings.defaultSnooze ? ' def' : ''}" data-m="${m}">${esc(fmtMin(m))}</button>`).join('')}<button class="chip back" aria-label="Back">↩</button></div>
            <div class="tip">Y = yes · L = later · or poke me</div>
          </div>
          <div class="charbox"><div class="flip"></div><div class="quip"></div></div>
        </div>
        <div class="count"></div>
      </div>`);
    (document.documentElement || document.body).appendChild(host);

    const $ = (s) => root.querySelector(s);
    S = {
      p, settings, host, root, W, H, charW, charH, x: 0, y: 0,
      stage: $('.stage'), actor: $('.actor'), panel: $('.panel'), flip: $('.flip'), quip: $('.quip'),
      cv: $('canvas.confetti'), count: $('.count'), veil: $('.veil'),
      timers: [], anims: [], parts: [], raf: 0, dodges: 0, phase: 'enter',
    };
    S.char = C.mount(S.flip, p.character || { kind: 'preset', id: 'arjun' }, p.emoji);

    // wire controls
    $('.yes').addEventListener('click', onYes);
    const laterBtn = $('.later');
    laterBtn.addEventListener('click', () => showChips(true));
    laterBtn.addEventListener('pointerenter', (e) => {
      if (!S || S.phase !== 'ask' || !settings.mischief || e.pointerType !== 'mouse' || S.dodges >= 2) return;
      S.dodges++;
      const dx = (Math.random() < .5 ? -1 : 1) * rand(90, 150), dy = rand(-26, 18);
      laterBtn.style.transform = `translate(${dx}px,${dy}px) rotate(${rand(-8, 8)}deg)`;
      quip(pick(DODGES));
      sfx('pop');
    });
    root.querySelectorAll('.chip[data-m]').forEach((b) => b.addEventListener('click', () => onSnooze(+b.dataset.m)));
    $('.chip.back').addEventListener('click', () => showChips(false));
    $('.charbox').addEventListener('click', poke);
    S.onKey = (e) => {
      if (!S || S.phase !== 'ask') return;
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === 'Escape') { e.stopPropagation(); onSnooze(settings.defaultSnooze); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); e.stopPropagation(); onYes(); }
      else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); e.stopPropagation(); showChips(true); }
    };
    g.addEventListener('keydown', S.onKey, true);
    S.onResize = () => { if (S && S.phase === 'ask') { S.W = innerWidth; S.H = innerHeight; placeRest(); S.actor.style.transform = T(S.x, S.y); S.anims.forEach((a) => a.cancel()); S.anims = []; } };
    g.addEventListener('resize', S.onResize);

    requestAnimationFrame(() => S && S.stage.classList.add('on'));
    enter();
  }

  function placeRest() {
    const { W, H, charW, charH } = S;
    const pw = Math.min(S.panel.offsetWidth || 360, W - 24);
    const half = Math.max(charW / 2, pw / 2) + 12;
    let cx = W / 2;
    cx = Math.max(half, Math.min(W - half, cx));
    S.restX = Math.round(cx - charW / 2);
    S.restY = Math.round(H - charH - (S.p.standalone || S.p.scene ? 18 : 14) - (S.p.bottomInset || 0));
    S.x = S.restX; S.y = S.restY;
  }

  async function enter() {
    placeRest();
    const { restX, restY, charW, charH, W, H } = S;
    let mode = S.settings.entrance;
    if (S.p.chase || typeof S.p.fromX === 'number') mode = 'run';
    if (!mode) mode = 'run';
    if (mode === 'random') mode = pick(['run', 'run', 'drop', 'peek']);
    if (reduced) mode = 'fade';

    if (mode === 'fade') {
      S.x = restX; S.y = restY;
      await anim(S.actor, [{ transform: T(restX, restY) + ' scale(.6)', opacity: 0 }, { transform: T(restX, restY), opacity: 1 }], { duration: 350 });
    } else if (mode === 'drop') {
      S.x = restX; S.y = -charH - 260;
      setChar('nb-running', 'nb-fast');
      await anim(S.actor, [
        { transform: T(restX, S.y) + ' rotate(-10deg)', offset: 0 },
        { transform: T(restX, restY) + ' rotate(4deg)', offset: .62, easing: 'cubic-bezier(.3,0,.6,1)' },
        { transform: T(restX, restY - charH * .22), offset: .8, easing: 'ease-out' },
        { transform: T(restX, restY), offset: 1, easing: 'ease-in' },
      ], { duration: 950, easing: 'cubic-bezier(.5,0,1,1)' });
      S.y = restY;
      setChar('nb-squash');
      puffs(restX + charW / 2, restY + charH, 7, 26, 60);
      sfx('boing');
      await wait(380);
    } else if (mode === 'peek') {
      S.x = restX; S.y = H + 8;
      await moveTo(restX, H - charH * .38, 550, 'cubic-bezier(.2,.9,.3,1)');
      quip('👀 psst…', 1200);
      await wait(800);
      if (!S) return;
      setChar('nb-crouch');
      await wait(220);
      setChar();
      const from = S.y;
      S.y = restY;
      await anim(S.actor, [
        { transform: T(restX, from) },
        { transform: T(restX, restY - charH * .35), offset: .55, easing: 'cubic-bezier(.2,.8,.4,1)' },
        { transform: T(restX, restY), easing: 'cubic-bezier(.6,0,1,1)' },
      ], { duration: 650 });
      setChar('nb-squash');
      sfx('boing');
      await wait(380);
    } else { // run
      const hasFrom = typeof S.p.fromX === 'number';
      const fromLeft = hasFrom ? S.p.fromX < restX : S.settings.entrance === 'random' ? Math.random() < .55 : true;   // default: always left → right
      S.x = hasFrom ? S.p.fromX : fromLeft ? -charW - 60 : W + 60; S.y = restY;
      face(fromLeft ? 1 : -1); lean(fromLeft ? 8 : 8);
      setChar('nb-running', 'nb-fast');
      await moveTo(restX, restY, Math.max(900, Math.min(1500, Math.abs(restX - S.x) * 1.4)), 'cubic-bezier(.25,.6,.35,1)');
      if (!S) return;
      lean(-6); setChar('nb-squash');
      puffs(restX + (fromLeft ? charW * .3 : charW * .7), restY + charH - 6, 5, 18, 34);
      await wait(260);
      lean(0); face(1);
    }
    if (!S) return;
    S.actor.style.transform = T(S.restX, S.restY);
    S.anims.forEach((a) => a.cancel()); S.anims = [];
    S.x = S.restX; S.y = S.restY;
    ask();
  }

  function ask() {
    S.phase = 'ask';
    setChar('nb-idle');
    S.panel.classList.add('show');
    if (S.p.chase) quip('You can’t escape me 😏', 2200);
    else if (S.p.welcomeBack) quip('Welcome back! 👋', 2000);
    if (S.settings.escalate && !S.p.preview) {
      later(() => { if (S.phase !== 'ask') return; setChar('nb-impatient'); quip(pick(NAGS), 2600); }, 20000);
      later(() => {
        if (S.phase !== 'ask') return;
        setChar('nb-angry'); S.actor.classList.add('grow');
        const n = S.p.name ? S.p.name.toUpperCase() : 'HEY';
        C.setHTML(S.root.querySelector('.l1'), `<span class="w" style="--i:0;opacity:1;transform:none">${esc(n)}!!! 😤</span>`);
        sfx('boing');
        later(() => S.phase === 'ask' && setChar('nb-impatient'), 1600);
      }, 45000);
    }
  }

  function showChips(on) {
    if (!S || S.phase !== 'ask') return;
    S.root.querySelector('.btns').hidden = on;
    S.root.querySelector('.chips').hidden = !on;
    if (on) { quip('How long? ⏳', 1400); const d = S.root.querySelector('.chip.def') || S.root.querySelector('.chip'); d && d.focus({ preventScroll: true }); }
  }

  function poke(e) {
    if (!S || S.phase !== 'ask') return;
    e.stopPropagation();
    const c = S.char; c.classList.remove('jump'); void c.offsetWidth; c.classList.add('jump');
    quip(pick(POKES)); sfx('boing');
    const r = S.actor.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height * .3, 18, .5);
  }

  function setHeadline(l1, l2) {
    C.setHTML(S.root.querySelector('.headline'), `<div class="l1">${words(l1)}</div><div class="l2">${words(l2, 3)}</div>`);
    S.panel.classList.remove('show'); void S.panel.offsetWidth; S.panel.classList.add('show');
  }
  function hidePanelBits() {
    S.root.querySelector('.btns').hidden = true;
    S.root.querySelector('.chips').hidden = true;
    S.root.querySelector('.tip').style.display = 'none';
  }
  function toast(text) {
    const t = el('div', 'toast', S.stage); t.textContent = text;
    requestAnimationFrame(() => t.classList.add('on'));
    later(() => t.classList.remove('on'), 2400);
  }

  /* ---------------- YES ---------------- */
  async function onYes() {
    if (!S || S.phase !== 'ask') return;
    S.phase = 'yes';
    S.timers.forEach(clearTimeout); S.timers = [];
    S.actor.classList.remove('grow');
    hidePanelBits();
    setHeadline(S.p.celebrate || 'Legend! 🎉', pick(['You absolute star ✨', 'That’s the spirit!', 'Proud of you 💪', 'Main character energy!']));
    const r = S.actor.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height * .35, 70, .7);
    const res = await send({ type: 'nb:answer', reminderId: S.p.reminderId, action: 'yes', preview: !!S.p.preview });
    if (!S) return;
    if (res && res.streak) toast(`🔥 ${res.streak}-day streak · ✅ ${res.today} today`);
    await wait(700);
    if (!S) return;
    let c = S.settings.celebration || 'runoff';
    if (c === 'random') c = pick(['zoomies', 'rocket', 'clones', 'disco']);
    if (reduced) c = 'calm';
    try { await CELEBRATIONS[c](); } catch (e) { /* ignore */ }
    finish();
  }

  const CELEBRATIONS = {
    async calm() { await wait(1600); },
    async runoff() {   // simple: hop, then keep running off to the right
      anim(S.panel, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 500 });
      setChar('nb-dance'); await wait(700);
      if (!S) return;
      setChar('nb-running', 'nb-fast'); face(1); lean(8);
      await moveTo(S.W + S.charW + 40, S.y, Math.max(900, (S.W - S.x) * 1.2), 'cubic-bezier(.4,0,.8,1)');
    },
    async zoomies() {
      const { W, charW, charH } = S, y = S.restY;
      anim(S.panel, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 500 });
      setChar('nb-running', 'nb-fast'); lean(10); face(1);
      await moveTo(W - charW - 8, y, 520, 'ease-in');
      if (!S) return;
      face(-1); confetti(W - charW / 2, y + charH * .5, 50, .8);
      const from = T(S.x, S.y);
      S.x = 8; S.y = y;
      await anim(S.actor, [
        { transform: from },
        { transform: T(W / 2 - charW / 2, y - S.H * .42, 'rotate(-180deg)'), easing: 'ease-out' },
        { transform: T(8, y, 'rotate(-360deg)'), easing: 'ease-in' },
      ], { duration: 900 });
      if (!S) return;
      confetti(charW / 2, y + charH * .5, 50, .8);
      face(1);
      await moveTo(W + charW + 40, y, 650, 'cubic-bezier(.6,0,1,1)');
    },
    async rocket() {
      const { charW, charH } = S;
      anim(S.panel, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 300 });
      setChar('nb-crouch');
      await wait(380);
      if (!S) return;
      setChar('nb-angry');
      const fl = el('div', 'flame', S.flip); fl.textContent = '🔥'; fl.style.setProperty('--ff', Math.round(charW * .5) + 'px');
      sfx('rocket');
      await wait(450);
      if (!S) return;
      setChar('nb-running', 'nb-fast');
      const iv = setInterval(() => { if (!S) return clearInterval(iv); const r = S.actor.getBoundingClientRect(); puffs(r.left + r.width / 2, r.bottom, 2, 30, 30); }, 60);
      S.timers.push(iv);
      confetti(S.x + charW / 2, S.y + charH, 80, .9);
      await moveTo(S.x, -charH - 260, 1100, 'cubic-bezier(.55,0,.9,.4)');
      clearInterval(iv);
    },
    async clones() {
      const { W, H, charW, charH } = S;
      anim(S.panel, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 400 });
      setChar('nb-dance');
      const n = 9;
      for (let i = 0; i < n; i++) {
        const sc = rand(.35, .75), h = charH * sc, w = charW * sc;
        const cl = el('div', 'clone', S.stage);
        cl.style.cssText = `width:${w}px;height:${h}px`;
        const fl = el('div', 'flip', cl);
        const dir = Math.random() < .5 ? 1 : -1;
        if (dir < 0) fl.classList.add('left');
        const ch = C.mount(fl, S.p.character || { kind: 'preset', id: 'arjun' }, S.p.emoji);
        ch.classList.add('nb-running', 'nb-fast');
        const y = rand(H * .1, H - h - 10);
        const x0 = dir > 0 ? -w - 20 : W + 20, x1 = dir > 0 ? W + 20 : -w - 20;
        const hop = rand(30, 90);
        cl.animate([
          { transform: T(x0, y) }, { transform: T((x0 + x1) / 2, y - hop) , offset: .5 }, { transform: T(x1, y) },
        ], { duration: rand(1300, 2300), delay: i * 140, easing: 'linear', fill: 'both' }).finished.then(() => cl.remove()).catch(() => {});
      }
      sfx('tada');
      for (let k = 0; k < 3 && S; k++) { confetti(rand(W * .1, W * .9), rand(H * .2, H * .6), 40, .7); await wait(600); }
      if (!S) return;
      setChar('nb-running', 'nb-fast'); face(1);
      await moveTo(W + charW + 40, S.y, 700, 'cubic-bezier(.6,0,1,1)');
    },
    async disco() {
      const { W, charW, charH } = S;
      S.veil.classList.add('disco');
      anim(S.panel, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 600 });
      setChar('nb-dance');
      const emo = [S.p.emoji || '🎉', '🎉', '✨', '💃', '🕺', '⭐'];
      for (let i = 0; i < 26; i++) {
        const r = el('div', 'rain', S.stage); r.textContent = pick(emo);
        r.style.left = rand(0, W) + 'px';
        r.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: `translateY(${S.H + 120}px) rotate(${rand(-360, 360)}deg)` }], { duration: rand(1400, 2400), delay: rand(0, 900), easing: 'cubic-bezier(.4,0,1,1)', fill: 'both' }).finished.then(() => r.remove()).catch(() => {});
      }
      const cx = S.x, cy = S.y;
      await anim(S.actor, [
        { transform: T(cx, cy) },
        { transform: T(cx, cy - charH * .2, 'scale(1.25) rotate(-10deg)') },
        { transform: T(cx, cy, 'scale(1.25) rotate(10deg)') },
        { transform: T(cx, cy - charH * .2, 'scale(1.3) rotate(370deg)') },
        { transform: T(cx, cy, 'scale(1.25) rotate(720deg)') },
      ], { duration: 2000, easing: 'ease-in-out' });
      if (!S) return;
      S.veil.classList.remove('disco');
      setChar('nb-running', 'nb-fast'); face(-1);
      S.actor.style.transform = T(cx, cy); S.anims.forEach((a) => a.cancel()); S.anims = []; S.x = cx; S.y = cy;
      await moveTo(-charW - 60, cy, 600, 'cubic-bezier(.6,0,1,1)');
    },
  };

  /* ---------------- SNOOZE ---------------- */
  async function onSnooze(min) {
    if (!S || S.phase !== 'ask') return;
    S.phase = 'snooze';
    S.timers.forEach(clearTimeout); S.timers = [];
    S.actor.classList.remove('grow');
    hidePanelBits();
    setHeadline('Okay okay…', `See you in ${fmtMin(min)} ⏰`);
    send({ type: 'nb:answer', reminderId: S.p.reminderId, action: 'snooze', minutes: min, preview: !!S.p.preview });
    await wait(500);
    if (!S) return;
    const { charW, charH } = S;
    // moonwalk backwards while a big 3-2-1 counts down
    const dir = 1; // keep heading right
    face(1); lean(2); setChar('nb-walk');
    moveTo(S.x + dir * Math.min(220, S.W * .2), S.y, 2100, 'linear');
    for (const n of [3, 2, 1]) {
      if (!S) return;
      const r = S.actor.getBoundingClientRect();
      S.count.style.left = (r.left + r.width / 2) + 'px';
      S.count.style.top = Math.max(80, r.top - 40) + 'px';
      S.count.textContent = n;
      sfx('tick');
      anim(S.count, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(2.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: .35 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }], { duration: 680, easing: 'cubic-bezier(.2,.9,.3,1)' });
      await wait(700);
    }
    if (!S) return;
    S.anims.forEach((a) => { try { a.commitStyles(); } catch (e) { /* noop */ } a.cancel(); }); S.anims = [];
    anim(S.panel, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
    setChar('nb-running', 'nb-fast'); lean(8);
    const m = new DOMMatrix(getComputedStyle(S.actor).transform); S.x = m.m41;
    await moveTo(S.W + charW + 40, S.y, Math.max(700, (S.W - S.x) * 1.1), 'cubic-bezier(.4,0,.8,1)');
    await wait(200);
    finish();
  }

  async function finish() {
    if (!S) return;
    const s = S;
    s.stage.classList.remove('on');
    await wait(500);
    if (S !== s) return;
    const standalone = s.p.standalone;
    hide();
    if (standalone) { try { g.close(); } catch (e) { /* noop */ } }
  }

  function hide() {
    if (!S) return;
    const s = S; S = null;
    s.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    s.anims.forEach((a) => { try { a.cancel(); } catch (e) { /* noop */ } });
    if (s.raf) cancelAnimationFrame(s.raf);
    g.removeEventListener('keydown', s.onKey, true);
    g.removeEventListener('resize', s.onResize);
    s.host.remove();
  }

  g.NudgeOverlay = { show, hide, isShowing: () => !!S };
})();
