// Nudge Buddy — desktop app (Electron). A normal window that lives on in the tray/menu bar,
// pops to the front with the animated buddy when a nudge is due.
const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, shell, screen, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');

// Serve the UI from app://bundle/ instead of file:// so fetch()/WebAssembly (face model) work.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const WWW = path.join(__dirname, 'www');
const MIME = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.tflite': 'application/octet-stream', '.binarypb': 'application/octet-stream', '.data': 'application/octet-stream' };
function registerAppProtocol() {
  // Read with fs (asar-aware) so it works inside the packaged app too, not only in development.
  protocol.handle('app', async (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(WWW, rel));
    if (!file.startsWith(WWW)) return new Response('forbidden', { status: 403 });
    try {
      const buf = await fs.promises.readFile(file);
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      return new Response(buf, { status: 200, headers: { 'content-type': type } });
    } catch (e) {
      return new Response('not found', { status: 404 });
    }
  });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.platform === 'win32') app.setAppUserModelId('com.tartanhq.nudgebuddy');
if (!app.requestSingleInstanceLock()) app.quit();

let win = null, pet = null, tray = null, quitting = false, lastStatus = null;
const isMac = process.platform === 'darwin';
const asset = (f) => path.join(__dirname, 'build', f);

function bigWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.min(1180, Math.round(wa.width * 0.85)), height = Math.min(860, Math.round(wa.height * 0.9));
  return { width, height, x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round((wa.height - height) / 2) };
}
function createWindow() {
  win = new BrowserWindow({
    ...bigWindow(), minWidth: 420, minHeight: 600,
    title: 'Nudge Buddy', backgroundColor: '#fbf8ff', show: false,
    icon: asset('icon.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false, // keep the 1s scheduler running while hidden
    },
  });
  win.loadURL('app://bundle/index.html');
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  // Closing the window keeps the app alive in the tray so nudges still fire.
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    if (!app.__toldTray && tray) {
      app.__toldTray = true;
      new Notification({ title: 'Nudge Buddy is still running', body: 'I’ll pop up when it’s time. Quit from the tray / menu-bar icon.' }).show();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

/* ---------------- Dock buddy: transparent, click-through, always-on-top ----------------
 * Covers the display's work area, so its bottom edge is the top of the Dock (macOS)
 * or the taskbar (Windows). The buddy walks along that edge and runs out over any app. */
function petBounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x, y: wa.y, width: wa.width, height: wa.height };
}
function createPet() {
  pet = new BrowserWindow({
    ...petBounds(),
    transparent: true, frame: false, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, hasShadow: false, skipTaskbar: true, focusable: false, show: false,
    backgroundColor: '#00000000', roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false,
    },
  });
  pet.setAlwaysOnTop(true, 'screen-saver');
  pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pet.setIgnoreMouseEvents(true, { forward: true });
  pet.loadURL('app://bundle/pet.html');
  pet.once('ready-to-show', () => pet.showInactive());
  pet.on('closed', () => { pet = null; });
  const fit = () => pet && pet.setBounds(petBounds());
  screen.on('display-metrics-changed', fit);
  screen.on('display-added', fit);
  screen.on('display-removed', fit);
}
const toPet = (...a) => pet && pet.webContents.send(...a);

