import { BigQuery } from '@google-cloud/bigquery';
import { scrapeInstagramProfile } from './scrapers/instagram-profile.js';
import { scrapeTikTokProfile } from './scrapers/tiktok-profile.js';
import { scrapeContentPost, detectPlatform } from './scrapers/content-post.js';
import { buildGoogleDork, searchProfiles } from './scrapers/google-search.js';
import { closeAllBrowsers, closeBrowser } from './browser-pool.js';
import { evaluateProspecto } from './prospect-ai.js';
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
 * Refresh on-demand para Recomendaciones: re-scrapea el watchlist (Activo / En
 * Negociación / Inactivo) y guarda una foto fechada de sus métricas en
 * creator_metric_snapshots, además de actualizar creators como siempre.
 *
 * IG y TikTok corren SECUENCIALMENTE, no en paralelo: scrapeCreatorProfiles y
 * scrapeTikTokProfiles llaman closeAllBrowsers() en su `finally`, y esa función
 * cierra TODOS los browsers del pool (no sólo el de la plataforma que terminó) —
 * correrlos en paralelo mataría la sesión del otro a mitad de scrape.
 *
 * @param {string[]} creatorIds
 * @param {string} runId
 * @returns {{ igResult: object, ttResult: object, snapshotted: string[] }}
 */
export async function refreshWatchlistSnapshots(creatorIds, runId) {
  console.log(`[Recomendaciones/Kernel] run ${runId} — refreshWatchlistSnapshots(${creatorIds.length} creadores)`);
  if (!creatorIds.length) return { igResult: null, ttResult: null, snapshotted: [] };

  console.log(`[Recomendaciones/Kernel] run ${runId} — scrapeando Instagram (secuencial, 1/2)...`);
  const igResult = await scrapeCreatorProfiles(creatorIds);
  console.log(`[Recomendaciones/Kernel] run ${runId} — Instagram listo: success=${igResult.success.length} failed=${igResult.failed.length} (${igResult.durationMs}ms)`);

  console.log(`[Recomendaciones/Kernel] run ${runId} — scrapeando TikTok (secuencial, 2/2)...`);
  const ttResult = await scrapeTikTokProfiles(creatorIds);
  console.log(`[Recomendaciones/Kernel] run ${runId} — TikTok listo: success=${ttResult.success.length} failed=${ttResult.failed.length} (${ttResult.durationMs}ms)`);

  const succeeded = [...new Set([...igResult.success, ...ttResult.success])];
  console.log(`[Recomendaciones/Kernel] run ${runId} — ${succeeded.length} creadores con al menos una plataforma exitosa:`, succeeded);
  if (!succeeded.length) return { igResult, ttResult, snapshotted: [] };

  const placeholders = succeeded.map((_, i) => `@id${i}`).join(', ');
  const params = Object.fromEntries(succeeded.map((id, i) => [`id${i}`, id]));

  const [rows] = await bq.query({
    query: `
      SELECT creator_id,
             eval_perfil_seguidores, eval_perfil_engagement_rate_cuenta, eval_perfil_promedio_vistas,
             eval_perfil_frecuencia_semanal, eval_perfil_videos_virales,
             tiktok_eval_seguidores, tiktok_eval_engagement_rate, tiktok_eval_promedio_vistas,
             tiktok_eval_frecuencia_semanal, tiktok_eval_videos_virales,
             score
      FROM ${DATASET}.creators WHERE creator_id IN (${placeholders})
    `,
    params,
    location: 'US',
  });

  const snapshotted = [];
  for (const r of rows) {
    const snapshotId = `snp_${runId}_${r.creator_id}`;
    await bq.query({
      query: `
        INSERT INTO ${DATASET}.creator_metric_snapshots (
          snapshot_id, run_id, creator_id, captured_at,
          ig_seguidores, ig_engagement_rate, ig_promedio_vistas, ig_frecuencia_semanal, ig_videos_virales,
          tt_seguidores, tt_engagement_rate, tt_promedio_vistas, tt_frecuencia_semanal, tt_videos_virales,
          score, created_at
        ) VALUES (
          @snapshotId, @runId, @creatorId, CURRENT_TIMESTAMP(),
          @igSeguidores, @igEr, @igVistas, @igFrecuencia, @igVirales,
          @ttSeguidores, @ttEr, @ttVistas, @ttFrecuencia, @ttVirales,
          @score, CURRENT_TIMESTAMP()
        )
      `,
      params: {
        snapshotId, runId, creatorId: r.creator_id,
        igSeguidores: r.eval_perfil_seguidores ?? null,
        igEr: r.eval_perfil_engagement_rate_cuenta ?? null,
        igVistas: r.eval_perfil_promedio_vistas ?? null,
        igFrecuencia: r.eval_perfil_frecuencia_semanal ?? null,
        igVirales: r.eval_perfil_videos_virales ?? null,
        ttSeguidores: r.tiktok_eval_seguidores ?? null,
        ttEr: r.tiktok_eval_engagement_rate ?? null,
        ttVistas: r.tiktok_eval_promedio_vistas ?? null,
        ttFrecuencia: r.tiktok_eval_frecuencia_semanal ?? null,
        ttVirales: r.tiktok_eval_videos_virales ?? null,
        score: r.score ?? null,
      },
      types: {
        igSeguidores: 'INT64', igEr: 'FLOAT64', igVistas: 'INT64', igFrecuencia: 'FLOAT64', igVirales: 'INT64',
        ttSeguidores: 'INT64', ttEr: 'FLOAT64', ttVistas: 'INT64', ttFrecuencia: 'FLOAT64', ttVirales: 'INT64',
        score: 'INT64',
      },
      location: 'US',
    });
    snapshotted.push(r.creator_id);
    console.log(`[Recomendaciones/Kernel] run ${runId} — snapshot guardado para ${r.creator_id} (${snapshotId})`);
  }

  console.log(`[Recomendaciones/Kernel] run ${runId} — listo, ${snapshotted.length}/${creatorIds.length} snapshots guardados`);
  return { igResult, ttResult, snapshotted };
}

