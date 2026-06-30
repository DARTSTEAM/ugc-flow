# Informe técnico — Dashboard de métricas de campaña

> Análisis de las respuestas del cliente (NGR/Hike) sobre el resumen de campaña, con la lógica de cálculo real de cada métrica, los cambios de flujo, base de datos, scrapers de Kernel y nuevos servicios necesarios.
> Fecha: 30/06/2026

---

## 0. Resumen ejecutivo

El cliente pidió 5 bloques en el resumen **a nivel campaña** (no creador):

1. **Indicadores totales**: alcance, impresiones, vistas, VTR, EG (engagement), CTR, frecuencia, CPM
2. **Top de creadores** (por vistas, alcance, impresiones, VTR, CTR, EG, categoría/tipo de creador)
3. **Top de contenidos** (por vistas, alcance, impresiones, VTR, CTR, EG)
4. **Sentiment de la campaña** (positivo / neutro / negativo)
5. **Comparativa creador/contenido vs. recomendación de IA** sobre históricos de campañas exitosas (por encima/por debajo del promedio → rojo/verde + puntaje)

### El hallazgo más importante (define todo el resto)

Hoy las métricas están modeladas **por creador** y sirven para el *score de prospección*. El dashboard que se pide es **performance de cada pieza de contenido publicada dentro de una campaña**. Eso requiere una **granularidad nueva que no existe en la base**: una fila por contenido publicado. Sin esa tabla no se pueden hacer "Top de contenidos" ni agregados correctos de campaña.

Segundo hallazgo crítico — **las 8 métricas no tienen la misma fuente**:

| Grupo | Métricas | ¿Kernel puede obtenerlas? |
|---|---|---|
| **Orgánicas** (perfil público) | vistas, likes, comentarios, shares, guardados, engagement | ✅ Sí, scrapeables por pieza |
| **De pauta / paid media** (Ads Manager) | alcance, impresiones, CPM, frecuencia, VTR, CTR, spend | ❌ **No**. No están en el perfil público. Sólo vía Meta/TikTok Marketing API o carga manual (CSV de pauta) |

> **Conclusión:** "alcance, impresiones, VTR, CTR, frecuencia y CPM" son métricas de **inversión publicitaria**. Kernel scrapea el perfil público y **nunca** va a ver el CPM ni el alcance pauteado. Esos datos entran por **API de Ads** (ideal, pesado) o por **import del Excel/CSV de pauta** que NGR ya maneja (pragmático para v1). Hay que comunicarle esto al cliente con claridad para no prometer automatización donde no la hay.

---

## 1. Análisis métrica por métrica

Notación: **Org** = orgánico (scrapeable Kernel), **Paid** = pauta (Ads API / CSV / manual).

| # | Métrica | Definición / Fórmula | Fuente real | Aditiva a nivel campaña |
|---|---|---|---|---|
| 1 | **Alcance** | Personas únicas que vieron el contenido | **Paid** (Ads Manager) | ❌ **NO sumar** — el alcance es deduplicado; sumar creadores/adgroups infla. Se carga un número único por campaña o se muestra como "estimado" con nota (ya lo había aclarado Raissa). |
| 2 | **Impresiones** | Veces que se mostró el contenido (no únicas) | **Paid** (Ads Manager) | ✅ Sí (sumables) |
| 3 | **Vistas** | Reproducciones del video | **Org** (Kernel `playCount`) + **Paid** (video views) | ✅ Sí. Definir si "vistas" = orgánicas + paid o sólo una. Recomiendo separar `vistasOrganicas` y `vistasPaid` y mostrar total. |
| 4 | **VTR** (view-through rate) | video views / impresiones × 100 (o vistas al 100%) | **Paid** (Ads Manager) | ❌ Es ratio → se promedia ponderado por impresiones, no se suma |
| 5 | **EG / Engagement** | (likes + comentarios + shares + guardados) / vistas × 100 (ó / alcance) | **Org** (Kernel) | ❌ Ratio → promedio ponderado por vistas |
| 6 | **CTR** (click-through rate) | clicks / impresiones × 100 | **Paid** (Ads Manager) | ❌ Ratio → promedio ponderado por impresiones |
| 7 | **Frecuencia** | impresiones / alcance | **Paid** (derivada) | ❌ Se recalcula a nivel campaña = Σ impresiones / alcance dedup. **No** se promedian las frecuencias individuales |
| 8 | **CPM** | (spend / impresiones) × 1000 | **Paid** (requiere **spend $**) | ❌ Se recalcula = Σ spend / Σ impresiones × 1000. Requiere dato de inversión que hoy no existe en la base |

