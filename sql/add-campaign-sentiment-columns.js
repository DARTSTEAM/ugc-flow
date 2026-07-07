import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Agrega a `campaigns` las columnas donde se persiste el último cálculo de
 * sentimiento (agregado de los últimos 10 comentarios de cada posteo cargado
 * en campaign_content, clasificados por MiniMax). Ver server/sentiment-service.js.
 */

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

const COLUMNS = [
  { name: 'sentiment_positive',    type: 'INT64',     description: '% de comentarios positivos en el último análisis' },
  { name: 'sentiment_neutral',     type: 'INT64',     description: '% de comentarios neutrales (100 - positive - negative)' },
  { name: 'sentiment_negative',    type: 'INT64',     description: '% de comentarios negativos en el último análisis' },
  { name: 'sentiment_sample_size', type: 'INT64',     description: 'Cantidad de comentarios que entraron en el cálculo' },
  { name: 'sentiment_updated_at',  type: 'TIMESTAMP', description: 'Cuándo se calculó el sentimiento por última vez' },
];

async function run() {
  console.log(`Adding sentiment columns to ${DATASET}.campaigns ...\n`);

  for (const col of COLUMNS) {
    try {
      await bq.query({
        query: `ALTER TABLE \`hike-agentic-playground.${DATASET}.campaigns\` ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`,
        location: 'US',
      });
      console.log(`✓ ${col.name} (${col.type})`);
    } catch (err) {
      console.error(`✗ ${col.name}: ${err.message}`);
    }
  }

  console.log('\nListo. El pipeline de sentimiento corre dentro de POST /api/campaigns/:id/scrape-content.');
}

run().catch(console.error);
