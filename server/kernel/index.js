import { BigQuery } from '@google-cloud/bigquery';
import { scrapeInstagramProfile } from './scrapers/instagram-profile.js';
import { scrapeTikTokProfile } from './scrapers/tiktok-profile.js';
import { scrapeContentPost, detectPlatform } from './scrapers/content-post.js';
import { closeAllBrowsers, closeBrowser } from './browser-pool.js';
import { recalcularScore } from '../score-service.js';
import { analyzeSentiment } from '../sentiment-service.js';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';
const BATCH_SIZE = 5;

// ─── Retry config ─────────────────────────────────────────────────────────────

const MAX_RETRIES   = 2;       // up to 3 total attempts per creator
const RETRY_DELAY   = 5000;    // ms between retries

// These errors signal a permanent condition — retrying won't change the outcome
const TERMINAL_ERRORS = new Set([
  'login_wall',        // platform redirected to login — session must be refreshed manually
  'no_username',       // creator has no username in BQ — data issue, not transient
  'no_username_tiktok',
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Executes fn() up to MAX_RETRIES + 1 times.
 * Retries on thrown exceptions AND on { ok: false, error } unless the error
 * is in TERMINAL_ERRORS. Each retry waits RETRY_DELAY ms.
 *
 * @param {() => Promise<{ok:boolean, error?:string}>} fn
 * @param {string} label — shown in logs
 * @param {() => Promise<void>} [onRetry] — optional cleanup called before each retry
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
async function withRetry(fn, label, onRetry) {
  const maxAttempts = MAX_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let result;
    try {
      result = await fn();
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      console.warn(`[Kernel] ${label} — attempt ${attempt}/${maxAttempts} threw: ${err.message} — retrying in ${RETRY_DELAY}ms`);
      if (onRetry) await onRetry().catch(() => {});
      await sleep(RETRY_DELAY);
      continue;
    }

    // Terminal errors are never retried
    if (result?.error && TERMINAL_ERRORS.has(result.error)) return result;

    // Success or last attempt — return as-is
    if (result?.ok || attempt >= maxAttempts) return result;

    // Retryable failure — reset browser before next attempt so it's a clean session
    console.warn(`[Kernel] ${label} — attempt ${attempt}/${maxAttempts} failed (${result.error}) — retrying in ${RETRY_DELAY}ms`);
    if (onRetry) await onRetry().catch(() => {});
    await sleep(RETRY_DELAY);
  }
}

/**
 * Scrapes Instagram profiles for a list of creator IDs and writes the
 * resulting eval_perfil_* metrics back to BigQuery.
 *
 * Only creators with platform = 'Instagram' (or no platform set) are processed.
 * Creators are processed in parallel batches of BATCH_SIZE to avoid overloading Kernel.
 *
 * @param {string[]} creatorIds
 * @returns {{ success: string[], failed: Array<{id, reason}>, durationMs: number }}
 */
export async function scrapeCreatorProfiles(creatorIds) {
  if (!creatorIds.length) return { success: [], failed: [], durationMs: 0 };

  const start = Date.now();

  // Fetch creator handles from BigQuery
  const placeholders = creatorIds.map((_, i) => `@id${i}`).join(', ');
  const params = Object.fromEntries(creatorIds.map((id, i) => [`id${i}`, id]));

  const [rows] = await bq.query({
    query: `SELECT creator_id, username, platform FROM ${DATASET}.creators WHERE creator_id IN (${placeholders})`,
    params,
    location: 'US',
  });

  // Filter to Instagram only (platform field may be null for older records)
  const targets = rows.filter(r => {
    const p = (r.platform ?? '').toLowerCase();
    return !p || p.includes('instagram');
  });

  const success = [];
  const failed = [];

  try {
    // Process in batches
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(creator =>
          withRetry(
            () => scrapeAndSaveInstagram(creator),
            `IG @${creator.username ?? creator.creator_id}`
          )
        )
      );

      results.forEach((result, j) => {
        const creator = batch[j];
        if (result.status === 'fulfilled' && result.value?.ok) {
          success.push(creator.creator_id);
        } else {
          const reason =
            result.status === 'rejected'
              ? result.reason?.message
              : result.value?.error ?? 'unknown';
          console.error(`[Kernel] Failed for ${creator.creator_id} (${creator.username}):`, reason);
          failed.push({ id: creator.creator_id, reason });
        }
      });
    }
  } finally {
    await closeAllBrowsers();
  }

  return { success, failed, durationMs: Date.now() - start };
}

/**
 * Scrapes TikTok profiles for a list of creator IDs and writes the
 * resulting tiktok_eval_* metrics back to BigQuery.
 *
 * Only processes creators that have username_tiktok set.
 *
 * @param {string[]} creatorIds
 * @returns {{ success: string[], failed: Array<{id, reason}>, durationMs: number }}
 */
