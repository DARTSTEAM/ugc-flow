import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'bigquery-388915' });
const DATASET = 'ngr_ugc';

async function run() {
  console.log('Adding etiquetas and username_tiktok columns to creators table...');

  try {
    await bq.query({
      query: `ALTER TABLE \`bigquery-388915.${DATASET}.creators\` ADD COLUMN IF NOT EXISTS etiquetas STRING`,
      location: 'US',
    });
    console.log('✓ etiquetas column added (or already existed)');
  } catch (err) {
    console.error('✗ etiquetas:', err.message);
  }

  try {
    await bq.query({
      query: `ALTER TABLE \`bigquery-388915.${DATASET}.creators\` ADD COLUMN IF NOT EXISTS username_tiktok STRING`,
      location: 'US',
    });
    console.log('✓ username_tiktok column added (or already existed)');
  } catch (err) {
    console.error('✗ username_tiktok:', err.message);
  }

  console.log('Done. Run this once before deploying the server changes.');
}

run().catch(console.error);
