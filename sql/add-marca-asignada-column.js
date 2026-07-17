import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Agrega a `users` la marca por defecto que se le preselecciona a ese
 * usuario en el selector de empresa del nav. NULL = sin asignar / Grupo NGR
 * (en ese caso el frontend cae de vuelta a 'popeyes').
 */

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

async function run() {
  console.log(`Adding marca_asignada column to ${DATASET}.users ...\n`);

  await bq.query({
    query: `ALTER TABLE \`hike-agentic-playground.${DATASET}.users\` ADD COLUMN IF NOT EXISTS marca_asignada STRING`,
    location: 'US',
  });
  console.log('✓ marca_asignada (STRING, nullable)');
}

run().catch(console.error);
