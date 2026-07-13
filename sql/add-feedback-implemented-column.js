import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Agrega a `agent_conversations` la columna que marca si el feedback dejado
 * por el usuario ya fue trabajado/implementado. Por defecto false; se marca
 * true a mano (UPDATE) cuando se resuelve el feedback correspondiente.
 */

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

async function run() {
  console.log(`Adding implemented column to ${DATASET}.agent_conversations ...\n`);

  await bq.query({
    query: `ALTER TABLE \`hike-agentic-playground.${DATASET}.agent_conversations\` ADD COLUMN IF NOT EXISTS implemented BOOL`,
    location: 'US',
  });
  console.log('✓ implemented (BOOL)');

  await bq.query({
    query: `UPDATE \`hike-agentic-playground.${DATASET}.agent_conversations\` SET implemented = FALSE WHERE implemented IS NULL`,
    location: 'US',
  });
  console.log('✓ backfilled existing rows to implemented = FALSE');
}

run().catch(console.error);
