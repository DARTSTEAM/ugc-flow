import { BigQuery } from '@google-cloud/bigquery';
import { scrapeInstagramProfile } from './scrapers/instagram-profile.js';
import { closeAllBrowsers } from './browser-pool.js';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';
const BATCH_SIZE = 5;

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
        batch.map(creator => scrapeAndSave(creator))
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

// ─── Private ─────────────────────────────────────────────────────────────────

async function scrapeAndSave(creator) {
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
    // BigQuery requires explicit types for parameters that may be null
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
