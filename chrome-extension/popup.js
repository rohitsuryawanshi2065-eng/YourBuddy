import { DEFAULT_SETTINGS, TEMPLATES, EMOJIS, dayKey, fmtMin, fmtDays, streakInfo } from './shared.js';

const Chars = globalThis.NudgeChars;
const Sounds = globalThis.NudgeSounds;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const FULL = params.has('full');
if (FULL) document.body.classList.add('full');

// character CSS for previews
const st = document.createElement('style'); st.textContent = Chars.css; document.head.appendChild(st);

let S = { settings: { ...DEFAULT_SETTINGS }, reminders: [], customChars: [], stats: { history: {} } };
const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r); }));

function toast(text) {
  const t = $('#toast'); t.textContent = text; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}
async function loadAll() {
  const d = await chrome.storage.local.get(['settings', 'reminders', 'customChars', 'stats']);
  S.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}), quiet: { ...DEFAULT_SETTINGS.quiet, ...((d.settings || {}).quiet || {}) } };
  S.reminders = d.reminders || [];
  S.customChars = d.customChars || [];
  S.stats = d.stats || { history: {} };
}
async function saveSettings(patch) {
  S.settings = { ...S.settings, ...patch };
  await chrome.storage.local.set({ settings: S.settings });
}
function charSpec(id) {
  if (id && id.startsWith('custom:')) {
    const c = S.customChars.find((x) => x.id === id.slice(7));
    if (c) return { kind: 'custom', dataUrl: c.dataUrl, mode: c.mode, color: c.color, crop: c.crop };
  }
  return { kind: 'preset', id: id && !id.startsWith('custom:') ? id : 'arjun' };
}
function mountInto(box, spec, emoji, idle = true) {
  box.textContent = '';
  const el = Chars.mount(box, spec, emoji);
  if (idle) el.classList.add('nb-idle');
  return el;
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
  const ringing = S.reminders.find((r) => r.ringingSince);
  if (ringing) { $('#nextLine').textContent = `🔔 ${ringing.title} is ringing!`; return; }
  const next = S.reminders.filter((r) => r.enabled && r.nextAt).sort((a, b) => a.nextAt - b.nextAt)[0];
  $('#nextLine').textContent = next ? `Next: ${next.emoji} ${next.title} in ${countdown(next.nextAt)}` : (S.reminders.length ? 'All nudges paused' : 'No nudges yet');
}
function renderStats() {
  const { streak, today } = streakInfo(S.stats);
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
  if (src.id) F.id = src.id;
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
  $('#fTitle').focus();
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
  $('#fDays').innerHTML = 'SMTWTFS'.split('').map((d, i) => `<button type="button" data-d="${i}" class="${F.days.includes(i) ? 'on' : ''}" title="${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}">${d}</button>`).join('');
  $$('#fDays button').forEach((b) => b.addEventListener('click', () => {
    const d = +b.dataset.d; F.days = F.days.includes(d) ? F.days.filter((x) => x !== d) : [...F.days, d]; renderFormBits();
  }));
}
$$('#fType button').forEach((b) => b.addEventListener('click', () => { F.type = b.dataset.v; renderFormBits(); }));
$('#fMin').addEventListener('input', renderFormBits);
$('#newBtn').addEventListener('click', () => openForm({ emoji: '⏰', type: 'timer', minutes: 15 }));
$('#fCancel').addEventListener('click', closeForm);
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('#fTitle').value.trim() || 'Reminder';
  const minutes = Math.max(1, Math.min(1440, Math.round(Number($('#fMin').value) || 15)));
  const r = {
    id: F.id || undefined, emoji: F.emoji, title,
    message: $('#fMsg').value.trim() || title,
    yesLabel: $('#fYes').value.trim() || 'YES',
    celebrate: F.celebrate || 'Legend! 🎉',
    type: F.type, minutes, time: $('#fTime').value || '09:00', days: [...F.days].sort(),
    characterId: $('#fChar').value,
  };
  const saved = await send({ type: 'nb:upsert', reminder: r });
  closeForm();
  toast(saved && saved.nextAt ? `⏰ ${saved.emoji} ${saved.title} — in ${countdown(saved.nextAt)}` : 'Saved!');
});

