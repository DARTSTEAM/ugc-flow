/**
 * Vista "Grupo NGR": agregación cruzada de todas las marcas, mismas fuentes
 * y misma lógica de suma/ER ponderado que `metrics-service.js` (que agrupa
 * por campaña) pero agrupando por `brand_id` — para poder comparar marcas
 * lado a lado en vez de campañas dentro de una marca.
 */
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

function q(sql, params, types) {
  return bq.query({ query: sql, params, types, location: 'US' }).then(([rows]) => rows);
}

function num(v) {
  return v == null ? 0 : Number(v);
}

function interaccionesDe(row) {
  return num(row.org_likes) + num(row.org_comments) + num(row.org_shares) + num(row.org_saves);
}

const ESTADOS_CREADOR_ACTIVO = ['Activo', 'Disponible'];
const MAX_CAMPANAS_RECIENTES = 15;
const ALCANCE_WINDOW_DAYS = 30;
// Mismo mapeo que STATUS_TO_ES en server/index.js — se duplica acá para no acoplar
// este servicio a index.js, igual que el resto de las constantes de este archivo.
const STATUS_TO_ES = { active: 'Activa', draft: 'Borrador', completed: 'Cerrada', paused: 'Pausada' };

export async function getGroupOverview() {
  const [brands, campaigns, campaignCreators, contentRows] = await Promise.all([
    q(`SELECT brand_id, name FROM ${DATASET}.brands ORDER BY name`),
    q(`SELECT campaign_id, brand_id, name, status, start_date FROM ${DATASET}.campaigns`),
    q(`SELECT DISTINCT creator_id, brand_id, estado FROM ${DATASET}.campaign_creators`),
    // Alcance/ER acá son SIEMPRE de los últimos 30 días (por cont.created_at, cuándo se
    // cargó la colaboración) — no el acumulado histórico. No hay un campo de "fecha de
    // publicación real" del posteo, así que created_at es el proxy más cercano.
    q(`
      SELECT cont.campaign_id, camp.brand_id,
             cont.org_views, cont.org_likes, cont.org_comments, cont.org_shares, cont.org_saves
      FROM ${DATASET}.campaign_content cont
      JOIN ${DATASET}.campaigns camp ON cont.campaign_id = camp.campaign_id
      WHERE (cont.org_views IS NOT NULL OR cont.org_likes IS NOT NULL OR cont.org_comments IS NOT NULL)
        AND cont.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${ALCANCE_WINDOW_DAYS} DAY)
    `),
  ]);

  // ── Métricas de alcance/ER por marca, reutilizando la misma suma que campaign detail ──
  const metricsByBrand = new Map();
  const metricsByCampaign = new Map();
  contentRows.forEach(r => {
    const acc = metricsByBrand.get(r.brand_id) || { views: 0, interacciones: 0 };
    acc.views += num(r.org_views);
    acc.interacciones += interaccionesDe(r);
    metricsByBrand.set(r.brand_id, acc);

    const campAcc = metricsByCampaign.get(r.campaign_id) || { views: 0, interacciones: 0 };
    campAcc.views += num(r.org_views);
    campAcc.interacciones += interaccionesDe(r);
    metricsByCampaign.set(r.campaign_id, campAcc);
  });

  // ── Creadores activos/disponibles por marca (distinct) ──
  const creadoresPorMarca = new Map();
  campaignCreators.forEach(cc => {
    if (!ESTADOS_CREADOR_ACTIVO.includes(cc.estado)) return;
    if (!creadoresPorMarca.has(cc.brand_id)) creadoresPorMarca.set(cc.brand_id, new Set());
    creadoresPorMarca.get(cc.brand_id).add(cc.creator_id);
  });

  const comparativa = brands.map(b => {
    const campanasDeMarca = campaigns.filter(c => c.brand_id === b.brand_id);
    const m = metricsByBrand.get(b.brand_id) || { views: 0, interacciones: 0 };
    return {
      brandId: b.brand_id,
      nombre: b.name,
      campanasActivas: campanasDeMarca.filter(c => c.status === 'active').length,
      campanasTotal: campanasDeMarca.length,
      creadoresActivos: creadoresPorMarca.get(b.brand_id)?.size ?? 0,
      alcanceTotal: m.interacciones,
      engagementRate: m.views > 0 ? parseFloat(((m.interacciones / m.views) * 100).toFixed(2)) : null,
    };
  });

  const totales = {
    campanasActivas: campaigns.filter(c => c.status === 'active').length,
    creadoresActivos: new Set(
      campaignCreators.filter(cc => ESTADOS_CREADOR_ACTIVO.includes(cc.estado)).map(cc => cc.creator_id)
    ).size,
    alcanceTotal: comparativa.reduce((sum, b) => sum + b.alcanceTotal, 0),
    marcasConActividad: comparativa.filter(b => b.campanasTotal > 0).length,
  };

  const campanasRecientes = campaigns
    .filter(c => c.start_date)
    .sort((a, b) => new Date(b.start_date?.value || b.start_date) - new Date(a.start_date?.value || a.start_date))
    .slice(0, MAX_CAMPANAS_RECIENTES)
    .map(c => {
      const brand = brands.find(b => b.brand_id === c.brand_id);
      const m = metricsByCampaign.get(c.campaign_id) || { views: 0, interacciones: 0 };
      return {
        id: c.campaign_id,
        nombre: c.name,
        marcaId: c.brand_id,
        marca: brand?.name || c.brand_id,
        estado: STATUS_TO_ES[c.status] || c.status,
        fechaInicio: c.start_date?.value || c.start_date,
        alcance: m.interacciones,
      };
    });

  return { totales, comparativa, campanasRecientes };
}
