/**
 * Score calculation — 3 components totaling 100 pts:
 *
 *  Perfil          60 pts  (seguidores 20 + ER cuenta 20 + frecuencia semanal 20)
 *  Contenido org.  25 pts  (videos virales 15 + CTR pauta 5 + VTR pauta 5)
 *  KPIs de pauta   15 pts  (CPM 5 + vistas 5 + ER paid 5)
 *
 * Any sub-metric with null data contributes 0 pts.
 */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// ─── Sub-scorers ────────────────────────────────────────────────────────────

function scoreSeguidores(seg) {
  if (seg == null) return 0;
  if (seg >= 100_000) return 20;
  if (seg >=  50_000) return 15;
  if (seg >=  20_000) return 10;
  if (seg >=  10_000) return  5;
  return 0;
}

function scoreERCuenta(er) {
  if (er == null) return 0;
  if (er >= 6) return 20;
  if (er >= 4) return 17;
  if (er >= 2) return 13;
  if (er >= 1) return  8;
  if (er >  0) return  3;
  return 0;
}

function scoreFrecuenciaSemanal(freq) {
  if (freq == null) return 0;
  // Optimal: 2-4 posts/week; below 1 is low, above 7 is likely noise
  if (freq >= 2 && freq <= 5) return 20;
  if (freq >= 1)              return 12;
  if (freq > 0)               return  6;
  return 0;
}

function scoreVideosVirales(count) {
  if (count == null || count === 0) return 0;
  if (count >= 3) return 15;
  if (count === 2) return 10;
  return 5;
}

function scoreCTR(ctr) {
  if (ctr == null) return 0;
  if (ctr >= 2)  return 5;
  if (ctr >= 1)  return 3;
  if (ctr > 0)   return 1;
  return 0;
}

function scoreVTR(vtr) {
  if (vtr == null) return 0;
  if (vtr >= 40) return 5;
  if (vtr >= 20) return 3;
  if (vtr > 0)   return 1;
  return 0;
}

function scoreCPM(cpm) {
  // Lower CPM = better
  if (cpm == null) return 0;
  if (cpm <= 3)  return 5;
  if (cpm <= 5)  return 4;
  if (cpm <= 10) return 3;
  if (cpm <= 20) return 1;
  return 0;
}

function scoreVistas(vistas) {
  if (vistas == null) return 0;
  if (vistas >= 500_000) return 5;
  if (vistas >= 200_000) return 4;
  if (vistas >=  50_000) return 3;
  if (vistas >=  10_000) return 1;
  return 0;
}

function scoreERPauta(er) {
  if (er == null) return 0;
  if (er >= 4) return 5;
  if (er >= 2) return 3;
  if (er >= 1) return 1;
  return 0;
}

// ─── Main export ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   seguidores?: number|null,
 *   engagementRateCuenta?: number|null,
 *   frecuenciaSemanal?: number|null,
 *   videosVirales?: number|null,
 *   ctr?: number|null,
 *   vtr?: number|null,
 *   cpm?: number|null,
 *   vistas?: number|null,
 *   erPauta?: number|null,
 * }} data
 * @returns {{ total: number, breakdown: Array<{criterio:string, puntos:number, maximo:number}> }}
 */
export function calcularScore(data) {
  const perfil = clamp(
    scoreSeguidores(data.seguidores) +
    scoreERCuenta(data.engagementRateCuenta) +
    scoreFrecuenciaSemanal(data.frecuenciaSemanal),
    0, 60
  );

  const organico = clamp(
    scoreVideosVirales(data.videosVirales) +
    scoreCTR(data.ctr) +
    scoreVTR(data.vtr),
    0, 25
  );

  const pauta = clamp(
    scoreCPM(data.cpm) +
    scoreVistas(data.vistas) +
    scoreERPauta(data.erPauta),
    0, 15
  );

  const total = clamp(perfil + organico + pauta, 0, 100);

  return {
    total,
    breakdown: [
      { criterio: 'Evaluación de perfil (60%)',   puntos: perfil,   maximo: 60 },
      { criterio: 'Contenido orgánico (25%)',      puntos: organico, maximo: 25 },
      { criterio: 'KPIs de pauta (15%)',           puntos: pauta,    maximo: 15 },
    ],
  };
}