### Reglas de agregación correctas (clave para que los totales sean reales)

- **Sumables**: impresiones, vistas, likes, comentarios, shares, spend.
- **Ratios → promedio ponderado** (no media simple):
  - EG campaña = Σ(interacciones) / Σ(vistas) × 100
  - VTR campaña = Σ(video views) / Σ(impresiones) × 100
  - CTR campaña = Σ(clicks) / Σ(impresiones) × 100
  - CPM campaña = Σ(spend) / Σ(impresiones) × 1000
  - Frecuencia campaña = Σ(impresiones) / alcance_dedup
- **Alcance**: nunca sumar. Cargar valor único de campaña, o mostrar "alcance estimado = máx(alcances) … Σ(alcances)" con disclaimer.

> Estas reglas se implementan en una sola función de agregación en el backend (`computeCampaignMetrics`), no en SQL disperso, para poder testearlas.

### "EG" — ambigüedad a confirmar
"EG" casi seguro es **engagement** (rate o total). Hay que confirmar con el cliente:
- ¿ER sobre **vistas** o sobre **alcance/seguidores**? (estándar UGC es sobre vistas para video).
- ¿Incluye **guardados**? (IG sí los expone a veces; TikTok no tiene "saves" igual).

---

## 2. Cambios en la base de datos (BigQuery `ngr_ugc`)

### 2.1 Nueva tabla `campaign_content` (núcleo del feature)
Una fila por **pieza de contenido publicada** dentro de una campaña. Es lo que habilita Top de contenidos, Top de creadores (agregando) e Indicadores totales (agregando).

```sql
CREATE TABLE IF NOT EXISTS ngr_ugc.campaign_content (
  content_id        STRING NOT NULL,   -- PK (uuid o hash de url)
  campaign_id       STRING NOT NULL,
  creator_id        STRING NOT NULL,
  platform          STRING,            -- 'instagram' | 'tiktok'
  content_url       STRING,
  content_type      STRING,            -- 'reel' | 'video' | 'post'
  published_at      TIMESTAMP,

  -- ── Orgánico (scrapeable Kernel) ──
  org_views         INT64,
  org_likes         INT64,
  org_comments      INT64,
  org_shares        INT64,
  org_saves         INT64,             -- IG only, puede ser NULL
  org_engagement_rate FLOAT64,         -- calculado
  org_last_scraped_at TIMESTAMP,

  -- ── Pauta (Ads API / CSV / manual) ──
  paid_impresiones  INT64,
  paid_alcance      INT64,             -- por pieza; NO sumar a campaña
  paid_video_views  INT64,
  paid_clicks       INT64,
  paid_spend        FLOAT64,           -- inversión $ (necesaria para CPM)
  paid_ctr          FLOAT64,
  paid_vtr          FLOAT64,
  paid_frecuencia   FLOAT64,
  paid_cpm          FLOAT64,
  paid_source       STRING,            -- 'meta_api' | 'tiktok_api' | 'csv' | 'manual'
  paid_last_updated_at TIMESTAMP,

  -- ── Sentiment (Kernel comments + LLM) ──
  sentiment_label   STRING,            -- 'positivo' | 'neutro' | 'negativo'
  sentiment_score   FLOAT64,           -- -1..1
  sentiment_pos_pct FLOAT64,
  sentiment_neu_pct FLOAT64,
  sentiment_neg_pct FLOAT64,
  sentiment_sample  INT64,             -- nº comentarios analizados
  sentiment_at      TIMESTAMP,

  created_at        TIMESTAMP,
  updated_at        TIMESTAMP
);
```