function showWin() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function buildTrayMenu() {
  const next = lastStatus ? `Next: ${lastStatus.title} at ${new Date(lastStatus.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'No upcoming nudges';
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: next, enabled: false },
    { type: 'separator' },
    { label: 'Open Nudge Buddy', click: showWin },
    { label: 'Try a nudge now 👀', click: () => toPet('nb:tray', 'try') },
    { label: 'Pause for 30 minutes', click: () => toPet('nb:tray', 'pause', 30) },
    { label: 'Pause for 1 hour', click: () => toPet('nb:tray', 'pause', 60) },
    { label: 'Resume', click: () => toPet('nb:tray', 'pause', 0) },
    { label: 'Hide buddy for 1 hour', click: () => toPet('nb:tray', 'hide', 60) },
    { label: 'Show buddy', click: () => toPet('nb:tray', 'show') },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.setToolTip(`Nudge Buddy — ${next}`);
}

app.whenReady().then(() => {
  registerAppProtocol();
  createPet();
  createWindow();
  const img = nativeImage.createFromPath(asset('tray.png')).resize({ width: 18, height: 18 });
  tray = new Tray(img);
  tray.on('click', showWin);
  buildTrayMenu();
  setInterval(() => {
    if (!lastStatus || !tray) return;
    const m = Math.max(0, Math.ceil((lastStatus.at - Date.now()) / 60000));
    if (isMac) tray.setTitle(m < 60 ? ` ${m}m` : '');
  }, 15000);
});

app.on('second-instance', showWin);
app.on('activate', showWin);
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* stay alive in tray */ });

/* ---------------- IPC from the renderer ---------------- */
ipcMain.handle('nb:attention', (_e, p) => {
  const wasFocused = win && win.isFocused() && win.isVisible();
  showWin();
  // Jump above other apps for a moment so the buddy is actually seen.
  win.setAlwaysOnTop(true, 'floating');
  setTimeout(() => win && win.setAlwaysOnTop(false), 2500);
  if (!wasFocused && !p.preview) {
    const n = new Notification({ title: p.title, body: p.body, silent: true, actions: [{ type: 'button', text: p.yes || 'Yes' }, { type: 'button', text: 'Later' }] });
    n.on('click', showWin);
    n.on('action', (_ev, idx) => win.webContents.send('nb:tray', 'action', { reminderId: p.reminderId, action: idx === 0 ? 'yes' : 'later' }));
    n.show();
    if (isMac) app.dock.bounce('critical'); else win.flashFrame(true);
  }
});
// main window → Dock buddy (previews / "try it now")
ipcMain.handle('nb:present', (_e, p) => toPet('nb:present', p));
ipcMain.handle('nb:pet-ignore', (_e, ignore) => pet && pet.setIgnoreMouseEvents(!!ignore, { forward: true }));
ipcMain.handle('nb:open-main', () => showWin());
ipcMain.handle('nb:pet-attention', (_e, p) => { if (isMac && !p.preview && !BrowserWindow.getFocusedWindow()) app.dock.bounce('informational'); });
ipcMain.handle('nb:pet-menu', (_e, info) => {
  Menu.buildFromTemplate([
    { label: info.next, enabled: false },
    { type: 'separator' },
    { label: 'Open Nudge Buddy', click: showWin },
    { label: 'Quick nudge', submenu: [5, 15, 30, 60].map((m) => ({ label: m < 60 ? `in ${m} minutes` : 'in 1 hour', click: () => toPet('nb:tray', 'quick', m) })) },
    { label: '💧 Remind me to drink water', click: () => toPet('nb:tray', 'water') },
    { label: 'Try a nudge now 👀', click: () => toPet('nb:tray', 'try') },
    { type: 'separator' },
    info.paused ? { label: '▶ Resume nudges', click: () => toPet('nb:tray', 'pause', 0) } : { label: 'Pause nudges for 1 hour', click: () => toPet('nb:tray', 'pause', 60) },
    { label: 'Hide buddy for 1 hour', click: () => toPet('nb:tray', 'hide', 60) },
    { type: 'separator' },
    { label: 'Quit Nudge Buddy', click: () => { quitting = true; app.quit(); } },
  ]).popup({ window: pet });
});
ipcMain.handle('nb:status', (_e, s) => {
  lastStatus = s;
  if (tray) buildTrayMenu();
  if (isMac && app.dock) {
    const m = s ? Math.max(0, Math.ceil((s.at - Date.now()) / 60000)) : null;
    app.dock.setBadge(m != null && m < 60 ? `${m}m` : '');
    if (tray) tray.setTitle(m != null && m < 60 ? ` ${m}m` : '');
  }
});
ipcMain.handle('nb:openExternal', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('nb:getAutoLaunch', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('nb:setAutoLaunch', (_e, on) => app.setLoginItemSettings({ openAtLogin: !!on, args: ['--hidden'] }));
