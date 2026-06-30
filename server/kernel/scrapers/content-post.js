import { newPage } from '../browser-pool.js';

const NAV_TIMEOUT = parseInt(process.env.SCRAPER_NAV_TIMEOUT_MS ?? '60000');

/**
 * Detecta la plataforma a partir de la URL del posteo.
 * @returns {'instagram'|'tiktok'|null}
 */
export function detectPlatform(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com')) return 'instagram';
  return null;
}

/**
 * Scrapea las métricas PÚBLICAS de UNA pieza de contenido a partir de su permalink.
 * Como navegamos al permalink exacto, las stats son las de ESA pieza — no hay
 * forma de "traer de más".
 *
 * @param {string} url  permalink del posteo (IG /p//reel/ o TikTok /video/)
 * @returns {{views,likes,comments,shares,saves}|{error,url}}
 */
export async function scrapeContentPost(url) {
  const platform = detectPlatform(url);
  if (!platform) return { error: 'plataforma_no_soportada', url };

  return platform === 'tiktok'
    ? scrapeTikTokPost(url)
    : scrapeInstagramPost(url);
}

// ─── TikTok ───────────────────────────────────────────────────────────────────

async function scrapeTikTokPost(url) {
  let page = null;
  let stats = null;

  try {
    page = await newPage('tiktok');

    let resolveStats;
    const statsPromise = new Promise(r => { resolveStats = r; });

    function tryStats(json) {
      if (stats) return;
      // Formato A: /api/item/detail/ → { itemInfo: { itemStruct: { stats } } }
      const a = json?.itemInfo?.itemStruct?.stats ?? json?.itemInfo?.itemStruct?.statsV2;
      // Formato B: { itemList: [{ stats }] }
      const b = json?.itemList?.[0]?.stats;
      const st = a ?? b;
      if (st && (st.playCount != null || st.diggCount != null)) {
        stats = normalizeTikTok(st);
        resolveStats?.();
      }
    }

    page.on('response', async (res) => {
      const u = res.url();
      if (!u.includes('tiktok.com')) return;
      if (!u.includes('/api/item/detail/') && !u.includes('/api/post/item_list/')) return;
      const text = await res.text().catch(() => null);
      if (text?.trimStart()[0] === '{') {
        try { tryStats(JSON.parse(text)); } catch { /* ignore */ }
      }
    });

    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    await Promise.race([statsPromise, new Promise(r => setTimeout(r, 15000))]);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup') || currentUrl.includes('challenge')) {
      return { error: 'login_wall', url };
    }

    // Fallback: __UNIVERSAL_DATA_FOR_REHYDRATION__ → webapp.video-detail
    if (!stats) {
      const fromDom = await page.evaluate(() => {
        try {
          const el = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
          if (!el) return null;
          const data = JSON.parse(el.textContent ?? '{}');
          const scope = data?.['__DEFAULT_SCOPE__'];
          const st = scope?.['webapp.video-detail']?.itemInfo?.itemStruct?.stats;
          return st ?? null;
        } catch { return null; }
      }).catch(() => null);
      if (fromDom) stats = normalizeTikTok(fromDom);
    }

    if (!stats) return { error: 'data_not_captured', url };
    return stats;
  } catch (err) {
    return { error: err.message, url };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

function normalizeTikTok(st) {
  const n = v => (v == null ? null : Number(v));
  return {
    views:    n(st.playCount ?? st.VV),
    likes:    n(st.diggCount ?? st.likeCount),
    comments: n(st.commentCount),
    shares:   n(st.shareCount),
    saves:    n(st.collectCount),   // TikTok sí expone guardados
  };
}

// ─── Instagram ──────────────────────────────────────────────────────────────────

async function scrapeInstagramPost(url) {
  let page = null;
  let stats = null;

  try {
    page = await newPage('instagram');

    let resolveStats;
    const statsPromise = new Promise(r => { resolveStats = r; });

    function tryStats(json) {
      if (stats) return;
      // /api/v1/media/<id>/info/ → { items: [ media ] }
      const item = json?.items?.[0];
      // graphql PolarisPostAction → { data: { xdt_shortcode_media | shortcode_media } }
      const media = item
        ?? json?.data?.xdt_shortcode_media
        ?? json?.data?.shortcode_media
        ?? json?.graphql?.shortcode_media;
      if (!media) return;
      const likes    = media.like_count ?? media.edge_liked_by?.count ?? media.edge_media_preview_like?.count;
      const comments = media.comment_count ?? media.edge_media_to_comment?.count ?? media.edge_media_to_parent_comment?.count;
      const views    = media.play_count ?? media.video_view_count ?? media.view_count ?? media.ig_play_count;
      if (likes == null && comments == null && views == null) return;
      stats = {
        views:    views    != null ? Number(views)    : null,
        likes:    likes    != null ? Number(likes)    : null,
        comments: comments != null ? Number(comments) : null,
        shares:   null,   // Instagram no expone shares públicamente
        saves:    null,   // Instagram no expone guardados públicamente
      };
      resolveStats?.();
    }

    await page.route('**/api/v1/media/**', async (route) => {
      try {
        const response = await route.fetch();
        const text = await response.text().catch(() => null);
        if (text?.trimStart()[0] === '{') { try { tryStats(JSON.parse(text)); } catch {} }
        await route.fulfill({ response });
      } catch {
        await route.continue().catch(() => {});
      }
    });

    page.on('response', async (res) => {
      const u = res.url();
      if (!u.includes('instagram.com')) return;
      if (!u.includes('/api/v1/media/') && !u.includes('graphql')) return;
      const text = await res.text().catch(() => null);
      if (text?.trimStart()[0] === '{') { try { tryStats(JSON.parse(text)); } catch {} }
    });

    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    await Promise.race([statsPromise, new Promise(r => setTimeout(r, 15000))]);

    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login') || currentUrl.includes('/login') || currentUrl.includes('/challenge/')) {
      return { error: 'login_wall', url };
    }

    // Fallback: JSON embebido en <script> con like_count / play_count
    if (!stats) {
      const fromDom = await page.evaluate(() => {
        for (const script of document.querySelectorAll('script:not([src])')) {
          const text = script.textContent || '';
          if (!text.includes('"like_count"') && !text.includes('"edge_liked_by"')) continue;
          const lk = text.match(/"like_count"\s*:\s*(\d+)/) || text.match(/"edge_liked_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
          const cc = text.match(/"comment_count"\s*:\s*(\d+)/) || text.match(/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
          const vc = text.match(/"play_count"\s*:\s*(\d+)/) || text.match(/"video_view_count"\s*:\s*(\d+)/);
          if (lk || cc || vc) {
            return {
              likes:    lk ? Number(lk[1]) : null,
              comments: cc ? Number(cc[1]) : null,
              views:    vc ? Number(vc[1]) : null,
            };
          }
        }
        return null;
      }).catch(() => null);
      if (fromDom) stats = { ...fromDom, shares: null, saves: null };
    }

    if (!stats) return { error: 'data_not_captured', url };
    return stats;
  } catch (err) {
    return { error: err.message, url };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}