### 2.2 Columnas nuevas en `campaigns` (datos no aditivos a nivel campaña)
El alcance y el spend total de campaña son **un solo número** (no se derivan sumando piezas):

```sql
ALTER TABLE ngr_ugc.campaigns ADD COLUMN IF NOT EXISTS paid_alcance_total INT64;   -- alcance dedup de toda la campaña
ALTER TABLE ngr_ugc.campaigns ADD COLUMN IF NOT EXISTS paid_spend_total   FLOAT64; -- inversión total
ALTER TABLE ngr_ugc.campaigns ADD COLUMN IF NOT EXISTS paid_source        STRING;
ALTER TABLE ngr_ugc.campaigns ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMP;
```

### 2.3 Tabla `content_comments` (opcional pero recomendada para auditar sentiment)
```sql
CREATE TABLE IF NOT EXISTS ngr_ugc.content_comments (
  comment_id      STRING,
  content_id      STRING,
  campaign_id     STRING,
  texto           STRING,
  author          STRING,
  likes           INT64,
  sentiment_label STRING,
  sentiment_score FLOAT64,
  scraped_at      TIMESTAMP
);
```
Permite re-calcular sentiment sin re-scrapear y mostrar "comentarios destacados" por sentimiento.

### 2.4 Benchmarks históricos `campaign_benchmarks` (para la comparativa IA)
La comparativa "vs históricos de campañas exitosas" necesita una referencia. Dos opciones:

- **Simple (recomendada v1):** tabla de agregados pre-calculados.
```sql
CREATE TABLE IF NOT EXISTS ngr_ugc.campaign_benchmarks (
  benchmark_id STRING,
  scope        STRING,   -- 'global' | 'brand:bembos' | 'tier:50k-100k' | 'platform:tiktok'
  metric       STRING,   -- 'org_views' | 'engagement_rate' | 'vtr' | 'cpm' ...
  mean         FLOAT64,
  median       FLOAT64,
  p25          FLOAT64,
  p75          FLOAT64,
  stddev       FLOAT64,
  sample_size  INT64,
  updated_at   TIMESTAMP
);
```
- **Avanzada:** tabla raw `historical_campaign_metrics` (mismas columnas que `campaign_content`) y calcular benchmarks al vuelo. Esto se alimenta del **Excel histórico** ya pendiente en la "Pregunta 5" del doc anterior.

> Sin datos históricos cargados, la comparativa IA no tiene contra qué comparar. **Dependencia dura del seed de históricos.**

---

## 3. Nuevos scrapers de Kernel

Kernel hoy scrapea **perfil** (followers, ER cuenta, avg vistas). Necesitamos scrapear **por pieza**.

### 3.1 `server/kernel/scrapers/content-metrics.js` (NUEVO)
Dado un `content_url`, abre la pieza y captura stats orgánicos. Reutiliza el patrón de intercepción de `tiktok-profile.js` / `instagram-profile.js`:
- **TikTok**: el endpoint `/api/item/detail/` o el `__UNIVERSAL_DATA_FOR_REHYDRATION__` de la página del video traen `stats` (playCount, diggCount, commentCount, shareCount).
- **Instagram**: el JSON embebido del permalink (`/p/` o `/reel/`) trae `video_view_count`, `edge_liked_by`, `edge_media_to_comment`. Los **guardados (saves) no son públicos** → `org_saves` queda NULL salvo carga manual.

Devuelve: `{ views, likes, comments, shares, saves|null }`. Engagement se calcula en el service.

### 3.2 `server/kernel/scrapers/content-comments.js` (NUEVO — para sentiment)
Captura los primeros N comentarios (50–100) de la pieza:
- **TikTok**: endpoint `/api/comment/list/` (visible al cargar el video).
- **Instagram**: `edge_media_to_parent_comment` del JSON del permalink.
Devuelve `[{ author, texto, likes }]`. Limitación: sólo top comments públicos; suficiente para un sentiment representativo, no exhaustivo.

