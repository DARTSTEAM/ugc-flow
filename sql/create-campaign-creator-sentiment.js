import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Crea la tabla `ngr_ugc.campaign_creator_sentiment`: sentimiento de comentarios
 * agregado por creador dentro de una campaña (a diferencia de `campaigns.sentiment_*`,
 * que es un agregado único de TODA la campaña mezclando creadores/posteos).
 *
 * Se recalcula por completo (DELETE + INSERT) cada vez que se corre "Analizar ahora"
 * sobre una campaña — mismo patrón idempotente que `creator_scores` en score-service.js.
 * Alimenta la columna "% sentimiento positivo" del Ranking de Creadores.
 */

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

async function run() {
  console.log(`Creando tabla ${DATASET}.campaign_creator_sentiment ...\n`);

  await bq.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`hike-agentic-playground.${DATASET}.campaign_creator_sentiment\` (
        campaign_id STRING NOT NULL,
        creator_id  STRING NOT NULL,
        positive    INT64,             -- % de comentarios positivos (0-100)
        neutral     INT64,
        negative    INT64,
        sample_size INT64,             -- cantidad de comentarios clasificados
        updated_at  TIMESTAMP
      )
    `,
    location: 'US',
  });

  console.log('✓ Tabla campaign_creator_sentiment creada (o ya existía).');
}

run().catch(console.error);
