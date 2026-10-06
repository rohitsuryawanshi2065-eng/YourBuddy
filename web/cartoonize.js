/* Nudge Buddy — "make me a buddy": photo → cartoon head + matching outfit colours.
 * 100% on-device. Uses MediaPipe Face Detection + Selfie Segmentation (bundled wasm/tflite)
 * to find the person, then a hand-written cartoon filter:
 *   edge-preserving smoothing → colour quantisation (k-means) → ink outlines → sticker outline.
 * Classic script → globalThis.NudgeToon */
(function () {
  const g = globalThis;
  if (g.NudgeToon) return;
  let base = 'ml/';
  let fdPromise = null, segPromise = null;

  // optional file map (used by the single-file preview, where models are embedded as blob: URLs)
  const url = (p) => (g.NudgeToonFiles && g.NudgeToonFiles[p]) || base + p;
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
    document.head.appendChild(s);
  });

  /* ---------- MediaPipe wrappers (one result per send) ---------- */
  function makeRunner(inst) {
    let pending = null;
    inst.onResults((r) => { if (pending) { const p = pending; pending = null; p(r); } });
    return (image) => new Promise((resolve, reject) => {
      pending = resolve;
      inst.send({ image }).catch(reject);
      setTimeout(() => { if (pending === resolve) { pending = null; reject(new Error('timeout')); } }, 20000);
    });
  }
  let fdModel = 'short';
  function faceDetector() {
    if (!fdPromise) fdPromise = (async () => {
      if (!g.FaceDetection) await loadScript(url('face_detection/face_detection.js'));
      const fd = new g.FaceDetection({ locateFile: (f) => url('face_detection/' + f) });
      fd.setOptions({ model: 'short', minDetectionConfidence: 0.3 });
      await fd.initialize();
      const run = makeRunner(fd);
      // run(image, 'short' | 'full'): switch model lazily (full-range copes with small/far faces)
      let conf = 0.3;
      return async (image, model = 'short', c = 0.5) => {
        if (model !== fdModel || c !== conf) { await fd.setOptions({ model, minDetectionConfidence: c }); fdModel = model; conf = c; }
        return run(image);
      };
    })().catch((e) => { fdPromise = null; throw e; });
    return fdPromise;
  }
  function segmenter() {
    if (!segPromise) segPromise = (async () => {
      if (!g.SelfieSegmentation) await loadScript(url('selfie_segmentation/selfie_segmentation.js'));
      const sg = new g.SelfieSegmentation({ locateFile: (f) => url('selfie_segmentation/' + f) });
      sg.setOptions({ modelSelection: 0 });
      await sg.initialize();
      return makeRunner(sg);
    })().catch((e) => { segPromise = null; throw e; });
    return segPromise;
  }

  /* ---------- helpers ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hex = (r, gg, b) => '#' + [r, gg, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function median(arr) { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[s.length >> 1]; }
  function medianColor(px, w, x0, y0, x1, y1, maskFn) {
    const R = [], G = [], B = [];
    x0 = clamp(Math.round(x0), 0, w - 1); x1 = clamp(Math.round(x1), 0, w - 1);
    const h = px.length / 4 / w;
    y0 = clamp(Math.round(y0), 0, h - 1); y1 = clamp(Math.round(y1), 0, h - 1);
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
      if (maskFn && !maskFn(x, y)) continue;
      const i = (y * w + x) * 4; R.push(px[i]); G.push(px[i + 1]); B.push(px[i + 2]);
    }
    if (R.length < 12) return null;
    return [median(R), median(G), median(B)];
  }
  function lum(c) { return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
  function saturate(c, k) { const l = lum(c); return c.map((v) => clamp(l + (v - l) * k, 0, 255)); }

  /* Edge-preserving smoothing (separable-ish bilateral, 2 passes). */
  function bilateral(src, w, h, radius, sigC) {
    const out = new Float32Array(src.length);
    const sc2 = 2 * sigC * sigC, ss2 = 2 * (radius * 0.6) ** 2;
    const sw = []; for (let d = -radius; d <= radius; d++) sw.push(Math.exp(-(d * d) / ss2));
    const pass = (inp, outp, dx, dy) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r0 = inp[i], g0 = inp[i + 1], b0 = inp[i + 2];
        let ws = 0, r = 0, gg = 0, b = 0;
        for (let d = -radius; d <= radius; d++) {
          const xx = clamp(x + d * dx, 0, w - 1), yy = clamp(y + d * dy, 0, h - 1);
          const j = (yy * w + xx) * 4;
          const dr = inp[j] - r0, dg = inp[j + 1] - g0, db = inp[j + 2] - b0;
          const wt = sw[d + radius] * Math.exp(-(dr * dr + dg * dg + db * db) / sc2);
          ws += wt; r += inp[j] * wt; gg += inp[j + 1] * wt; b += inp[j + 2] * wt;
        }
        outp[i] = r / ws; outp[i + 1] = gg / ws; outp[i + 2] = b / ws; outp[i + 3] = inp[i + 3];
      }
    };
    const tmp = new Float32Array(src.length);
    pass(src, tmp, 1, 0); pass(tmp, out, 0, 1);
    return out;
  }

  /* k-means colour quantisation over opaque pixels (in a perceptual-ish space). */
  function quantize(px, w, h, k) {
    const idx = [];
    for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] > 128) idx.push(i);
    if (idx.length < k) return px;
    const cent = [];
    for (let c = 0; c < k; c++) { const i = idx[Math.floor((c + 0.5) / k * idx.length * 0.999)]; cent.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]); }
    // sort-init by luminance spread for stability
    const sampleStep = Math.max(1, Math.floor(idx.length / 6000));
    const assign = new Uint8Array(w * h);
    for (let it = 0; it < 9; it++) {
      const sum = cent.map(() => [0, 0, 0, 0]);
      for (let n = 0; n < idx.length; n += sampleStep) {
        const i = idx[n] * 4; let best = 0, bd = 1e9;
        for (let c = 0; c < k; c++) { const d = (px[i] - cent[c][0]) ** 2 * 0.8 + (px[i + 1] - cent[c][1]) ** 2 + (px[i + 2] - cent[c][2]) ** 2 * 0.6; if (d < bd) { bd = d; best = c; } }
        const s = sum[best]; s[0] += px[i]; s[1] += px[i + 1]; s[2] += px[i + 2]; s[3]++;
      }
      for (let c = 0; c < k; c++) if (sum[c][3]) cent[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
    const out = new Float32Array(px);
    for (const n of idx) {
      const i = n * 4; let best = 0, bd = 1e9;
      for (let c = 0; c < k; c++) { const d = (px[i] - cent[c][0]) ** 2 * 0.8 + (px[i + 1] - cent[c][1]) ** 2 + (px[i + 2] - cent[c][2]) ** 2 * 0.6; if (d < bd) { bd = d; best = c; } }
      assign[n] = best;
      // keep a little of the smooth shading so faces don't look flat-ugly
      out[i] = cent[best][0] * 0.78 + px[i] * 0.22; out[i + 1] = cent[best][1] * 0.78 + px[i + 1] * 0.22; out[i + 2] = cent[best][2] * 0.78 + px[i + 2] * 0.22;
    }
    return out;
  }

  /* Local magnify ("cartoon eyes"): each eye region is enlarged with a smooth falloff. */
  function bulge(src, w, h, centers, R, k) {
    const out = new Float32Array(src);
    for (const c of centers) {
      const x0 = Math.max(0, Math.floor(c.x - R)), x1 = Math.min(w - 1, Math.ceil(c.x + R));
      const y0 = Math.max(0, Math.floor(c.y - R)), y1 = Math.min(h - 1, Math.ceil(c.y + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
        if (d >= R) continue;
        const f = 1 - k * (1 - (d / R) ** 2) ** 2;      // < 1 near the centre → magnified
        const sx = clamp(c.x + dx * f, 0, w - 1.001), sy = clamp(c.y + dy * f, 0, h - 1.001);
        const xi = sx | 0, yi = sy | 0, ax = sx - xi, ay = sy - yi;
        const o = (y * w + x) * 4;
        for (let ch = 0; ch < 4; ch++) {
          const a = src[(yi * w + xi) * 4 + ch], b = src[(yi * w + xi + 1) * 4 + ch];
          const cc = src[((yi + 1) * w + xi) * 4 + ch], dd = src[((yi + 1) * w + xi + 1) * 4 + ch];
          out[o + ch] = (a * (1 - ax) + b * ax) * (1 - ay) + (cc * (1 - ax) + dd * ax) * ay;
        }
      }
    }
    return out;
  }

  /* Ink lines from luminance edges (Sobel), thresholded adaptively. */
  function inkEdges(px, w, h) {
    const L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) L[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    const mag = new Float32Array(w * h); const vals = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (px[i * 4 + 3] < 140) continue;
      const gx = -L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1] + L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1];
      const gy = -L[i - w - 1] - 2 * L[i - w] - L[i - w + 1] + L[i + w - 1] + 2 * L[i + w] + L[i + w + 1];
      mag[i] = Math.hypot(gx, gy); vals.push(mag[i]);
    }
    vals.sort((a, b) => a - b);
    const t = vals[Math.floor(vals.length * 0.9)] || 60;
    return { mag, t: Math.max(45, t) };
  }

  /* ---------- main ---------- */
  /** @returns {Promise<{ok, head, photo, skin, hair, shirt, reason?}>} */
  async function cartoonize(source, { onStep, style = '3d', longHair = false, forceGuess = false } = {}) {
    const step = (s) => { try { onStep && onStep(s); } catch (e) { /* noop */ } };
    const bmp = source instanceof ImageBitmap ? source : await createImageBitmap(source);
    const sc = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const W = Math.round(bmp.width * sc), H = Math.round(bmp.height * sc);
    const img = canvas(W, H); const ictx = img.getContext('2d', { willReadFrequently: true });
    ictx.drawImage(bmp, 0, 0, W, H);
    const photo = (() => { const s2 = Math.min(1, 420 / Math.max(W, H)); const c = canvas(Math.round(W * s2), Math.round(H * s2)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.88); })();

    step('Finding your face…');
    // Several attempts: as-is, padded (close-up selfies), full-range model (small/far faces), mirrored.
    let face = null, why = 'noface';
    try {
      const detect = await faceDetector();
      const pad = (k) => { const c = canvas(Math.round(W * (1 + 2 * k)), Math.round(H * (1 + 2 * k))); const x = c.getContext('2d'); x.fillStyle = '#888'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, W * k, H * k); return c; };
      const tries = [
        [img, 'short', null, 0.5], [pad(0.35), 'short', 0.35, 0.5], [img, 'full', null, 0.5], [pad(0.35), 'full', 0.35, 0.5],
        [img, 'short', null, 0.3], [img, 'full', null, 0.3],
      ];
      // a real face has both eyes inside its box, a sensible distance apart
      const sane = (d) => { const b = d.boundingBox, L = d.landmarks || []; if (L.length < 2) return true;
        const x0 = b.xCenter - b.width / 2, x1 = b.xCenter + b.width / 2, y0 = b.yCenter - b.height / 2, y1 = b.yCenter + b.height / 2;
        const inside = [L[0], L[1]].every((p) => p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1);
        const eyeD = Math.hypot(L[0].x - L[1].x, L[0].y - L[1].y) / b.width;
        return inside && eyeD > 0.2 && eyeD < 0.65; };
      for (const [im, model, k, c] of (forceGuess ? [] : tries)) {
        const r = await detect(im, model, c);
        const best = (r && r.detections || []).filter(sane).sort((a, b) => b.boundingBox.width - a.boundingBox.width)[0];
        console.info('[NudgeToon] try', model, k, c, best && JSON.stringify(best.boundingBox));
        if (!best) continue;
        if (k) {   // map padded coordinates back to the original image
          const f = 1 + 2 * k, m = (v) => (v * f - k);
          const bbx = best.boundingBox;
          face = { boundingBox: { xCenter: m(bbx.xCenter), yCenter: m(bbx.yCenter), width: bbx.width * f, height: bbx.height * f },
            landmarks: (best.landmarks || []).map((p) => ({ x: m(p.x), y: m(p.y) })) };
        } else face = best;
        break;
      }
      if (fdModel !== 'short') detect(img, 'short', 0.5).catch(() => {});
    } catch (e) { console.warn('[NudgeToon] face model failed', e); why = 'model'; }
    step('Removing the background…');
    let maskPx = null;
    try {
      const seg = await (await segmenter())(img);
      const mc = canvas(W, H); const mctx = mc.getContext('2d', { willReadFrequently: true });
      mctx.drawImage(seg.segmentationMask, 0, 0, W, H);
      const md = mctx.getImageData(0, 0, W, H).data;
      maskPx = new Uint8ClampedArray(W * H);
      let alphaVaries = false;
      for (let i = 0; i < W * H; i++) if (md[i * 4 + 3] < 250) { alphaVaries = true; break; }
      for (let i = 0; i < W * H; i++) maskPx[i] = alphaVaries ? md[i * 4 + 3] : md[i * 4];
    } catch (e) { maskPx = null; }
    const person = (x, y) => !maskPx || maskPx[(y | 0) * W + (x | 0)] > 128;

    // No face found → estimate the head from the person silhouette (or the upper-centre of the photo).
    let guessed = false;
    if (!face) {
      guessed = true;
      let box = null;
      if (maskPx) {
        const rowW = (y) => { let a = -1, b = -1; for (let x = 0; x < W; x++) if (maskPx[y * W + x] > 128) { if (a < 0) a = x; b = x; } return a < 0 ? null : [a, b]; };
        let top = -1; for (let y = 0; y < H; y++) { const r = rowW(y); if (r && r[1] - r[0] > W * 0.04) { top = y; break; } }
        if (top >= 0 && top < H * 0.7) {
          // head width ≈ silhouette width a little below the crown
          const sample = (f) => rowW(Math.min(H - 1, Math.round(top + f)));
          const guessW = Math.min(W, H) * 0.3;
          const r1 = sample(guessW * 0.55) || sample(guessW * 0.3);
          if (r1) { const hw = Math.max(20, Math.min(r1[1] - r1[0], W * 0.7)) * 0.64; box = { xCenter: (r1[0] + r1[1]) / 2 / W, yCenter: (top + hw * 1.08) / H, width: hw / W, height: hw * 1.15 / H }; }
        }
      }
      if (!box) { const hw = Math.min(W, H) * 0.34; box = { xCenter: 0.5, yCenter: (H * 0.12 + hw * 1.15) / H, width: hw / W, height: hw * 1.15 / H }; }
      face = { boundingBox: box, landmarks: [] };
      console.info('[NudgeToon] no face detected (' + why + ') — using estimated head box', box);
    }
    const bb = face.boundingBox;
    const fx = bb.xCenter * W, fy = bb.yCenter * H, fw = bb.width * W, fh = bb.height * H;
    const kp = (face.landmarks || []).map((p) => ({ x: p.x * W, y: p.y * H }));
    // estimated head → synthesize rough eye/nose/mouth points so the jaw & collar cut still work
    if (kp.length < 4) kp.splice(0, kp.length, { x: fx - fw * 0.2, y: fy - fh * 0.08 }, { x: fx + fw * 0.2, y: fy - fh * 0.08 }, { x: fx, y: fy + fh * 0.1 }, { x: fx, y: fy + fh * 0.26 });

    // Head region: face box widened for hair, cut just under the chin.
    const hx0 = clamp(fx - fw * (longHair ? 1.15 : 0.95), 0, W - 1), hx1 = clamp(fx + fw * (longHair ? 1.15 : 0.95), 0, W - 1);
    const hy0 = clamp(fy - fh * 1.25, 0, H - 1), hy1 = clamp(fy + fh * (longHair ? 1.6 : 0.72), 0, H - 1);
    // hair colour (for keeping long hair that falls below the chin)
    const px0 = ictx.getImageData(0, 0, W, H).data;
    const hairRGB = medianColor(px0, W, fx - fw * 0.45, fy - fh * 1.15, fx + fw * 0.45, fy - fh * 0.75, person);
    const isHair1 = (X, Y) => { if (!hairRGB) return false; const i = ((Y | 0) * W + (X | 0)) * 4; return Math.hypot(px0[i] - hairRGB[0], px0[i + 1] - hairRGB[1], px0[i + 2] - hairRGB[2]) < 42; };
    const isHair = (X, Y) => { let n = 0; for (const [dx, dy] of [[0, 0], [-4, 0], [4, 0], [0, -4], [0, 4], [-3, -3], [3, 3], [3, -3], [-3, 3]]) if (isHair1(clamp(X + dx, 0, W - 1), clamp(Y + dy, 0, H - 1))) n++; return n >= 7; };
    const ex = fx, ey = fy - fh * 0.2, erx = fw * 0.88, ery = fh * 1.05;   // head ellipse
    const cw = Math.round(hx1 - hx0), ch = Math.round(hy1 - hy0);
    const OUT = 300, s = Math.min(OUT / cw, OUT / ch);
    const ow = Math.round(cw * s), oh = Math.round(ch * s);
    const crop = canvas(ow, oh); const cctx = crop.getContext('2d', { willReadFrequently: true });
    cctx.drawImage(img, hx0, hy0, cw, ch, 0, 0, ow, oh);
    const cd = cctx.getImageData(0, 0, ow, oh);
    // chin line from landmarks (mouth/nose), so the collar & neck are cut off cleanly
    const chinY = kp.length >= 4 ? kp[3].y + Math.max(fh * 0.12, (kp[3].y - kp[2].y) * 1.25) : fy + fh * 0.55;
    const alpha = new Float32Array(ow * oh);
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const X = hx0 + x / s, Y = hy0 + y / s;
      const e = ((X - ex) / erx) ** 2 + ((Y - ey) / (Y > ey ? ery * 0.92 : ery)) ** 2;   // head ellipse, a bit narrower at the jaw
      let a = e < 0.8 ? 1 : e > 1.0 ? 0 : (1.0 - e) / 0.2;
      const keepHair = longHair && Y > kp[3]?.y && Y < chinY + fh * 0.85 && Math.abs(X - fx) > fw * 0.42 && Math.abs(X - fx) < fw * 1.05 && person(clamp(X, 0, W - 1), clamp(Y, 0, H - 1)) && isHair(clamp(X, 0, W - 1), clamp(Y, 0, H - 1));
      if (longHair) { const e2 = ((X - ex) / (erx * 1.25)) ** 2 + ((Y - (ey + fh * 0.35)) / (ery * 1.45)) ** 2; if (keepHair) a = e2 < 1 ? 1 : 0; }
      if (Y > chinY && !keepHair) a *= clamp(1 - (Y - chinY) / (fh * 0.06), 0, 1);
      // jawline: below the mouth the head tapers toward the chin, so collars/shoulders drop out
      if (!keepHair && kp.length >= 4 && Y > kp[3].y) {
        const t = clamp((Y - kp[3].y) / Math.max(1, chinY - kp[3].y), 0, 1);
        const half = fw * (0.5 - 0.2 * t);
        a *= clamp(1 - (Math.abs(X - kp[3].x) - half) / (fw * 0.05), 0, 1);
      }
      if (maskPx) { const m = maskPx[clamp(Y | 0, 0, H - 1) * W + clamp(X | 0, 0, W - 1)] / 255; a *= clamp((m - 0.3) / 0.4, 0, 1); }
      alpha[y * ow + x] = a;
    }
    // smooth the silhouette (box blur ×2) → clean cartoon outline instead of jaggies
    const blurA = (A) => { const B = new Float32Array(A.length), r = 2;
      for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) { let sum = 0, n = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < ow && yy < oh) { sum += A[yy * ow + xx]; n++; } }
        B[y * ow + x] = sum / n; } return B; };
    const sa = blurA(blurA(alpha));
    const src = new Float32Array(cd.data.length);
    for (let i = 0; i < ow * oh; i++) {
      const p = i * 4, a = clamp((sa[i] - 0.35) / 0.3, 0, 1);   // re-sharpen the blurred edge
      src[p] = cd.data[p]; src[p + 1] = cd.data[p + 1]; src[p + 2] = cd.data[p + 2]; src[p + 3] = a * 255;
    }

    step('Drawing your cartoon…');
    await new Promise((r) => setTimeout(r, 0));
    const out = cctx.createImageData(ow, oh); const od = out.data;
    if (style === 'comic') {
      let sm = bilateral(src, ow, oh, 4, 30);
      sm = bilateral(sm, ow, oh, 4, 24);
      sm = bilateral(sm, ow, oh, 2, 18);
      const q = quantize(sm, ow, oh, 9);
      const { mag, t } = inkEdges(sm, ow, oh);
      for (let i = 0; i < ow * oh; i++) {
        const p = i * 4;
        let c = saturate([q[p], q[p + 1], q[p + 2]], 1.18);
        c = c.map((v) => clamp((v - 128) * 1.06 + 136, 0, 255));
        const edge = mag[i] > t ? clamp((mag[i] - t) / t, 0, 1) : 0;
        const k = 1 - edge * 0.72;
        od[p] = c[0] * k + 43 * (1 - k); od[p + 1] = c[1] * k + 33 * (1 - k); od[p + 2] = c[2] * k + 64 * (1 - k);
        od[p + 3] = src[p + 3];
      }
    } else {
      // "3D cartoon": bigger eyes, airbrushed skin, soft studio light, no ink lines
      const eyes = kp.length >= 2 && !guessed ? [kp[0], kp[1]].map((e) => ({ x: (e.x - hx0) * s, y: (e.y - hy0) * s })) : [];
      const R = fw * s * 0.2;
      let w0 = eyes.length ? bulge(src, ow, oh, eyes, R, 0.42) : src;
      let sm = bilateral(w0, ow, oh, 5, 34);
      sm = bilateral(sm, ow, oh, 5, 30);
      sm = bilateral(sm, ow, oh, 3, 20);
      // keep a little fine detail (eyes, brows, lips) from the warped original
      const fcx = (fx - hx0) * s, fcy = (fy - hy0) * s, frx = fw * s * 0.62, fry = fh * s * 0.75;
      for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
        const i = y * ow + x, p = i * 4;
        const detail = eyes.some((e) => Math.hypot(x - e.x, y - e.y) < R * 1.1) ? 0.55 : 0.12;
        let c = [0, 1, 2].map((k) => sm[p + k] * (1 - detail) + w0[p + k] * detail);
        // soft key light from top-left, gentle falloff toward the edges → rounded, "rendered" look
        const lx = (x - fcx) / frx, ly = (y - fcy) / fry;
        const light = 1.02 - 0.12 * (lx * 0.6 + ly * 0.8) - 0.14 * Math.min(1, lx * lx + ly * ly);
        c = c.map((v) => v * light);
        c = saturate(c, 1.22);
        c = [c[0] * 1.03 + 3, c[1] * 1.0 + 1, c[2] * 0.96];             // warm, glowy skin
        c = c.map((v) => clamp((v - 128) * 1.14 + 126, 0, 255));
        od[p] = c[0]; od[p + 1] = c[1]; od[p + 2] = c[2]; od[p + 3] = src[p + 3];
      }
    }
    // Trim to the visible head and add a cartoon outline (dark ink + soft white rim)
    let minX = ow, minY = oh, maxX = 0, maxY = 0;
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) if (od[(y * ow + x) * 4 + 3] > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (maxX <= minX) return { ok: false, reason: 'noface', photo };
    const pad = 8, tw = maxX - minX + 1 + pad * 2, th = maxY - minY + 1 + pad * 2;
    const layer = canvas(ow, oh); layer.getContext('2d').putImageData(out, 0, 0);
    const head = canvas(tw, th); const hctx = head.getContext('2d');
    // outline: draw silhouette offset in a ring, tinted
    const sil = canvas(tw, th); const sctx = sil.getContext('2d');
    sctx.drawImage(layer, minX - pad, minY - pad, tw, th, 0, 0, tw, th);
    sctx.globalCompositeOperation = 'source-in'; sctx.fillStyle = '#2b2140'; sctx.fillRect(0, 0, tw, th);
    const ring = style === 'comic' ? 3.2 : 1.4; if (style !== 'comic') hctx.globalAlpha = 0.55;
    for (let a = 0; a < 16; a++) hctx.drawImage(sil, Math.cos(a / 16 * 6.283) * ring, Math.sin(a / 16 * 6.283) * ring);
    hctx.globalAlpha = 1;
    hctx.drawImage(layer, minX - pad, minY - pad, tw, th, 0, 0, tw, th);

    // Outfit colours sampled from the photo
    step('Matching your outfit…');
    const px = ictx.getImageData(0, 0, W, H).data;
    let skin = null;
    if (kp.length >= 4) {
      const eyeY = (kp[0].y + kp[1].y) / 2, mY = kp[3].y;
      skin = medianColor(px, W, kp[0].x, eyeY + (mY - eyeY) * 0.25, kp[1].x, eyeY + (mY - eyeY) * 0.6, null);
    }
    skin = skin || medianColor(px, W, fx - fw * 0.2, fy - fh * 0.05, fx + fw * 0.2, fy + fh * 0.15, null) || [240, 192, 140];
    const hairC = medianColor(px, W, fx - fw * 0.45, fy - fh * 1.15, fx + fw * 0.45, fy - fh * 0.75, person);
    const shirtC = medianColor(px, W, fx - fw * 1.1, fy + fh * 1.15, fx + fw * 1.1, Math.min(H - 1, fy + fh * 2.4), person);
    const tone = (c, fallback) => (c ? hex(...saturate(c, 1.15)) : fallback);
    return {
      ok: true,
      guessed,
      facePhoto: (() => {   // square photo crop around the head, for the "Head on body" / "Sticker" styles
        const side = Math.min(Math.max(fw, fh) * 2.2, W, H), cx = clamp(fx, side / 2, W - side / 2), cy = clamp(fy - fh * 0.12, side / 2, H - side / 2);
        const c = canvas(320, 320); c.getContext('2d').drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, 320, 320);
        return c.toDataURL('image/jpeg', 0.9);
      })(),
      head: head.toDataURL('image/png'),
      photo,
      skin: tone(skin, '#f0c08a'),
      hair: tone(hairC, '#2a1d18'),
      shirt: tone(shirtC, '#4a7cc4'),
    };
  }

  g.NudgeToon = {
    configure(opts) { if (opts && opts.base) base = opts.base.endsWith('/') ? opts.base : opts.base + '/'; },
    cartoonize,
    preload() { faceDetector().catch(() => {}); segmenter().catch(() => {}); },
  };
})();
