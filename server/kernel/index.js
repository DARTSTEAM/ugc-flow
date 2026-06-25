import { BigQuery } from '@google-cloud/bigquery';
import { scrapeInstagramProfile } from './scrapers/instagram-profile.js';
import { scrapeTikTokProfile } from './scrapers/tiktok-profile.js';
import { closeAllBrowsers } from './browser-pool.js';

const bq = new BigQuery({ projectId: 'bigquery-388915' });
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
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
async function withRetry(fn, label) {
  const maxAttempts = MAX_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let result;
    try {
      result = await fn();
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      console.warn(`[Kernel] ${label} — attempt ${attempt}/${maxAttempts} threw: ${err.message} — retrying in ${RETRY_DELAY}ms`);
      await sleep(RETRY_DELAY);
      continue;
    }

    // Terminal errors are never retried
    if (result?.error && TERMINAL_ERRORS.has(result.error)) return result;

    // Success or last attempt — return as-is
    if (result?.ok || attempt >= maxAttempts) return result;

    // Retryable failure
    console.warn(`[Kernel] ${label} — attempt ${attempt}/${maxAttempts} failed (${result.error}) — retrying in ${RETRY_DELAY}ms`);
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
            `TT @${creator.username_tiktok ?? creator.creator_id}`
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

// ─── Private ─────────────────────────────────────────────────────────────────

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
    },
    types: {
      seguidores: 'INT64',
      engagementRate: 'FLOAT64',
      promedioVistas: 'INT64',
      categoria: 'STRING',
    },
    location: 'US',
  });

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
        tiktok_eval_seguidores      = @seguidores,
        tiktok_eval_engagement_rate = @engagementRate,
        tiktok_eval_promedio_vistas = @promedioVistas,
        tiktok_eval_last_scraped_at = CURRENT_TIMESTAMP()
      WHERE creator_id = @id
    `,
    params: {
      id: creator.creator_id,
      seguidores:    data.seguidores   ?? null,
      engagementRate: data.engagementRate ?? null,
      promedioVistas: data.promedioVistas ?? null,
    },
    types: {
      seguidores:    'INT64',
      engagementRate: 'FLOAT64',
      promedioVistas: 'INT64',
    },
    location: 'US',
  });

  return { ok: true };
}
