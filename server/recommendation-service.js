/**
 * Recomendaciones — a diferencia del resto de la app, esto no es un espejo
 * 1:1 de una tabla: cruza creators + campaign_content + campaign_creators
 * para producir 3 secciones reales:
 *
 *  - Top Creadores: ranking histórico ponderado cruzando todas las campañas
 *    Cerradas del grupo — score de perfil (60/25/15 existente) 50% + ranking
 *    de rendimiento real (percentil de ER real dentro de su misma plataforma) 50%.
 *  - En alza (momentum): compara los últimos 2 snapshots de cada creador.
 *  - Ex-colaboradores mejorado: creators.estado='Inactivo', rankeados por
 *    performance real en campaign_content en vez de sólo "trabajó una vez".
 */
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

function q(sql, params, types) {
  return bq.query({ query: sql, params, types, location: 'US' }).then(([rows]) => rows);
}

const MAX_TOP_CREADORES = 12;

function platformLabel(p) {
  return p === 'tiktok' ? 'TikTok' : p === 'instagram' ? 'Instagram' : p;
}

/**
 * Sección "Top Creadores": ranking histórico ponderado cruzando TODAS las
 * campañas Cerradas (status='completed') del grupo. A diferencia de la vieja
 * "Fórmula ganadora" (que matcheaba candidatos Pendiente contra un perfil),
 * esto rankea directamente a los creadores que YA trabajaron y demostraron
 * rendimiento real — no recomienda gente nueva sin probar.
 *
 * finalScore = score de perfil (60/25/15 existente) 50% + performanceIndex 50%.
 * performanceIndex = percentil del ER real promedio del creador DENTRO de su
 * misma plataforma (nunca se compara ER de Instagram contra ER de TikTok —
 * mismo criterio que el resto de este archivo). Sin campaign_content real en
 * una campaña terminada, el creador no entra: esta sección mide performance
 * comprobada, no sólo participación.
 */
