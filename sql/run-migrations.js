/**
 * Runs all BigQuery ALTER TABLE migrations for the evaluation fields.
 * Usage: node sql/run-migrations.js
 */
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'bigquery-388915' });
const DATASET = 'ngr_ugc';

const MIGRATIONS = [
  // ── creators: Kernel profile evaluation ─────────────────────────
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_perfil_nombre STRING`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_perfil_handle STRING`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_perfil_seguidores INT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_perfil_engagement_rate_cuenta FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_perfil_promedio_vistas INT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_perfil_categoria STRING`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_perfil_rango_edad_seguidores STRING`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_perfil_last_scraped_at TIMESTAMP`,

  // ── creators: WhatsApp phone ────────────────────────────────────
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS phone STRING`,

  // ── creators: organic content evaluation (25% each) ────────────
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_organica_views FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_organica_shares FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_organica_engagement_rate FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_organica_hook_natural FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_organica_completado BOOL`,

  // ── creators: pauta KPIs evaluation ─────────────────────────────
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_pauta_impresiones INT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_pauta_alcance INT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_pauta_cpm FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_pauta_frecuencia FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_pauta_ctr FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_pauta_vtr FLOAT64`,
  `ALTER TABLE ${DATASET}.creators ADD COLUMN IF NOT EXISTS eval_pauta_completado BOOL`,

  // ── campaigns: outreach message template ────────────────────────
  `ALTER TABLE ${DATASET}.campaigns ADD COLUMN IF NOT EXISTS mensaje_contacto STRING`,
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`Running ${MIGRATIONS.length} migrations on ${DATASET}...\n`);

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const sql = MIGRATIONS[i];
    const label = sql.replace(`ALTER TABLE ${DATASET}.`, '').substring(0, 80);
    process.stdout.write(`[${i + 1}/${MIGRATIONS.length}] ${label}... `);

    try {
      const [job] = await bq.createQueryJob({ query: sql, location: 'US' });
      await job.getQueryResults();
      console.log('✓');
    } catch (err) {
      if (err.message?.includes('already exists')) {
        console.log('(already exists)');
      } else {
        console.error(`\n  ERROR: ${err.message}`);
      }
    }

    // Respect BigQuery DDL rate limits — 1 table update per ~2s is safe
    if (i < MIGRATIONS.length - 1) await sleep(2500);
  }

  console.log('\nAll migrations complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