/**
 * Scrapea las métricas públicas de cada pieza de contenido cargada para una campaña
 * y las escribe en `campaign_content`. La atribución ya está resuelta (cada fila
 * tiene la URL exacta del posteo), así que esto sólo lee stats por permalink.
 *
 * De paso, junta los últimos 10 comentarios de CADA posteo, tagueados con el
 * creator_id del posteo de origen, y los manda a analyzeSentiment() para
 * recalcular el sentimiento de la campaña (agregado global) y por creador.
 *
 * @param {string} campaignId
 * @returns {{ success: string[], failed: Array<{id, reason}>, durationMs: number, sentiment: object|null }}
 */
export async function scrapeCampaignContent(campaignId) {
  const start = Date.now();

  const [rows] = await bq.query({
    query: `SELECT content_id, content_url, platform, creator_id FROM ${DATASET}.campaign_content WHERE campaign_id = @campaignId`,
    params: { campaignId },
    location: 'US',
  });

  if (!rows.length) return { success: [], failed: [], durationMs: 0, sentiment: null };

  const success = [];
  const failed = [];
  const commentItems = [];

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
          if (result.value.commentTexts?.length) {
            for (const text of result.value.commentTexts) {
              commentItems.push({ creatorId: piece.creator_id, text });
            }
          }
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
    sentiment = await analyzeSentiment(campaignId, commentItems);
  } catch (err) {
    console.error('[Kernel/Content] Sentiment analysis failed:', err.message);
  }

  return { success, failed, durationMs: Date.now() - start, sentiment };
}

// Normaliza la respuesta de cada analizador de plataforma a un shape común de prospecto.
const PLATFORM_ADAPTERS = {
  instagram: {
    analyze: scrapeInstagramProfile,
    toProspecto: (username, data) => ({
      username,
      platform: 'instagram',
      profileUrl: `https://www.instagram.com/${username}/`,
      nombre: data.nombre,
      seguidores: data.seguidores ?? 0,
      bio: data.bio ?? null,
      externalUrl: data.externalUrl ?? null,
      engagementRate: data.engagementRateCuenta,
      promedioVistas: data.promedioVistaVideos,
      categoria: data.categoria,
      frecuenciaSemanal: data.frecuenciaSemanal,
      videosVirales: data.videosVirales,
    }),
  },
  tiktok: {
    analyze: scrapeTikTokProfile,
    toProspecto: (username, data) => ({
      username,
      platform: 'tiktok',
      profileUrl: `https://www.tiktok.com/@${username}`,
      nombre: data.nombre,
      seguidores: data.seguidores ?? 0,
      bio: data.bio ?? null,
      externalUrl: data.bioLink ?? null,
      engagementRate: data.engagementRate,
      promedioVistas: data.promedioVistas,
      categoria: null,
      frecuenciaSemanal: data.frecuenciaSemanal,
      videosVirales: data.videosVirales,
    }),
  },
};