### 3.3 Cambios en `server/kernel/index.js`
Agregar `scrapeCampaignContent(campaignId)`:
1. Lee `campaign_content` de la campaña.
2. Por pieza, en batches (reusa `BATCH_SIZE`, `withRetry`): scrapea métricas + comentarios.
3. `UPDATE` org_* y `org_engagement_rate`.
4. Inserta comentarios en `content_comments`.
5. Dispara el sentiment service (sección 4).

> **No** tocar el flujo de score: este scraper es de **reporting de campaña**, separado del scraper de prospección.

---

## 4. Sentiment de campaña (Kernel + LLM)

Capacidad **nueva**. Pipeline:

1. **Recolección** → comentarios por pieza (scraper 3.2).
2. **Clasificación** → `server/sentiment-service.js` (NUEVO) manda lotes de comentarios a **Claude** (modelo `claude-haiku-4-5` por costo/volumen; `claude-sonnet-4-6` si se quiere más matiz). Prompt que devuelve por comentario `{label: positivo|neutro|negativo, score: -1..1}` en JSON estructurado (tool use / structured output).
3. **Agregación** → por pieza: % pos/neu/neg + score promedio + label dominante. Por campaña: ponderar por volumen de comentarios.
4. **Persistencia** → `campaign_content.sentiment_*` y opcionalmente cada comentario en `content_comments`.

Cambios:
- `package.json`: agregar `@anthropic-ai/sdk` (hoy no hay SDK de LLM).
- `.env`: `ANTHROPIC_API_KEY`.
- Considerar también analizar **caption + menciones de marca**, no sólo comentarios, si el cliente quiere "sentiment de la campaña" más amplio.

> Decisión de costo: con 100 comentarios × N piezas × M campañas conviene Haiku + batching. Cachear por `content_id` para no reclasificar.

---

## 5. Comparativa vs. IA (históricos de campañas exitosas)

Pedido: por creador y por contenido, decir si está **por encima/por debajo del promedio** → rojo/verde + puntaje.

### Lógica (estadística primero, LLM opcional para el "por qué")
1. **Benchmark** (sección 2.4): para cada métrica, media/p25/p75 de campañas históricas **exitosas**, idealmente segmentado por marca / tier de seguidores / plataforma para que la comparación sea justa.
2. **Delta**: para cada pieza/creador y métrica:
   - `deltaPct = (valor − benchmark.mean) / benchmark.mean × 100`
   - o **z-score** `(valor − mean) / stddev` para normalizar entre métricas.
3. **Semáforo + puntaje**:
   - verde si `valor ≥ p75` (o z ≥ +0.5), amarillo en rango intercuartil, rojo si `≤ p25` (o z ≤ −0.5).
   - puntaje 0–100 = percentil del valor dentro de la distribución histórica.
4. **Score compuesto** del creador/contenido = promedio ponderado de los percentiles por métrica (pesos a confirmar; reusar la filosofía de `score-calculator.js`).
5. **Narrativa IA (opcional)**: Claude genera 1–2 frases ("Rinde 32% por encima del promedio en VTR pero su CPM está un 18% peor") a partir de los deltas. El semáforo NO depende del LLM (es determinístico y auditable); el LLM sólo explica.

Archivo nuevo: `server/recommendation-service.js`.

> **"Campañas exitosas"** hay que definirlo con el cliente: ¿qué hace exitosa a una campaña histórica? (ej. ER > X, CPM < Y, objetivo cumplido). Ese filtro define qué entra al benchmark.

---

## 6. Endpoints backend (`server/index.js`)

