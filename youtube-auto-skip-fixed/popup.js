/**
 * YouTube Auto Skip — Popup Script
 *
 * Reads state from the background service worker, lets the user toggle
 * the extension on/off, and reset the counter.
 */

'use strict';

// ─── DOM References ───────────────────────────────────────────────────────────

const enableToggle = document.getElementById('enable-toggle');
const statusText   = document.getElementById('status-text');
const skipCount    = document.getElementById('skip-count');
const resetBtn     = document.getElementById('reset-btn');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sends a message to the background service worker.
 * Returns a promise that resolves with the response, or null on error.
 * @param {object} message
 * @returns {Promise<object|null>}
 */
async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (err) {
    console.warn('[YT Auto Skip Popup] Message failed:', err);
    return null;
  }
}

/** Updates the UI to reflect the current enabled/disabled state. */
function renderToggleState(enabled) {
  enableToggle.checked = enabled;
  statusText.textContent = enabled ? 'Active' : 'Paused';
  statusText.classList.toggle('disabled', !enabled);
}

/** Updates the ads-skipped counter display with a brief flash animation. */
function renderCount(count) {
  skipCount.classList.add('updating');
  requestAnimationFrame(() => {
    skipCount.textContent = count.toLocaleString();
    skipCount.classList.remove('updating');
  });
}

// ─── Initialisation ───────────────────────────────────────────────────────────

async function init() {
  // Fetch current state from the background worker
  const stats = await sendMessage({ type: 'GET_STATS' });

  if (stats) {
    renderToggleState(stats.isEnabled);
    renderCount(stats.adsSkipped);
  } else {
    // Fallback: read directly from storage if the background is unresponsive
    const stored = await chrome.storage.local.get(['isEnabled', 'adsSkipped']);
    renderToggleState(stored.isEnabled !== false);
    renderCount(stored.adsSkipped || 0);
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

enableToggle.addEventListener('change', async () => {
  const enabled = enableToggle.checked;
  renderToggleState(enabled);
  await sendMessage({ type: 'SET_ENABLED', value: enabled });
});

resetBtn.addEventListener('click', async () => {
  renderCount(0);
  await sendMessage({ type: 'RESET_COUNTER' });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

init();
