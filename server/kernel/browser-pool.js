import Kernel from '@onkernel/sdk';
import { chromium } from 'playwright-core';

const pool = new Map();       // platform -> { kernelBrowser, browser, context, sessionId }
const initializing = new Map(); // platform -> Promise (prevents duplicate init on concurrent calls)

const PROFILES = {
  instagram: process.env.KERNEL_PROFILE_INSTAGRAM,
};

const HEADFUL_PLATFORMS = (process.env.HEADFUL_PLATFORMS ?? 'instagram')
  .split(',')
  .map(p => p.trim().toLowerCase());

// Lazy-initialize so the server can start without KERNEL_API_KEY when scraping isn't used.
let _client = null;
function getClient() {
  if (!_client) {
    const apiKey = process.env.KERNEL_API_KEY;
    if (!apiKey) throw new Error('[Kernel] KERNEL_API_KEY env var is required to use the scraper.');
    _client = new Kernel({ apiKey });
  }
  return _client;
}

export async function getBrowser(platform) {
  const key = platform.toLowerCase();

  const existing = pool.get(key);
  if (existing) {
    if (existing.browser.isConnected()) return existing;
    // Stale entry — connection dropped (Kernel session expired or network error)
    console.warn(`[Kernel] Stale browser entry for "${key}" — reconnecting`);
    pool.delete(key);
    try { await existing.browser.close(); } catch { /* already dead */ }
  }

  if (initializing.has(key)) {
    return initializing.get(key);
  }

  const initPromise = (async () => {
    const profileName = PROFILES[key];
    const headless = !HEADFUL_PLATFORMS.includes(key);

    const createOpts = {
      headless,
      stealth: true,
    };
    if (profileName) createOpts.profile = { id: profileName };
    if (process.env.KERNEL_PROXY_ID) createOpts.proxy_id = process.env.KERNEL_PROXY_ID;

    const kernelBrowser = await getClient().browsers.create(createOpts);

    console.log(`[Kernel] Browser created for ${platform} | session: ${kernelBrowser.session_id}`);
    if (kernelBrowser.browser_live_view_url) {
      console.log(`[Kernel] LIVE VIEW: ${kernelBrowser.browser_live_view_url}`);
    }

    const browser = await chromium.connectOverCDP(kernelBrowser.cdp_ws_url);
    // Use existing context to preserve profile cookies — never call newContext()
    const context = browser.contexts()[0] ?? await browser.newContext();

    const entry = { kernelBrowser, browser, context, sessionId: kernelBrowser.session_id };
    pool.set(key, entry);
    initializing.delete(key);
    return entry;
  })();

  initializing.set(key, initPromise);

  try {
    return await initPromise;
  } catch (err) {
    initializing.delete(key);
    throw err;
  }
}

export async function newPage(platform) {
  const { context } = await getBrowser(platform);
  return context.newPage();
}

export async function closeBrowser(platform) {
  const key = platform.toLowerCase();
  const entry = pool.get(key);
  if (!entry) return;
  pool.delete(key);
  try {
    await entry.browser.close();
    await getClient().browsers.deleteByID(entry.sessionId);
  } catch (err) {
    console.error(`[Kernel] Error closing ${platform} browser:`, err.message);
  }
}

export async function closeAllBrowsers() {
  await Promise.allSettled([...pool.keys()].map(p => closeBrowser(p)));
}