| Método | Ruta | Función |
|---|---|---|
| `GET` | `/api/campaigns/:id/metrics` | **Principal.** Computa al vuelo indicadores totales, top creadores, top contenidos, sentiment y comparativa. No persiste agregados. |
| `POST` | `/api/campaigns/:id/content` | Registra una pieza (url + creator_id + plataforma). |
| `DELETE` | `/api/content/:contentId` | Quita una pieza. |
| `POST` | `/api/campaigns/:id/scrape-content` | Dispara Kernel: métricas orgánicas + comentarios de todas las piezas. |
| `POST` | `/api/campaigns/:id/analyze-sentiment` | Corre sentiment sobre comentarios scrapeados (o se pliega dentro de scrape-content). |
| `PATCH` | `/api/content/:contentId/pauta` | Carga manual de métricas paid de una pieza. |
| `POST` | `/api/campaigns/:id/pauta-import` | Import del CSV de pauta (multipart). Matchea por url/creator. |
| `PATCH` | `/api/campaigns/:id/pauta-total` | Carga alcance/spend dedup a nivel campaña. |
| `POST` | `/api/admin/recompute-benchmarks` | Recalcula `campaign_benchmarks` desde históricos. |

Lógica de agregación centralizada en `computeCampaignMetrics(campaignId)` aplicando las reglas de la sección 1 (sumables vs ratios ponderados vs alcance no-sumable).

### (Opcional, fase posterior) Integración Ads API
Para automatizar pauta sin CSV:
- **Meta Marketing API** (`/insights`: impressions, reach, frequency, ctr, cpm, spend, video views) — requiere acceso al Ad Account, token de sistema y App Review.
- **TikTok Marketing API** (Reporting endpoints) — ídem.
- Servicio `server/ads/` con `syncMetaAds(campaignId)` / `syncTikTokAds(campaignId)` que escriben `paid_*`. Mapear cada ad/adgroup → `content_id`.

> Es la opción "correcta" pero pesada (credenciales por marca, revisión de app). Recomiendo **CSV/manual en v1** y API en v2.

---

## 7. Cambios en el frontend

### 7.1 `src/data.ts`
```ts
export interface ContenidoCampana {
  id: string; creatorId: string; platform: 'instagram'|'tiktok';
  url: string; tipo?: string; publishedAt?: string;
  org: { views:number; likes:number; comments:number; shares:number; saves:number|null; er:number|null };
  paid?: { impresiones:number; alcance:number; cpm:number; frecuencia:number; ctr:number; vtr:number; spend:number; clicks:number };
  sentiment?: { label:'positivo'|'neutro'|'negativo'; score:number; posPct:number; neuPct:number; negPct:number; sample:number };
}

export interface MetricasCampana {
  indicadoresTotales: {
    alcance:number|null; impresiones:number; vistas:number;
    vtr:number|null; engagement:number|null; ctr:number|null;
    frecuencia:number|null; cpm:number|null;
    alcanceEsAditivo:false; // flag para el disclaimer
  };
  topCreadores: Array<{ creatorId:string; nombre:string; categoria:string|null; vistas:number; alcance:number|null; impresiones:number; vtr:number|null; ctr:number|null; engagement:number|null; piezas:number }>;
  topContenidos: ContenidoCampana[];
  sentiment: { label:'positivo'|'neutro'|'negativo'; posPct:number; neuPct:number; negPct:number; sample:number };
  comparativa: Array<{ tipo:'creador'|'contenido'; id:string; nombre:string;
    metricas: Array<{ metric:string; valor:number; benchmark:number; deltaPct:number; semaforo:'verde'|'amarillo'|'rojo'; percentil:number }>;
    scoreCompuesto:number }>;
}
// Campana gana: metricas?: MetricasCampana; contenidos?: ContenidoCampana[];
```

### 7.2 `src/api.ts`
Agregar: `getCampaignMetrics(id)`, `addContent(id, payload)`, `scrapeContent(id)`, `analyzeSentiment(id)`, `patchPautaContent(contentId, payload)`, `importPautaCsv(id, file)`.

### 7.3 `src/components/CampanaDetail.tsx`
Hoy sólo muestra el embudo. Agregar un **sub-tab o sección "Resultados"** con:
1. **Strip de 8 KPIs** (los indicadores totales) — reutiliza el `KPICard` existente; alcance con tooltip/nota "no aditivo".
2. **Top creadores** — tabla ordenable (reusa el patrón de tabla + `SortIcon` ya presente) con columnas vistas/alcance/impresiones/VTR/CTR/EG/categoría.
3. **Top contenidos** — cards o tabla con thumbnail + métricas, ordenable.
4. **Sentiment** — barra/gauge pos/neu/neg + label dominante.
5. **Comparativa IA** — tabla con badges rojo/verde + puntaje por métrica + score compuesto (reusa `scoreColor` de `utils.ts`).
6. **Acciones**: "Registrar contenido" (alta de URLs por creador), "Actualizar métricas" (scrape-content), "Importar pauta (CSV)".

