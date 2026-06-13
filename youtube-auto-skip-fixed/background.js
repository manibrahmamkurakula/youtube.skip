'use strict';

async function updateBadge(count) {
  const text = count > 0 ? (count > 999 ? '999+' : String(count)) : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: '#cc0000' });
}

async function getStoredTotal() {
  const data = await chrome.storage.local.get('adsSkipped');
  return typeof data.adsSkipped === 'number' ? data.adsSkipped : 0;
}

// Get the real button coords by injecting into the tab's own JS context
async function getButtonCoords(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const selectors = [
        '.ytp-ad-skip-button-modern',
        '.ytp-ad-skip-button',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-slot button',
      ];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
          }
        }
      }
      return null;
    },
  });
  return results?.[0]?.result ?? null;
}

const attachedTabs = new Set();

async function debuggerClick(tabId) {
  const coords = await getButtonCoords(tabId);
  if (!coords) {
    console.warn('[BG] Skip button not found in tab');
    return;
  }

  const { x, y } = coords;

  try {
    if (!attachedTabs.has(tabId)) {
      await chrome.debugger.attach({ tabId }, '1.3');
      attachedTabs.add(tabId);
    }
  } catch (e) {
    if (!e.message?.includes('already attached')) {
      console.error('[BG] attach failed:', e.message);
      return;
    }
    attachedTabs.add(tabId);
  }

  const cmd = (type, extra) =>
    chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', { x, y, modifiers: 0, ...extra, type });

  try {
    // No artificial delays — fire as fast as possible
    await cmd('mouseMoved',   { button: 'none', clickCount: 0 });
    await cmd('mousePressed', { button: 'left', clickCount: 1 });
    await cmd('mouseReleased',{ button: 'left', clickCount: 1 });
  } catch (e) {
    console.error('[BG] click failed:', e.message);
    return;
  }

  // Detach immediately after click
  try { await chrome.debugger.detach({ tabId }); } catch(e) {}
  attachedTabs.delete(tabId);

  const total = (await getStoredTotal()) + 1;
  await chrome.storage.local.set({ adsSkipped: total });
  await updateBadge(total);
  console.info(`[BG] ✅ Skipped! Total: ${total}`);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (attachedTabs.has(tabId)) {
    chrome.debugger.detach({ tabId }).catch(() => {});
    attachedTabs.delete(tabId);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'DEBUGGER_CLICK') {
      await debuggerClick(sender.tab.id);
      sendResponse({ ok: true });
    } else if (msg.type === 'GET_STATS') {
      const data = await chrome.storage.local.get(['isEnabled', 'adsSkipped']);
      sendResponse({ isEnabled: data.isEnabled !== false, adsSkipped: data.adsSkipped || 0 });
    } else if (msg.type === 'SET_ENABLED') {
      await chrome.storage.local.set({ isEnabled: msg.value });
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'SET_ENABLED', value: msg.value }).catch(() => {});
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'RESET_COUNTER') {
      await chrome.storage.local.set({ adsSkipped: 0 });
      await updateBadge(0);
      sendResponse({ ok: true });
    }
  })();
  return true;
});

async function restoreBadge() {
  const total = await getStoredTotal();
  await updateBadge(total);
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ isEnabled: true, adsSkipped: 0 });
  }
  await restoreBadge();
});

restoreBadge();