function countdown(at) {
  const s = Math.max(0, Math.round((at - Date.now()) / 1000));
  if (s >= 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function describe(r) {
  if (r.type === 'clock') return `Alarm ${r.time} · ${fmtDays(r.days)}`;
  if (r.type === 'interval') return `Every ${fmtMin(r.minutes)}`;
  return r.doneAt && !r.enabled ? 'Done ✓ · switch on to run again' : `Once · ${fmtMin(r.minutes)}`;
}
function statusHTML(r) {
  if (r.ringingSince) return ' · <span class="cd">ringing 🔔</span>';
  if (!r.enabled || !r.nextAt) return '';
  return ` · ${r.snoozed ? 'snoozed ' : ''}<span class="cd" data-at="${r.nextAt}">${countdown(r.nextAt)}</span>`;
}
function renderList() {
  const list = [...S.reminders].sort((a, b) => (b.enabled - a.enabled) || ((a.nextAt || 9e15) - (b.nextAt || 9e15)));
  $('#empty').hidden = list.length > 0;
  if (!list.length) mountInto($('#emptyBuddy'), charSpec(S.settings.characterId), '💤');
  $('#list').innerHTML = list.map((r) => `
    <div class="item${r.enabled ? '' : ' off'}${r.ringingSince ? ' ringing' : ''}" data-id="${r.id}">
      <div class="e">${Chars.esc(r.emoji || '⏰')}</div>
      <div class="meta"><div class="t">${Chars.esc(r.title)}</div><div class="s">${Chars.esc(describe(r))}${statusHTML(r)}</div></div>
      <div class="acts">
        <button data-a="test" title="Try it now">▶</button>
        <button data-a="edit" title="Edit">✎</button>
        <button data-a="del" title="Delete">🗑</button>
      </div>
      <label class="sw" title="${r.enabled ? 'On' : 'Off'}"><input type="checkbox" ${r.enabled ? 'checked' : ''}><i></i></label>
    </div>`).join('');
  $$('#list .item').forEach((row) => {
    const id = row.dataset.id;
    const r = S.reminders.find((x) => x.id === id);
    row.querySelector('input').addEventListener('change', (e) => send({ type: 'nb:toggle', id, enabled: e.target.checked }));
    row.querySelector('[data-a=test]').addEventListener('click', () => preview({ reminderId: id }));
    row.querySelector('[data-a=edit]').addEventListener('click', () => { showTab('nudges'); openForm({ ...r }); });
    const del = row.querySelector('[data-a=del]');
    del.addEventListener('click', () => {
      if (del.dataset.armed) { send({ type: 'nb:delete', id }); return; }
      del.dataset.armed = '1'; del.textContent = '✓'; del.title = 'Click again to delete';
      setTimeout(() => { del.dataset.armed = ''; del.textContent = '🗑'; }, 2500);
    });
  });
}
setInterval(() => {
  $$('.cd[data-at]').forEach((el) => (el.textContent = countdown(+el.dataset.at)));
  renderNextLine();
}, 1000);

/* ---------------- preview ---------------- */
function localPayload(reminder, characterId) {
  const s = S.settings;
  const r = reminder || { emoji: '💧', message: 'Did you drink water?', yesLabel: 'YES', celebrate: 'Hydration hero! 💧' };
  const cid = characterId || (r.characterId && r.characterId !== 'default' ? r.characterId : s.characterId);
  return {
    reminderId: '__preview', preview: true, emoji: r.emoji, name: s.name,
    headline: s.name ? `Hey, ${s.name}!` : 'Hey there!', message: r.message, yesLabel: r.yesLabel, celebrate: r.celebrate,
    character: charSpec(cid),
    settings: { mischief: s.mischief, escalate: false, snoozeOptions: s.snoozeOptions, defaultSnooze: s.defaultSnooze, entrance: s.entrance, celebration: s.celebration },
  };
}
async function preview({ reminderId, characterId } = {}) {
  if (FULL) {
    const r = reminderId && S.reminders.find((x) => x.id === reminderId);
    if (S.settings.sound !== 'none') Sounds.play(S.settings.sound, S.settings.volume);
    globalThis.NudgeOverlay.show(localPayload(r, characterId));
    return;
  }
  await send(reminderId ? { type: 'nb:test', id: reminderId } : { type: 'nb:preview', characterId });
  window.close();
}

/* ---------------- buddies ---------------- */
function renderBuddies() {
  const cur = S.settings.characterId;
  $('#presetGrid').innerHTML = Chars.presets.map((p) =>
    `<button class="buddy${cur === p.id ? ' on' : ''}" data-id="${p.id}"><div class="stagebox"></div><div class="n">${Chars.esc(p.name)}</div><div class="tg">${Chars.esc(p.tagline)}</div></button>`).join('');
  $$('#presetGrid .buddy').forEach((b) => mountInto(b.querySelector('.stagebox'), { kind: 'preset', id: b.dataset.id }, ''));

  $('#customGrid').innerHTML = S.customChars.map((c) =>
    `<div class="buddy${cur === 'custom:' + c.id ? ' on' : ''}" data-id="custom:${c.id}" role="button" tabindex="0"><button class="del" title="Delete">✕</button><div class="stagebox"></div><div class="n">${Chars.esc(c.name)}</div><div class="tg">${Chars.esc((Chars.customModes.find((m) => m.id === c.mode) || {}).name || '')}</div></div>`).join('') +
    `<button class="buddy add" id="addBuddy"><span class="plus">＋</span><span class="n">Upload image</span><span class="tg">or drop it here</span></button>`;
  $$('#customGrid .buddy[data-id]').forEach((b) => {
    mountInto(b.querySelector('.stagebox'), charSpec(b.dataset.id), '');
    b.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = b.dataset.id.slice(7);
      S.customChars = S.customChars.filter((c) => c.id !== id);
      await chrome.storage.local.set({ customChars: S.customChars });
      if (S.settings.characterId === b.dataset.id) await saveSettings({ characterId: 'arjun' });
      toast('Buddy removed');
    });
  });
  $$('.buddy[data-id]').forEach((b) => b.addEventListener('click', async () => {
    await saveSettings({ characterId: b.dataset.id });
    toast('Buddy selected! 🎉');
  }));
  const add = $('#addBuddy');
  add.addEventListener('click', () => {
    if (FULL) $('#file').click();
    else chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?full=1&tab=buddies&upload=1') });
  });
  add.addEventListener('dragover', (e) => { e.preventDefault(); add.classList.add('drag'); });
  add.addEventListener('dragleave', () => add.classList.remove('drag'));
  add.addEventListener('drop', (e) => { e.preventDefault(); add.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
  if (params.has('upload')) { add.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 700, iterations: 3 }); }
}

