import { newPage } from '../browser-pool.js';

const NAV_TIMEOUT = parseInt(process.env.SCRAPER_NAV_TIMEOUT_MS ?? '60000');
const MAX_POSTS = 5;

/**
 * Scrapes an Instagram profile using three strategies:
 *
 * 1. page.route() on web_profile_info — intercepts before the service worker
 *    cache can serve a stale response.
 * 2. page.on('response') — catches feed/graphql endpoints that carry posts in
 *    a separate XHR (common in Instagram 2024-2025).
 * 3. page.evaluate() DOM fallback — extracts from embedded <script> data when
 *    both network strategies fail.
 *
 * User data (seguidores, nombre, categoria) and posts data are tracked
 * independently because in newer Instagram they arrive in separate XHRs.
 * We wait up to 20s for the user object, then up to 10s more for posts.
 */
export async function scrapeInstagramProfile(handle) {
  let page = null;

  let capturedUser = null;       // { nombre, seguidores, categoria }
  let capturedPosts = undefined; // undefined = not yet received; [] = received but empty

  try {
    page = await newPage('instagram');

    let resolveUser, resolvePosts;
    const userPromise  = new Promise(r => { resolveUser  = r; });
    const postsPromise = new Promise(r => { resolvePosts = r; });

    // Extra counts captured from the mobile feed API (play_count, comment_count).
    // Keyed by post pk (string). Used to enrich XDT posts that lack these fields.
    const extraByPk = {};

    // Reels from the /reels/ tab in order (most-recent first).
    // Used for promedioVistaVideos so we always have exactly 5 reels even when
    // the main 5 posts for ER don't contain enough video posts.
    const capturedReelsFeed = [];

    // ── Parsers ──────────────────────────────────────────────────────────────

    function tryUser(json) {
      if (capturedUser) return;
      const user = json?.data?.user ?? json?.graphql?.user;
      if (!user) return;
      const seguidores = user.edge_followed_by?.count ?? user.follower_count;
      if (!seguidores) return;
      capturedUser = {
        nombre: user.full_name || user.username,
        seguidores,
        categoria: user.category_name ?? user.category ?? null,
      };
      resolveUser();
    }

    function tryPosts(json) {
      if (capturedPosts !== undefined) return;

      // Format A: posts nested inside the user object (web_profile_info)
      const user = json?.data?.user ?? json?.graphql?.user;
      if (user) {
        const edges = user.edge_owner_to_timeline_media?.edges;
        // Require non-empty — an empty array would lock out Format B/C.
        if (Array.isArray(edges) && edges.length) {
          capturedPosts = edges.map(e => e?.node).filter(Boolean);
          resolvePosts();
          return;
        }
      }

      // Format B: Instagram graphql timeline connection (newer API)
      // e.g. data.xdt_api__v1__feed__user_timeline_graphql_connection
      const timelineConn = findTimelineConnection(json?.data);
      if (timelineConn) {
        const edges = timelineConn.edges ?? [];
        capturedPosts = edges.map(e => e?.node ?? e).filter(Boolean);
        resolvePosts();
        return;
      }

      // Format C: /api/v1/feed/user/<id>/ → { items: [...] }
      if (Array.isArray(json?.items)) {
        capturedPosts = json.items.filter(Boolean);
        resolvePosts();
        return;
      }
    }

    // Extracts play_count and comment_count from any mobile-feed or clips response.
    // Called even after capturedPosts is set so we can enrich XDT data.
    function tryExtraCounts(json) {
      // Standard mobile feed: { items: [...] }
      const rawItems = json?.items ?? json?.data?.items;
      const directItems = Array.isArray(rawItems) ? rawItems : [];

      // XDT clips tab (reels): data keys like xdt_api__v1__clips__user__connection_v2
      // Scan all keys to handle version suffixes (_v2, _v3, etc.)
      const clipItems = [];
      for (const [key, val] of Object.entries(json?.data ?? {})) {
        if (!key.includes('clips__user__connection')) continue;
        if (!Array.isArray(val?.edges)) continue;
        for (const e of val.edges) {
          // node.media wraps the actual post; fallback to node directly
          const media = e?.node?.media ?? e?.node;
          if (!media) continue;
          clipItems.push(media);
          // Track ordered reel feed for promedioVistaVideos (deduplicate across pages)
          const pk = String(media.pk ?? media.id ?? '').split('_')[0];
          if (pk && !capturedReelsFeed.some(r => String(r.pk ?? r.id ?? '').split('_')[0] === pk)) {
            capturedReelsFeed.push(media);
          }
        }
      }

      [...directItems, ...clipItems].forEach(item => {
        const pk = String(item.pk ?? item.id ?? '').split('_')[0];
        if (!pk) return;
        const views    = item.play_count ?? item.view_count ?? item.video_view_count ?? item.clips_metadata?.ig_play_count;
        const comments = item.comment_count ?? item.edge_media_to_comment?.count;
        if (views    != null) extraByPk[pk] = { ...(extraByPk[pk] ?? {}), views:    Number(views)    };
        if (comments != null) extraByPk[pk] = { ...(extraByPk[pk] ?? {}), comments: Number(comments) };
      });
    }

    function processText(text) {
      if (!text) return;
      const t = text.trimStart();
      if (t[0] !== '{') return;
      try {
        const json = JSON.parse(t);
        tryUser(json);
        tryPosts(json);
        tryExtraCounts(json); // always run — enriches posts captured via XDT
      } catch { /* ignore non-profile JSON */ }
    }

    // ── Strategy 1: route() ──────────────────────────────────────────────────
    // Fires before the service worker cache — guarantees a live network response.
    await page.route('**/*web_profile_info*', async (route) => {
      try {
        const response = await route.fetch();
        processText(await response.text().catch(() => null));
        await route.fulfill({ response });
      } catch {
        await route.continue().catch(() => {});
      }
    });

    // ── Strategy 2: response listener ────────────────────────────────────────
    // Catches feed/graphql endpoints that carry posts or per-post metrics.
    // We no longer bail out early on capturedPosts so that the mobile-feed
    // response (/api/v1/feed/) can still enrich view/comment counts.
    page.on('response', async (res) => {
      const url = res.url();
      if (!url.includes('instagram.com')) return;
      if (
        !url.includes('/api/v1/users/') &&
        !url.includes('/api/v1/feed/') &&
        !url.includes('/api/v1/clips/') &&
        !url.includes('graphql')
      ) return;
      // Skip the heavy processing once user+posts are captured, but still
      // call processText so tryExtraCounts can pick up any view-count payload.
      if (capturedUser && capturedPosts !== undefined) {
        const text = await res.text().catch(() => null);
        if (text?.trimStart()[0] === '{') {
          try { tryExtraCounts(JSON.parse(text)); } catch {}
        }
        return;
      }
      processText(await res.text().catch(() => null));
    });

    const profileUrl = `https://www.instagram.com/${handle}/`;
    await page.goto(profileUrl, { waitUntil: 'load', timeout: NAV_TIMEOUT });

    // Wait up to 20s for the user object (required to proceed)
    await Promise.race([userPromise, new Promise(r => setTimeout(r, 20000))]);

    // If we have the user but no posts yet, give them 10 more seconds
    if (capturedUser && capturedPosts === undefined) {
      await Promise.race([postsPromise, new Promise(r => setTimeout(r, 10000))]);
    }

    // Give the mobile-feed response (/api/v1/feed/) up to 4s to arrive and
    // populate extraByPk with view/comment counts not present in XDT format.
    if (capturedPosts?.length) {
      await new Promise(r => setTimeout(r, 4000));
    }

    // XDT timeline API does not include play_count for Reels. Navigate to the
    // /reels/ tab which triggers the clips endpoint that does include it.
    const hasVideosWithoutViews = (capturedPosts ?? []).some(p =>
      (p.media_type === 2 || p.product_type === 'clips') &&
      p.play_count == null && p.view_count == null && p.video_view_count == null &&
      !extraByPk[String(p.pk ?? p.id ?? '').split('_')[0]]?.views
    );
    if (capturedUser && hasVideosWithoutViews) {
      console.log(`[Kernel] ${handle} — navigating to /reels/ tab to fetch view counts`);
      try {
        await page.goto(`https://www.instagram.com/${handle}/reels/`, {
          waitUntil: 'load',
          timeout: 30000,
        });
        await new Promise(r => setTimeout(r, 6000));
        console.log(`[Kernel] ${handle} — reels tab done | extraByPk keys: ${Object.keys(extraByPk).length}`);
      } catch (err) {
        console.warn(`[Kernel] ${handle} — reels tab navigation failed: ${err.message}`);
      }
    }

    // ── Challenge / login-wall detection ────────────────────────────────────
    const currentUrl = page.url();
    console.log(`[Kernel] ${handle} → URL: ${currentUrl} | user: ${!!capturedUser} | posts: ${capturedPosts?.length ?? 'none yet'}`);

    if (
      currentUrl.includes('/accounts/login') ||
      currentUrl.includes('/login') ||
      currentUrl.includes('/challenge/') ||
      currentUrl.includes('/accounts/suspended')
    ) {
      return { error: 'login_wall', handle };
    }

    // ── Strategy 3: DOM fallback ─────────────────────────────────────────────
    if (!capturedUser) {
      console.log(`[Kernel] Network capture failed for "${handle}" — trying DOM fallback`);
      const fromDom = await extractFromPageContext(page);
      if (fromDom) {
        capturedUser = { nombre: fromDom.nombre, seguidores: fromDom.seguidores, categoria: fromDom.categoria };
        if (fromDom.posts?.length && capturedPosts === undefined) capturedPosts = fromDom.posts;
      }
    }

    if (!capturedUser) {
      const title = await page.title().catch(() => '—');
      console.warn(`[Kernel] data_not_captured for "${handle}" | page title: "${title}"`);
      return { error: 'data_not_captured', handle };
    }

    // Merge any extra counts (view/comment) captured from the mobile feed API
    // into the XDT posts, which often lack these fields.
    const rawPosts = (capturedPosts ?? []).map(p => {
      const pk = String(p.pk ?? p.id ?? '').split('_')[0];
      const extra = pk ? extraByPk[pk] : null;
      if (!extra) return p;
      return {
        ...p,
        ...(extra.views    != null && p.view_count    == null && p.play_count    == null
              ? { play_count: extra.views }    : {}),
        ...(extra.comments != null && p.comment_count == null
              ? { comment_count: extra.comments } : {}),
      };
    });

    // XDT format uses timeline_pinned_user_ids (array of user IDs for whom this post is pinned).
    // Old GraphQL format used pinned_for_universal_grid or is_pinned boolean.
    const allNonPinned = rawPosts.filter(p =>
      !p.pinned_for_universal_grid &&
      !p.is_pinned &&
      !(Array.isArray(p.timeline_pinned_user_ids) && p.timeline_pinned_user_ids.length > 0)
    );

    // Collect up to MAX_POSTS non-pinned posts that have visible like counts.
    // Posts where Instagram hides likes (near-zero likes vs high comments) are skipped
    // so the ER calculation is never distorted by missing data.
    const postsForER = [];
    for (const p of allNonPinned) {
      if (postsForER.length >= MAX_POSTS) break;
      const lc = Number(p.edge_liked_by?.count ?? p.like_count ?? 0);
      const cc = Number(p.edge_media_to_comment?.count ?? p.comment_count ?? 0);
      if (isLikeCountHidden(lc, cc)) {
        console.log(`[Kernel] ${handle} — skipped post pk=${String(p.pk ?? p.id ?? '').split('_')[0]} (likes hidden: lc=${lc}, cc=${cc})`);
        continue;
      }
      postsForER.push(p);
    }

    if (postsForER.length < MAX_POSTS) {
      console.warn(`[Kernel] ${handle} — only ${postsForER.length}/${MAX_POSTS} posts with visible likes found`);
    }

    console.log(`[Kernel] ${handle} — posts for ER: ${postsForER.length} (of ${allNonPinned.length} non-pinned, ${rawPosts.length} total) | extraByPk: ${Object.keys(extraByPk).length}`);
    console.log(`[Kernel] ${handle} — ER posts metrics:`,
      JSON.stringify(postsForER.map((p, i) => ({
        i,
        mt:  p.media_type ?? p.__typename,
        lc:  p.like_count,
        cc:  p.comment_count,
        vc:  p.view_count,
        pc:  p.play_count,
        vvc: p.video_view_count,
      })))
    );

    const engagementRateCuenta = calcEngagementRate(postsForER, capturedUser.seguidores);

    // Avg views uses the last 5 reels from the dedicated /reels/ tab feed,
    // so we always find 5 reels even when they don't appear in the 5 ER posts.
    const reelsForAvgViews = capturedReelsFeed.slice(0, 5);
    const promedioVistaVideos = calcAvgViews(reelsForAvgViews);

    console.log(`[Kernel] ${handle} — ER: ${engagementRateCuenta} | avgViews: ${promedioVistaVideos} (from ${reelsForAvgViews.length} reels) | seguidores: ${capturedUser.seguidores}`);

    return {
      handle,
      nombre:               capturedUser.nombre,
      seguidores:           capturedUser.seguidores,
      engagementRateCuenta,
      promedioVistaVideos,
      categoria:            capturedUser.categoria,
      rangoEdadSeguidores:  null,
    };

  } catch (err) {
    return { error: err.message, handle };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ─── Strategy 3 helper ──────────────────────────────────────────────────────

async function extractFromPageContext(page) {
  try {
    const rawUser = await page.evaluate(() => {
      // Pattern A: window._sharedData (classic Instagram)
      try {
        if (window._sharedData) {
          const u = window._sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
          if (u && (u.edge_followed_by || u.follower_count)) return u;
        }
      } catch { /* not available */ }

      // Pattern B: scan inline <script> tags for a JSON blob containing
      // the follower count field (present across all Instagram API versions)
      for (const script of document.querySelectorAll('script:not([src])')) {
        const text = script.textContent || '';
        if (!text.includes('"edge_followed_by"') && !text.includes('"follower_count"')) continue;

        const marker = text.includes('"edge_followed_by"')
          ? text.indexOf('"edge_followed_by"')
          : text.indexOf('"follower_count"');

        // Walk backwards to find the opening { of the enclosing object
        let depth = 0, start = -1;
        for (let i = marker; i >= 0; i--) {
          if (text[i] === '}') depth++;
          else if (text[i] === '{') {
            if (depth === 0) { start = i; break; }
            depth--;
          }
        }
        if (start === -1) continue;

        // Walk forwards to find the matching closing }
        depth = 0;
        let end = -1;
        for (let i = start; i < text.length; i++) {
          if (text[i] === '{') depth++;
          else if (text[i] === '}') {
            depth--;
            if (depth === 0) { end = i + 1; break; }
          }
        }
        if (end === -1) continue;

        try {
          const obj = JSON.parse(text.slice(start, end));
          if (obj.edge_followed_by?.count || obj.follower_count) return obj;
        } catch { /* malformed JSON fragment */ }
      }

      return null;
    });

    if (!rawUser) return null;

    const seguidores = rawUser.edge_followed_by?.count ?? rawUser.follower_count;
    if (!seguidores) return null;

    const posts = (rawUser.edge_owner_to_timeline_media?.edges ?? [])
      .map(e => e?.node)
      .filter(Boolean);

    return {
      nombre:    rawUser.full_name || rawUser.username,
      seguidores,
      categoria: rawUser.category_name ?? rawUser.category ?? null,
      posts,
    };
  } catch (err) {
    console.warn('[Kernel] DOM fallback error:', err.message);
    return null;
  }
}

// ─── findTimelineConnection ──────────────────────────────────────────────────

/**
 * Instagram's graphql endpoint uses dynamic connection key names that encode
 * the query (e.g. "xdt_api__v1__feed__user_timeline_graphql_connection").
 * Instead of hard-coding the key, scan the data object for any value that
 * looks like a timeline connection (has an `edges` array of post-like nodes).
 */
function findTimelineConnection(data) {
  if (!data || typeof data !== 'object') return null;
  for (const [key, val] of Object.entries(data)) {
    // Only consider keys that describe a user's own timeline (not highlights, clips tab, explore, etc.)
    const lk = key.toLowerCase();
    if (!lk.includes('timeline') && !lk.includes('user_feed')) continue;
    if (val && typeof val === 'object' && Array.isArray(val.edges)) {
      const sample = val.edges[0]?.node ?? val.edges[0];
      if (sample && (sample.like_count != null || sample.edge_liked_by || sample.media_type != null)) {
        return val;
      }
    }
  }
  return null;
}

// ─── Metric calculators ──────────────────────────────────────────────────────

/**
 * Returns true when Instagram is hiding the like count for a post.
 * Signal: likes are near-zero (< 10) while comments are high (> 200), or the
 * likes-to-comments ratio is below 0.5% — statistically impossible for real engagement.
 */
function isLikeCountHidden(likes, comments) {
  if (likes == null) return true;
  if (likes < 10 && comments > 200) return true;
  if (comments > 0 && likes / comments < 0.005) return true;
  return false;
}

/**
 * Engagement rate = (total_likes + total_comments) / (posts × followers) × 100
 * Only receives posts that have already been validated to have visible like counts.
 */
function calcEngagementRate(posts, seguidores) {
  if (!posts.length || !seguidores) return null;

  const totalInteractions = posts.reduce((sum, p) => {
    const likes    = Number(p.edge_liked_by?.count ?? p.like_count    ?? 0);
    const comments = Number(p.edge_media_to_comment?.count ?? p.comment_count ?? 0);
    return sum + likes + comments;
  }, 0);

  return parseFloat(((totalInteractions / posts.length / seguidores) * 100).toFixed(2));
}

/**
 * Average views across video/reel posts.
 * Field priority: video_view_count (old GraphQL) → play_count → view_count →
 *   clips_metadata.ig_play_count (Reels in XDT format, 2024-2025 API).
 * Returns null if no video posts are in the analyzed set.
 */
function calcAvgViews(posts) {
  const videos = posts.filter(p =>
    p.__typename === 'GraphVideo' ||
    p.media_type === 2 ||
    p.is_video === true ||
    p.product_type === 'clips'
  );

  if (!videos.length) return null;

  // Only count videos for which we actually have a view/play count.
  // XDT profile-page API omits view counts; they are populated by the reels-tab
  // navigation via extraByPk → play_count. If none arrived, return null rather than 0.
  const withViews = videos.filter(v =>
    (v.video_view_count ?? v.play_count ?? v.view_count ?? v.clips_metadata?.ig_play_count) != null
  );

  if (!withViews.length) return null;

  const total = withViews.reduce((sum, v) => {
    const views =
      v.video_view_count ??
      v.play_count ??
      v.view_count ??
      v.clips_metadata?.ig_play_count ??
      0;
    return sum + Number(views);
  }, 0);
  return Math.round(total / withViews.length);
}