async function getTopCreadores() {
  const [poolRows, contentRows, creators, brands] = await Promise.all([
    q(`
      SELECT DISTINCT cc.creator_id, cc.campaign_id, cc.brand_id
      FROM ${DATASET}.campaign_creators cc
      JOIN ${DATASET}.campaigns camp ON cc.campaign_id = camp.campaign_id
      WHERE cc.estado = 'Activo' AND camp.status = 'completed'
    `),
    q(`
      SELECT cont.creator_id, cont.campaign_id, cont.platform, cont.org_engagement_rate,
             cont.org_likes, cont.org_comments, cont.org_shares, cont.org_saves
      FROM ${DATASET}.campaign_content cont
      JOIN ${DATASET}.campaigns camp ON cont.campaign_id = camp.campaign_id
      WHERE cont.org_engagement_rate IS NOT NULL AND camp.status = 'completed'
    `),
    q(`SELECT creator_id, full_name, username, score, seguidores_display FROM ${DATASET}.creators`),
    q(`SELECT brand_id, name FROM ${DATASET}.brands`),
  ]);

  if (!poolRows.length) return { disponible: false, creadores: [] };

  const brandNameById = new Map(brands.map(b => [b.brand_id, b.name]));
  const creatorById = new Map(creators.map(c => [c.creator_id, c]));

  const poolKeys = new Set(poolRows.map(r => `${r.creator_id}|${r.campaign_id}`));
  const campanasByCreator = new Map();
  const brandsByCreator = new Map();
  poolRows.forEach(r => {
    if (!campanasByCreator.has(r.creator_id)) campanasByCreator.set(r.creator_id, new Set());
    campanasByCreator.get(r.creator_id).add(r.campaign_id);
    if (!brandsByCreator.has(r.creator_id)) brandsByCreator.set(r.creator_id, new Set());
    brandsByCreator.get(r.creator_id).add(brandNameById.get(r.brand_id) || r.brand_id);
  });

  // Por creador, agrupado por plataforma — nunca se promedia ER de IG con ER de TikTok junto.
  const platformStatsByCreator = new Map();
  contentRows
    .filter(r => poolKeys.has(`${r.creator_id}|${r.campaign_id}`))
    .forEach(r => {
      if (!platformStatsByCreator.has(r.creator_id)) platformStatsByCreator.set(r.creator_id, new Map());
      const byPlat = platformStatsByCreator.get(r.creator_id);
      const plat = r.platform || 'desconocida';
      if (!byPlat.has(plat)) byPlat.set(plat, { ers: [], interacciones: 0, posts: 0 });
      const s = byPlat.get(plat);
      s.ers.push(Number(r.org_engagement_rate));
      s.interacciones += (r.org_likes ?? 0) + (r.org_comments ?? 0) + (r.org_shares ?? 0) + (r.org_saves ?? 0);
      s.posts += 1;
    });

  // Plataforma primaria de cada creador = la que tiene más posteos con datos reales.
  const perCreator = [];
  for (const [creatorId, byPlat] of platformStatsByCreator.entries()) {
    const c = creatorById.get(creatorId);
    if (!c) continue;
    const [primaryPlatform, primaryStats] = [...byPlat.entries()].sort((a, b) => b[1].posts - a[1].posts)[0];
    const avgEr = parseFloat((primaryStats.ers.reduce((a, b) => a + b, 0) / primaryStats.ers.length).toFixed(2));
    const totalPosts = [...byPlat.values()].reduce((sum, s) => sum + s.posts, 0);
    const totalInteracciones = [...byPlat.values()].reduce((sum, s) => sum + s.interacciones, 0);
    perCreator.push({
      creatorId, c, primaryPlatform, avgEr, totalPosts, totalInteracciones,
      totalCampanasTerminadas: campanasByCreator.get(creatorId)?.size ?? 0,
      marcas: [...(brandsByCreator.get(creatorId) || [])],
    });
  }

  if (!perCreator.length) return { disponible: false, creadores: [] };

  // Percentil de avgEr dentro de cada grupo de plataforma.
  const byPlatform = new Map();
  perCreator.forEach(x => {
    if (!byPlatform.has(x.primaryPlatform)) byPlatform.set(x.primaryPlatform, []);
    byPlatform.get(x.primaryPlatform).push(x);
  });
  byPlatform.forEach(group => {
    const sorted = [...group].sort((a, b) => a.avgEr - b.avgEr);
    sorted.forEach((x, i) => {
      x.performanceIndex = sorted.length > 1 ? Math.round((i / (sorted.length - 1)) * 100) : 50;
    });
  });

  const creadores = perCreator
    .map(x => {
      const perfilScore = x.c.score || 0;
      const perfilPts = Math.round(perfilScore * 0.5);
      const performancePts = Math.round(x.performanceIndex * 0.5);
      const finalScore = perfilPts + performancePts;
      const platLabel = platformLabel(x.primaryPlatform);

      return {
        creatorId: x.creatorId,
        nombre: x.c.full_name || x.c.username || x.creatorId,
        username: x.c.username || null,
        score: perfilScore,
        seguidoresDisplay: x.c.seguidores_display || null,
        avgEngagementRate: x.avgEr,
        performanceIndex: x.performanceIndex,
        finalScore,
        totalPosts: x.totalPosts,
        totalInteracciones: x.totalInteracciones,
        totalCampanasTerminadas: x.totalCampanasTerminadas,
        marcas: x.marcas,
        razon: `Score de perfil ${perfilScore}/100 · ER real ${x.avgEr.toFixed(1)}% (percentil ${x.performanceIndex} en ${platLabel}) · ${x.totalCampanasTerminadas} campaña${x.totalCampanasTerminadas > 1 ? 's' : ''} terminada${x.totalCampanasTerminadas > 1 ? 's' : ''}`,
        breakdown: [
          { label: 'Score de perfil', value: `${perfilScore}/100`, pts: perfilPts, max: 50 },
          { label: 'Rendimiento real en campañas terminadas', value: `ER promedio ${x.avgEr.toFixed(1)}% (percentil ${x.performanceIndex} en ${platLabel})`, pts: performancePts, max: 50 },
        ],
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, MAX_TOP_CREADORES);

  return { disponible: true, creadores };
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

    const seguidoresPts = Math.round(clamp(deltaFollowersPct, 0, MOMENTUM_CAP_FOLLOWERS));
    const erPts = Math.round(clamp(deltaEngagementRate * 6, 0, MOMENTUM_CAP_ER));
    const viralesPts = Math.round(clamp(deltaVideosVirales * 10, 0, MOMENTUM_CAP_VIRALES));
    const momentumScore = seguidoresPts + erPts + viralesPts;
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
      breakdown: [
        { label: 'Crecimiento de seguidores', value: `${deltaFollowersPct.toFixed(1)}%`, pts: seguidoresPts, max: MOMENTUM_CAP_FOLLOWERS },
        { label: 'Variación de engagement rate', value: `${deltaEngagementRate.toFixed(1)}pts`, pts: erPts, max: MOMENTUM_CAP_ER },
        { label: 'Nuevos videos virales', value: `${deltaVideosVirales}`, pts: viralesPts, max: MOMENTUM_CAP_VIRALES },
      ],
    });
  }

  candidatos.sort((a, b) => b.momentumScore - a.momentumScore);
  return { disponible: true, creadores: candidatos.slice(0, MAX_EN_ALZA) };
}

export async function getRecomendaciones() {
  const [topCreadores, enAlza, exColaboradores] = await Promise.all([
    getTopCreadores(),
    getEnAlza(),
    getExColaboradoresMejorado(),
  ]);

  return { topCreadores, enAlza, exColaboradores };
}

// ─── Refresh on-demand (botón "Actualizar tendencias") ──────────────────────

const WATCHLIST_ESTADOS = ['Activo', 'Inactivo', 'En Negociación', 'Disponible'];
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
