import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'bigquery-388915' });
const [meta] = await bq.dataset('ngr_ugc').table('campaigns').getMetadata();
console.log(JSON.stringify(meta.schema.fields.map(f => ({ name: f.name, type: f.type })), null, 2));
