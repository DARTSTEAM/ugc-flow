-- ============================================================
-- BigQuery schema migrations for evaluation fields
-- Dataset: ngr_ugc  |  Project: hike-agentic-playground
-- Run these in the BigQuery console (one at a time).
-- ============================================================

-- ── creators table ──────────────────────────────────────────

-- Kernel / profile evaluation (populated by Kernel scraper)
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_perfil_nombre               STRING;
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_perfil_handle               STRING;
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_perfil_seguidores            INT64;
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_perfil_engagement_rate_cuenta FLOAT64;
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_perfil_promedio_vistas        INT64;   -- avg views last 5 videos
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_perfil_categoria              STRING;
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_perfil_rango_edad_seguidores  STRING;  -- e.g. "18-24"
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_perfil_last_scraped_at        TIMESTAMP;

-- Phone (for WhatsApp outreach)
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS phone STRING;

-- Organic content evaluation (manual form — each field = 25% weight)
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_organica_views           FLOAT64;   -- avg views (25%)
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_organica_shares          FLOAT64;   -- avg shares (25%)
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_organica_engagement_rate FLOAT64;   -- ER % (25%)
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_organica_hook_natural    FLOAT64;   -- 1-10 score (25%)
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_organica_completado      BOOL;

-- Pauta KPIs evaluation (manual form)
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_pauta_impresiones        INT64;
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_pauta_alcance            INT64;
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_pauta_cpm               FLOAT64;   -- cost per 1000 impressions
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_pauta_frecuencia        FLOAT64;   -- exposure frequency
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_pauta_ctr               FLOAT64;   -- % click-through rate
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_pauta_vtr               FLOAT64;   -- % view-through rate
ALTER TABLE ngr_ugc.creators ADD COLUMN IF NOT EXISTS eval_pauta_completado        BOOL;

-- ── campaigns table ─────────────────────────────────────────

ALTER TABLE ngr_ugc.campaigns ADD COLUMN IF NOT EXISTS mensaje_contacto STRING;   -- WhatsApp outreach message template