/**
 * Prospección inteligente: busca creadores (Instagram o TikTok, según
 * `platform`) en Google Dorking a partir de un nicho/locación, analiza cada
 * candidato reutilizando scrapeInstagramProfile()/scrapeTikTokProfile() (los
 * mismos analizadores que usa el resto del sistema, sin escribir a BigQuery —
 * estos creadores todavía no existen en la base) y se queda con los que caen
 * dentro del rango de seguidores pedido.
 *
 * Cada aprobado pasa además por evaluateProspecto() (prospect-ai.js), que
 * juzga afinidad de nicho a partir de bio/categoría y busca un email de
 * contacto (bio o, si no está ahí, siguiendo un salto al link externo de la
 * bio) reutilizando la misma sesión de Kernel — nunca lanza, así que un fallo
 * ahí sólo deja esos campos en null sin frenar la prospección.
 *
 * Se detiene apenas junta `targetQuantity` aprobados o se queda sin candidatos.
 * Nunca lanza: si Google bloquea la búsqueda (captcha) o la plataforma bloquea
 * un perfil puntual, sigue con el resto y devuelve lo que haya logrado juntar.
 *
 * @param {{ niche: string, location?: string, minFollowers?: number, maxFollowers?: number, targetQuantity?: number, platform?: 'instagram'|'tiktok' }} params
 * @returns {{ query: string, platform: string, googleBlocked: boolean, totalCandidates: number, approved: object[], discarded: object[], errors: Array<{username?:string, stage?:string, reason:string}> }}
 *   Cada `approved[i]` incluye, además de los campos de perfil, `email` (string|null) y
 *   `nicheFit`/`nicheFitReason` (boolean|null, string|null) de la evaluación IA.
 */
export async function prospectCreators({ niche, location, minFollowers, maxFollowers, targetQuantity, platform }) {
  if (!niche) throw new Error('niche es requerido');

  const platformKey = PLATFORM_ADAPTERS[platform] ? platform : 'instagram';
  const adapter = PLATFORM_ADAPTERS[platformKey];

  const target = Number(targetQuantity) > 0 ? Number(targetQuantity) : 10;
  const min = minFollowers != null && minFollowers !== '' ? Number(minFollowers) : null;
  const max = maxFollowers != null && maxFollowers !== '' ? Number(maxFollowers) : null;

  const query = buildGoogleDork({ niche, location, platform: platformKey });
  console.log(`[Prospecting] iniciando (${platformKey}) — query: "${query}" | target: ${target} | rango seguidores: ${min ?? '-'}–${max ?? '-'}`);

  const approved = [];
  const discarded = [];
  const errors = [];
  let usernames = [];
  let googleBlocked = false;

  try {
    const searchResult = await searchProfiles(query, { platform: platformKey, maxResults: target * 3 });
    usernames = searchResult.usernames;
    googleBlocked = searchResult.blocked;
    if (searchResult.error) errors.push({ stage: 'google_search', reason: searchResult.error });

    for (let i = 0; i < usernames.length && approved.length < target; i++) {
      const username = usernames[i];
      if (i > 0) await sleep(3000 + Math.random() * 4000); // 3-7s entre perfiles

      try {
        const data = await adapter.analyze(username);

        if (data.error) {
          console.warn(`[Prospecting] @${username} (${platformKey}) — scrape falló: ${data.error}`);
          errors.push({ username, reason: data.error });
          // login_wall implica que la sesión quedó pisada — arrancar limpia en el próximo intento
          if (data.error === 'login_wall') await closeBrowser(platformKey).catch(() => {});
          continue;
        }

        const prospecto = adapter.toProspecto(username, data);
        const seguidores = prospecto.seguidores;
        const enRango = (min == null || seguidores >= min) && (max == null || seguidores <= max);

        if (enRango) {
          const { email, nicheFit, nicheFitReason } = await evaluateProspecto({
            platform: platformKey,
            niche,
            bio: prospecto.bio,
            categoria: prospecto.categoria,
            externalUrl: prospecto.externalUrl,
          }).catch(err => {
            console.warn(`[Prospecting] @${username} — evaluación IA falló: ${err.message}`);
            return { email: null, nicheFit: null, nicheFitReason: null };
          });

          approved.push({ ...prospecto, email, nicheFit, nicheFitReason });
          console.log(`[Prospecting] ✓ @${username} aprobado (${seguidores} seguidores, nicheFit=${nicheFit}) — ${approved.length}/${target}`);
        } else {
          discarded.push({ ...prospecto, motivo: 'fuera_de_rango_seguidores' });
          console.log(`[Prospecting] ✗ @${username} fuera de rango (${seguidores} seguidores)`);
        }
      } catch (err) {
        console.error(`[Prospecting] @${username} — error inesperado:`, err.message);
        errors.push({ username, reason: err.message });
      }
    }
  } finally {
    await closeAllBrowsers().catch(() => {});
  }

  console.log(`[Prospecting] listo (${platformKey}) — ${approved.length} aprobados, ${discarded.length} descartados, ${errors.length} errores (de ${usernames.length} candidatos)`);

  return {
    query,
    platform: platformKey,
    googleBlocked,
    totalCandidates: usernames.length,
    approved,
    discarded,
    errors,
  };
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
