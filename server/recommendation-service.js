/**
 * Recomendaciones — a diferencia del resto de la app, esto no es un espejo
 * 1:1 de una tabla: cruza creators + campaign_content + campaign_creators +
 * brands para producir 3 secciones reales:
 *
 *  - Fórmula ganadora por marca: perfil de los creadores con mejor ER real
 *    en campaign_content para esa marca, matcheado contra candidatos Pendiente
 *    que nunca trabajaron con ella.
 *  - En alza (momentum): stub hasta que exista creator_metric_snapshots (Fase 2).
 *  - Ex-colaboradores mejorado: creators.estado='Inactivo', rankeados por
 *    performance real en campaign_content en vez de sólo "trabajó una vez".
 */
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

function q(sql, params, types) {
  return bq.query({ query: sql, params, types, location: 'US' }).then(([rows]) => rows);
}

function parseEtiquetas(json) {
  try { return JSON.parse(json || '[]'); } catch { return []; }
}

// ─── Tiers de seguidores (mismos cortes que score-calculator.js scoreSeguidores) ──
const SEGUIDORES_TIERS = [
  { min: 100_000, label: '100k+' },
  { min: 50_000, label: '50k-100k' },
  { min: 20_000, label: '20k-50k' },
  { min: 10_000, label: '10k-20k' },
  { min: 0, label: '0-10k' },
];

function tierDe(seguidores) {
  if (seguidores == null) return null;
  return SEGUIDORES_TIERS.find(t => seguidores >= t.min).label;
}

function seguidoresDe(c) {
  if (c.eval_perfil_seguidores != null) return Number(c.eval_perfil_seguidores);
  if (c.tiktok_eval_seguidores != null) return Number(c.tiktok_eval_seguidores);
  return null;
}

// ─── Umbrales editoriales (valores iniciales, ajustar con uso real — ver plan) ──
const MIN_CREADORES_PARA_PERFIL = 3;   // marcas con menos posteos atribuidos se omiten este ciclo
const TOP_PERFORMERS_POR_MARCA = 3;
const MAX_RECOMENDADOS_POR_MARCA = 5;
const SIMILARITY_MIN_THRESHOLD = 20;   // score de similitud mínimo para aparecer