const COLORS = ['#4a7cc4', '#e8505b', '#22a06b', '#f59e0b', '#7c4dff', '#2b2140', '#ec4899', '#0ea5e9'];
let draft = null;
$('#file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = ''; });
document.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
  if (f && !$('#tab-buddies').hidden) handleFile(f);
});
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
  const transparent = corners.some((a) => a < 200);
  const dataUrl = file.type === 'image/jpeg' ? cv.toDataURL('image/jpeg', 0.9) : cv.toDataURL('image/png');
  draft = { id: Math.random().toString(36).slice(2, 10), name: (file.name || 'My buddy').replace(/\.[^.]+$/, '').slice(0, 20), dataUrl, mode: transparent ? 'cutout' : 'body', color: COLORS[0], crop: { zoom: 1, x: 0, y: 0 } };
  openEditor();
}
function openEditor() {
  $('#editor').hidden = false;
  $('#eName').value = draft.name;
  $('#eZoom').value = draft.crop.zoom; $('#eX').value = draft.crop.x; $('#eY').value = draft.crop.y;
  $('#eMode').innerHTML = Chars.customModes.map((m) => `<button data-v="${m.id}" class="${m.id === draft.mode ? 'on' : ''}">${m.name.replace(' (transparent PNG)', '')}</button>`).join('');
  $$('#eMode button').forEach((b) => b.addEventListener('click', () => { draft.mode = b.dataset.v; openEditor(); }));
  $('#eColor').innerHTML = COLORS.map((c) => `<button data-c="${c}" class="${c === draft.color ? 'on' : ''}" style="background:${c}"></button>`).join('');
  $$('#eColor button').forEach((b) => b.addEventListener('click', () => { draft.color = b.dataset.c; openEditor(); }));
  drawEditor();
  $('#editor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function drawEditor() { mountInto($('#editorStage'), { kind: 'custom', ...draft }, '💧'); }
['eZoom', 'eX', 'eY'].forEach((id) => $('#' + id).addEventListener('input', () => {
  draft.crop = { zoom: +$('#eZoom').value, x: +$('#eX').value, y: +$('#eY').value };
  clearTimeout(drawEditor.t); drawEditor.t = setTimeout(drawEditor, 30);
}));
$('#eCancel').addEventListener('click', () => { draft = null; $('#editor').hidden = true; });
$('#eSave').addEventListener('click', async () => {
  draft.name = $('#eName').value.trim() || 'My buddy';
  S.customChars.push(draft);
  try {
    await chrome.storage.local.set({ customChars: S.customChars });
  } catch (e) { S.customChars.pop(); return toast('Storage full — delete a buddy first'); }
  await saveSettings({ characterId: 'custom:' + draft.id });
  draft = null; $('#editor').hidden = true;
  toast('New buddy saved & selected! 🎉');
});
$('#previewBtn').addEventListener('click', () => preview({}));

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
  $('#sChase').checked = s.chase;
  $('#sAway').value = s.away;
  $('#sLocked').checked = s.skipWhenLocked;
  $('#sQuiet').checked = s.quiet.enabled;
  $('#sQStart').value = s.quiet.start; $('#sQEnd').value = s.quiet.end;
  $('#sSnoozeOpts').innerHTML = SNOOZE_CHOICES.map((m) => `<button data-m="${m}" class="${s.snoozeOptions.includes(m) ? 'on' : ''}">${fmtMin(m)}</button>`).join('');
  $$('#sSnoozeOpts button').forEach((b) => b.addEventListener('click', () => {
    const m = +b.dataset.m; let o = s.snoozeOptions.includes(m) ? s.snoozeOptions.filter((x) => x !== m) : [...s.snoozeOptions, m];
    if (!o.length) return toast('Keep at least one');
    if (o.length > 6) return toast('Up to 6 choices');
    o = o.sort((a, b) => a - b);
    saveSettings({ snoozeOptions: o, defaultSnooze: o.includes(s.defaultSnooze) ? s.defaultSnooze : o[Math.floor(o.length / 2)] });
  }));
  $('#sDefSnooze').innerHTML = s.snoozeOptions.map((m) => `<option value="${m}">${fmtMin(m)}</option>`).join('');
  $('#sDefSnooze').value = s.defaultSnooze;
}
const bind = (id, ev, fn) => $('#' + id).addEventListener(ev, (e) => fn(e.target));
bind('sName', 'change', (t) => saveSettings({ name: t.value.trim() }));
bind('sSound', 'change', (t) => { saveSettings({ sound: t.value }); Sounds.play(t.value, S.settings.volume); });
bind('sVol', 'change', (t) => { saveSettings({ volume: +t.value }); Sounds.play('pop', +t.value); });
$('#sSoundTest').addEventListener('click', () => Sounds.play(S.settings.sound, S.settings.volume));
bind('sRing', 'change', (t) => saveSettings({ ringUntilAnswered: t.checked }));
bind('sVoice', 'change', (t) => { saveSettings({ voice: t.checked }); if (t.checked && chrome.tts) chrome.tts.speak(`Hey ${S.settings.name || 'there'}! I can talk now.`, { pitch: 1.15 }); });
bind('sEntrance', 'change', (t) => saveSettings({ entrance: t.value }));
bind('sCeleb', 'change', (t) => saveSettings({ celebration: t.value }));
bind('sMischief', 'change', (t) => saveSettings({ mischief: t.checked }));
bind('sEscalate', 'change', (t) => saveSettings({ escalate: t.checked }));
bind('sChase', 'change', (t) => saveSettings({ chase: t.checked }));
bind('sAway', 'change', (t) => saveSettings({ away: t.value }));
bind('sLocked', 'change', (t) => saveSettings({ skipWhenLocked: t.checked }));
bind('sDefSnooze', 'change', (t) => saveSettings({ defaultSnooze: +t.value }));
const saveQuiet = () => saveSettings({ quiet: { enabled: $('#sQuiet').checked, start: $('#sQStart').value || '22:00', end: $('#sQEnd').value || '08:00' } });
['sQuiet', 'sQStart', 'sQEnd'].forEach((id) => bind(id, 'change', saveQuiet));
$('#sReset').addEventListener('click', async (e) => {
  const b = e.target;
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to reset'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Reset stats'; }, 2500); return; }
  await chrome.storage.local.set({ stats: { history: {}, streak: 0, best: 0, total: 0, snoozed: 0, lastDone: null } });
  b.dataset.armed = ''; b.textContent = 'Reset stats'; toast('Stats reset');
});
$('#ver').textContent = 'v' + chrome.runtime.getManifest().version;

