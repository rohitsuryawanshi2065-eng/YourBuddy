/* Nudge Buddy — synthesized sounds (no audio files). Classic script → globalThis.NudgeSounds */
(function () {
  const g = globalThis;
  if (g.NudgeSounds) return;
  let ctx = null;
  const ac = () => (ctx = ctx || new (g.AudioContext || g.webkitAudioContext)());

  function tone(freq, t, dur, { type = 'sine', vol = 0.3, attack = 0.01, slideTo = null, out } = {}) {
    const c = ac();
    const o = c.createOscillator(), gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, out, hp = 800) {
    const c = ac();
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const gn = c.createGain(); gn.gain.value = vol;
    s.connect(f).connect(gn).connect(out); s.start(t);
  }

  // Each returns its duration in seconds.
  const LIB = {
    chime(t, o) { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.12, 0.9, { vol: 0.25, out: o })); [1568, 2093].forEach((f, i) => tone(f, t + 0.55 + i * 0.1, 0.8, { vol: 0.12, out: o })); return 1.5; },
    alarm(t, o) { for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) tone(2100, t + r * 0.7 + i * 0.11, 0.07, { type: 'square', vol: 0.12, attack: 0.002, out: o }); return 2.1; },
    retro(t, o) { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.09, { type: 'square', vol: 0.1, attack: 0.002, out: o })); return 0.7; },
    marimba(t, o) { [659, 784, 988, 784, 1319, 988].forEach((f, i) => { tone(f, t + i * 0.16, 0.45, { type: 'triangle', vol: 0.35, attack: 0.003, out: o }); tone(f * 4, t + i * 0.16, 0.08, { vol: 0.05, attack: 0.002, out: o }); }); return 1.2; },
    birds(t, o) { for (let i = 0; i < 6; i++) { const s = t + i * 0.22 + Math.random() * 0.05; tone(2400 + Math.random() * 800, s, 0.12, { vol: 0.15, slideTo: 3800 + Math.random() * 600, out: o }); } return 1.5; },
    boing(t, o) { tone(180, t, 0.45, { type: 'triangle', vol: 0.35, slideTo: 620, out: o }); return 0.5; },
    pop(t, o) { tone(600, t, 0.08, { vol: 0.25, slideTo: 1200, out: o }); return 0.1; },
    tick(t, o) { tone(1500, t, 0.05, { type: 'square', vol: 0.08, attack: 0.002, out: o }); return 0.06; },
    poof(t, o) { noise(t, 0.35, 0.25, o, 400); return 0.35; },
    rocket(t, o) { noise(t, 1.4, 0.18, o, 200); tone(120, t, 1.4, { type: 'sawtooth', vol: 0.06, slideTo: 900, out: o }); return 1.4; },
    tada(t, o) { [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.08, 0.25, { type: 'triangle', vol: 0.3, out: o })); [1047, 1319, 1568].forEach((f) => tone(f, t + 0.3, 0.9, { type: 'triangle', vol: 0.2, out: o })); return 1.2; },
    womp(t, o) { [392, 370, 349].forEach((f, i) => tone(f, t + i * 0.28, 0.3, { type: 'sawtooth', vol: 0.07, out: o })); tone(330, t + 0.84, 0.7, { type: 'sawtooth', vol: 0.07, slideTo: 300, out: o }); return 1.6; },
  };

  function play(name, volume = 0.7) {
    const fn = LIB[name];
    if (!fn) return 0;
    const c = ac();
    if (c.state === 'suspended') c.resume();
    const out = c.createGain();
    out.gain.value = Math.max(0, Math.min(1, volume));
    out.connect(c.destination);
    return fn(c.currentTime + 0.03, out);
  }

  g.NudgeSounds = {
    play,
    ringtones: [
      { id: 'chime', name: 'Sparkle chime' },
      { id: 'marimba', name: 'Marimba' },
      { id: 'alarm', name: 'Classic alarm clock' },
      { id: 'retro', name: 'Retro arcade' },
      { id: 'birds', name: 'Morning birds' },
      { id: 'boing', name: 'Cartoon boing' },
      { id: 'none', name: 'Silent' },
    ],
  };
})();
