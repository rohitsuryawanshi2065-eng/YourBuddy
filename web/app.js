import { TEMPLATES, EMOJIS, dayKey, fmtMin, fmtDays } from './shared.js';
import * as core from './core.js';
import { createPlatform } from './platform.js';

const Chars = globalThis.NudgeChars;
const Sounds = globalThis.NudgeSounds;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const S = core.state;
const platform = createPlatform();
document.body.classList.add('plat-' + platform.name);
if (/Mac/.test(navigator.platform || navigator.userAgent)) document.body.classList.add('mac');

const st = document.createElement('style'); st.textContent = Chars.css; document.head.appendChild(st);

function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}
const charSpec = core.charSpec;
function mountInto(box, spec, emoji, idle = true) {
  box.textContent = '';
  const el = Chars.mount(box, spec, emoji);
  if (idle) el.classList.add('nb-idle');
  return el;
}
function countdown(at) {
  const s = Math.max(0, Math.round((at - Date.now()) / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------------- header + stats ---------------- */
function renderHeader() {
  mountInto($('#mascot'), charSpec(S.settings.characterId), '');
  const paused = S.settings.pausedUntil > Date.now();
  $('#pausedBar').hidden = !paused;
  if (paused) $('#pausedUntil').textContent = new Date(S.settings.pausedUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  renderNextLine();
}
function renderNextLine() {
  const next = S.reminders.filter((r) => r.enabled && r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
  $('#nextLine').textContent = next ? `Next: ${next.emoji} ${next.title} in ${countdown(next.nextAt)}` : (S.reminders.length ? 'All nudges paused' : 'No nudges yet');
}
function renderStats() {
  const { streak, today } = core.streakInfo(S.stats);
  $('#stStreak').textContent = streak;
  $('#stToday').textContent = today;
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const counts = days.map((d) => (S.stats.history?.[dayKey(d)]?.done) || 0);
  const max = Math.max(3, ...counts);
  $('#week').innerHTML = days.map((d, i) =>
    `<div class="bar${counts[i] ? ' has' : ''}${i === 6 ? ' today' : ''}" title="${counts[i]} done"><i style="height:${Math.max(8, (counts[i] / max) * 100) * 0.7}%"></i><b>${'SMTWTFS'[d.getDay()]}</b></div>`).join('');
}

/* ---------------- tabs ---------------- */
function showTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $$('main.panel').forEach((p) => (p.hidden = p.id !== 'tab-' + name));
  try { localStorage.setItem('nb-tab', name); } catch (e) { /* noop */ }
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ---------------- nudges ---------------- */
const F = { id: null, emoji: '💧', type: 'interval', minutes: 45, time: '09:00', days: [], celebrate: '' };
const DURS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120];
function renderTemplates() {
  $('#templates').innerHTML = TEMPLATES.map((t, i) =>
    `<button class="tpl" data-i="${i}"><span class="e">${t.emoji}</span><span class="t">${Chars.esc(t.title)}</span><span class="d">${t.type === 'clock' ? '⏰ ' + t.time : (t.type === 'interval' ? 'every ' : 'in ') + fmtMin(t.minutes)}</span></button>`).join('');
  $$('.tpl').forEach((b) => b.addEventListener('click', () => openForm(TEMPLATES[+b.dataset.i])));
}
function renderCharOptions(sel, value) {
  const opts = [['default', '⭐ My default buddy'], ...Chars.presets.map((p) => [p.id, p.name]), ...S.customChars.map((c) => ['custom:' + c.id, '🖼️ ' + c.name])];
  sel.innerHTML = opts.map(([v, n]) => `<option value="${v}">${Chars.esc(n)}</option>`).join('');
  sel.value = opts.some(([v]) => v === value) ? value : 'default';
}
function openForm(src = {}) {
  Object.assign(F, { id: null, emoji: '💧', type: 'interval', minutes: 45, time: '09:00', days: [], celebrate: '' }, src);
  F.id = src.id || null;
  $('#fTitle').value = src.title || '';
  $('#fMsg').value = src.message || '';
  $('#fYes').value = src.yesLabel || '';
  $('#fMin').value = F.minutes || 45;
  $('#fTime').value = F.time || '09:00';
  renderCharOptions($('#fChar'), src.characterId || 'default');
  $('#fSave').textContent = F.id ? 'Save changes' : 'Create nudge ✨';
  renderFormBits();
  $('#form').hidden = false;
  $('#newBtn').hidden = true;
  $('#form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function closeForm() { $('#form').hidden = true; $('#newBtn').hidden = false; }
function renderFormBits() {
  $('#emojiRow').innerHTML = EMOJIS.map((e) => `<button type="button" class="${e === F.emoji ? 'on' : ''}">${e}</button>`).join('');
  $$('#emojiRow button').forEach((b) => b.addEventListener('click', () => { F.emoji = b.textContent; renderFormBits(); }));
  $$('#fType button').forEach((b) => b.classList.toggle('on', b.dataset.v === F.type));
  $('#durBox').hidden = F.type === 'clock';
  $('#clockBox').hidden = F.type !== 'clock';
  const m = Number($('#fMin').value) || F.minutes;
  $('#durChips').innerHTML = DURS.map((d) => `<button type="button" data-m="${d}" class="${d === m ? 'on' : ''}">${fmtMin(d)}</button>`).join('');
  $$('#durChips button').forEach((b) => b.addEventListener('click', () => { $('#fMin').value = b.dataset.m; renderFormBits(); }));
  $('#fDays').innerHTML = 'SMTWTFS'.split('').map((d, i) => `<button type="button" data-d="${i}" class="${F.days.includes(i) ? 'on' : ''}">${d}</button>`).join('');
  $$('#fDays button').forEach((b) => b.addEventListener('click', () => {
    const d = +b.dataset.d; F.days = F.days.includes(d) ? F.days.filter((x) => x !== d) : [...F.days, d]; renderFormBits();
  }));
}
$$('#fType button').forEach((b) => b.addEventListener('click', () => { F.type = b.dataset.v; renderFormBits(); }));
$('#fMin').addEventListener('input', renderFormBits);
$('#newBtn').addEventListener('click', () => openForm({ emoji: '⏰', type: 'timer', minutes: 15 }));
$('#fCancel').addEventListener('click', closeForm);
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('#fTitle').value.trim() || 'Reminder';
  const minutes = Math.max(1, Math.min(1440, Math.round(Number($('#fMin').value) || 15)));
  const saved = core.upsert({
    id: F.id || undefined, emoji: F.emoji, title,
    message: $('#fMsg').value.trim() || title,
    yesLabel: $('#fYes').value.trim() || 'YES',
    celebrate: F.celebrate || 'Legend! 🎉',
    type: F.type, minutes, time: $('#fTime').value || '09:00', days: [...F.days].sort(),
    characterId: $('#fChar').value,
  });
  closeForm();
  maybeAskPermission();
  toast(`⏰ ${saved.emoji} ${saved.title} — in ${countdown(saved.nextAt)}`);
});

function describe(r) {
  if (r.type === 'clock') return `Alarm ${r.time} · ${fmtDays(r.days)}`;
  if (r.type === 'interval') return `Every ${fmtMin(r.minutes)}`;
  return r.doneAt && !r.enabled ? 'Done ✓ · switch on to run again' : `Once · ${fmtMin(r.minutes)}`;
}
function statusHTML(r) {
  if (!r.enabled || !r.nextAt) return '';
  return ` · ${r.snoozed ? 'snoozed ' : ''}<span class="cd" data-at="${r.nextAt}">${countdown(r.nextAt)}</span>`;
}
function renderList() {
  const list = [...S.reminders].sort((a, b) => (b.enabled - a.enabled) || ((a.nextAt || 9e15) - (b.nextAt || 9e15)));
  $('#empty').hidden = list.length > 0;
  if (!list.length) mountInto($('#emptyBuddy'), charSpec(S.settings.characterId), '💤');
  $('#list').innerHTML = list.map((r) => `
    <div class="item${r.enabled ? '' : ' off'}" data-id="${r.id}">
      <div class="e">${Chars.esc(r.emoji || '⏰')}</div>
      <div class="meta"><div class="t">${Chars.esc(r.title)}</div><div class="s">${Chars.esc(describe(r))}${statusHTML(r)}</div></div>
      <div class="acts">
        <button data-a="test" title="Try it now">▶</button>
        <button data-a="edit" title="Edit">✎</button>
        <button data-a="del" title="Delete">🗑</button>
      </div>
      <label class="sw"><input type="checkbox" ${r.enabled ? 'checked' : ''}><i></i></label>
    </div>`).join('');
  $$('#list .item').forEach((row) => {
    const id = row.dataset.id;
    const r = S.reminders.find((x) => x.id === id);
    row.querySelector('input').addEventListener('change', (e) => core.toggle(id, e.target.checked));
    row.querySelector('[data-a=test]').addEventListener('click', () => core.preview({ reminderId: id }));
    row.querySelector('[data-a=edit]').addEventListener('click', () => openForm({ ...r }));
    const del = row.querySelector('[data-a=del]');
    del.addEventListener('click', () => {
      if (del.dataset.armed) return core.remove(id);
      del.dataset.armed = '1'; del.textContent = '✓';
      setTimeout(() => { del.dataset.armed = ''; del.textContent = '🗑'; }, 2500);
    });
  });
}
setInterval(() => { $$('.cd[data-at]').forEach((el) => (el.textContent = countdown(+el.dataset.at))); renderNextLine(); }, 1000);

/* ---------------- buddies ---------------- */
function renderBuddies() {
  const cur = S.settings.characterId;
  $('#presetGrid').innerHTML = Chars.presets.map((p) =>
    `<button class="buddy${cur === p.id ? ' on' : ''}" data-id="${p.id}"><div class="stagebox"></div><div class="n">${Chars.esc(p.name)}</div><div class="tg">${Chars.esc(p.tagline)}</div></button>`).join('');
  $$('#presetGrid .buddy').forEach((b) => mountInto(b.querySelector('.stagebox'), { kind: 'preset', id: b.dataset.id }, ''));
  $('#customGrid').innerHTML = S.customChars.map((c) =>
    `<div class="buddy${cur === 'custom:' + c.id ? ' on' : ''}" data-id="custom:${c.id}" role="button" tabindex="0"><button class="del" title="Delete">✕</button><div class="stagebox"></div><div class="n">${Chars.esc(c.name)}</div><div class="tg">${Chars.esc(c.mode === 'toon' ? (c.look === 'comic' ? 'Comic cartoon' : '3D cartoon' + (c.body === 'girl' ? ' · Girl' : ' · Boy')) : ((Chars.customModes.find((m) => m.id === c.mode) || {}).name || ''))}</div></div>`).join('') +
    `<button class="buddy add" id="addBuddy"><span class="plus">＋</span><span class="n">Upload image</span><span class="tg">photo, pet or PNG</span></button>`;
  $$('#customGrid .buddy[data-id]').forEach((b) => {
    mountInto(b.querySelector('.stagebox'), charSpec(b.dataset.id), '');
    b.querySelector('.del').addEventListener('click', (e) => {
      e.stopPropagation();
      const id = b.dataset.id.slice(7);
      S.customChars = S.customChars.filter((c) => c.id !== id);
      if (S.settings.characterId === b.dataset.id) S.settings.characterId = 'arjun';
      core.save('all');
      toast('Buddy removed');
    });
  });
  $$('.buddy[data-id]').forEach((b) => b.addEventListener('click', () => { core.setSettings({ characterId: b.dataset.id }); toast('Buddy selected! 🎉'); }));
  const add = $('#addBuddy');
  add.addEventListener('click', () => { globalThis.NudgeToon.preload(); $('#file').click(); });
  add.addEventListener('dragover', (e) => { e.preventDefault(); add.classList.add('drag'); });
  add.addEventListener('dragleave', () => add.classList.remove('drag'));
  add.addEventListener('drop', (e) => { e.preventDefault(); add.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
}
const COLORS = ['#4a7cc4', '#e8505b', '#22a06b', '#f59e0b', '#7c4dff', '#2b2140', '#ec4899', '#0ea5e9'];
let draft = null, draftBmp = null;
$('#file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = ''; });
async function handleFile(file) {
  if (!file.type.startsWith('image/')) return toast('Please choose an image');
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { return toast('Couldn’t read that image'); }
  const max = 420, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
  const ctx = cv.getContext('2d');
  ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
  const corners = [[0, 0], [cv.width - 1, 0], [0, cv.height - 1], [cv.width - 1, cv.height - 1]].map(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3]);
  let clear = 0; const sd = ctx.getImageData(0, 0, cv.width, cv.height).data;
  for (let i = 3; i < sd.length; i += 4 * 7) if (sd[i] < 40) clear++;
  const transparent = clear / (sd.length / 28) > 0.3;   // a real cut-out PNG (not just rounded corners)
  const photo = transparent ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88);
  const name = (file.name || 'My buddy').replace(/\.[^.]+$/, '').slice(0, 20);

  // Show the editor with a "drawing you" state while the cartoon is made on-device
  $('#editor').hidden = false;
  $('#editorStage').innerHTML = '<div class="toon-loading"><div class="toon-spin"></div><span id="toonStep">✨ Turning you into a cartoon…</span></div>';
  $('#editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  let toon = null;
  try {
    toon = await globalThis.NudgeToon.cartoonize(bmp, { style: '3d', onStep: (t) => { const el = $('#toonStep'); if (el) el.textContent = '✨ ' + t; } });
  } catch (e) { toon = null; }
  const base = { id: Math.random().toString(36).slice(2, 10), name, photo, crop: { zoom: 1, x: 0, y: 0 } };
  if (toon && toon.ok) {
    if (!transparent && toon.facePhoto) base.photo = toon.facePhoto;
    draft = { ...base, toon: toon.head, dataUrl: toon.head, mode: 'toon', body: 'boy', look: '3d', color: toon.shirt, skin: toon.skin, hair: toon.hair, palette: [toon.shirt] };
    draftBmp = bmp;
    toast(toon.guessed ? 'Cartoon made 🎨 — face was hard to spot, use Zoom/Move to frame it' : 'Ta-da! Meet cartoon you 🎨');
  } else {
    draft = { ...base, dataUrl: photo, mode: transparent ? 'cutout' : 'body', color: COLORS[0] };
    toast(toon && toon.reason === 'noface' ? 'Couldn’t find a face — try a clear, front-facing photo' : 'Cartoon maker unavailable — using your photo');
  }
  openEditor();
}
function openEditor() {
  $('#editor').hidden = false;
  $('#eName').value = draft.name;
  $('#eZoom').value = draft.crop.zoom; $('#eX').value = draft.crop.x; $('#eY').value = draft.crop.y;
  const modes = Chars.customModes.filter((m) => m.id !== 'toon' || draft.toon);
  $('#eMode').innerHTML = modes.map((m) => `<button data-v="${m.id}" class="${m.id === draft.mode ? 'on' : ''}">${m.name.replace(' (transparent PNG)', '')}</button>`).join('');
  $$('#eMode button').forEach((b) => b.addEventListener('click', () => {
    draft.mode = b.dataset.v;
    draft.dataUrl = draft.mode === 'toon' ? draft.toon : draft.photo;
    openEditor();
  }));
  const swatches = [...new Set([...(draft.palette || []), ...COLORS])].slice(0, 9);
  $('#eColor').innerHTML = swatches.map((c) => `<button data-c="${c}" class="${c === draft.color ? 'on' : ''}" style="background:${c}" title="${c === (draft.palette || [])[0] ? 'From your photo' : ''}"></button>`).join('');
  $$('#eColor button').forEach((b) => b.addEventListener('click', () => { draft.color = b.dataset.c; draft.colorTouched = true; openEditor(); }));
  $('#eToonRow').hidden = draft.mode !== 'toon';
  $$('#eBody button').forEach((b) => { b.classList.toggle('on', b.dataset.v === (draft.body || 'boy')); b.onclick = () => retoon({ body: b.dataset.v }); });
  $$('#eLook button').forEach((b) => { b.classList.toggle('on', b.dataset.v === (draft.look || '3d')); b.onclick = () => retoon({ look: b.dataset.v }); });
  drawEditor();
  $('#editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// Boy/Girl changes the outfit (and keeps long hair); 3D/Comic changes the face style
async function retoon(change) {
  const next = { body: draft.body || 'boy', look: draft.look || '3d', ...change };
  const needRedraw = draftBmp && (next.look !== draft.look || (next.body === 'girl') !== (draft.body === 'girl'));
  Object.assign(draft, next);
  if (needRedraw) {
    $('#editorStage').innerHTML = '<div class="toon-loading"><div class="toon-spin"></div><span>✨ Redrawing…</span></div>';
    const r = await globalThis.NudgeToon.cartoonize(draftBmp, { style: next.look, longHair: next.body === 'girl' });
    if (r && r.ok) { draft.toon = r.head; draft.dataUrl = r.head; }
  }
  openEditor();
}
function drawEditor() { mountInto($('#editorStage'), { kind: 'custom', ...draft }, '💧'); }
['eZoom', 'eX', 'eY'].forEach((id) => $('#' + id).addEventListener('input', () => {
  draft.crop = { zoom: +$('#eZoom').value, x: +$('#eX').value, y: +$('#eY').value };
  clearTimeout(drawEditor.t); drawEditor.t = setTimeout(drawEditor, 30);
}));
$('#eCancel').addEventListener('click', () => { draft = null; $('#editor').hidden = true; });
$('#eSave').addEventListener('click', () => {
  draft.name = $('#eName').value.trim() || 'My buddy';
  S.customChars.push(draft);
  const prev = S.settings.characterId;
  S.settings.characterId = 'custom:' + draft.id;
  try { core.save('all'); } catch (e) { S.customChars.pop(); S.settings.characterId = prev; return; }
  draft = null; $('#editor').hidden = true;
  toast('New buddy saved & selected! 🎉');
});
$('#previewBtn').addEventListener('click', () => core.preview({}));

/* ---------------- settings ---------------- */
const SNOOZE_CHOICES = [1, 2, 5, 10, 15, 20, 30, 45, 60, 120];
function renderSettings() {
  const s = S.settings;
  $('#sName').value = s.name;
  $('#sSound').innerHTML = Sounds.ringtones.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
  $('#sSound').value = s.sound;
  $('#sVol').value = s.volume;
  $('#sRing').checked = s.ringUntilAnswered;
  $('#sVoice').checked = s.voice;
  $('#sEntrance').value = s.entrance;
  $('#sCeleb').value = s.celebration;
  $('#sMischief').checked = s.mischief;
  $('#sEscalate').checked = s.escalate;
  $('#sQuiet').checked = s.quiet.enabled;
  $('#sQStart').value = s.quiet.start; $('#sQEnd').value = s.quiet.end;
  $('#sSnoozeOpts').innerHTML = SNOOZE_CHOICES.map((m) => `<button data-m="${m}" class="${s.snoozeOptions.includes(m) ? 'on' : ''}">${fmtMin(m)}</button>`).join('');
  $$('#sSnoozeOpts button').forEach((b) => b.addEventListener('click', () => {
    const m = +b.dataset.m; let o = s.snoozeOptions.includes(m) ? s.snoozeOptions.filter((x) => x !== m) : [...s.snoozeOptions, m];
    if (!o.length) return toast('Keep at least one');
    if (o.length > 6) return toast('Up to 6 choices');
    o = o.sort((a, b) => a - b);
    core.setSettings({ snoozeOptions: o, defaultSnooze: o.includes(s.defaultSnooze) ? s.defaultSnooze : o[Math.floor(o.length / 2)] });
  }));
  $('#sDefSnooze').innerHTML = s.snoozeOptions.map((m) => `<option value="${m}">${fmtMin(m)}</option>`).join('');
  $('#sDefSnooze').value = s.defaultSnooze;
}
const bind = (id, ev, fn) => $('#' + id).addEventListener(ev, (e) => fn(e.target));
bind('sName', 'change', (t) => core.setSettings({ name: t.value.trim() }));
bind('sSound', 'change', (t) => { core.setSettings({ sound: t.value }); Sounds.play(t.value, S.settings.volume); });
bind('sVol', 'change', (t) => { core.setSettings({ volume: +t.value }); Sounds.play('pop', +t.value); });
$('#sSoundTest').addEventListener('click', () => Sounds.play(S.settings.sound, S.settings.volume));
bind('sRing', 'change', (t) => core.setSettings({ ringUntilAnswered: t.checked }));
bind('sVoice', 'change', (t) => {
  core.setSettings({ voice: t.checked });
  if (t.checked && globalThis.speechSynthesis) speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(`Hey ${S.settings.name || 'there'}! I can talk now.`), { pitch: 1.15 }));
});
bind('sEntrance', 'change', (t) => core.setSettings({ entrance: t.value }));
bind('sCeleb', 'change', (t) => core.setSettings({ celebration: t.value }));
bind('sMischief', 'change', (t) => core.setSettings({ mischief: t.checked }));
bind('sEscalate', 'change', (t) => core.setSettings({ escalate: t.checked }));
bind('sDefSnooze', 'change', (t) => core.setSettings({ defaultSnooze: +t.value }));
const saveQuiet = () => core.setSettings({ quiet: { enabled: $('#sQuiet').checked, start: $('#sQStart').value || '22:00', end: $('#sQEnd').value || '08:00' } });
['sQuiet', 'sQStart', 'sQEnd'].forEach((id) => bind(id, 'change', saveQuiet));
$('#sReset').addEventListener('click', (e) => {
  const b = e.target;
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to reset'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Reset stats'; }, 2500); return; }
  S.stats = { history: {}, streak: 0, best: 0, total: 0, snoozed: 0, lastDone: null };
  core.save('all');
  b.dataset.armed = ''; b.textContent = 'Reset stats'; toast('Stats reset');
});
$('#ver').textContent = `v1.0.0 · ${platform.name}`;

// notifications + launch at login
async function refreshNotif() {
  const btn = $('#sNotif'), note = $('#notifNote');
  let granted = false;
  if (platform.name === 'web') granted = 'Notification' in window && Notification.permission === 'granted';
  else if (platform.name === 'desktop') granted = true;
  else { try { granted = (await window.Capacitor.Plugins.LocalNotifications.checkPermissions()).display === 'granted'; } catch (e) { /* noop */ } }
  btn.hidden = granted;
  note.textContent = granted
    ? (platform.name === 'desktop' ? '✓ Nudge Buddy keeps running in the menu bar / tray when you close the window.' : '✓ Notifications are on — nudges arrive even when the app is closed.')
    : 'Allow notifications so nudges reach you even when the app is in the background.';
  note.classList.toggle('ok', granted);
}
async function maybeAskPermission() {
  if (platform.name === 'desktop') return;
  if (localStorage.getItem('nb-asked')) return;
  localStorage.setItem('nb-asked', '1');
  await platform.requestPermission(); refreshNotif(); core.save('reminders');
}
$('#sNotif').addEventListener('click', async () => { const ok = await platform.requestPermission(); toast(ok ? 'Notifications on 🔔' : 'Notifications are blocked — enable them in system settings'); refreshNotif(); core.save('reminders'); });
if (platform.features.autoLaunch) {
  $('#autoLaunchRow').hidden = false;
  platform.getAutoLaunch().then((on) => ($('#sAutoLaunch').checked = on));
  bind('sAutoLaunch', 'change', (t) => platform.setAutoLaunch(t.checked));
}

/* ---------------- desktop Dock buddy ---------------- */
if (platform.name === 'desktop') {
  $('#petCard').hidden = false;
  const pet = () => ({ enabled: false, wander: true, size: 'm', ...(S.settings.pet || {}) });
  const renderPet = () => { const p = pet(); $('#pEnabled').checked = p.enabled; $('#pWander').checked = p.wander; $('#pSize').value = p.size; };
  renderPet(); core.on(renderPet);
  bind('pEnabled', 'change', (t) => core.setSettings({ pet: { ...pet(), enabled: t.checked } }));
  bind('pWander', 'change', (t) => core.setSettings({ pet: { ...pet(), wander: t.checked } }));
  bind('pSize', 'change', (t) => core.setSettings({ pet: { ...pet(), size: t.value } }));
  $('.hint').textContent = 'Your buddy lives above your Dock / taskbar and runs out over any app when it’s time.';
}

/* ---------------- header actions ---------------- */
$('#pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#pauseMenu').hidden = !$('#pauseMenu').hidden; });
document.addEventListener('click', () => ($('#pauseMenu').hidden = true));
$$('#pauseMenu button').forEach((b) => b.addEventListener('click', () => {
  const m = +b.dataset.p; core.pause(m);
  toast(m ? `😴 Paused for ${fmtMin(m)}` : '▶ Nudges resumed');
}));
$('#resumeBtn').addEventListener('click', () => core.pause(0));

/* ---------------- welcome (first run) ---------------- */
function setupWelcome() {
  if (localStorage.getItem('nb-welcomed')) return;
  $('#welcome').hidden = false;
  mountInto($('#welcomeBuddy'), charSpec(S.settings.characterId), '👋');
  const done = () => { localStorage.setItem('nb-welcomed', '1'); core.setSettings({ name: $('#welcomeName').value.trim() }); $('#welcome').hidden = true; };
  $('#welcomeGo').addEventListener('click', () => { done(); toast(S.settings.name ? `Nice to meet you, ${S.settings.name}! 🎉` : 'Let’s go! 🎉'); maybeAskPermission(); });
  $('#welcomeName').addEventListener('keydown', (e) => e.key === 'Enter' && $('#welcomeGo').click());
  $('#welcomeTry').addEventListener('click', () => { if ($('#welcomeName').value.trim()) core.setSettings({ name: $('#welcomeName').value.trim() }); core.preview({}); });
}

/* ---------------- boot ---------------- */
function renderAll() { renderHeader(); renderStats(); renderList(); renderBuddies(); renderSettings(); }
core.on((what, data) => {
  if (what === 'error') return toast(data);
  if (what === 'ringing') return;
  renderAll();
  if (!$('#form').hidden) renderCharOptions($('#fChar'), $('#fChar').value);
});
core.init(platform, { scheduler: platform.name !== 'desktop' });
renderTemplates();
renderAll();
setupWelcome();
refreshNotif();
let tab = null; try { tab = localStorage.getItem('nb-tab'); } catch (e) { /* noop */ }
showTab(['nudges', 'buddies', 'settings'].includes(tab) ? tab : 'nudges');
// Unlock Web Audio on first touch (mobile autoplay rules)
addEventListener('pointerdown', () => { try { Sounds.play('tick', 0.001); } catch (e) { /* noop */ } }, { once: true });
