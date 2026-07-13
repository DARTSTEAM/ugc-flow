/**
 * Migra `creators.estado` del modelo viejo de 5 valores (Nuevo/Contactado/
 * Respondió/Calificado/Descartado — trackeaba progreso de outreach) al
 * modelo nuevo de 5 valores que trackea el estado real de relación con el
 * creador (Pendiente/Activo/En Negociación/Descartado/Inactivo).
 *
 * Paso 1 — remapeo directo (mismo criterio que sql/migrate-estado-en-campana.js):
 *   Nuevo      → Pendiente
 *   Contactado → Pendiente
 *   Respondió  → En Negociación
 *   Calificado → Activo
 *   Descartado → Descartado (sin cambios)
 *   NULL / valor desconocido → Pendiente (red de seguridad)
 *
 * Paso 2 — cómputo de Inactivo (misma regla que aplica el hook automático
 * en PUT /api/campaigns/:id al cerrar una campaña — ver server/index.js):
 *   Un creador pasa a Inactivo si alguna vez fue 'Activo' en algún
 *   campaign_creators, PERO hoy no tiene ninguna fila con estado IN
 *   ('Activo','En Negociación') en una campaña cuyo status != 'completed'.
 *   Nunca sobreescribe 'Descartado'.
 */

import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DS = 'ngr_ugc';

async function q(sql, params) {
  const [rows] = await bq.query({ query: sql, params, location: 'US' });
  return rows;
}

const MAPPING = {
  'Nuevo': 'Pendiente',
  'Contactado': 'Pendiente',
  'Respondió': 'En Negociación',
  'Calificado': 'Activo',
};

console.log('=== Migración de estado en creators ===\n');

const before = await q(`SELECT estado, COUNT(*) as n FROM ${DS}.creators GROUP BY estado ORDER BY n DESC`);
console.log('Antes:');
before.forEach(r => console.log(`  ${r.estado ?? '(null)'}: ${r.n}`));

console.log('\nPaso 1 — remapeo de valores...');
for (const [oldVal, newVal] of Object.entries(MAPPING)) {
  await q(
    `UPDATE ${DS}.creators SET estado = @newVal, updated_at = CURRENT_TIMESTAMP() WHERE estado = @oldVal`,
    { newVal, oldVal }
  );
  console.log(`  ${oldVal} → ${newVal}`);
}
await q(`
  UPDATE ${DS}.creators SET estado = 'Pendiente', updated_at = CURRENT_TIMESTAMP()
  WHERE estado IS NULL OR estado NOT IN ('Pendiente', 'Activo', 'En Negociación', 'Descartado')
`);
console.log('  NULL / desconocido → Pendiente');

console.log('\nPaso 2 — cómputo de Inactivo...');
await q(`
  UPDATE \`${DS}.creators\` AS c
  SET c.estado = 'Inactivo', c.updated_at = CURRENT_TIMESTAMP()
  WHERE c.estado != 'Descartado'
    AND EXISTS (
      SELECT 1 FROM ${DS}.campaign_creators cc
      WHERE cc.creator_id = c.creator_id AND cc.estado = 'Activo'
    )
    AND NOT EXISTS (
      SELECT 1 FROM ${DS}.campaign_creators cc2
      JOIN ${DS}.campaigns c2 ON cc2.campaign_id = c2.campaign_id
      WHERE cc2.creator_id = c.creator_id
        AND cc2.estado IN ('Activo', 'En Negociación')
        AND c2.status != 'completed'
    )
`);

const after = await q(`SELECT estado, COUNT(*) as n FROM ${DS}.creators GROUP BY estado ORDER BY n DESC`);
console.log('\nDespués:');
after.forEach(r => console.log(`  ${r.estado}: ${r.n}`));

console.log('\n✓ Migración completada.');