export async function scrapeTikTokProfiles(creatorIds) {
  if (!creatorIds.length) return { success: [], failed: [], durationMs: 0 };

  const start = Date.now();

  const placeholders = creatorIds.map((_, i) => `@id${i}`).join(', ');
  const params = Object.fromEntries(creatorIds.map((id, i) => [`id${i}`, id]));

  const [rows] = await bq.query({
    query: `SELECT creator_id, username_tiktok FROM ${DATASET}.creators WHERE creator_id IN (${placeholders})`,
    params,
    location: 'US',
  });

  // Only process creators that have a TikTok handle
  const targets = rows.filter(r => r.username_tiktok);

  if (!targets.length) {
    return { success: [], failed: [], durationMs: Date.now() - start };
  }

  const success = [];
  const failed = [];

  try {
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(creator =>
          withRetry(
            () => scrapeAndSaveTikTok(creator),
            `TT @${creator.username_tiktok ?? creator.creator_id}`,
            () => closeBrowser('tiktok')   // fresh Kernel session before each retry
          )
        )
      );

      results.forEach((result, j) => {
        const creator = batch[j];
        if (result.status === 'fulfilled' && result.value?.ok) {
          success.push(creator.creator_id);
        } else {
          const reason =
            result.status === 'rejected'
              ? result.reason?.message
              : result.value?.error ?? 'unknown';
          console.error(`[Kernel/TikTok] Failed for ${creator.creator_id} (@${creator.username_tiktok}):`, reason);
          failed.push({ id: creator.creator_id, reason });
        }
      });
    }
  } finally {
    await closeAllBrowsers();
  }

  return { success, failed, durationMs: Date.now() - start };
}

/**
 * Scrapea las métricas públicas de cada pieza de contenido cargada para una campaña
 * y las escribe en `campaign_content`. La atribución ya está resuelta (cada fila
 * tiene la URL exacta del posteo), así que esto sólo lee stats por permalink.
 *
 * De paso, junta los últimos 10 comentarios de CADA posteo en una única lista
 * global (sin distinguir creador/posteo de origen) y la manda a analyzeSentiment()
 * para recalcular el sentimiento de la campaña.
 *
 * @param {string} campaignId
 * @returns {{ success: string[], failed: Array<{id, reason}>, durationMs: number, sentiment: object|null }}
 */
export async function scrapeCampaignContent(campaignId) {
  const start = Date.now();

  const [rows] = await bq.query({
    query: `SELECT content_id, content_url, platform FROM ${DATASET}.campaign_content WHERE campaign_id = @campaignId`,
    params: { campaignId },
    location: 'US',
  });

  if (!rows.length) return { success: [], failed: [], durationMs: 0, sentiment: null };

  const success = [];
  const failed = [];
  const allCommentTexts = [];

  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(piece =>
          withRetry(
            () => scrapeAndSaveContent(piece),
            `CONTENT ${piece.content_url}`,
            () => closeBrowser(detectPlatform(piece.content_url) ?? 'instagram')
          )
        )
      );

      results.forEach((result, j) => {
        const piece = batch[j];
        if (result.status === 'fulfilled' && result.value?.ok) {
          success.push(piece.content_id);
          if (result.value.commentTexts?.length) allCommentTexts.push(...result.value.commentTexts);
        } else {
          const reason = result.status === 'rejected'
            ? result.reason?.message
            : result.value?.error ?? 'unknown';
          console.error(`[Kernel/Content] Failed for ${piece.content_id} (${piece.content_url}):`, reason);
          failed.push({ id: piece.content_id, reason });
        }
      });
    }
  } finally {
    await closeAllBrowsers();
  }

  let sentiment = null;
  try {
    sentiment = await analyzeSentiment(campaignId, allCommentTexts);
  } catch (err) {
    console.error('[Kernel/Content] Sentiment analysis failed:', err.message);
  }

  return { success, failed, durationMs: Date.now() - start, sentiment };
}

// ─── Private ─────────────────────────────────────────────────────────────────