### 7.4 Componentes nuevos sugeridos
`MetricasCampanaPanel.tsx`, `TopCreadores.tsx`, `TopContenidos.tsx`, `SentimentCard.tsx`, `ComparativaIA.tsx`, `RegistrarContenidoModal.tsx`, `ImportPautaModal.tsx`.

---

## 8. Decisiones que necesito confirmar con el cliente

1. **Pauta**: ¿entra por **CSV** (su Excel actual), por **carga manual** pieza por pieza, o invertimos en **Ads API**? (Define el alcance del backend de pauta.)
2. **"EG"**: ¿engagement rate sobre **vistas** o sobre **seguidores/alcance**? ¿Incluye guardados?
3. **"Vistas"**: ¿orgánicas, paid, o ambas sumadas?
4. **Alcance a nivel campaña**: ¿valor único dedup (cargado) o "estimado" con nota?
5. **Sentiment**: ¿sólo comentarios, o también caption/menciones? ¿idioma (ES) y umbral de muestra mínima?
6. **Comparativa IA**: ¿qué define una **campaña histórica exitosa**? ¿Segmentamos benchmark por marca / tier de seguidores / plataforma?
7. **Históricos**: confirmar el **Excel/CSV** y su formato para el seed (bloquea la comparativa IA).
8. **¿Cuántas piezas por creador/campaña?** (1 pieza vs varias — afecta UI de "registrar contenido").

---

## 9. Roadmap por fases (esfuerzo orientativo)

| Fase | Entrega | Depende de | Esfuerzo |
|---|---|---|---|
| **F1 — Modelo de datos** | Tabla `campaign_content`, columnas en `campaigns`, alta de piezas (UI + endpoint) | — | S |
| **F2 — Métricas orgánicas** | Scraper `content-metrics`, `scrape-content`, agregación, KPIs + Top creadores/contenidos orgánicos en UI | F1 | M |
| **F3 — Pauta** | Import CSV / carga manual, recálculo de ratios ponderados, KPIs paid (impresiones/CPM/CTR/VTR/frecuencia/alcance) | F1 | M (CSV) / L (Ads API) |
| **F4 — Sentiment** | Scraper de comentarios, `@anthropic-ai/sdk`, `sentiment-service`, card de sentiment | F2 | M |
| **F5 — Comparativa IA** | Seed de históricos, `campaign_benchmarks`, `recommendation-service`, tabla semáforo + narrativa | F1 + históricos | L |

S=chico, M=medio, L=grande.

### Orden recomendado
F1 → F2 (entrega visible rápida con lo 100% automatizable) → F3 (cierra los indicadores totales) → F4 (sentiment) → F5 (comparativa, la más dependiente de datos externos).

---

## 10. Resumen de archivos a tocar / crear

**Nuevos:**
- `sql/create-campaign-content.js`, `sql/add-campaign-paid-columns.js`, `sql/create-benchmarks.js`, `sql/seed-historical-creators.js`
- `server/kernel/scrapers/content-metrics.js`, `server/kernel/scrapers/content-comments.js`
- `server/sentiment-service.js`, `server/recommendation-service.js`, `server/metrics-service.js` (computeCampaignMetrics)
- (v2) `server/ads/meta.js`, `server/ads/tiktok.js`
- `src/components/MetricasCampanaPanel.tsx` + subcomponentes (sección 7.4)

**Modificados:**
- `server/kernel/index.js` (scrapeCampaignContent)
- `server/index.js` (endpoints sección 6)
- `src/data.ts` (interfaces sección 7.1)
- `src/api.ts` (llamadas sección 7.2)
- `src/components/CampanaDetail.tsx` (sección 7.3)
- `package.json` / `.env` (`@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`)
</content>
</invoke>
