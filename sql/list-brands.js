import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const [rows] = await bq.query({ query: `SELECT * FROM ngr_ugc.brands ORDER BY brand_id`, location: 'US' });
console.log(JSON.stringify(rows, null, 2));
