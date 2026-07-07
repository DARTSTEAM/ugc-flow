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

  // Instagram no expone "vistas" para posteos de foto/carrusel (no es que el dato esté
  // oculto, directamente no existe). Si NINGÚN posteo tiene org_views, la suma en 0 no
  // representa "cero vistas" sino "no hay nada que sumar" — el frontend debe distinguirlo.
  const vistasDisponibles = conMetricas.some(r => r.org_views != null);

  // Sólo se usa para el conteo "X posteos · Y creadores" del header de la sección.
  const creadoresConPosteos = new Set(conMetricas.map(r => r.creator_id));

  // ── Top contenidos, por interacciones (no por vistas: en Instagram no siempre hay vistas) ──
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
    .sort((a, b) => b.interacciones - a.interacciones);

  return {
    totalPosteos: conMetricas.length,
    totalCreadoresConPosteos: creadoresConPosteos.size,
    vistas, likes, comentarios, compartidos, guardados, interacciones,
    engagementRate,
    vistasDisponibles,
    topContenidos,
  };
}
