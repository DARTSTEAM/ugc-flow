/**
 * Score service — reads evaluation data from BigQuery, calculates the score,
 * and persists it back to creators.score and creator_scores table.
 *
 * Exported and called by both server/index.js (after manual evaluation saves)
 * and server/kernel/index.js (after scrapes).
 */
import { BigQuery } from '@google-cloud/bigquery';
import { calcularScore } from './score-calculator.js';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

function q(sql, params, types) {
  return bq.query({ query: sql, params, types, location: 'US' }).then(([rows]) => rows);
}

/**
 * Fetches the creator's full evaluation data, calculates the score,
 * writes it to creators.score and replaces creator_scores rows.
 *
 * @param {string} creatorId
 * @returns {{ total: number, breakdown: Array<{criterio, puntos, maximo}> } | null}
 */
export async function recalcularScore(creatorId) {
  const rows = await q(
    `SELECT
       eval_perfil_seguidores,
       eval_perfil_engagement_rate_cuenta,
       eval_perfil_frecuencia_semanal,
       eval_perfil_videos_virales,
       tiktok_eval_seguidores,
       tiktok_eval_engagement_rate,
       tiktok_eval_frecuencia_semanal,
       tiktok_eval_videos_virales,
       eval_pauta_cpm,
       eval_pauta_ctr,
       eval_pauta_vtr,
       eval_pauta_vistas,
       eval_pauta_er
     FROM ${DATASET}.creators WHERE creator_id = @id`,
    { id: creatorId }
  );

  if (!rows.length) return null;
  const c = rows[0];

  // Prefer Instagram data; fall back to TikTok when Instagram scrape not done
  const seguidores = c.eval_perfil_seguidores != null
    ? Number(c.eval_perfil_seguidores)
    : c.tiktok_eval_seguidores != null ? Number(c.tiktok_eval_seguidores) : null;

  const engagementRateCuenta = c.eval_perfil_engagement_rate_cuenta != null
    ? Number(c.eval_perfil_engagement_rate_cuenta)
    : c.tiktok_eval_engagement_rate != null ? Number(c.tiktok_eval_engagement_rate) : null;

  const frecuenciaSemanal = c.eval_perfil_frecuencia_semanal != null
    ? Number(c.eval_perfil_frecuencia_semanal)
    : c.tiktok_eval_frecuencia_semanal != null ? Number(c.tiktok_eval_frecuencia_semanal) : null;

  // Sum viral videos across both platforms
  const videosVirales =
    (c.eval_perfil_videos_virales != null ? Number(c.eval_perfil_videos_virales) : 0) +
    (c.tiktok_eval_videos_virales  != null ? Number(c.tiktok_eval_videos_virales)  : 0);

  const { total, breakdown } = calcularScore({
    seguidores,
    engagementRateCuenta,
    frecuenciaSemanal,
    videosVirales,
    cpm:     c.eval_pauta_cpm  != null ? Number(c.eval_pauta_cpm)  : null,
    ctr:     c.eval_pauta_ctr  != null ? Number(c.eval_pauta_ctr)  : null,
    vtr:     c.eval_pauta_vtr  != null ? Number(c.eval_pauta_vtr)  : null,
    vistas:  c.eval_pauta_vistas != null ? Number(c.eval_pauta_vistas) : null,
    erPauta: c.eval_pauta_er   != null ? Number(c.eval_pauta_er)   : null,
  });

  // Persist total score
  await q(
    `UPDATE ${DATASET}.creators SET score = @score, updated_at = CURRENT_TIMESTAMP() WHERE creator_id = @id`,
    { id: creatorId, score: total },
    { score: 'INT64' }
  );

  // Replace breakdown rows
  await q(`DELETE FROM ${DATASET}.creator_scores WHERE creator_id = @id`, { id: creatorId });

  for (const [i, b] of breakdown.entries()) {
    await q(
      `INSERT INTO ${DATASET}.creator_scores (id, creator_id, brand_id, criterio, puntos, maximo, orden)
       VALUES (SUBSTR(GENERATE_UUID(), 1, 8), @creatorId, 'popeyes', @criterio, @puntos, @maximo, @orden)`,
      { creatorId, criterio: b.criterio, puntos: b.puntos, maximo: b.maximo, orden: i },
      { puntos: 'INT64', maximo: 'INT64', orden: 'INT64' }
    );
  }

  return { total, breakdown };
}
