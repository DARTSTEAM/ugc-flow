/**
 * Agregación de métricas de campaña a partir de las piezas de contenido
 * confirmadas (filas de `campaign_content`).
 *
 * Reglas (sólo métricas públicas / orgánicas):
 *   - vistas, likes, comentarios, compartidos, guardados, interacciones → SUMA
 *   - engagement rate de campaña → PROMEDIO PONDERADO por vistas
 *     = Σ(interacciones) / Σ(vistas) × 100   (NO media simple de los ER)
 *
 * Las métricas se empiezan a calcular en cuanto hay ≥1 pieza con datos scrapeados.
 */

function num(v) {
  return v == null ? 0 : Number(v);
}

/** Interacciones públicas de una pieza: likes + comentarios + compartidos + guardados. */
function interaccionesDe(row) {
  return num(row.org_likes) + num(row.org_comments) + num(row.org_shares) + num(row.org_saves);
}

/** ¿La pieza tiene al menos una métrica scrapeada? */
export function tieneMetricas(row) {
  return row.org_views != null || row.org_likes != null || row.org_comments != null;
}

/**
 * @param {Array<object>} rows   filas de campaign_content (ya con nombre de creador y categoría adjuntos)
 * @returns {object} MetricasCampana (o null si no hay piezas con métricas)
 */
export function computeCampaignMetrics(rows) {
  const conMetricas = rows.filter(tieneMetricas);
  if (!conMetricas.length) return null;

  // ── Totales (sumables) ──
  let vistas = 0, likes = 0, comentarios = 0, compartidos = 0, guardados = 0;
  for (const r of conMetricas) {
    vistas      += num(r.org_views);
    likes       += num(r.org_likes);
    comentarios += num(r.org_comments);
    compartidos += num(r.org_shares);
    guardados   += num(r.org_saves);
  }
  const interacciones = likes + comentarios + compartidos + guardados;
  const engagementRate = vistas > 0
    ? parseFloat(((interacciones / vistas) * 100).toFixed(2))
    : null;

  // ── Agregado por creador (para Top creadores) ──
  const porCreador = new Map();
  for (const r of conMetricas) {
    const key = r.creator_id;
    if (!porCreador.has(key)) {
      porCreador.set(key, {
        creatorId: key,
        nombre: r.creator_nombre || key,
        categoria: r.creator_categoria || null,
        posteos: 0, vistas: 0, interacciones: 0,
      });
    }
    const acc = porCreador.get(key);
    acc.posteos      += 1;
    acc.vistas       += num(r.org_views);
    acc.interacciones += interaccionesDe(r);
  }
  const topCreadores = [...porCreador.values()]
    .map(c => ({
      ...c,
      engagementRate: c.vistas > 0
        ? parseFloat(((c.interacciones / c.vistas) * 100).toFixed(2))
        : null,
    }))
    .sort((a, b) => b.vistas - a.vistas);

  // ── Top contenidos ──
  const topContenidos = conMetricas
    .map(r => ({
      id: r.content_id,
      creatorId: r.creator_id,
      creatorNombre: r.creator_nombre || r.creator_id,
      platform: r.platform || 'desconocida',
      url: r.content_url,
      views: r.org_views != null ? num(r.org_views) : null,
      likes: r.org_likes != null ? num(r.org_likes) : null,
      comments: r.org_comments != null ? num(r.org_comments) : null,
      shares: r.org_shares != null ? num(r.org_shares) : null,
      saves: r.org_saves != null ? num(r.org_saves) : null,
      engagementRate: r.org_engagement_rate != null ? Number(r.org_engagement_rate) : null,
      interacciones: interaccionesDe(r),
    }))
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0));

  return {
    totalPosteos: conMetricas.length,
    totalCreadoresConPosteos: porCreador.size,
    vistas, likes, comentarios, compartidos, guardados, interacciones,
    engagementRate,
    topCreadores,
    topContenidos,
  };
}