/** Sección "Fórmula ganadora por marca". */
async function getFormulaGanadora() {
  const [creators, brands, contentRows, ccRows] = await Promise.all([
    q(`
      SELECT creator_id, full_name, username, score, seguidores_display, etiquetas, estado,
             eval_perfil_categoria, eval_perfil_seguidores, tiktok_eval_seguidores
      FROM ${DATASET}.creators
    `),
    q(`SELECT brand_id, name FROM ${DATASET}.brands`),
    q(`
      SELECT cc.creator_id, camp.brand_id, cc.org_engagement_rate
      FROM ${DATASET}.campaign_content cc
      JOIN ${DATASET}.campaigns camp ON cc.campaign_id = camp.campaign_id
      WHERE cc.org_engagement_rate IS NOT NULL
    `),
    q(`SELECT DISTINCT creator_id, brand_id FROM ${DATASET}.campaign_creators`),
  ]);

  const creatorById = new Map(creators.map(c => [c.creator_id, c]));
  const brandNameById = new Map(brands.map(b => [b.brand_id, b.name]));

  const triedBrandsByCreator = new Map();
  ccRows.forEach(r => {
    if (!triedBrandsByCreator.has(r.creator_id)) triedBrandsByCreator.set(r.creator_id, new Set());
    triedBrandsByCreator.get(r.creator_id).add(r.brand_id);
  });

  const byBrand = new Map();
  contentRows.forEach(r => {
    if (!byBrand.has(r.brand_id)) byBrand.set(r.brand_id, new Map());
    const byCreator = byBrand.get(r.brand_id);
    if (!byCreator.has(r.creator_id)) byCreator.set(r.creator_id, []);
    byCreator.get(r.creator_id).push(Number(r.org_engagement_rate));
  });

  const resultado = [];

  for (const [brandId, byCreator] of byBrand.entries()) {
    if (byCreator.size < MIN_CREADORES_PARA_PERFIL) continue; // muestra insuficiente para esta marca

    const promedios = [...byCreator.entries()]
      .map(([creatorId, ers]) => ({ creatorId, avgEr: ers.reduce((a, b) => a + b, 0) / ers.length }))
      .sort((a, b) => b.avgEr - a.avgEr);

    const topPerformers = promedios
      .slice(0, TOP_PERFORMERS_POR_MARCA)
      .map(p => creatorById.get(p.creatorId))
      .filter(Boolean);
    if (!topPerformers.length) continue;

    // ── Perfil ganador derivado de los top performers ──
    const etiquetaCounts = new Map();
    topPerformers.forEach(c => parseEtiquetas(c.etiquetas).forEach(tag => {
      etiquetaCounts.set(tag, (etiquetaCounts.get(tag) || 0) + 1);
    }));
    let signatureEtiquetas = [...etiquetaCounts.entries()].filter(([, n]) => n >= 2).map(([tag]) => tag);
    if (!signatureEtiquetas.length && etiquetaCounts.size) {
      signatureEtiquetas = [[...etiquetaCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]];
    }

    const categoriaCounts = new Map();
    topPerformers.forEach(c => {
      if (c.eval_perfil_categoria) categoriaCounts.set(c.eval_perfil_categoria, (categoriaCounts.get(c.eval_perfil_categoria) || 0) + 1);
    });
    const categoria = categoriaCounts.size ? [...categoriaCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;

    const tierCounts = new Map();
    topPerformers.forEach(c => {
      const tier = tierDe(seguidoresDe(c));
      if (tier) tierCounts.set(tier, (tierCounts.get(tier) || 0) + 1);
    });
    const seguidoresTier = tierCounts.size ? [...tierCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;

    let igCount = 0, ttCount = 0;
    topPerformers.forEach(c => {
      if (c.eval_perfil_seguidores != null) igCount++;
      if (c.tiktok_eval_seguidores != null) ttCount++;
    });
    const platform = ttCount > igCount ? 'tiktok' : 'instagram';

    // ── Candidatos: Pendiente y sin historial con esta marca ──
    const candidatos = creators.filter(c =>
      c.estado === 'Pendiente' && !triedBrandsByCreator.get(c.creator_id)?.has(brandId)
    );

    const brandName = brandNameById.get(brandId) || brandId;
    const tierIdxOf = label => SEGUIDORES_TIERS.findIndex(t => t.label === label);
    const targetTierIdx = seguidoresTier ? tierIdxOf(seguidoresTier) : -1;

    const scored = candidatos
      .map(c => {
        const tags = parseEtiquetas(c.etiquetas);
        const overlap = signatureEtiquetas.filter(t => tags.includes(t));
        const etiquetaScore = signatureEtiquetas.length ? 40 * (overlap.length / signatureEtiquetas.length) : 0;

        const catMatch = !!(categoria && c.eval_perfil_categoria && c.eval_perfil_categoria.toLowerCase() === categoria.toLowerCase());
        const categoriaScore = catMatch ? 20 : 0;

        const cTier = tierDe(seguidoresDe(c));
        let tierScore = 0;
        if (cTier && seguidoresTier) {
          if (cTier === seguidoresTier) tierScore = 25;
          else if (Math.abs(tierIdxOf(cTier) - targetTierIdx) === 1) tierScore = 10;
        }

        const hasPlatformData = platform === 'tiktok' ? c.tiktok_eval_seguidores != null : c.eval_perfil_seguidores != null;
        const platformScore = hasPlatformData ? 15 : 0;

        const similarityScore = Math.round(etiquetaScore + categoriaScore + tierScore + platformScore);

        const razonParts = [];
        if (overlap.length) razonParts.push(`Comparte etiqueta${overlap.length > 1 ? 's' : ''} '${overlap.slice(0, 2).join("', '")}' con tus mejores creadores de ${brandName}`);
        if (catMatch) razonParts.push(`Misma categoría (${categoria})`);
        if (tierScore === 25) razonParts.push(`Mismo rango de seguidores (${cTier})`);
        else if (tierScore === 10) razonParts.push(`Rango de seguidores cercano (${cTier})`);
        if (!razonParts.length) razonParts.push('Perfil similar a tus mejores creadores');

        return {
          creatorId: c.creator_id,
          nombre: c.full_name || c.username || c.creator_id,
          username: c.username || null,
          score: c.score || 0,
          seguidoresDisplay: c.seguidores_display || null,
          etiquetas: tags,
          similarityScore,
          razon: razonParts.slice(0, 2).join(' · '),
        };
      })
      .filter(c => c.similarityScore >= SIMILARITY_MIN_THRESHOLD)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, MAX_RECOMENDADOS_POR_MARCA);

    if (!scored.length) continue;

    resultado.push({
      brandId,
      brandName,
      perfilGanador: {
        etiquetas: signatureEtiquetas,
        categoria,
        seguidoresTier,
        platform,
        basadoEnCreadores: topPerformers.length,
      },
      recomendados: scored,
    });
  }

  return resultado;
}

/** Sección "Ex-colaboradores mejorado": estado='Inactivo', rankeado por performance real. */
async function getExColaboradoresMejorado() {
  const inactivos = await q(`
    SELECT creator_id, full_name, username, seguidores_display, score
    FROM ${DATASET}.creators WHERE estado = 'Inactivo'
  `);
  if (!inactivos.length) return [];

  const [contentRows, ccRows, brands] = await Promise.all([
    q(`
      SELECT creator_id, org_engagement_rate, org_likes, org_comments, org_shares, org_saves
      FROM ${DATASET}.campaign_content WHERE org_engagement_rate IS NOT NULL
    `),
    q(`SELECT DISTINCT creator_id, brand_id FROM ${DATASET}.campaign_creators WHERE estado = 'Activo'`),
    q(`SELECT brand_id, name FROM ${DATASET}.brands`),
  ]);

  const brandNameById = new Map(brands.map(b => [b.brand_id, b.name]));
  const brandsByCreator = new Map();
  ccRows.forEach(r => {
    if (!brandsByCreator.has(r.creator_id)) brandsByCreator.set(r.creator_id, new Set());
    brandsByCreator.get(r.creator_id).add(brandNameById.get(r.brand_id) || r.brand_id);
  });

  const metricsByCreator = new Map();
  contentRows.forEach(r => {
    if (!metricsByCreator.has(r.creator_id)) metricsByCreator.set(r.creator_id, { ers: [], interacciones: 0, posts: 0 });
    const m = metricsByCreator.get(r.creator_id);
    m.ers.push(Number(r.org_engagement_rate));
    m.interacciones += (r.org_likes ?? 0) + (r.org_comments ?? 0) + (r.org_shares ?? 0) + (r.org_saves ?? 0);
    m.posts += 1;
  });

  const withData = [];
  const withoutData = [];

  inactivos.forEach(c => {
    const m = metricsByCreator.get(c.creator_id);
    const marcas = [...(brandsByCreator.get(c.creator_id) || [])];
    const base = {
      creatorId: c.creator_id,
      nombre: c.full_name || c.username || c.creator_id,
      username: c.username || null,
      brandsHistoricos: marcas,
    };

    if (m) {
      const avgEr = parseFloat((m.ers.reduce((a, b) => a + b, 0) / m.ers.length).toFixed(2));
      withData.push({
        ...base,
        avgEngagementRate: avgEr,
        totalInteracciones: m.interacciones,
        totalPosts: m.posts,
        razon: `ER promedio ${avgEr.toFixed(1)}% en ${m.posts} posteo${m.posts > 1 ? 's' : ''}` +
          (marcas.length ? ` · Trabajó con ${marcas.slice(0, 2).join(', ')}` : ''),
      });
    } else {
      withoutData.push({
        ...base,
        avgEngagementRate: null,
        totalInteracciones: 0,
        totalPosts: 0,
        razon: marcas.length
          ? `Trabajó con ${marcas.slice(0, 2).join(', ')} (sin métricas de contenido cargadas)`
          : 'Ex-colaborador sin métricas de contenido cargadas',
      });
    }
  });

  withData.sort((a, b) => (b.avgEngagementRate - a.avgEngagementRate) || (b.totalInteracciones - a.totalInteracciones));

  return [...withData, ...withoutData];
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

const MOMENTUM_CAP_FOLLOWERS = 50;
const MOMENTUM_CAP_ER = 30;
const MOMENTUM_CAP_VIRALES = 20;
const MAX_EN_ALZA = 12;

/**
 * Sección "En alza": compara los últimos 2 snapshots de cada creador. Un
 * creador con menos de 2 snapshots simplemente no aparece en el join — ese es
 * el gate natural de "necesita ≥2 corridas", sin flag extra.
 */
async function getEnAlza() {
  const rows = await q(`
    WITH ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY creator_id ORDER BY captured_at DESC) AS rn
      FROM ${DATASET}.creator_metric_snapshots
    )
    SELECT
      latest.creator_id,
      latest.captured_at AS latest_captured_at, prev.captured_at AS prev_captured_at,
      latest.ig_seguidores AS l_ig_seg, prev.ig_seguidores AS p_ig_seg,
      latest.ig_engagement_rate AS l_ig_er, prev.ig_engagement_rate AS p_ig_er,
      latest.ig_videos_virales AS l_ig_vir, prev.ig_videos_virales AS p_ig_vir,
      latest.tt_seguidores AS l_tt_seg, prev.tt_seguidores AS p_tt_seg,
      latest.tt_engagement_rate AS l_tt_er, prev.tt_engagement_rate AS p_tt_er,
      latest.tt_videos_virales AS l_tt_vir, prev.tt_videos_virales AS p_tt_vir
    FROM ranked latest
    JOIN ranked prev ON latest.creator_id = prev.creator_id AND prev.rn = 2
    WHERE latest.rn = 1
  `);

  if (!rows.length) return { disponible: false, creadores: [] };

  const creatorIds = rows.map(r => r.creator_id);
  const placeholders = creatorIds.map((_, i) => `@id${i}`).join(', ');
  const params = Object.fromEntries(creatorIds.map((id, i) => [`id${i}`, id]));
  const creators = await q(`SELECT creator_id, full_name, username FROM ${DATASET}.creators WHERE creator_id IN (${placeholders})`, params);
  const creatorById = new Map(creators.map(c => [c.creator_id, c]));

  const candidatos = [];
  for (const r of rows) {
    const c = creatorById.get(r.creator_id);
    if (!c) continue;

    // Preferir Instagram; si falta algún punto ahí, usar TikTok — misma
    // precedencia que recalcularScore en score-service.js.
    let lSeg, pSeg, lEr, pEr, lVir, pVir;
    if (r.l_ig_seg != null && r.p_ig_seg != null) {
      lSeg = Number(r.l_ig_seg); pSeg = Number(r.p_ig_seg);
      lEr = r.l_ig_er != null ? Number(r.l_ig_er) : null; pEr = r.p_ig_er != null ? Number(r.p_ig_er) : null;
      lVir = r.l_ig_vir != null ? Number(r.l_ig_vir) : 0; pVir = r.p_ig_vir != null ? Number(r.p_ig_vir) : 0;
    } else if (r.l_tt_seg != null && r.p_tt_seg != null) {
      lSeg = Number(r.l_tt_seg); pSeg = Number(r.p_tt_seg);
      lEr = r.l_tt_er != null ? Number(r.l_tt_er) : null; pEr = r.p_tt_er != null ? Number(r.p_tt_er) : null;
      lVir = r.l_tt_vir != null ? Number(r.l_tt_vir) : 0; pVir = r.p_tt_vir != null ? Number(r.p_tt_vir) : 0;
    } else {
      continue; // ninguna plataforma tiene dato en los 2 puntos
    }
    if (!(pSeg > 0)) continue;

    const deltaFollowersPct = ((lSeg - pSeg) / pSeg) * 100;
    const deltaEngagementRate = (lEr != null && pEr != null) ? lEr - pEr : 0;
    const deltaVideosVirales = lVir - pVir;

    const momentumScore =
      clamp(deltaFollowersPct, 0, MOMENTUM_CAP_FOLLOWERS) +
      clamp(deltaEngagementRate * 6, 0, MOMENTUM_CAP_ER) +
      clamp(deltaVideosVirales * 10, 0, MOMENTUM_CAP_VIRALES);
    if (momentumScore <= 0) continue;

    const razonParts = [];
    if (deltaFollowersPct > 0) razonParts.push(`+${deltaFollowersPct.toFixed(1)}% seguidores`);
    if (deltaEngagementRate > 0) razonParts.push(`+${deltaEngagementRate.toFixed(1)}pts de ER`);
    if (deltaVideosVirales > 0) razonParts.push(`+${deltaVideosVirales} video${deltaVideosVirales > 1 ? 's' : ''} viral${deltaVideosVirales > 1 ? 'es' : ''}`);

    candidatos.push({
      creatorId: r.creator_id,
      nombre: c.full_name || c.username || r.creator_id,
      username: c.username || null,
      deltaFollowersPct: parseFloat(deltaFollowersPct.toFixed(2)),
      deltaEngagementRate: parseFloat(deltaEngagementRate.toFixed(2)),
      deltaVideosVirales,
      momentumScore: parseFloat(momentumScore.toFixed(1)),
      razon: razonParts.join(' · ') || 'Crecimiento reciente detectado',
      capturedAtPrev: r.prev_captured_at?.value ?? r.prev_captured_at,
      capturedAtLatest: r.latest_captured_at?.value ?? r.latest_captured_at,
    });
  }

  candidatos.sort((a, b) => b.momentumScore - a.momentumScore);
  return { disponible: true, creadores: candidatos.slice(0, MAX_EN_ALZA) };
}

export async function getRecomendaciones() {
  const [formulaGanadora, enAlza, exColaboradores] = await Promise.all([
    getFormulaGanadora(),
    getEnAlza(),
    getExColaboradoresMejorado(),
  ]);

  return { formulaGanadora, enAlza, exColaboradores };
}

// ─── Refresh on-demand (botón "Actualizar tendencias") ──────────────────────

const WATCHLIST_ESTADOS = ['Activo', 'Inactivo', 'En Negociación'];
const STALE_RUN_MINUTES = 30;  // ~doble del tiempo esperado de una corrida secuencial IG+TikTok
const COOLDOWN_HOURS = 24;

export async function getWatchlistCreatorIds() {
  const inClause = WATCHLIST_ESTADOS.map(e => `'${e}'`).join(', ');
  const rows = await q(`SELECT creator_id FROM ${DATASET}.creators WHERE estado IN (${inClause})`);
  return rows.map(r => r.creator_id);
}

export async function startRefreshRun(creatorsCount) {
  const runId = `run_${Date.now().toString(36)}`;
  await q(`
    INSERT INTO ${DATASET}.recommendation_runs (run_id, started_at, status, creators_count, created_at)
    VALUES (@runId, CURRENT_TIMESTAMP(), 'running', @count, CURRENT_TIMESTAMP())
  `, { runId, count: creatorsCount }, { count: 'INT64' });
  return runId;
}

export async function completeRefreshRun(runId, { successCount, failedCount }) {
  await q(`
    UPDATE ${DATASET}.recommendation_runs
    SET status = 'completed', finished_at = CURRENT_TIMESTAMP(), success_count = @s, failed_count = @f
    WHERE run_id = @runId
  `, { runId, s: successCount, f: failedCount }, { s: 'INT64', f: 'INT64' });
}

export async function failRefreshRun(runId, errorMessage) {
  await q(`
    UPDATE ${DATASET}.recommendation_runs
    SET status = 'failed', finished_at = CURRENT_TIMESTAMP(), error_message = @err
    WHERE run_id = @runId
  `, { runId, err: errorMessage }).catch(() => {});
}

function gateStatus(status, extra = {}) {
  return {
    status, canRefresh: status === 'idle',
    runId: null, startedAt: null, finishedAt: null,
    creatorsCount: null, successCount: null, failedCount: null, nextEligibleAt: null,
    ...extra,
  };
}

/**
 * Resuelve el estado del gate de refresh: mutex contra corridas concurrentes +
 * cooldown de 24hs tras una corrida 'completed' ('failed' no penaliza). Si la
 * última corrida quedó 'running' más de STALE_RUN_MINUTES (el proceso murió a
 * mitad de camino), se auto-sana a 'failed' antes de evaluar el gate.
 */
export async function getRefreshGateStatus() {
  const rows = await q(`
    SELECT run_id, started_at, finished_at, status, creators_count, success_count, failed_count
    FROM ${DATASET}.recommendation_runs
    ORDER BY started_at DESC LIMIT 1
  `);
  if (!rows.length) return gateStatus('idle');

  let latest = rows[0];
  const startedAt = latest.started_at?.value ?? latest.started_at;

  if (latest.status === 'running') {
    const ageMin = (Date.now() - new Date(startedAt).getTime()) / 60_000;
    if (ageMin <= STALE_RUN_MINUTES) {
      return gateStatus('running', { runId: latest.run_id, startedAt, creatorsCount: latest.creators_count ?? null });
    }
    await failRefreshRun(latest.run_id, 'stale_timeout');
    latest = { ...latest, status: 'failed', finished_at: new Date().toISOString() };
  }

  if (latest.status === 'completed') {
    const finishedAt = latest.finished_at?.value ?? latest.finished_at;
    const nextEligibleAt = new Date(new Date(finishedAt).getTime() + COOLDOWN_HOURS * 3_600_000);
    if (Date.now() < nextEligibleAt.getTime()) {
      return gateStatus('cooldown', {
        runId: latest.run_id, startedAt, finishedAt,
        creatorsCount: latest.creators_count ?? null,
        successCount: latest.success_count ?? null, failedCount: latest.failed_count ?? null,
        nextEligibleAt: nextEligibleAt.toISOString(),
      });
    }
  }

  return gateStatus('idle', {
    runId: latest.run_id, startedAt,
    finishedAt: latest.finished_at?.value ?? latest.finished_at ?? null,
    creatorsCount: latest.creators_count ?? null,
    successCount: latest.success_count ?? null, failedCount: latest.failed_count ?? null,
  });
}
