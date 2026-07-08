/**
 * Migra el campo `estado` de campaign_creators del modelo viejo de 5 valores
 * (Enviado/Respondió/Pendiente/Calificado/No aplica, que trackeaba el estado
 * del mensaje de WhatsApp) al modelo nuevo de 4 valores que trackea el pipeline
 * de relación con el creador (Pendiente/Activo/En Negociación/Descartado).
 *
 * Mapeo semántico:
 *   Pendiente  → Pendiente        (sin contactar todavía)
 *   Enviado    → Pendiente        (mensaje enviado, sin respuesta aún)
 *   Respondió  → En Negociación   (ya contestó, se está coordinando)
 *   Calificado → Activo           (confirmado, trabajando en la campaña)
 *   No aplica  → Descartado
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
  'Enviado': 'Pendiente',
  'Respondió': 'En Negociación',
  'Calificado': 'Activo',
  'No aplica': 'Descartado',
};

console.log('=== Migración de estado en campaign_creators ===\n');

const before = await q(`SELECT estado, COUNT(*) as n FROM ${DS}.campaign_creators GROUP BY estado ORDER BY n DESC`);
console.log('Antes:');
before.forEach(r => console.log(`  ${r.estado}: ${r.n}`));

console.log('\nAplicando mapeo...');
for (const [oldVal, newVal] of Object.entries(MAPPING)) {
  const result = await q(
    `UPDATE ${DS}.campaign_creators SET estado = @newVal WHERE estado = @oldVal`,
    { newVal, oldVal }
  );
  console.log(`  ${oldVal} → ${newVal} (${result.length ?? 0} filas devueltas, ver conteo final abajo)`);
}

const after = await q(`SELECT estado, COUNT(*) as n FROM ${DS}.campaign_creators GROUP BY estado ORDER BY n DESC`);
console.log('\nDespués:');
after.forEach(r => console.log(`  ${r.estado}: ${r.n}`));

console.log('\n✓ Migración completada.');
