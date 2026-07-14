/**
 * "Email" deja de existir como canal de contacto (se removió la opción del
 * formulario y de los badges de la UI). Los creadores que ya tenían
 * canal = 'Email' pasan a 'Instagram'.
 */

import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DS = 'ngr_ugc';

async function q(sql, params) {
  const [rows] = await bq.query({ query: sql, params, location: 'US' });
  return rows;
}

console.log('=== Migración de canal Email → Instagram ===\n');

const before = await q(`SELECT canal, COUNT(*) as n FROM ${DS}.creators GROUP BY canal ORDER BY n DESC`);
console.log('Antes:');
before.forEach(r => console.log(`  ${r.canal ?? '(null)'}: ${r.n}`));

const affected = await q(`SELECT creator_id, full_name FROM ${DS}.creators WHERE canal = 'Email'`);
console.log(`\nCreadores a migrar (${affected.length}):`);
affected.forEach(r => console.log(`  ${r.creator_id} — ${r.full_name}`));

await q(`
  UPDATE ${DS}.creators SET canal = 'Instagram', updated_at = CURRENT_TIMESTAMP()
  WHERE canal = 'Email'
`);

const after = await q(`SELECT canal, COUNT(*) as n FROM ${DS}.creators GROUP BY canal ORDER BY n DESC`);
console.log('\nDespués:');
after.forEach(r => console.log(`  ${r.canal ?? '(null)'}: ${r.n}`));

console.log('\n✓ Migración completada.');
