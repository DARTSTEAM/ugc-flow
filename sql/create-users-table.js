/**
 * Crea la tabla `ngr_ugc.users` y siembra el único usuario actual del sistema.
 * Todavía no hay autenticación real (ver UserProfileMenu.tsx), así que esta
 * tabla guarda un solo perfil editable ("mi perfil") en vez de una lista de
 * cuentas con login.
 */

import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';
export const CURRENT_USER_ID = 'user-001';

async function run() {
  console.log(`Creando tabla ${DATASET}.users ...\n`);

  await bq.query({
    query: `
      CREATE TABLE IF NOT EXISTS \`hike-agentic-playground.${DATASET}.users\` (
        user_id     STRING NOT NULL,
        nombre      STRING,
        area        STRING,
        email       STRING,
        foto_url    STRING,   -- data URL (base64) o link externo a la foto de perfil
        created_at  TIMESTAMP,
        updated_at  TIMESTAMP
      )
    `,
    location: 'US',
  });
  console.log('✓ Tabla users creada (o ya existía).');

  const [existing] = await bq.query({
    query: `SELECT user_id FROM \`${DATASET}.users\` WHERE user_id = @id`,
    params: { id: CURRENT_USER_ID },
    location: 'US',
  });

  if (existing.length === 0) {
    // INSERT vía DML (no streaming insert): las filas quedan disponibles para
    // UPDATE/DELETE de inmediato. El API de streaming (`table.insert()`) deja
    // las filas en el streaming buffer, donde no se pueden UPDATE/DELETE por ~90min.
    await bq.query({
      query: `
        INSERT INTO \`${DATASET}.users\` (user_id, nombre, area, email, foto_url, created_at, updated_at)
        VALUES (@id, @nombre, @area, NULL, NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
      `,
      params: { id: CURRENT_USER_ID, nombre: 'Bautista', area: 'Marketing' },
      location: 'US',
    });
    console.log(`✓ Usuario semilla "${CURRENT_USER_ID}" insertado.`);
  } else {
    console.log(`✓ Usuario "${CURRENT_USER_ID}" ya existía, no se volvió a insertar.`);
  }

  console.log('\nListo. Endpoints disponibles:');
  console.log('  GET /api/profile  — obtener el perfil actual');
  console.log('  PUT /api/profile  — actualizar nombre, área, email o foto');
}

run().catch(err => { console.error(err); process.exit(1); });
