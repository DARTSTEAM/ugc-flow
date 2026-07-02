import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

async function run() {
  await bq.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`${DATASET}.agent_conversations\` (
        conversation_id STRING NOT NULL,
        started_at TIMESTAMP,
        feedback STRING,
        feedback_at TIMESTAMP
      )
    `,
    location: 'US',
  });
  console.log('✅ agent_conversations table ready');

  await bq.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`${DATASET}.agent_messages\` (
        message_id STRING NOT NULL,
        conversation_id STRING NOT NULL,
        role STRING NOT NULL,
        content STRING NOT NULL,
        created_at TIMESTAMP NOT NULL
      )
    `,
    location: 'US',
  });
  console.log('✅ agent_messages table ready');
}

run().catch(err => { console.error(err); process.exit(1); });
