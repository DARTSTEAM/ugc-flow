import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'bigquery-388915' });
const DATASET = 'ngr_ugc';

const [rows] = await bq.query({
  query: `
    SELECT c.campaign_id, c.name, c.status, c.start_date, c.end_date, b.name as brand_name, b.brand_id
    FROM ${DATASET}.campaigns c
    LEFT JOIN ${DATASET}.brands b ON c.brand_id = b.brand_id
    ORDER BY c.start_date DESC NULLS LAST
  `,
  location: 'US',
});

console.log(JSON.stringify(rows, null, 2));
