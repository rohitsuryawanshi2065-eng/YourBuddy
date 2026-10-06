# Nudge Buddy: Desktop app, Mobile app & Website

```
web/       shared app: UI, scheduler (core.js), Dock buddy (pet.js), characters, overlay, sounds
desktop/   Electron app for macOS / Windows: settings window + Dock buddy + tray/menu bar
mobile/    Capacitor app for iOS / Android (local notifications)
site/      landing page for Vercel (static, no build step)
.github/   GitHub Actions: builds the Mac .dmg + Windows .exe and publishes a Release
```

# 🚀 Go live: GitHub → Releases → Vercel (≈20 minutes)

## 1. Put the project on GitHub
1. Create a repo at github.com/new, e.g. `nudge-buddy`. Make it **public**, so builds on GitHub's Mac machines are free and the download links work for everyone.
2. Upload the project:
   ```bash
   cd nudge-buddy-apps
   git init && git add . && git commit -m "Nudge Buddy 1.0"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/nudge-buddy.git
   git push -u origin main
   ```

## 2. Build the Mac & Windows installers (free, automatic)
```bash
git tag v1.0.0 && git push --tags
```
GitHub → **Actions** tab → "Release desktop app" runs on a real Mac and a real Windows machine (about 10 minutes). When it finishes, **Releases** shows `Nudge-Buddy-mac.dmg` and `Nudge-Buddy-windows.exe`.
For future versions, bump `"version"` in `desktop/package.json`, then tag `v1.0.1`, and so on.

## 3. Point the website at your downloads
Edit `site/config.js`:
```js
repo: 'YOUR-USERNAME/nudge-buddy',
```
The buttons use `https://github.com/YOUR-USERNAME/nudge-buddy/releases/latest/download/…`, so they always serve the newest release.

## 4. Deploy the site on Vercel
1. vercel.com → **Add New… → Project** → import your `nudge-buddy` repo.
2. **Root Directory:** `site` · **Framework Preset:** Other · leave Build Command and Output Directory empty.
3. Click **Deploy**. You get `nudge-buddy.vercel.app`. Add your own domain under Settings → Domains.

Every `git push` redeploys the site automatically. To deploy without GitHub: `cd site && npx vercel --prod`.

## 5. Optional: remove the "unknown developer" warnings
- **Mac:** Apple Developer Program ($99/yr). Add the GitHub secrets `CSC_LINK` (base64 .p12), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`, remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the workflow, and add `"notarize": true` under `build.mac`.
- **Windows:** a code-signing certificate, set as the `CSC_LINK` / `CSC_KEY_PASSWORD` secrets.

Until then, the website explains the one-time "right-click → Open" (Mac) and "More info → Run anyway" (Windows) steps.

---

# The Dock buddy (desktop)
- A transparent, click-through, always-on-top window sized to the screen's work area, so its bottom edge is the top of the **Mac Dock** or **Windows taskbar**.
- The buddy walks, idles, looks around, hops, dances, waves when your cursor comes near, and naps (z Z) when you're away.
- **Drag** it: it dangles and protests, then falls back down with gravity. **Click** it: it hops and tells you the next nudge. **Double-click** it: opens the app. **Right-click** it: quick nudges (5/15/30/60 min), 💧 water every 45 min, try a nudge, pause, hide, quit.
- When a nudge is due, the buddy sprints out from where it's standing, over any app (including full-screen ones), and runs the full YES / snooze routine. Afterwards it walks back to the Dock.
- Only the buddy and the nudge are clickable; everything else passes clicks straight through to your apps. It never takes keyboard focus.
- Settings → **Desktop buddy**: live on Dock on/off, wander on/off, size S/M/L.

---

After changing anything in `web/`, run `npm run sync` in `desktop/` or `mobile/`.

## Desktop (Mac & Windows)
Requires Node.js 18+ (download from nodejs.org).
```bash
cd desktop
npm install
npm start            # run it
npm run dist:mac     # → dist/Nudge Buddy-1.0.0.dmg   (run on a Mac)
npm run dist:win     # → dist/Nudge Buddy Setup.exe   (run on Windows)
```
How it behaves:
- Closing the window keeps Nudge Buddy running in the tray (Windows) or menu bar (Mac).
- When a nudge is due, the window jumps to the front with the buddy animation. If you're in another app, you also get a system notification with **Yes / Later** buttons, and the Dock icon bounces (Mac) or the taskbar flashes (Windows).
- On Mac, the menu bar shows minutes until the next nudge. The tray menu has Pause and Quit.
- Settings has an option to start the app when you log in.

To distribute:
- **Mac:** without code-signing, users must right-click → Open the first time. For a smooth install, sign and notarize with an Apple Developer account ($99/year).
- **Windows:** unsigned installers show a SmartScreen warning. A code-signing certificate removes it.
- You can also publish to the Microsoft Store or Mac App Store later.

## Mobile (iOS & Android)
```bash
cd mobile
npm install
npm run android      # opens Android Studio → ▶ Run on your phone/emulator
npm run ios          # (Mac only) first: npx cap add ios  → opens Xcode → ▶ Run
```
- The `android/` project is already generated, with icons and splash screens.
- For iOS, run `npx cap add ios` once on your Mac, then `npm run icons` to generate iOS icons.
- **Android APK:** in Android Studio, go to Build → Build App Bundle(s)/APK(s).
- **iPhone:** in Xcode, select your Apple ID under Signing & Capabilities. A free Apple ID can install on your own phone for 7 days at a time.

How mobile works:
- Nudges are scheduled as **local notifications** with ✅ Yes / ⏰ Later actions. They arrive even when the app is closed, and are pre-scheduled up to 3 days ahead (iOS allows at most 64 pending).
- Tapping a notification opens the app, where the buddy runs in and does the full YES / snooze animation.
- If the app is open when a nudge is due, the buddy appears straight away.
- Android 12+ asks the user to allow "Alarms & reminders" so timing is exact.

Store publishing:
- **Google Play:** $25 one-time developer fee. Upload the `.aab` from Android Studio.
- **Apple App Store:** $99/year. Archive in Xcode → upload through App Store Connect.

## Differences from the Chrome extension
| Feature | Extension | Desktop | Mobile |
|---|---|---|---|
| Buddy appears on top of… | any web page | the app window, brought to front | the app, opened from a notification |
| Works when closed | yes, while Chrome runs | yes (tray) | yes (notifications) |
| Custom image buddies, sounds, celebrations, snooze, streaks | ✓ | ✓ | ✓ |
| Tab-chasing, right-click "remind me about this page" | ✓ | n/a | n/a |

Data stays on the device (`localStorage`). There are no accounts and no servers.
