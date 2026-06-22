/**
 * Inserta asignaciones fijas de creadores a campañas en campaign_creators.
 * ~49 filas totales, todos los estados representados en cada campaña.
 */

import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DS = 'ngr_ugc';

function q(sql) {
  return bq.query({ query: sql, location: 'US' }).then(([r]) => r);
}

const rows = [
  // ── camp-001 | Popeyes - Menú Verano 2025 | active ───────────────────────
  { id:'camp-001_ugc-001',   campaign_id:'camp-001', creator_id:'ugc-001',   brand_id:'popeyes',      estado:'Calificado', fecha_envio:'2025-08-02', fecha_respuesta:'2025-08-03' },
  { id:'camp-001_ugc-002',   campaign_id:'camp-001', creator_id:'ugc-002',   brand_id:'popeyes',      estado:'Respondió',  fecha_envio:'2025-08-02', fecha_respuesta:'2025-08-04' },
  { id:'camp-001_ugc-006',   campaign_id:'camp-001', creator_id:'ugc-006',   brand_id:'popeyes',      estado:'Calificado', fecha_envio:'2025-08-03', fecha_respuesta:'2025-08-04' },
  { id:'camp-001_5ba5fa11',  campaign_id:'camp-001', creator_id:'5ba5fa11',  brand_id:'popeyes',      estado:'Enviado',    fecha_envio:'2025-08-03', fecha_respuesta:null },
  { id:'camp-001_ae62608d',  campaign_id:'camp-001', creator_id:'ae62608d',  brand_id:'popeyes',      estado:'Pendiente',  fecha_envio:'2025-08-04', fecha_respuesta:null },
  { id:'camp-001_8d519bdd',  campaign_id:'camp-001', creator_id:'8d519bdd',  brand_id:'popeyes',      estado:'No aplica',  fecha_envio:'2025-08-02', fecha_respuesta:'2025-08-05' },

  // ── camp-002 | Don Belisario - Día del Pollo | draft ─────────────────────
  { id:'camp-002_ugc-009',   campaign_id:'camp-002', creator_id:'ugc-009',   brand_id:'donbelisario', estado:'Calificado', fecha_envio:'2025-07-02', fecha_respuesta:'2025-07-03' },
  { id:'camp-002_ugc-012',   campaign_id:'camp-002', creator_id:'ugc-012',   brand_id:'donbelisario', estado:'Calificado', fecha_envio:'2025-07-02', fecha_respuesta:'2025-07-04' },
  { id:'camp-002_6e6d91ea',  campaign_id:'camp-002', creator_id:'6e6d91ea',  brand_id:'donbelisario', estado:'Enviado',    fecha_envio:'2025-07-03', fecha_respuesta:null },
  { id:'camp-002_42cac6cf',  campaign_id:'camp-002', creator_id:'42cac6cf',  brand_id:'donbelisario', estado:'Pendiente',  fecha_envio:'2025-07-04', fecha_respuesta:null },

  // ── camp-003 | Dunkin' - Colección Otoño | paused ────────────────────────
  { id:'camp-003_ugc-007',   campaign_id:'camp-003', creator_id:'ugc-007',   brand_id:'dunkin',       estado:'Calificado', fecha_envio:'2025-06-02', fecha_respuesta:'2025-06-03' },
  { id:'camp-003_ugc-011',   campaign_id:'camp-003', creator_id:'ugc-011',   brand_id:'dunkin',       estado:'Respondió',  fecha_envio:'2025-06-02', fecha_respuesta:'2025-06-04' },
  { id:'camp-003_2838f32e',  campaign_id:'camp-003', creator_id:'2838f32e',  brand_id:'dunkin',       estado:'Enviado',    fecha_envio:'2025-06-03', fecha_respuesta:null },
  { id:'camp-003_75520f2d',  campaign_id:'camp-003', creator_id:'75520f2d',  brand_id:'dunkin',       estado:'Pendiente',  fecha_envio:'2025-06-04', fecha_respuesta:null },
  { id:'camp-003_d69ae15f',  campaign_id:'camp-003', creator_id:'d69ae15f',  brand_id:'dunkin',       estado:'No aplica',  fecha_envio:'2025-06-02', fecha_respuesta:'2025-06-05' },

  // ── camp-004 | Papa John's - Black Friday 2024 | completed ───────────────
  { id:'camp-004_ugc-001',   campaign_id:'camp-004', creator_id:'ugc-001',   brand_id:'papajohns',    estado:'Calificado', fecha_envio:'2025-05-02', fecha_respuesta:'2025-05-03' },
  { id:'camp-004_ugc-006',   campaign_id:'camp-004', creator_id:'ugc-006',   brand_id:'papajohns',    estado:'Calificado', fecha_envio:'2025-05-02', fecha_respuesta:'2025-05-03' },
  { id:'camp-004_ugc-009',   campaign_id:'camp-004', creator_id:'ugc-009',   brand_id:'papajohns',    estado:'Respondió',  fecha_envio:'2025-05-03', fecha_respuesta:'2025-05-05' },
  { id:'camp-004_ugc-004',   campaign_id:'camp-004', creator_id:'ugc-004',   brand_id:'papajohns',    estado:'Enviado',    fecha_envio:'2025-05-03', fecha_respuesta:null },
  { id:'camp-004_3477c0be',  campaign_id:'camp-004', creator_id:'3477c0be',  brand_id:'papajohns',    estado:'No aplica',  fecha_envio:'2025-05-02', fecha_respuesta:'2025-05-04' },
  { id:'camp-004_f9a60236',  campaign_id:'camp-004', creator_id:'f9a60236',  brand_id:'papajohns',    estado:'Calificado', fecha_envio:'2025-05-04', fecha_respuesta:'2025-05-05' },
  { id:'camp-004_ce2dd957',  campaign_id:'camp-004', creator_id:'ce2dd957',  brand_id:'papajohns',    estado:'Respondió',  fecha_envio:'2025-05-04', fecha_respuesta:'2025-05-06' },
  { id:'camp-004_229a2bd3',  campaign_id:'camp-004', creator_id:'229a2bd3',  brand_id:'papajohns',    estado:'No aplica',  fecha_envio:'2025-05-05', fecha_respuesta:'2025-05-06' },

  // ── camp-005 | Bembos - Burger Fest 2025 | active ────────────────────────
  { id:'camp-005_ugc-002',   campaign_id:'camp-005', creator_id:'ugc-002',   brand_id:'bembos',       estado:'Calificado', fecha_envio:'2025-04-02', fecha_respuesta:'2025-04-03' },
  { id:'camp-005_ugc-007',   campaign_id:'camp-005', creator_id:'ugc-007',   brand_id:'bembos',       estado:'Respondió',  fecha_envio:'2025-04-02', fecha_respuesta:'2025-04-04' },
  { id:'camp-005_45d77b4f',  campaign_id:'camp-005', creator_id:'45d77b4f',  brand_id:'bembos',       estado:'Enviado',    fecha_envio:'2025-04-03', fecha_respuesta:null },
  { id:'camp-005_acff1294',  campaign_id:'camp-005', creator_id:'acff1294',  brand_id:'bembos',       estado:'Pendiente',  fecha_envio:'2025-04-04', fecha_respuesta:null },
  { id:'camp-005_5ccab452',  campaign_id:'camp-005', creator_id:'5ccab452',  brand_id:'bembos',       estado:'Calificado', fecha_envio:'2025-04-03', fecha_respuesta:'2025-04-05' },
  { id:'camp-005_fdcc3dfb',  campaign_id:'camp-005', creator_id:'fdcc3dfb',  brand_id:'bembos',       estado:'No aplica',  fecha_envio:'2025-04-02', fecha_respuesta:'2025-04-04' },

  // ── camp-006 | Bembos - Aniversario 35 Años | draft ──────────────────────
  { id:'camp-006_ugc-012',   campaign_id:'camp-006', creator_id:'ugc-012',   brand_id:'bembos',       estado:'Calificado', fecha_envio:'2025-03-02', fecha_respuesta:'2025-03-03' },
  { id:'camp-006_ugc-011',   campaign_id:'camp-006', creator_id:'ugc-011',   brand_id:'bembos',       estado:'Enviado',    fecha_envio:'2025-03-03', fecha_respuesta:null },
  { id:'camp-006_2b97422d',  campaign_id:'camp-006', creator_id:'2b97422d',  brand_id:'bembos',       estado:'Pendiente',  fecha_envio:'2025-03-04', fecha_respuesta:null },

  // ── camp-007 | Don Belisario - Delivery Exprés | paused ──────────────────
  { id:'camp-007_ugc-001',   campaign_id:'camp-007', creator_id:'ugc-001',   brand_id:'donbelisario', estado:'Calificado', fecha_envio:'2025-02-02', fecha_respuesta:'2025-02-03' },
  { id:'camp-007_ugc-003',   campaign_id:'camp-007', creator_id:'ugc-003',   brand_id:'donbelisario', estado:'Respondió',  fecha_envio:'2025-02-02', fecha_respuesta:'2025-02-04' },
  { id:'camp-007_0b47baec',  campaign_id:'camp-007', creator_id:'0b47baec',  brand_id:'donbelisario', estado:'Enviado',    fecha_envio:'2025-02-03', fecha_respuesta:null },
  { id:'camp-007_6b260421',  campaign_id:'camp-007', creator_id:'6b260421',  brand_id:'donbelisario', estado:'Pendiente',  fecha_envio:'2025-02-04', fecha_respuesta:null },
  { id:'camp-007_52d81400',  campaign_id:'camp-007', creator_id:'52d81400',  brand_id:'donbelisario', estado:'No aplica',  fecha_envio:'2025-02-02', fecha_respuesta:'2025-02-05' },

  // ── camp-008 | Chinawok - Año Nuevo Chino | completed ────────────────────
  { id:'camp-008_ugc-006',   campaign_id:'camp-008', creator_id:'ugc-006',   brand_id:'chinawok',     estado:'Calificado', fecha_envio:'2025-01-16', fecha_respuesta:'2025-01-17' },
  { id:'camp-008_ugc-009',   campaign_id:'camp-008', creator_id:'ugc-009',   brand_id:'chinawok',     estado:'Calificado', fecha_envio:'2025-01-16', fecha_respuesta:'2025-01-18' },
  { id:'camp-008_ugc-010',   campaign_id:'camp-008', creator_id:'ugc-010',   brand_id:'chinawok',     estado:'Respondió',  fecha_envio:'2025-01-17', fecha_respuesta:'2025-01-19' },
  { id:'camp-008_ugc-004',   campaign_id:'camp-008', creator_id:'ugc-004',   brand_id:'chinawok',     estado:'No aplica',  fecha_envio:'2025-01-17', fecha_respuesta:'2025-01-18' },
  { id:'camp-008_84b42a63',  campaign_id:'camp-008', creator_id:'84b42a63',  brand_id:'chinawok',     estado:'Calificado', fecha_envio:'2025-01-16', fecha_respuesta:'2025-01-17' },
  { id:'camp-008_9bbcfe90',  campaign_id:'camp-008', creator_id:'9bbcfe90',  brand_id:'chinawok',     estado:'Enviado',    fecha_envio:'2025-01-18', fecha_respuesta:null },
  { id:'camp-008_c8e3bad2',  campaign_id:'camp-008', creator_id:'c8e3bad2',  brand_id:'chinawok',     estado:'Pendiente',  fecha_envio:'2025-01-19', fecha_respuesta:null },

  // ── camp-009 | Chinawok - Festival Lunar | active ────────────────────────
  { id:'camp-009_ugc-001',   campaign_id:'camp-009', creator_id:'ugc-001',   brand_id:'chinawok',     estado:'Calificado', fecha_envio:'2024-12-02', fecha_respuesta:'2024-12-03' },
  { id:'camp-009_ugc-007',   campaign_id:'camp-009', creator_id:'ugc-007',   brand_id:'chinawok',     estado:'Calificado', fecha_envio:'2024-12-02', fecha_respuesta:'2024-12-04' },
  { id:'camp-009_6cee0280',  campaign_id:'camp-009', creator_id:'6cee0280',  brand_id:'chinawok',     estado:'Enviado',    fecha_envio:'2024-12-03', fecha_respuesta:null },
  { id:'camp-009_9a17abcb',  campaign_id:'camp-009', creator_id:'9a17abcb',  brand_id:'chinawok',     estado:'Pendiente',  fecha_envio:'2024-12-04', fecha_respuesta:null },
  { id:'camp-009_d99a1ecf',  campaign_id:'camp-009', creator_id:'d99a1ecf',  brand_id:'chinawok',     estado:'No aplica',  fecha_envio:'2024-12-02', fecha_respuesta:'2024-12-05' },
];

console.log(`Insertando ${rows.length} asignaciones...`);
await bq.dataset(DS).table('campaign_creators').insert(rows);

console.log('\nVerificando por campaña:');
const counts = await q(`
  SELECT campaign_id, COUNT(*) as total,
    COUNTIF(estado = 'Calificado') as calificado,
    COUNTIF(estado = 'Respondió')  as respondio,
    COUNTIF(estado = 'Enviado')    as enviado,
    COUNTIF(estado = 'Pendiente')  as pendiente,
    COUNTIF(estado = 'No aplica')  as no_aplica
  FROM ${DS}.campaign_creators
  GROUP BY campaign_id
  ORDER BY campaign_id
`);
counts.forEach(r => {
  console.log(`  ${r.campaign_id}: ${r.total} total | Cal:${r.calificado} Res:${r.respondio} Env:${r.enviado} Pen:${r.pendiente} NA:${r.no_aplica}`);
});
console.log(`\n✓ Total: ${rows.length} asignaciones insertadas.`);
