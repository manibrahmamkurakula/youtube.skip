'use strict';

const SKIP_SELECTORS = [
  '.ytp-ad-skip-button-modern',
  '.ytp-ad-skip-button',
  '.ytp-skip-ad-button',
  '.ytp-ad-skip-button-slot button',
];
// Hello
function getSkipButton() {
  for (const sel of SKIP_SELECTORS) {
    const btn = document.querySelector(sel);
    if (btn && btn.offsetParent !== null) return btn;
  }
  return null;
}

let skipping = false;

function trySkip() {
  if (skipping) return;
  const btn = getSkipButton();
  if (!btn) return;

  skipping = true;
  console.info('[YT Skip] Skip button detected — firing immediately');
  chrome.runtime.sendMessage({ type: 'DEBUGGER_CLICK' });

  // Short cooldown just to avoid double-firing on same button
  setTimeout(() => { skipping = false; }, 1500);
}

// MutationObserver fires instantly the moment the button enters the DOM
new MutationObserver(trySkip)
  .observe(document.documentElement, { childList: true, subtree: true, attributes: true });

// Fallback poll every 100ms (catches cases where button is already there)
setInterval(trySkip, 100);

console.info('[YT Skip] v6.0 ready');
