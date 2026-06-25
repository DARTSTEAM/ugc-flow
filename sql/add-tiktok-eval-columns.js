import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

const COLUMNS = [
  // Prerequisite columns from previous migration (safe to re-run with IF NOT EXISTS)
  { name: 'etiquetas',      type: 'STRING',    description: 'JSON array of tags' },
  { name: 'username_tiktok', type: 'STRING',   description: 'TikTok @handle' },

  // TikTok evaluation data (parallel to eval_perfil_* for Instagram)
  { name: 'tiktok_eval_seguidores',      type: 'INT64',     description: 'TikTok follower count' },
  { name: 'tiktok_eval_engagement_rate', type: 'FLOAT64',   description: 'TikTok ER %: (likes+comments)/(videos×followers)×100' },
  { name: 'tiktok_eval_promedio_vistas', type: 'INT64',     description: 'Average TikTok play count (last 5 videos)' },
  { name: 'tiktok_eval_last_scraped_at', type: 'TIMESTAMP', description: 'When TikTok data was last scraped via Kernel' },
];

async function run() {
  console.log(`Adding TikTok eval columns to ${DATASET}.creators ...\n`);

  for (const col of COLUMNS) {
    try {
      await bq.query({
        query: `ALTER TABLE \`hike-agentic-playground.${DATASET}.creators\` ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`,
        location: 'US',
      });
      console.log(`✓ ${col.name} (${col.type})`);
    } catch (err) {
      console.error(`✗ ${col.name}: ${err.message}`);
    }
  }

  console.log('\nDone. You can now use POST /api/creators/:id/scrape-tiktok.');
}

run().catch(console.error);
