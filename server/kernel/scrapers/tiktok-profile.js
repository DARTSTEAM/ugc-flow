import { newPage } from '../browser-pool.js';

const NAV_TIMEOUT = parseInt(process.env.SCRAPER_NAV_TIMEOUT_MS ?? '60000');
const MAX_VIDEOS = 5;

/**
 * Scrapes a TikTok profile using the page.on('response') strategy only.
 *
 * NOTE: We intentionally do NOT use page.route() interceptors here. On TikTok,
 * route.fetch() causes Playwright to re-issue the request server-side, which can
 * alter headers/cookies and produce a different (often empty) response than what
 * the browser receives. We therefore let the browser make all requests normally
 * and capture them via the response listener.
 *
 * Data sources:
 *   A. /api/user/detail/  → { userInfo: { user, stats } }
 *   B. /api/post/item_list/ → { itemList: [{ author, authorStats, stats }] }
 *
 * Metrics extracted (parallel to Instagram):
 *   - seguidores (followerCount)
 *   - engagementRate: (likes + comments) / (videos × followers) × 100
 *   - promedioVistas: average play count of last MAX_VIDEOS videos
 */
export async function scrapeTikTokProfile(handle) {
  let page = null;

  let capturedUser = null;      // { nombre, seguidores }
  let capturedVideos = [];      // [{ playCount, diggCount, commentCount }]

  try {
    page = await newPage('tiktok');

    let resolveUser, resolvePosts;
    const userPromise  = new Promise(r => { resolveUser  = r; });
    const postsPromise = new Promise(r => { resolvePosts = r; });

    // ── Parsers ────────────────────────────────────────────────────────────────

    function tryUser(json) {
      if (capturedUser) return;

      // Format A: /api/user/detail/ → { userInfo: { user, stats } }
      const userData = json?.userInfo?.user;
      const stats    = json?.userInfo?.stats;
      if (userData && stats?.followerCount != null) {
        capturedUser = {
          nombre:    userData.nickname || userData.uniqueId || handle,
          seguidores: Number(stats.followerCount),
        };
        console.log(`[Kernel/TikTok] @${handle} — user captured via /api/user/detail/ | followers: ${capturedUser.seguidores}`);
        resolveUser?.();
        return;
      }

      // Format B: /api/post/item_list/ first item carries authorStats
      const author      = json?.itemList?.[0]?.author;
      const authorStats = json?.itemList?.[0]?.authorStats;
      if (author && authorStats?.followerCount != null) {
        capturedUser = {
          nombre:    author.nickname || author.uniqueId || handle,
          seguidores: Number(authorStats.followerCount),
        };
        console.log(`[Kernel/TikTok] @${handle} — user captured via /api/post/item_list/ authorStats | followers: ${capturedUser.seguidores}`);
        resolveUser?.();
      }
    }

    function tryVideos(json) {
      if (capturedVideos.length >= MAX_VIDEOS * 4) return; // buffer, dedup later

      // /api/post/item_list/ → { itemList: [{ stats }] }
      const items = json?.itemList;
      if (!Array.isArray(items) || !items.length) return;

      const before = capturedVideos.length;
      for (const item of items) {
        if (capturedVideos.length >= MAX_VIDEOS * 4) break;
        // Pinned posts skew ER and avg views — skip them
        if (item.isPinnedPost === 1 || item.isPinnedPost === true) {
          console.log(`[Kernel/TikTok] @${handle} — skipping pinned post id=${item.id ?? '?'}`);
          continue;
        }
        const st = item?.stats ?? item?.statistics;
        if (!st) continue;
        capturedVideos.push({
          playCount:    Number(st.playCount    ?? st.VV        ?? 0),
          diggCount:    Number(st.diggCount    ?? st.likeCount ?? 0),
          commentCount: Number(st.commentCount ?? 0),
          shareCount:   Number(st.shareCount   ?? 0),
          createTime:   item.createTime != null ? Number(item.createTime) : null,
        });
      }
      if (capturedVideos.length > before) {
        console.log(`[Kernel/TikTok] @${handle} — videos captured: ${capturedVideos.length} total`);
        resolvePosts?.();
      }
    }

    function processText(text) {
      if (!text) return;
      const t = text.trimStart();
      if (t[0] !== '{') return;
      try {
        const json = JSON.parse(t);
        tryUser(json);
        tryVideos(json);
      } catch { /* ignore non-profile JSON */ }
    }

    // ── Strategy: response listener only (no route interceptors) ──────────────
    // page.route() with route.fetch() was intentionally removed because it causes
    // the browser-side request to receive a synthetic response (potentially with
    // missing cookies/headers), making TikTok return empty or blocked data.
    page.on('response', async (res) => {
      const url = res.url();
      if (!url.includes('tiktok.com')) return;
      if (
        !url.includes('/api/user/detail/') &&
        !url.includes('/api/post/item_list/') &&
        !url.includes('/api/recommend/item_list/') &&
        !url.includes('/api/creator/item_list/')
      ) return;

      const text = await res.text().catch(() => null);
      if (text) {
        console.log(`[Kernel/TikTok] @${handle} — response: ${url.replace(/https:\/\/[^/]+/, '').split('?')[0]} (${text.length} bytes)`);
        processText(text);
      }
    });

    const profileUrl = `https://www.tiktok.com/@${handle}`;
    await page.goto(profileUrl, { waitUntil: 'load', timeout: NAV_TIMEOUT });

    // Wait up to 20s for user data (required to proceed)
    await Promise.race([userPromise, new Promise(r => setTimeout(r, 20000))]);

    // If we have user data but no videos yet, wait up to 10s more
    if (capturedUser && capturedVideos.length === 0) {
      await Promise.race([postsPromise, new Promise(r => setTimeout(r, 10000))]);
    }

    // Give a short buffer for remaining video responses to arrive
    if (capturedVideos.length > 0 && capturedVideos.length < MAX_VIDEOS) {
      await new Promise(r => setTimeout(r, 3000));
    }

    // ── Challenge / login-wall detection ──────────────────────────────────────
    const currentUrl = page.url();
    console.log(`[Kernel/TikTok] @${handle} → final URL: ${currentUrl} | user: ${!!capturedUser} | videos: ${capturedVideos.length}`);

    if (
      currentUrl.includes('/login') ||
      currentUrl.includes('/signup') ||
      currentUrl.includes('challenge')
    ) {
      return { error: 'login_wall', handle };
    }

    // ── DOM fallback ───────────────────────────────────────────────────────────
    if (!capturedUser || capturedVideos.length === 0) {
      console.log(`[Kernel/TikTok] Network capture incomplete for "@${handle}" — trying DOM fallback`);
      const fromDom = await extractFromTikTokDom(page);
      if (fromDom) {
        if (!capturedUser && fromDom.user) capturedUser = fromDom.user;
        if (capturedVideos.length === 0 && fromDom.videos?.length) capturedVideos = fromDom.videos;
      }
    }

    if (!capturedUser) {
      const title = await page.title().catch(() => '—');
      console.warn(`[Kernel/TikTok] data_not_captured for "@${handle}" | page title: "${title}"`);
      return { error: 'data_not_captured', handle };
    }

    const videosForMetrics = capturedVideos.slice(0, MAX_VIDEOS);

    if (videosForMetrics.length < MAX_VIDEOS) {
      console.warn(`[Kernel/TikTok] @${handle} — only ${videosForMetrics.length}/${MAX_VIDEOS} videos captured`);
    }

    console.log(`[Kernel/TikTok] @${handle} — video metrics:`,
      JSON.stringify(videosForMetrics.map((v, i) => ({
        i, pc: v.playCount, dc: v.diggCount, cc: v.commentCount,
      })))
    );

    const engagementRate    = calcTikTokEngagementRate(videosForMetrics, capturedUser.seguidores);
    const promedioVistas    = calcTikTokAvgViews(videosForMetrics);
    const frecuenciaSemanal = calcTikTokFrecuenciaSemanal(capturedVideos);
    const videosVirales     = calcTikTokVideosVirales(capturedVideos);

    console.log(`[Kernel/TikTok] @${handle} — ER: ${engagementRate} | avgViews: ${promedioVistas} | freq: ${frecuenciaSemanal}/wk | viral: ${videosVirales} | seguidores: ${capturedUser.seguidores}`);

    return {
      handle,
      nombre:       capturedUser.nombre,
      seguidores:   capturedUser.seguidores,
      engagementRate,
      promedioVistas,
      frecuenciaSemanal,
      videosVirales,
    };

  } catch (err) {
    return { error: err.message, handle };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ─── DOM fallback ────────────────────────────────────────────────────────────

async function extractFromTikTokDom(page) {
  try {
    return await page.evaluate(() => {
      function parseVideos(itemList) {
        if (!Array.isArray(itemList)) return [];
        return itemList
          .filter(item => !item.isPinnedPost)
          .map(item => {
            const st = item?.stats ?? item?.statistics ?? {};
            return {
              playCount:    Number(st.playCount    ?? st.VV        ?? 0),
              diggCount:    Number(st.diggCount    ?? st.likeCount ?? 0),
              commentCount: Number(st.commentCount ?? 0),
              shareCount:   Number(st.shareCount   ?? 0),
            };
          }).filter(v => v.playCount > 0 || v.diggCount > 0);
      }

      // Strategy A: __UNIVERSAL_DATA_FOR_REHYDRATION__ (TikTok 2024-2025)
      try {
        const el = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
        if (el) {
          const data = JSON.parse(el.textContent ?? '{}');
          const scope = data?.['__DEFAULT_SCOPE__'];
          const userDetail = scope?.['webapp.user-detail'];
          if (userDetail?.userInfo) {
            const { user, stats } = userDetail.userInfo;
            if (user && stats?.followerCount != null) {
              return {
                user: {
                  nombre:    user.nickname || user.uniqueId,
                  seguidores: Number(stats.followerCount),
                },
                videos: parseVideos(userDetail?.itemList),
              };
            }
          }
        }
      } catch { /* continue */ }

      // Strategy B: SIGI_STATE (older TikTok format)
      try {
        const sigiEl = document.querySelector('#SIGI_STATE');
        if (sigiEl) {
          const data = JSON.parse(sigiEl.textContent ?? '{}');
          const users = data?.UserModule?.users ?? {};
          const handleKey = Object.keys(users)[0];
          if (handleKey) {
            const u = users[handleKey];
            const uStats = data?.UserModule?.stats?.[handleKey] ?? {};
            const followerCount = u?.followerCount ?? uStats?.followerCount;
            if (followerCount != null) {
              const itemModule = data?.ItemModule ?? {};
              const pinnedIds = new Set(
                data?.ItemList?.['user-post']?.pinnedItemIds ??
                data?.ItemList?.post?.pinnedItemIds ?? []
              );
              const videos = Object.entries(itemModule)
                .filter(([id]) => !pinnedIds.has(id))
                .map(([, item]) => {
                  const st = item?.stats ?? {};
                  return {
                    playCount:    Number(st.playCount    ?? 0),
                    diggCount:    Number(st.diggCount    ?? 0),
                    commentCount: Number(st.commentCount ?? 0),
                    shareCount:   Number(st.shareCount   ?? 0),
                  };
                }).filter(v => v.playCount > 0 || v.diggCount > 0);
              return {
                user: {
                  nombre:    u.nickname || u.uniqueId,
                  seguidores: Number(followerCount),
                },
                videos,
              };
            }
          }
        }
      } catch { /* continue */ }

      // Strategy C: scan inline scripts for followerCount pattern
      try {
        for (const script of document.querySelectorAll('script:not([src])')) {
          const text = script.textContent || '';
          if (!text.includes('"followerCount"')) continue;
          const fcMatch = text.match(/"followerCount"\s*:\s*(\d+)/);
          const nnMatch = text.match(/"nickname"\s*:\s*"([^"]+)"/);
          if (fcMatch) {
            return {
              user: {
                nombre:    nnMatch?.[1] ?? '',
                seguidores: Number(fcMatch[1]),
              },
              videos: null,
            };
          }
        }
      } catch { /* ignore */ }

      return null;
    });
  } catch (err) {
    console.warn('[Kernel/TikTok] DOM fallback error:', err.message);
    return null;
  }
}

// ─── Metric calculators ──────────────────────────────────────────────────────

/**
 * TikTok engagement rate = (total_likes + total_comments) / (videos × followers) × 100
 */
function calcTikTokEngagementRate(videos, seguidores) {
  if (!videos.length || !seguidores) return null;
  const totalInteractions = videos.reduce((sum, v) => sum + v.diggCount + v.commentCount, 0);
  return parseFloat(((totalInteractions / videos.length / seguidores) * 100).toFixed(2));
}

/**
 * Average play count across captured videos.
 * Returns null if no videos with play counts are available.
 */
function calcTikTokAvgViews(videos) {
  const withViews = videos.filter(v => v.playCount > 0);
  if (!withViews.length) return null;
  const total = withViews.reduce((sum, v) => sum + v.playCount, 0);
  return Math.round(total / withViews.length);
}

/**
 * Average posts per week based on videos within the last 60 days.
 * Uses createTime (Unix seconds). Returns null if no timestamps available.
 */
function calcTikTokFrecuenciaSemanal(videos) {
  const now = Math.floor(Date.now() / 1000);
  const sixtyDaysAgo = now - 60 * 24 * 3600;

  const recent = videos.filter(v => v.createTime != null && v.createTime > sixtyDaysAgo);
  if (!recent.length) return null;

  const WEEKS = 60 / 7;
  return parseFloat((recent.length / WEEKS).toFixed(2));
}

/**
 * Count of videos in the last 60 days whose play count exceeds 3× the average
 * play count of the remaining videos (viral = outlier by 3x).
 */
function calcTikTokVideosVirales(videos) {
  const now = Math.floor(Date.now() / 1000);
  const sixtyDaysAgo = now - 60 * 24 * 3600;

  const withTs  = videos.filter(v => v.createTime != null);
  const inRange = withTs.filter(v => v.createTime > sixtyDaysAgo && v.playCount > 0);
  console.log(`[Kernel/TikTok] calcVideosVirales: ${videos.length} videos | ${withTs.length} with timestamp | ${inRange.length} within 60 days`);

  // Fall back to all videos with playCount if timestamps are missing
  const pool = inRange.length >= 2 ? inRange.map(v => v.playCount) : videos.filter(v => v.playCount > 0).map(v => v.playCount);

  if (pool.length < 2) return 0;

  const total = pool.reduce((s, v) => s + v, 0);
  return pool.filter(v => {
    const othersAvg = (total - v) / (pool.length - 1);
    return v > 3 * othersAvg;
  }).length;
}
