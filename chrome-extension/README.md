# Nudge Buddy — Playful Reminders & Alarms (Chrome extension, MV3)

Reminders that a cartoon buddy delivers in person. When the timer ends, your buddy runs, drops or peeks onto whatever page you're on and asks the question. Then:

- **YES** → a random celebration plays (Zoomies, Rocket launch, Clone party or Disco) with confetti, a sound effect and your streak.
- **Remind me later** → you pick a snooze length, a big **3‑2‑1** countdown runs while the buddy moonwalks backwards and vanishes in a puff of smoke, and it comes back when the snooze ends.

## Install (developer mode)
1. Unzip `nudge-buddy.zip`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `nudge-buddy` folder.
4. A welcome tab opens. Enter your name and press **Show me what you do** to see a demo.

Shortcut: **Alt+Shift+N** opens the popup.

## Features
| Area | What it does |
|---|---|
| Reminder types | **Once in…** (timer), **Repeat every…** (interval), **⏰ Alarm at** a set time on chosen weekdays |
| Quick starts | Hydrate, Stretch, 20‑20‑20 eye break, Posture, Walk, Pomodoro, Meds, Meeting |
| Buddies | 6 built‑in characters (Arjun, Blobby, Bolt, Mochi, Rex, Boo), each with running, blinking, waving and dancing animations |
| Your own buddy | Upload a selfie, your pet or a transparent PNG. Choose **Head on body**, **Sticker** or **Cutout**, plus outfit colour, zoom and position. You can set a different buddy for each reminder |
| Alarm sounds | 6 synthesised ringtones, volume control, "keep ringing until I answer" (stops after 90 s) |
| Talking buddy | Optional text‑to‑speech: "Hey Aakash! Did you drink water?" |
| Personality | Pick the entrance and celebration style. **Mischief mode** makes "Remind me later" dodge the cursor twice. If you ignore the buddy it gets impatient: it taps its foot at 20 s and shouts your name at 45 s. Poking the buddy gets a reaction |
| Chases you | If you switch tabs while a reminder is ringing, the buddy follows you ("You can't escape me 😏") |
| Away from Chrome | Opens a mini buddy window, a system notification (with Yes/Snooze buttons), both, or waits until you come back |
| Smart holds | Quiet hours, **Pause** for 30 min/1 h/3 h/today, and holding reminders while the screen is locked ("Welcome back! 👋" when you return) |
| Read‑later | Right‑click any page or link → **Nudge me about this** → in 15 min, 1 h, 3 h or tomorrow at 9:00. Pressing YES opens the page |
| Motivation | Day streak, done today, and a 7‑day bar chart in the popup. The toolbar badge shows how long until the next nudge |
| Keyboard | `Y` = yes, `L` = later, `Esc` = default snooze |
| Accessibility | Respects `prefers-reduced-motion` (simple fade, no big movement). Buttons are focusable and labelled |

## Architecture
```
background.js   MV3 service worker (ES module): chrome.alarms scheduling, delivery,
                tab-chasing, queue, quiet hours/pause/idle, stats, context menu, badge
shared.js       defaults, templates, scheduling maths (module)
characters.js   SVG character library + canvas renderer for uploaded images
overlay.js      on-page experience in a closed Shadow DOM (entrances, ask,
                celebrations, snooze countdown, confetti)
sounds.js       Web Audio synthesised ringtones/SFX (no audio files)
offscreen.*     offscreen document that plays audio for the service worker
reminder.*      mini-window fallback (chrome:// pages, Web Store, Chrome in background)
popup.*         popup UI; ?full=1 is the full-page options/onboarding view
```
Design notes:
- **Injected only when needed.** No content script runs on every page. When a reminder fires, `chrome.scripting` injects the overlay into the active tab only, so pages load at normal speed.
- **Isolated from the page's styles.** Everything is drawn inside a closed shadow root at the maximum z-index with `pointer-events` passthrough, so the page stays usable underneath.
- **Uploaded images can't be blocked by a site's CSP.** They're decoded from base64 into an `ImageBitmap` and drawn on a `<canvas>`. No `img src` request is ever made.
- **Survives service-worker restarts.** All state lives in `chrome.storage` (local and session), and storage changes are serialised through a lock so they can't conflict.

## Publishing to the Chrome Web Store
1. Upload `nudge-buddy.zip` at https://chrome.google.com/webstore/devconsole (one-time $5 developer fee).
2. **Store assets you still need:** at least one 1280×800 screenshot (the overlay on a real page shows the product best), a 440×280 small promo tile, and optionally a 1400×560 marquee. The 128×128 icon is included.
3. **Single purpose:** "Shows user-scheduled reminders and alarms as an animated character on the current web page."
4. **Permission justifications** (paste into the Privacy tab):
   - `alarms`: schedule the reminders the user creates.
   - `storage` / `unlimitedStorage`: save reminders, settings, stats and user-uploaded buddy images on the device.
   - `scripting` + host permission `<all_urls>`: draw the reminder character on whichever page the user has open when a reminder fires. Code is injected only at that moment and only into the active tab. The extension does not read page content.
   - `offscreen`: play alarm sounds, since the service worker can't play audio.
   - `notifications`: optional system notification when Chrome isn't in front.
   - `tts`: optional "talking buddy" that reads the reminder aloud.
   - `idle`: hold reminders while the screen is locked.
   - `contextMenus`: the "Nudge me about this page" right-click menu.
5. **Data usage:** collects no user data. Paste the policy from `PRIVACY.md` into the listing or host it on a URL.
6. Expect a longer review because of the `<all_urls>` host permission. The justification above is what reviewers look for.

## Store listing copy (suggested)
**Short description:** Reminders delivered by an animated buddy that runs across your screen. Hydrate, stretch, focus, the fun way.

**Description:**
Standard notifications are easy to ignore. Nudge Buddy isn't.
When it's time to drink water, stretch or take a break, your buddy runs onto the page you're on and asks. Press YES and it celebrates with zoomies, a rocket launch, a clone army or a disco party. Press "Remind me later" and it counts down, moonwalks away and comes back right on time.
• Timers, repeating reminders and real alarms on chosen days
• 6 animated buddies, or upload your own photo or pet
• Fun alarm sounds and an optional talking buddy
• Follows you across tabs, gets impatient if ignored
• Streaks, daily stats, quiet hours, pause, and "remind me about this page"
• Private: everything stays on your device
