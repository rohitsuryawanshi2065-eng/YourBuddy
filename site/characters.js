/* Nudge Buddy — character library (classic script, shared by popup, overlay, mini-window).
 * Every character is an SVG on a 200x300 canvas with named, animatable parts:
 * .nb-leg-l/.nb-leg-r, .nb-arm-l/.nb-arm-r, .nb-eyes, .nb-tail, .nb-prop
 * Custom uploads are drawn on a <canvas> (immune to page CSP) layered over a body. */
(function () {
  const g = globalThis;
  if (g.NudgeChars) return;

  let policy = null;
  try {
    if (g.trustedTypes && g.trustedTypes.createPolicy) {
      policy = g.trustedTypes.createPolicy('nudge-buddy', { createHTML: (s) => s });
    }
  } catch (e) { /* policy name not allowed; fall back */ }
  function setHTML(el, html) {
    try { el.innerHTML = policy ? policy.createHTML(html) : html; }
    catch (e) { el.innerHTML = html; }
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const INK = '#2b2140';

  const prop = (emoji, x, y, size = 34) =>
    emoji ? `<text class="nb-prop" x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central">${esc(emoji)}</text>` : '';
  const svgWrap = (inner) =>
    `<svg class="nb-svg" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  /* ---------- Preset characters ---------- */
  const PRESETS = {
    arjun: {
      name: 'Arjun', tagline: 'Your chill desk buddy',
      svg: (e) => svgWrap(`
        <g class="nb-leg nb-leg-l" style="--o:82px 192px"><path d="M82 192 L80 266" stroke="#2f3b52" stroke-width="22" stroke-linecap="round"/><ellipse cx="76" cy="276" rx="17" ry="9" fill="#fff" stroke="#c9cdd6" stroke-width="2.5"/></g>
        <g class="nb-leg nb-leg-r" style="--o:118px 192px"><path d="M118 192 L120 266" stroke="#2f3b52" stroke-width="22" stroke-linecap="round"/><ellipse cx="124" cy="276" rx="17" ry="9" fill="#fff" stroke="#c9cdd6" stroke-width="2.5"/></g>
        <g class="nb-arm nb-arm-l" style="--o:70px 122px"><path d="M70 122 Q56 160 60 192" stroke="#3d6fb6" stroke-width="20" fill="none" stroke-linecap="round"/><circle cx="60" cy="199" r="9" fill="#f0c08a"/></g>
        <path d="M68 116 Q100 106 132 116 L136 200 Q100 208 64 200Z" fill="#7b818c"/>
        <path d="M66 116 Q82 108 93 111 L97 203 Q78 205 62 198Z" fill="#4a7cc4"/>
        <path d="M134 116 Q118 108 107 111 L103 203 Q122 205 138 198Z" fill="#4a7cc4"/>
        <path d="M86 108 L96 132 L100 112Z M114 108 L104 132 L100 112Z" fill="#35619f"/>
        <path d="M72 150 h14 M114 150 h14" stroke="#35619f" stroke-width="3" stroke-linecap="round"/>
        <g class="nb-arm nb-arm-r" style="--o:130px 122px"><path d="M130 122 Q162 148 156 112" stroke="#3d6fb6" stroke-width="20" fill="none" stroke-linecap="round"/><circle cx="155" cy="104" r="9" fill="#f0c08a"/>${prop(e, 160, 80)}</g>
        <rect x="92" y="92" width="16" height="20" rx="4" fill="#e3ad74"/>
        <circle cx="66" cy="72" r="7" fill="#e8b47c"/><circle cx="134" cy="72" r="7" fill="#e8b47c"/>
        <circle cx="100" cy="70" r="34" fill="#f1c48c"/>
        <path d="M70 84 Q100 112 130 84 Q128 100 100 106 Q72 100 70 84Z" fill="#3a2a22" opacity=".28"/>
        <path d="M66 66 Q60 28 100 26 Q142 26 134 64 Q130 46 114 46 Q102 36 86 46 Q72 46 66 66Z" fill="#2a1d18"/>
        <path d="M86 32 Q100 14 120 28 Q108 26 100 34Z" fill="#2a1d18"/>
        <path d="M80 60 q8 -5 15 0 M105 60 q8 -5 15 0" stroke="#2a1d18" stroke-width="4" fill="none" stroke-linecap="round"/>
        <g class="nb-eyes" style="--o:100px 72px"><ellipse cx="88" cy="72" rx="5.5" ry="6.5" fill="#fff"/><ellipse cx="112" cy="72" rx="5.5" ry="6.5" fill="#fff"/><circle cx="89" cy="73" r="3.6" fill="${INK}"/><circle cx="113" cy="73" r="3.6" fill="${INK}"/></g>
        <ellipse cx="80" cy="86" rx="5" ry="3" fill="#ff8f8f" opacity=".45"/><ellipse cx="120" cy="86" rx="5" ry="3" fill="#ff8f8f" opacity=".45"/>
        <path class="nb-mouth" d="M88 86 Q100 98 112 86 Q100 92 88 86Z" fill="#fff" stroke="#7a3b2e" stroke-width="2.5" stroke-linejoin="round"/>`),
    },
    blobby: {
      name: 'Blobby', tagline: 'Squishy, sticky, persistent',
      svg: (e) => svgWrap(`
        <g class="nb-leg nb-leg-l" style="--o:80px 248px"><path d="M80 248 L77 276" stroke="#3fae5a" stroke-width="16" stroke-linecap="round"/><ellipse cx="74" cy="282" rx="13" ry="7" fill="#3fae5a"/></g>
        <g class="nb-leg nb-leg-r" style="--o:120px 248px"><path d="M120 248 L123 276" stroke="#3fae5a" stroke-width="16" stroke-linecap="round"/><ellipse cx="126" cy="282" rx="13" ry="7" fill="#3fae5a"/></g>
        <g class="nb-arm nb-arm-l" style="--o:46px 190px"><path d="M46 190 Q28 202 26 224" stroke="#5cc86f" stroke-width="14" fill="none" stroke-linecap="round"/></g>
        <path d="M100 96 C150 96 168 150 166 200 C164 250 140 262 100 262 C60 262 36 250 34 200 C32 150 50 96 100 96Z" fill="#7ee081" stroke="#3fae5a" stroke-width="4"/>
        <circle cx="100" cy="88" r="8" fill="#7ee081" stroke="#3fae5a" stroke-width="3"/>
        <ellipse cx="66" cy="146" rx="10" ry="20" fill="#fff" opacity=".45" transform="rotate(20 66 146)"/>
        <g class="nb-arm nb-arm-r" style="--o:154px 186px"><path d="M154 186 Q178 170 172 146" stroke="#5cc86f" stroke-width="14" fill="none" stroke-linecap="round"/>${prop(e, 176, 122)}</g>
        <g class="nb-eyes" style="--o:100px 160px"><circle cx="80" cy="160" r="18" fill="#fff" stroke="#3fae5a" stroke-width="2"/><circle cx="122" cy="158" r="20" fill="#fff" stroke="#3fae5a" stroke-width="2"/><circle cx="84" cy="163" r="9" fill="${INK}"/><circle cx="126" cy="161" r="10" fill="${INK}"/><circle cx="87" cy="159" r="3" fill="#fff"/><circle cx="130" cy="157" r="3.4" fill="#fff"/></g>
        <ellipse cx="62" cy="196" rx="9" ry="5" fill="#ff8fb1" opacity=".55"/><ellipse cx="140" cy="196" rx="9" ry="5" fill="#ff8fb1" opacity=".55"/>
        <path class="nb-mouth" d="M82 198 Q102 226 122 198 Q102 210 82 198Z" fill="${INK}"/><path d="M94 210 Q102 220 110 210" fill="#ff7a90"/>`),
    },
    bolt: {
      name: 'Bolt', tagline: 'Beep boop, hydrate human',
      svg: (e) => svgWrap(`
        <g class="nb-leg nb-leg-l" style="--o:82px 214px"><path d="M82 214 L82 264" stroke="#9aa5b1" stroke-width="16" stroke-linecap="round"/><rect x="62" y="264" width="38" height="16" rx="8" fill="#5b6573"/></g>
        <g class="nb-leg nb-leg-r" style="--o:118px 214px"><path d="M118 214 L118 264" stroke="#9aa5b1" stroke-width="16" stroke-linecap="round"/><rect x="100" y="264" width="38" height="16" rx="8" fill="#5b6573"/></g>
        <g class="nb-arm nb-arm-l" style="--o:58px 140px"><path d="M58 140 Q42 170 46 198" stroke="#9aa5b1" stroke-width="14" fill="none" stroke-linecap="round"/><circle cx="46" cy="205" r="10" fill="#5b6573"/></g>
        <rect x="90" y="108" width="20" height="20" fill="#9aa5b1"/>
        <rect x="56" y="124" width="88" height="96" rx="20" fill="#d7dfe9" stroke="#5b6573" stroke-width="4"/>
        <rect x="74" y="144" width="52" height="38" rx="9" fill="#2b3a4a"/>
        <circle class="nb-pulse" cx="100" cy="163" r="9" fill="#ff5d73"/>
        <path d="M72 198 h16 M112 198 h16" stroke="#5b6573" stroke-width="4" stroke-linecap="round"/>
        <g class="nb-arm nb-arm-r" style="--o:142px 140px"><path d="M142 140 Q170 130 164 100" stroke="#9aa5b1" stroke-width="14" fill="none" stroke-linecap="round"/><circle cx="164" cy="94" r="10" fill="#5b6573"/>${prop(e, 170, 70)}</g>
        <path d="M100 34 L100 14" stroke="#5b6573" stroke-width="4"/><circle class="nb-antenna" cx="100" cy="11" r="7" fill="#ff5d73"/>
        <rect x="40" y="58" width="14" height="28" rx="5" fill="#ffb703"/><rect x="146" y="58" width="14" height="28" rx="5" fill="#ffb703"/>
        <rect x="50" y="32" width="100" height="80" rx="24" fill="#edf2f8" stroke="#5b6573" stroke-width="4"/>
        <rect x="62" y="46" width="76" height="52" rx="15" fill="#1f2a37"/>
        <g class="nb-eyes" style="--o:100px 68px"><rect x="75" y="58" width="16" height="20" rx="7" fill="#4cf0ff"/><rect x="109" y="58" width="16" height="20" rx="7" fill="#4cf0ff"/></g>
        <path class="nb-mouth" d="M84 85 Q100 95 116 85" stroke="#4cf0ff" stroke-width="4" fill="none" stroke-linecap="round"/>`),
    },
    mochi: {
      name: 'Mochi', tagline: 'Judgy cat, means well',
      svg: (e) => svgWrap(`
        <g class="nb-tail" style="--o:128px 232px"><path d="M128 232 Q180 222 170 172 Q166 150 180 140" stroke="#ef9442" stroke-width="15" fill="none" stroke-linecap="round"/></g>
        <g class="nb-leg nb-leg-l" style="--o:86px 228px"><path d="M86 228 L84 270" stroke="#ef9442" stroke-width="20" stroke-linecap="round"/><ellipse cx="81" cy="278" rx="15" ry="8" fill="#fff3e0"/></g>
        <g class="nb-leg nb-leg-r" style="--o:114px 228px"><path d="M114 228 L116 270" stroke="#ef9442" stroke-width="20" stroke-linecap="round"/><ellipse cx="119" cy="278" rx="15" ry="8" fill="#fff3e0"/></g>
        <g class="nb-arm nb-arm-l" style="--o:68px 168px"><path d="M68 168 Q52 196 58 220" stroke="#ef9442" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="58" cy="225" r="9" fill="#fff3e0"/></g>
        <ellipse cx="100" cy="198" rx="42" ry="50" fill="#f6a35b"/>
        <ellipse cx="100" cy="210" rx="26" ry="34" fill="#fff3e0"/>
        <path d="M62 186 h10 M60 200 h10 M128 186 h10 M130 200 h10" stroke="#e0873a" stroke-width="4" stroke-linecap="round"/>
        <g class="nb-arm nb-arm-r" style="--o:132px 168px"><path d="M132 168 Q162 156 158 124" stroke="#ef9442" stroke-width="16" fill="none" stroke-linecap="round"/><circle cx="158" cy="118" r="9" fill="#fff3e0"/>${prop(e, 164, 94)}</g>
        <path d="M56 72 L64 20 L98 50Z M144 72 L136 20 L102 50Z" fill="#f6a35b" stroke="#e0873a" stroke-width="3" stroke-linejoin="round"/>
        <path d="M66 58 L70 34 L88 50Z M134 58 L130 34 L112 50Z" fill="#ff9fb0"/>
        <ellipse cx="100" cy="90" rx="50" ry="44" fill="#f6a35b"/>
        <path d="M90 50 L94 64 M100 48 L100 64 M110 50 L106 64" stroke="#e0873a" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="100" cy="110" rx="23" ry="15" fill="#fff3e0"/>
        <g class="nb-eyes" style="--o:100px 88px"><ellipse cx="80" cy="88" rx="8" ry="10" fill="${INK}"/><ellipse cx="120" cy="88" rx="8" ry="10" fill="${INK}"/><circle cx="83" cy="84" r="3" fill="#fff"/><circle cx="123" cy="84" r="3" fill="#fff"/></g>
        <path d="M94 101 L106 101 L100 108Z" fill="#ff7a90"/>
        <path class="nb-mouth" d="M100 108 Q94 117 87 112 M100 108 Q106 117 113 112" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M70 104 L46 100 M70 110 L46 114 M130 104 L154 100 M130 110 L154 114" stroke="${INK}" stroke-width="1.8" opacity=".55" stroke-linecap="round"/>
        <ellipse cx="68" cy="100" rx="6" ry="3.5" fill="#ff8f8f" opacity=".5"/><ellipse cx="132" cy="100" rx="6" ry="3.5" fill="#ff8f8f" opacity=".5"/>`),
    },
    rex: {
      name: 'Rex', tagline: 'Tiny arms, huge energy',
      svg: (e) => svgWrap(`
        <g class="nb-tail" style="--o:70px 222px"><path d="M74 208 Q30 230 12 272 Q48 258 82 240Z" fill="#3cc3a8" stroke="#219c84" stroke-width="3" stroke-linejoin="round"/></g>
        <g class="nb-leg nb-leg-l" style="--o:86px 236px"><path d="M86 236 L84 270" stroke="#2fb197" stroke-width="24" stroke-linecap="round"/><ellipse cx="80" cy="280" rx="18" ry="9" fill="#219c84"/></g>
        <g class="nb-leg nb-leg-r" style="--o:118px 236px"><path d="M118 236 L120 270" stroke="#2fb197" stroke-width="24" stroke-linecap="round"/><ellipse cx="124" cy="280" rx="18" ry="9" fill="#219c84"/></g>
        <path d="M60 170 L46 160 L62 154Z M58 200 L42 194 L58 186Z M64 140 L52 128 L68 126Z" fill="#ff8c42"/>
        <ellipse cx="102" cy="196" rx="44" ry="54" fill="#3cc3a8" stroke="#219c84" stroke-width="3"/>
        <ellipse cx="108" cy="206" rx="26" ry="38" fill="#f7e6a6"/>
        <path d="M90 190 h36 M88 206 h40 M90 222 h36" stroke="#e6cf7a" stroke-width="3" stroke-linecap="round"/>
        <g class="nb-arm nb-arm-l" style="--o:72px 176px"><path d="M72 176 Q60 186 64 198" stroke="#2fb197" stroke-width="12" fill="none" stroke-linecap="round"/></g>
        <g class="nb-arm nb-arm-r" style="--o:136px 172px"><path d="M136 172 Q152 160 150 144" stroke="#2fb197" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="150" cy="140" r="6" fill="#2fb197"/>${prop(e, 154, 118, 30)}</g>
        <path d="M70 54 L76 36 L88 50Z M90 46 L98 28 L106 46Z M110 46 L120 32 L124 52Z" fill="#ff8c42"/>
        <ellipse cx="104" cy="92" rx="54" ry="46" fill="#3cc3a8" stroke="#219c84" stroke-width="3"/>
        <ellipse cx="128" cy="106" rx="34" ry="24" fill="#4fd6ba"/>
        <circle cx="140" cy="96" r="2.5" fill="#219c84"/><circle cx="152" cy="98" r="2.5" fill="#219c84"/>
        <g class="nb-eyes" style="--o:100px 78px"><circle cx="84" cy="78" r="13" fill="#fff"/><circle cx="114" cy="76" r="12" fill="#fff"/><circle cx="87" cy="80" r="6.5" fill="${INK}"/><circle cx="117" cy="78" r="6" fill="${INK}"/><circle cx="89" cy="77" r="2" fill="#fff"/><circle cx="119" cy="75" r="2" fill="#fff"/></g>
        <path class="nb-mouth" d="M94 116 Q124 134 152 110" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M108 122 l4 7 l4 -6 M126 124 l3 7 l5 -7" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`),
    },
    boo: {
      name: 'Boo', tagline: 'Haunts you until you hydrate',
      floaty: true,
      svg: (e) => svgWrap(`
        <g class="nb-arm nb-arm-l" style="--o:46px 160px"><path d="M46 160 Q24 170 22 188" stroke="#c9c6e8" stroke-width="20" fill="none" stroke-linecap="round"/><path d="M46 160 Q24 170 22 188" stroke="#fbfbff" stroke-width="14" fill="none" stroke-linecap="round"/></g>
        <path class="nb-sheet" d="M40 140 C40 80 70 50 100 50 C130 50 160 80 160 140 L160 250 Q148 270 136 250 Q124 232 112 252 Q100 272 88 252 Q76 232 64 252 Q52 270 40 250Z" fill="#fbfbff" stroke="#c9c6e8" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="70" cy="96" rx="10" ry="18" fill="#fff" transform="rotate(25 70 96)"/>
        <g class="nb-arm nb-arm-r" style="--o:154px 156px"><path d="M154 156 Q178 142 176 120" stroke="#c9c6e8" stroke-width="20" fill="none" stroke-linecap="round"/><path d="M154 156 Q178 142 176 120" stroke="#fbfbff" stroke-width="14" fill="none" stroke-linecap="round"/>${prop(e, 180, 98)}</g>
        <g class="nb-eyes" style="--o:100px 118px"><ellipse cx="82" cy="118" rx="9" ry="13" fill="${INK}"/><ellipse cx="118" cy="118" rx="9" ry="13" fill="${INK}"/><circle cx="85" cy="113" r="3" fill="#fff"/><circle cx="121" cy="113" r="3" fill="#fff"/></g>
        <ellipse cx="68" cy="140" rx="8" ry="4.5" fill="#ffb3c7"/><ellipse cx="132" cy="140" rx="8" ry="4.5" fill="#ffb3c7"/>
        <ellipse class="nb-mouth" cx="100" cy="150" rx="9" ry="11" fill="${INK}"/><ellipse cx="100" cy="156" rx="5" ry="4" fill="#ff7a90"/>`),
    },
  };

  /* ---------- Custom (uploaded image) bodies ---------- */
  function shade(hex, amt) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
    const r = c((n >> 16) & 255), gg = c((n >> 8) & 255), b = c(n & 255);
    return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
  }
  const CUSTOM = {
    body: {
      face: { x: 60, y: 24, w: 80, h: 80, shape: 'circle', fit: 'cover' },
      svg: (e, color) => {
        const c = color || '#4a7cc4', d = shade(c, -0.12), d2 = shade(c, -0.2);
        return svgWrap(`
        <g class="nb-leg nb-leg-l" style="--o:82px 192px"><path d="M82 192 L80 266" stroke="#2f3b52" stroke-width="22" stroke-linecap="round"/><ellipse cx="76" cy="276" rx="17" ry="9" fill="#fff" stroke="#c9cdd6" stroke-width="2.5"/></g>
        <g class="nb-leg nb-leg-r" style="--o:118px 192px"><path d="M118 192 L120 266" stroke="#2f3b52" stroke-width="22" stroke-linecap="round"/><ellipse cx="124" cy="276" rx="17" ry="9" fill="#fff" stroke="#c9cdd6" stroke-width="2.5"/></g>
        <g class="nb-arm nb-arm-l" style="--o:70px 122px"><path d="M70 122 Q56 160 60 192" stroke="${d}" stroke-width="20" fill="none" stroke-linecap="round"/><circle cx="60" cy="199" r="9" fill="#f0c08a"/></g>
        <path d="M68 116 Q100 106 132 116 L136 200 Q100 208 64 200Z" fill="#7b818c"/>
        <path d="M66 116 Q82 108 93 111 L97 203 Q78 205 62 198Z" fill="${c}"/>
        <path d="M134 116 Q118 108 107 111 L103 203 Q122 205 138 198Z" fill="${c}"/>
        <path d="M86 108 L96 132 L100 112Z M114 108 L104 132 L100 112Z" fill="${d2}"/>
        <g class="nb-arm nb-arm-r" style="--o:130px 122px"><path d="M130 122 Q162 148 156 112" stroke="${d}" stroke-width="20" fill="none" stroke-linecap="round"/><circle cx="155" cy="104" r="9" fill="#f0c08a"/>${prop(e, 162, 80)}</g>
        <rect x="92" y="96" width="16" height="18" rx="4" fill="#e3ad74"/>`);
      },
    },
    sticker: {
      face: { x: 22, y: 18, w: 156, h: 170, shape: 'round', fit: 'cover' },
      svg: (e, color) => {
        const c = color || '#2b2140';
        return svgWrap(`
        <g class="nb-leg nb-leg-l" style="--o:80px 186px"><path d="M80 186 L78 268" stroke="${c}" stroke-width="10" stroke-linecap="round"/><ellipse cx="72" cy="274" rx="15" ry="8" fill="${c}"/></g>
        <g class="nb-leg nb-leg-r" style="--o:120px 186px"><path d="M120 186 L122 268" stroke="${c}" stroke-width="10" stroke-linecap="round"/><ellipse cx="128" cy="274" rx="15" ry="8" fill="${c}"/></g>
        <g class="nb-arm nb-arm-l" style="--o:28px 120px"><path d="M28 120 Q8 150 14 186" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="14" cy="190" r="8" fill="#fff" stroke="${c}" stroke-width="3"/></g>
        <g class="nb-arm nb-arm-r" style="--o:172px 120px"><path d="M172 120 Q196 96 188 64" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="188" cy="60" r="8" fill="#fff" stroke="${c}" stroke-width="3"/>${prop(e, 190, 36)}</g>`);
      },
    },
    cutout: {
      face: { x: 6, y: 0, w: 188, h: 218, shape: 'none', fit: 'contain' },
      svg: (e, color) => {
        const c = color || '#2b2140';
        return svgWrap(`
        <g class="nb-leg nb-leg-l" style="--o:82px 206px"><path d="M82 206 L80 268" stroke="${c}" stroke-width="10" stroke-linecap="round"/><ellipse cx="74" cy="274" rx="15" ry="8" fill="${c}"/></g>
        <g class="nb-leg nb-leg-r" style="--o:118px 206px"><path d="M118 206 L120 268" stroke="${c}" stroke-width="10" stroke-linecap="round"/><ellipse cx="126" cy="274" rx="15" ry="8" fill="${c}"/></g>
        <g class="nb-arm nb-arm-r" style="--o:180px 140px">${prop(e, 182, 120, 38)}</g>`);
      },
    },
  };

  /* ---------- Image decoding (base64 -> ImageBitmap; no network, no CSP issues) ---------- */
  const bitmapCache = new Map();
  async function bitmapFrom(dataUrl) {
    if (bitmapCache.has(dataUrl)) return bitmapCache.get(dataUrl);
    const p = (async () => {
      const [meta, b64] = dataUrl.split(',');
      const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/png';
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return createImageBitmap(new Blob([arr], { type: mime }));
    })();
    bitmapCache.set(dataUrl, p);
    return p;
  }

  async function drawFace(canvas, dataUrl, face, crop) {
    const scale = 3;
    const cw = (canvas.width = Math.round(face.w * scale));
    const ch = (canvas.height = Math.round(face.h * scale));
    const ctx = canvas.getContext('2d');
    let bmp;
    try { bmp = await bitmapFrom(dataUrl); } catch (e) { return; }
    const z = (crop && crop.zoom) || 1, ox = (crop && crop.x) || 0, oy = (crop && crop.y) || 0;
    const border = face.shape === 'none' ? 0 : 7 * scale / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    const path = new Path2D();
    if (face.shape === 'circle') path.arc(cw / 2, ch / 2, cw / 2 - border, 0, Math.PI * 2);
    else if (face.shape === 'round') path.roundRect(border, border, cw - 2 * border, ch - 2 * border, 26 * scale / 2);
    else path.rect(0, 0, cw, ch);
    ctx.clip(path);
    const fit = face.fit === 'contain' ? Math.min : Math.max;
    const s = fit(cw / bmp.width, ch / bmp.height) * z;
    const dw = bmp.width * s, dh = bmp.height * s;
    ctx.drawImage(bmp, (cw - dw) / 2 + ox * cw, (ch - dh) / 2 + oy * ch, dw, dh);
    ctx.restore();
    if (face.shape !== 'none') {
      ctx.lineWidth = border * 2; ctx.strokeStyle = '#fff'; ctx.stroke(path);
      ctx.lineWidth = scale * 1.2; ctx.strokeStyle = 'rgba(43,33,64,.35)'; ctx.stroke(path);
    }
  }

  /* ---------- Public API ---------- */
  function resolve(spec) {
    if (spec && spec.kind === 'custom' && spec.dataUrl) {
      const mode = CUSTOM[spec.mode] ? spec.mode : 'body';
      return { custom: true, def: CUSTOM[mode], mode };
    }
    const id = spec && PRESETS[spec.id] ? spec.id : 'arjun';
    return { custom: false, def: PRESETS[id], id };
  }

  /** Mount a character into `container`. Returns the .nb-char element. */
  function mount(container, spec, emoji) {
    const r = resolve(spec);
    const el = document.createElement('div');
    el.className = 'nb-char' + (r.def.floaty ? ' nb-floaty' : '') + (r.custom ? ' nb-custom nb-mode-' + r.mode : '');
    const svg = r.custom ? r.def.svg(emoji, spec.color) : r.def.svg(emoji);
    setHTML(el, `<div class="nb-shadow"></div><div class="nb-inner">${svg}</div>`);
    if (r.custom) {
      const f = r.def.face;
      const cv = document.createElement('canvas');
      cv.className = 'nb-face';
      cv.style.cssText = `left:${(f.x / 200) * 100}%;top:${(f.y / 300) * 100}%;width:${(f.w / 200) * 100}%;height:${(f.h / 300) * 100}%;`;
      el.querySelector('.nb-inner').appendChild(cv);
      drawFace(cv, spec.dataUrl, f, spec.crop);
    }
    container.appendChild(el);
    return el;
  }

  const css = `
  .nb-char{position:relative;width:100%;height:100%;user-select:none;-webkit-user-select:none}
  .nb-inner{position:absolute;inset:0;transform-origin:50% 100%}
  .nb-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;display:block}
  .nb-face{position:absolute;display:block;pointer-events:none}
  .nb-mode-cutout .nb-face{filter:drop-shadow(0 0 0 #fff) drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 6px 8px rgba(0,0,0,.25))}
  .nb-mode-sticker .nb-face{filter:drop-shadow(0 6px 10px rgba(0,0,0,.25))}
  .nb-shadow{position:absolute;left:24%;right:24%;bottom:0.5%;height:4%;border-radius:50%;background:rgba(0,0,0,.2);filter:blur(2px)}
  .nb-arm,.nb-leg,.nb-tail,.nb-eyes{transform-box:view-box;transform-origin:var(--o,100px 150px)}
  .nb-prop{transform-box:fill-box;transform-origin:center}
  .nb-eyes{animation:nb-blink 4.2s infinite}
  .nb-tail{animation:nb-wag .7s ease-in-out infinite alternate}
  .nb-pulse,.nb-antenna{animation:nb-pulse 1s ease-in-out infinite}
  .nb-idle .nb-inner{animation:nb-bob 1.7s ease-in-out infinite}
  .nb-idle .nb-arm-r{animation:nb-wave 1.3s ease-in-out infinite}
  .nb-idle .nb-prop{animation:nb-propbob 1.3s ease-in-out infinite}
  .nb-floaty .nb-inner{animation:nb-float 2.2s ease-in-out infinite}
  .nb-floaty .nb-shadow{animation:nb-shadowpulse 2.2s ease-in-out infinite}
  .nb-running .nb-inner{animation:nb-runbob .17s ease-in-out infinite alternate}
  .nb-running .nb-leg-l{animation:nb-swing .34s ease-in-out infinite alternate}
  .nb-running .nb-leg-r{animation:nb-swing .34s ease-in-out infinite alternate-reverse}
  .nb-running .nb-arm-l{animation:nb-swing .34s ease-in-out infinite alternate-reverse}
  .nb-running .nb-arm-r{animation:nb-swing .34s ease-in-out infinite alternate}
  .nb-running.nb-fast .nb-leg-l,.nb-running.nb-fast .nb-leg-r,.nb-running.nb-fast .nb-arm-l,.nb-running.nb-fast .nb-arm-r{animation-duration:.18s}
  .nb-running.nb-fast .nb-inner{animation-duration:.09s}
  .nb-impatient .nb-leg-r{animation:nb-tap .28s ease-in-out infinite alternate}
  .nb-impatient .nb-inner{animation:nb-huff .9s ease-in-out infinite}
  .nb-angry .nb-inner{animation:nb-shake .12s linear infinite}
  .nb-dance .nb-inner{animation:nb-dance .5s ease-in-out infinite alternate}
  .nb-dance .nb-arm-l{animation:nb-swing .25s infinite alternate}
  .nb-dance .nb-arm-r{animation:nb-swing .25s infinite alternate-reverse}
  .nb-dance .nb-leg-l{animation:nb-swing .5s infinite alternate}
  .nb-squash .nb-inner{animation:nb-squash .45s cubic-bezier(.3,1.6,.5,1) 1}
  .nb-crouch .nb-inner{transform:scale(1.08,.84);transition:transform .25s}
  @keyframes nb-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
  @keyframes nb-wag{from{transform:rotate(-10deg)}to{transform:rotate(12deg)}}
  @keyframes nb-pulse{50%{opacity:.45}}
  @keyframes nb-bob{50%{transform:translateY(-2.2%)}}
  @keyframes nb-float{50%{transform:translateY(-5%) rotate(-2deg)}}
  @keyframes nb-shadowpulse{50%{transform:scaleX(.75);opacity:.6}}
  @keyframes nb-wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-16deg)}}
  @keyframes nb-propbob{50%{transform:rotate(10deg) scale(1.08)}}
  @keyframes nb-runbob{from{transform:translateY(0) rotate(var(--lean,0deg))}to{transform:translateY(-3.5%) rotate(var(--lean,0deg))}}
  @keyframes nb-swing{from{transform:rotate(-30deg)}to{transform:rotate(30deg)}}
  @keyframes nb-tap{from{transform:rotate(0)}to{transform:rotate(-14deg)}}
  @keyframes nb-huff{0%,100%{transform:scale(1)}50%{transform:scale(1.03,.97)}}
  @keyframes nb-shake{0%{transform:translate(0,0) rotate(0)}25%{transform:translate(-2%,0) rotate(-3deg)}75%{transform:translate(2%,0) rotate(3deg)}}
  @keyframes nb-dance{from{transform:rotate(-12deg) translateY(0)}to{transform:rotate(12deg) translateY(-6%)}}
  @keyframes nb-squash{0%{transform:scale(1.25,.7)}60%{transform:scale(.92,1.1)}100%{transform:scale(1)}}
  `;

  g.NudgeChars = {
    presets: Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name, tagline: p.tagline })),
    customModes: [
      { id: 'body', name: 'Head on body' },
      { id: 'sticker', name: 'Sticker' },
      { id: 'cutout', name: 'Cutout (transparent PNG)' },
    ],
    mount, drawFace, setHTML, esc, css,
  };
})();
