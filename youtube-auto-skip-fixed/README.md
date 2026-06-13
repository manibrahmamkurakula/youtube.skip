# YouTube Auto Skip

A lightweight Chrome Extension (Manifest V3) that automatically skips skippable YouTube ads the moment the "Skip Ad" button becomes available.

---

## Features

- **Zero-lag skipping** — clicks the skip button within ~80 ms of it appearing
- **MutationObserver-based** — no polling loops; near-zero CPU impact when idle
- **Resilient selector matching** — tries CSS selectors first, falls back to button text (in multiple languages), so it survives YouTube UI changes
- **SPA-aware** — handles YouTube's `yt-navigate-finish` event so it keeps working as you browse between videos
- **Popup UI** — enable/disable toggle + live counter + reset button
- **Badge counter** — always-visible ad count on the extension icon
- **Persistent state** — settings and counter survive browser restarts via `chrome.storage.local`

---

## Architecture

```
youtube-auto-skip/
├── manifest.json      Manifest V3 config — permissions, content script, popup
├── content.js         Injected into YouTube pages; detects & skips ads
├── background.js      Service worker; manages storage, badge, and message routing
├── popup.html         Extension popup markup
├── popup.js           Popup logic (reads/writes state via background messages)
├── popup.css          Dark-themed popup styles
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### How it works

1. **`content.js`** is injected into every `youtube.com` page.
2. A `MutationObserver` watches the `#movie_player` DOM subtree for class or child changes.
3. When a mutation fires, the script checks whether an ad is playing (`.ad-showing` class on the player).
4. If an ad is detected, it searches for the skip button by a prioritised list of CSS selectors; if none match, it falls back to scanning button text content (multi-language).
5. On a successful click, a `AD_SKIPPED` message is sent to `background.js`.
6. The background service worker increments the persistent counter and updates the icon badge.
7. YouTube SPA navigation is handled by listening to the `yt-navigate-finish` event and restarting the observer on the fresh player element.

### Message flow

```
content.js  ──AD_SKIPPED──►  background.js  (increments storage, updates badge)
popup.js    ──GET_STATS───►  background.js  (returns isEnabled + adsSkipped)
popup.js    ──SET_ENABLED─►  background.js  ──SET_ENABLED──► content.js (all YT tabs)
popup.js    ──RESET_COUNTER► background.js  ──RESET_COUNTER► content.js (all YT tabs)
```

---

## Installation (Developer Mode)

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `youtube-auto-skip` folder.
6. The extension icon appears in your toolbar. Pin it for easy access.
7. Open YouTube — the extension is active immediately.

---

## Packaging for the Chrome Web Store

1. Remove any development files (`.git`, `*.md` if preferred, test files).
2. In `chrome://extensions`, click **Pack extension** and select the folder — Chrome produces a `.crx` and a `.pem` key file. **Keep the `.pem` safe** — you need it for future updates.
3. Alternatively, create a ZIP of the folder contents (not the folder itself):
   ```bash
   cd youtube-auto-skip
   zip -r ../youtube-auto-skip.zip . --exclude "*.git*"
   ```
4. Upload the ZIP to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
5. Fill in the store listing (description, screenshots, privacy policy) and submit for review.

---

## Extending the Extension

### Adding new skip button selectors

Edit the `SKIP_SELECTORS` array in `content.js`:

```js
const SKIP_SELECTORS = [
  '.ytp-skip-ad-button',
  '.your-new-selector-here',   // ← add here
  // ...
];
```

### Adding skip button text in more languages

Edit the `SKIP_BUTTON_TEXTS` array in `content.js`:

```js
const SKIP_BUTTON_TEXTS = [
  'skip ad',
  'skip ads',
  'Přeskočit reklamu',   // ← Czech example
  // ...
];
```

---

## Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Persist the enabled state and skip counter across sessions |
| `scripting` | Required by MV3 for service workers that communicate with content scripts |
| `host_permissions: youtube.com` | Allows the content script to run on YouTube pages |

No browsing history, no network requests to external servers, no data collection.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Ads aren't being skipped | Open DevTools on a YouTube tab → Console and check for `[YT Auto Skip]` logs. If absent, reload the extension. |
| Badge shows wrong count | Click **Reset counter** in the popup. |
| Extension stopped working after a YouTube update | YouTube may have renamed CSS classes. Check `SKIP_SELECTORS` in `content.js` and update if needed. The text-based fallback should still work in the interim. |
| "Could not establish connection" errors | Normal — these appear when the content script isn't loaded on the current tab (e.g., a non-video page). They're caught and suppressed in production. |

---

## License

MIT — free to use, modify, and distribute.
