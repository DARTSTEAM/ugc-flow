import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Crea las tablas que soportan el refresh on-demand de Recomendaciones:
 *
 *  - recommendation_runs: una fila por corrida del botón "Actualizar tendencias".
 *    Sirve de mutex (sólo una 'running' a la vez) y de gate de cooldown de 24hs
 *    (sólo se exige tras una corrida 'completed' — un 'failed' no penaliza).
 *
 *  - creator_metric_snapshots: una copia fechada de las columnas eval_perfil_,
 *    tiktok_eval_ y score que `creators` ya tiene, tomada al final de cada corrida
 *    exitosa. No son métricas nuevas — es la foto en el tiempo que hoy no existe
 *    en ningún lado (todo en `creators` se pisa con UPDATE).
 */

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

async function run() {
  console.log(`Creando tablas de recomendaciones en ${DATASET} ...\n`);

  await bq.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`hike-agentic-playground.${DATASET}.recommendation_runs\` (
        run_id         STRING NOT NULL,   -- PK, ej. run_<Date.now().toString(36)>
        started_at     TIMESTAMP NOT NULL,
        finished_at    TIMESTAMP,
        status         STRING NOT NULL,   -- 'running' | 'completed' | 'failed'
        creators_count INT64,             -- tamaño del watchlist intentado
        success_count  INT64,
        failed_count   INT64,
        error_message  STRING,
        created_at     TIMESTAMP
      )
    `,
    location: 'US',
  });
  console.log('✓ recommendation_runs creada (o ya existía).');

  await bq.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`hike-agentic-playground.${DATASET}.creator_metric_snapshots\` (
        snapshot_id           STRING NOT NULL,  -- PK = snp_<run_id>_<creator_id>
        run_id                STRING NOT NULL,  -- FK -> recommendation_runs.run_id
        creator_id            STRING NOT NULL,
        captured_at           TIMESTAMP NOT NULL,

        ig_seguidores         INT64,
        ig_engagement_rate    FLOAT64,
        ig_promedio_vistas    INT64,
        ig_frecuencia_semanal FLOAT64,
        ig_videos_virales     INT64,

        tt_seguidores         INT64,
        tt_engagement_rate    FLOAT64,
        tt_promedio_vistas    INT64,
        tt_frecuencia_semanal FLOAT64,
        tt_videos_virales     INT64,

        score                 INT64,

        created_at            TIMESTAMP
      )
    `,
    location: 'US',
  });
  console.log('✓ creator_metric_snapshots creada (o ya existía).');

  console.log('\nListo. Endpoints disponibles:');
  console.log('  GET  /api/recomendaciones                — 3 secciones (fórmula ganadora, en alza, ex-colaboradores)');
  console.log('  POST /api/recomendaciones/refresh         — dispara el refresh on-demand (gate de 24hs)');
  console.log('  GET  /api/recomendaciones/refresh-status  — estado del gate / corrida en curso');
}

run().catch(err => { console.error(err); process.exit(1); });
