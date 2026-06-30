import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

/**
 * Crea la tabla `ngr_ugc.campaign_content`: una fila por pieza de contenido
 * publicada que un creador hizo PARA una campaña. La atribución es manual
 * (el equipo carga la URL exacta del posteo), por lo que las sumas a nivel
 * campaña salen SIEMPRE de estas filas y nunca de "los últimos posteos" del perfil.
 *
 * Métricas orgánicas (públicas, scrapeables por Kernel desde el permalink):
 *   org_views, org_likes, org_comments, org_shares, org_saves, org_engagement_rate
 *
 * shares/saves pueden quedar NULL en Instagram (no son públicos); en TikTok sí.
 */

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

async function run() {
  console.log(`Creando tabla ${DATASET}.campaign_content ...\n`);

  await bq.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`hike-agentic-playground.${DATASET}.campaign_content\` (
        content_id          STRING NOT NULL,   -- PK determinístico = hash(campaign_id|url)
        campaign_id         STRING NOT NULL,
        creator_id          STRING NOT NULL,
        platform            STRING,             -- 'instagram' | 'tiktok' | 'desconocida'
        content_url         STRING,

        org_views           INT64,
        org_likes           INT64,
        org_comments        INT64,
        org_shares          INT64,
        org_saves           INT64,
        org_engagement_rate FLOAT64,            -- (likes+comments+shares+saves)/views×100
        org_last_scraped_at TIMESTAMP,
        scrape_error        STRING,             -- último error de scrape, NULL si OK

        created_at          TIMESTAMP,
        updated_at          TIMESTAMP
      )
    `,
    location: 'US',
  });

  console.log('✓ Tabla campaign_content creada (o ya existía).');
  console.log('\nListo. Endpoints disponibles:');
  console.log('  POST   /api/campaigns/:id/content        — registrar URL de posteo');
  console.log('  GET    /api/campaigns/:id/content        — listar contenido + métricas');
  console.log('  DELETE /api/campaigns/:id/content/:cid    — quitar posteo');
  console.log('  POST   /api/campaigns/:id/scrape-content  — actualizar métricas con Kernel');
}

run().catch(console.error);
