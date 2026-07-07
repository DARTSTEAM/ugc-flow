import { newPage } from '../browser-pool.js';

const NAV_TIMEOUT = parseInt(process.env.SCRAPER_NAV_TIMEOUT_MS ?? '60000');
const MAX_COMMENTS = 10;

/** Agrega texto de comentario a la lista, hasta MAX_COMMENTS, sin duplicar. */
function pushComment(list, text) {
  if (list.length >= MAX_COMMENTS) return;
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) return;
  list.push(clean);
}

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
  const commentTexts = [];

  try {
    page = await newPage('tiktok');

    let resolveStats;
    const statsPromise = new Promise(r => { resolveStats = r; });
    let resolveComments;
    const commentsPromise = new Promise(r => { resolveComments = r; });

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

    // /api/comment/list/ devuelve los comentarios en el orden que muestra el panel
    // (TikTok los pagina más-recientes-primero por defecto); tomamos la primera página.
    function tryComments(json) {
      if (commentTexts.length >= MAX_COMMENTS) return;
      const list = json?.comments;
      if (!Array.isArray(list) || !list.length) return;
      for (const c of list) pushComment(commentTexts, c?.text);
      if (commentTexts.length >= MAX_COMMENTS) resolveComments?.();
    }

    page.on('response', async (res) => {
      const u = res.url();
      if (!u.includes('tiktok.com')) return;
      const isStats = u.includes('/api/item/detail/') || u.includes('/api/post/item_list/');
      const isComments = u.includes('/api/comment/list/');
      if (!isStats && !isComments) return;
      const text = await res.text().catch(() => null);
      if (text?.trimStart()[0] !== '{') return;
      try {
        const json = JSON.parse(text);
        if (isStats) tryStats(json);
        if (isComments) tryComments(json);
      } catch { /* ignore */ }
    });

    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    await Promise.race([statsPromise, new Promise(r => setTimeout(r, 15000))]);
    // Los comentarios pueden llegar un poco después que las stats — damos un margen corto extra.
    await Promise.race([commentsPromise, new Promise(r => setTimeout(r, 4000))]);

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
    return { ...stats, commentTexts };
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
  const commentTexts = [];

  try {
    page = await newPage('instagram');

    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    // El HTML SSR con el media object y los comentarios llega en el load inicial;
    // este margen es sólo por si algún script tarda en hidratar.
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    if (currentUrl.includes('/accounts/login') || currentUrl.includes('/login') || currentUrl.includes('/challenge/')) {
      return { error: 'login_wall', url };
    }

    // Instagram (Comet/Polaris) no expone el post por un XHR interceptable en la carga
    // normal de /p/<code>/: todo — el media object (likes, comentarios, reposts) y los
    // comentarios — viene embebido server-side en un <script> como preloaded Relay query.
    // El media object se identifica por tener like_count + media_repost_count juntos
    // (fingerprint estable, más confiable que fijarse en la ruta exacta del JSON, que
    // cambia de versión en versión). Los comentarios viven bajo una key dinámica que
    // termina en "comments__connection", con { edges: [{ node: { text } }] }.
    const ssr = await page.evaluate((max) => {
      function findMedia(obj, depth, seen) {
        if (depth > 20 || obj == null || typeof obj !== 'object') return null;
        if (seen.has(obj)) return null;
        seen.add(obj);
        if ('media_repost_count' in obj && ('like_count' in obj || 'comment_count' in obj)) return obj;
        for (const k of Object.keys(obj)) {
          const found = findMedia(obj[k], depth + 1, seen);
          if (found) return found;
        }
        return null;
      }
      function findComments(obj, depth, out, seen) {
        if (depth > 20 || obj == null || typeof obj !== 'object' || out.length >= max) return;
        if (seen.has(obj)) return;
        seen.add(obj);
        for (const k of Object.keys(obj)) {
          if (out.length >= max) return;
          const v = obj[k];
          if (k.endsWith('comments__connection') && Array.isArray(v?.edges)) {
            for (const e of v.edges) {
              if (out.length >= max) break;
              const t = e?.node?.text;
              if (typeof t === 'string' && t.trim()) out.push(t.trim());
            }
            continue;
          }
          findComments(v, depth + 1, out, seen);
        }
      }

      let media = null;
      const comments = [];
      for (const script of document.querySelectorAll('script:not([src])')) {
        const text = script.textContent || '';
        if (!media && text.includes('"like_count"') && text.includes('"media_repost_count"')) {
          try { media = findMedia(JSON.parse(text), 0, new Set()); } catch { /* no era JSON parseable */ }
        }
        if (comments.length < max && text.includes('comments__connection')) {
          try { findComments(JSON.parse(text), 0, comments, new Set()); } catch { /* no era JSON parseable */ }
        }
        if (media && comments.length >= max) break;
      }
      return { media, comments };
    }, MAX_COMMENTS).catch(() => ({ media: null, comments: [] }));

    if (ssr.media) {
      const m = ssr.media;
      const likes    = m.like_count;
      const comments = m.comment_count;
      // view_count sólo existe para video/Reels — los posteos de foto/carrusel de IG no
      // tienen concepto de "vistas" (no es un dato oculto, directamente no existe).
      const views    = m.view_count ?? m.play_count ?? m.video_view_count ?? m.ig_play_count;
      // media_repost_count = veces que resubieron este contenido con "Repost" — es el
      // único agregado público de "compartir" que expone Instagram hoy.
      const shares   = m.media_repost_count;
      stats = {
        views:    views    != null ? Number(views)    : null,
        likes:    likes    != null ? Number(likes)    : null,
        comments: comments != null ? Number(comments) : null,
        shares:   shares   != null ? Number(shares)   : null,
        saves:    null,   // Verificado en el payload completo: IG no expone un conteo agregado de guardados,
                           // sólo el estado "¿lo guardó ESTE viewer?", que no sirve como métrica pública.
      };
    }

    for (const t of ssr.comments) pushComment(commentTexts, t);

    if (!stats) return { error: 'data_not_captured', url };
    return { ...stats, commentTexts };
  } catch (err) {
    return { error: err.message, url };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}