async function scrapeAndSaveContent(piece) {
  const data = await scrapeContentPost(piece.content_url);

  if (data.error) {
    // Persistir el error para mostrarlo en la UI sin romper el agregado
    await bq.query({
      query: `UPDATE ${DATASET}.campaign_content
              SET scrape_error = @err, updated_at = CURRENT_TIMESTAMP()
              WHERE content_id = @id`,
      params: { id: piece.content_id, err: data.error },
      location: 'US',
    }).catch(() => {});
    return { ok: false, error: data.error };
  }

  const interacciones =
    (data.likes ?? 0) + (data.comments ?? 0) + (data.shares ?? 0) + (data.saves ?? 0);
  const er = data.views > 0
    ? parseFloat(((interacciones / data.views) * 100).toFixed(2))
    : null;

  await bq.query({
    query: `
      UPDATE ${DATASET}.campaign_content SET
        org_views           = @views,
        org_likes           = @likes,
        org_comments        = @comments,
        org_shares          = @shares,
        org_saves           = @saves,
        org_engagement_rate = @er,
        org_last_scraped_at = CURRENT_TIMESTAMP(),
        scrape_error        = NULL,
        updated_at          = CURRENT_TIMESTAMP()
      WHERE content_id = @id
    `,
    params: {
      id:       piece.content_id,
      views:    data.views    ?? null,
      likes:    data.likes    ?? null,
      comments: data.comments ?? null,
      shares:   data.shares   ?? null,
      saves:    data.saves    ?? null,
      er,
    },
    types: {
      views: 'INT64', likes: 'INT64', comments: 'INT64',
      shares: 'INT64', saves: 'INT64', er: 'FLOAT64',
    },
    location: 'US',
  });

  return { ok: true, commentTexts: data.commentTexts ?? [] };
}

async function scrapeAndSaveInstagram(creator) {
  if (!creator.username) {
    return { ok: false, error: 'no_username' };
  }

  const data = await scrapeInstagramProfile(creator.username);

  if (data.error) {
    return { ok: false, error: data.error };
  }

  await bq.query({
    query: `
      UPDATE ${DATASET}.creators SET
        eval_perfil_nombre                 = @nombre,
        eval_perfil_handle                 = @handle,
        eval_perfil_seguidores             = @seguidores,
        eval_perfil_engagement_rate_cuenta = @engagementRate,
        eval_perfil_promedio_vistas        = @promedioVistas,
        eval_perfil_categoria              = @categoria,
        eval_perfil_rango_edad_seguidores  = NULL,
        eval_perfil_frecuencia_semanal     = @frecuenciaSemanal,
        eval_perfil_videos_virales         = @videosVirales,
        eval_perfil_last_scraped_at        = CURRENT_TIMESTAMP()
      WHERE creator_id = @id
    `,
    params: {
      id: creator.creator_id,
      nombre: data.nombre ?? creator.username,
      handle: data.handle,
      seguidores: data.seguidores ?? null,
      engagementRate: data.engagementRateCuenta ?? null,
      promedioVistas: data.promedioVistaVideos ?? null,
      categoria: data.categoria ?? null,
      frecuenciaSemanal: data.frecuenciaSemanal ?? null,
      videosVirales: data.videosVirales ?? null,
    },
    types: {
      seguidores: 'INT64',
      engagementRate: 'FLOAT64',
      promedioVistas: 'INT64',
      categoria: 'STRING',
      frecuenciaSemanal: 'FLOAT64',
      videosVirales: 'INT64',
    },
    location: 'US',
  });

  await recalcularScore(creator.creator_id).catch(err =>
    console.warn(`[Kernel] score recalc failed for ${creator.creator_id}:`, err.message)
  );

  return { ok: true };
}

async function scrapeAndSaveTikTok(creator) {
  if (!creator.username_tiktok) {
    return { ok: false, error: 'no_username_tiktok' };
  }

  const data = await scrapeTikTokProfile(creator.username_tiktok);

  if (data.error) {
    return { ok: false, error: data.error };
  }

  await bq.query({
    query: `
      UPDATE ${DATASET}.creators SET
        tiktok_eval_seguidores         = @seguidores,
        tiktok_eval_engagement_rate    = @engagementRate,
        tiktok_eval_promedio_vistas    = @promedioVistas,
        tiktok_eval_frecuencia_semanal = @frecuenciaSemanal,
        tiktok_eval_videos_virales     = @videosVirales,
        tiktok_eval_last_scraped_at    = CURRENT_TIMESTAMP()
      WHERE creator_id = @id
    `,
    params: {
      id: creator.creator_id,
      seguidores:       data.seguidores        ?? null,
      engagementRate:   data.engagementRate    ?? null,
      promedioVistas:   data.promedioVistas    ?? null,
      frecuenciaSemanal: data.frecuenciaSemanal ?? null,
      videosVirales:    data.videosVirales     ?? null,
    },
    types: {
      seguidores:        'INT64',
      engagementRate:    'FLOAT64',
      promedioVistas:    'INT64',
      frecuenciaSemanal: 'FLOAT64',
      videosVirales:     'INT64',
    },
    location: 'US',
  });

  await recalcularScore(creator.creator_id).catch(err =>
    console.warn(`[Kernel/TikTok] score recalc failed for ${creator.creator_id}:`, err.message)
  );

  return { ok: true };
}