/* ---------------- header actions ---------------- */
$('#pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#pauseMenu').hidden = !$('#pauseMenu').hidden; });
document.addEventListener('click', () => ($('#pauseMenu').hidden = true));
$$('#pauseMenu button').forEach((b) => b.addEventListener('click', async () => {
  const m = +b.dataset.p;
  await send({ type: 'nb:pause', minutes: m });
  toast(m ? `😴 Paused for ${fmtMin(m)}` : '▶ Nudges resumed');
}));
$('#resumeBtn').addEventListener('click', () => send({ type: 'nb:pause', minutes: 0 }));
$('#expandBtn').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?full=1') }));

/* ---------------- welcome ---------------- */
function setupWelcome() {
  if (!params.has('welcome')) return;
  $('#welcome').hidden = false;
  const el = mountInto($('#welcomeBuddy'), charSpec(S.settings.characterId), '👋');
  el.classList.add('nb-idle');
  $('#welcomeName').value = S.settings.name;
  const go = async () => {
    await saveSettings({ name: $('#welcomeName').value.trim() });
    $('#welcome').hidden = true;
    toast(S.settings.name ? `Nice to meet you, ${S.settings.name}! 🎉` : 'Let’s go! 🎉');
  };
  $('#welcomeGo').addEventListener('click', go);
  $('#welcomeName').addEventListener('keydown', (e) => e.key === 'Enter' && go());
  $('#welcomeTry').addEventListener('click', async () => {
    if ($('#welcomeName').value.trim()) await saveSettings({ name: $('#welcomeName').value.trim() });
    preview({});
  });
}

/* ---------------- boot ---------------- */
function renderAll() { renderHeader(); renderStats(); renderList(); renderBuddies(); renderSettings(); }
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  await loadAll();
  if (changes.reminders) { renderList(); renderNextLine(); }
  if (changes.stats) renderStats();
  if (changes.settings || changes.customChars) { renderHeader(); renderBuddies(); renderSettings(); if (!$('#form').hidden) renderCharOptions($('#fChar'), $('#fChar').value); if (!S.reminders.length) renderList(); }
});
(async () => {
  await loadAll();
  renderTemplates();
  renderAll();
  setupWelcome();
  let tab = params.get('tab');
  if (!tab) { try { tab = localStorage.getItem('nb-tab'); } catch (e) { /* noop */ } }
  showTab(['nudges', 'buddies', 'settings'].includes(tab) ? tab : 'nudges');
  send({ type: 'nb:badge' });
})();
