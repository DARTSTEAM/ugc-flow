/**
 * Migra las campañas de ejemplo en BigQuery:
 * - Inserta marcas faltantes (Chinawok, Dunkin', Don Belisario)
 * - Corrige el nombre de Papa Johns → Papa John's
 * - Reemplaza todas las campañas con 9 ejemplos en formato "Marca - Evento"
 * - Estatuses distribuidos: active, draft, paused, completed de forma intercalada
 * - start_date ordenado DESC para que el display sea A→B→P→C→A→B→P→C→A
 */

import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DS = 'ngr_ugc';

async function q(sql, params) {
  const [rows] = await bq.query({ query: sql, params, location: 'US' });
  return rows;
}

console.log('=== Migración de campañas ===\n');

// ── 1. Insertar marcas faltantes ────────────────────────────────────────────
console.log('1. Insertando marcas faltantes...');

await q(`
  INSERT INTO ${DS}.brands (brand_id, name, industry, country, created_at)
  SELECT * FROM UNNEST([
    STRUCT('chinawok'     AS brand_id, 'Chinawok'      AS name, 'QSR' AS industry, 'PE' AS country, CURRENT_TIMESTAMP() AS created_at),
    STRUCT('dunkin'       AS brand_id, "Dunkin'"        AS name, 'QSR' AS industry, 'PE' AS country, CURRENT_TIMESTAMP() AS created_at),
    STRUCT('donbelisario' AS brand_id, 'Don Belisario'  AS name, 'QSR' AS industry, 'PE' AS country, CURRENT_TIMESTAMP() AS created_at)
  ])
  WHERE brand_id NOT IN (SELECT brand_id FROM ${DS}.brands)
`);

// ── 2. Corregir nombre de Papa Johns ────────────────────────────────────────
console.log("2. Actualizando 'Papa Johns' → 'Papa John's'...");

await q(`UPDATE ${DS}.brands SET name = "Papa John's" WHERE brand_id = 'papajohns'`);

// ── 3. Borrar campaign_creators y campañas existentes ───────────────────────
console.log('3. Limpiando campaña_creators y campañas existentes...');

await q(`DELETE FROM ${DS}.campaign_creators WHERE true`);
await q(`DELETE FROM ${DS}.campaigns WHERE true`);

// ── 4. Insertar 9 campañas nuevas ───────────────────────────────────────────
// Orden por start_date DESC da el patrón: Activa→Borrador→Pausada→Cerrada→Activa→Borrador→Pausada→Cerrada→Activa
console.log('4. Insertando 9 campañas nuevas...');

await q(`
  INSERT INTO ${DS}.campaigns
    (campaign_id, brand_id, name, slug, start_date, end_date, status, description, created_at)
  VALUES
    ('camp-001', 'popeyes',      "Popeyes - Menú Verano 2025",       'popeyes-menu-verano-2025',      DATE('2025-08-01'), DATE('2025-10-31'), 'active',    'Campaña de UGC para el menú de verano de Popeyes. Buscamos creadores amantes del pollo crujiente estilo sureño.',                    CURRENT_TIMESTAMP()),
    ('camp-002', 'donbelisario', 'Don Belisario - Día del Pollo',     'donbelisario-dia-del-pollo',    DATE('2025-07-01'), DATE('2025-08-15'), 'draft',     'Campaña de UGC para el Día del Pollo de Don Belisario. Pollos a la brasa y gastronomía peruana auténtica.',                        CURRENT_TIMESTAMP()),
    ('camp-003', 'dunkin',       "Dunkin' - Colección Otoño",         'dunkin-coleccion-otono',        DATE('2025-06-01'), DATE('2025-07-31'), 'paused',    "Campaña de UGC para la colección de otoño de Dunkin'. Donuts de temporada y cafetería especial.",                                     CURRENT_TIMESTAMP()),
    ('camp-004', 'papajohns',    "Papa John's - Black Friday 2024",   'papajohns-black-friday-2024',   DATE('2025-05-01'), DATE('2025-05-31'), 'completed', "Campaña de UGC para Black Friday 2024 de Papa John's. Alta rotación para comunicar promociones de pizzas.",                           CURRENT_TIMESTAMP()),
    ('camp-005', 'bembos',       'Bembos - Burger Fest 2025',         'bembos-burger-fest-2025',       DATE('2025-04-01'), DATE('2025-05-31'), 'active',    'Campaña de UGC para el Burger Fest 2025 de Bembos. Creadores food y lifestyle apasionados por las mejores hamburguesas.',             CURRENT_TIMESTAMP()),
    ('camp-006', 'bembos',       'Bembos - Aniversario 35 Años',      'bembos-aniversario-35',         DATE('2025-03-01'), DATE('2025-04-30'), 'draft',     'Campaña especial de UGC para el 35 aniversario de Bembos. Celebramos 35 años de las mejores hamburguesas del Perú.',                CURRENT_TIMESTAMP()),
    ('camp-007', 'donbelisario', 'Don Belisario - Delivery Exprés',   'donbelisario-delivery-expres',  DATE('2025-02-01'), DATE('2025-03-31'), 'paused',    'Campaña de UGC para el servicio de delivery exprés de Don Belisario. Creadores que disfrutan comida peruana desde casa.',            CURRENT_TIMESTAMP()),
    ('camp-008', 'chinawok',     'Chinawok - Año Nuevo Chino',        'chinawok-ano-nuevo-chino',      DATE('2025-01-15'), DATE('2025-02-15'), 'completed', 'Campaña de UGC para celebrar el Año Nuevo Chino con Chinawok. Contenido auténtico sobre tradición culinaria oriental.',               CURRENT_TIMESTAMP()),
    ('camp-009', 'chinawok',     'Chinawok - Festival Lunar',         'chinawok-festival-lunar',       DATE('2024-12-01'), DATE('2025-01-31'), 'active',    'Campaña de UGC para el Festival Lunar de Chinawok. Buscamos creadores que amen la comida oriental y quieran compartir la experiencia.', CURRENT_TIMESTAMP())
`);

// ── 5. Verificar resultado ──────────────────────────────────────────────────
console.log('\n5. Resultado final:\n');

const result = await q(`
  SELECT c.campaign_id, c.name, c.status, c.start_date
  FROM ${DS}.campaigns c
  ORDER BY c.start_date DESC NULLS LAST
`);

result.forEach((r, i) => {
  console.log(`  ${i + 1}. [${r.status.padEnd(9)}] ${r.name}  (${r.start_date?.value || 'sin fecha'})`);
});

console.log('\n✓ Migración completada.');
