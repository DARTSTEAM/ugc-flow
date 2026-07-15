/**
 * Sentiment service — clasifica con MiniMax los últimos comentarios de cada
 * posteo de una campaña y persiste dos agregados: uno GLOBAL de campaña
 * (`campaigns.sentiment_*`, mezclando todos los creadores/posteos, para el
 * resumen de campaña) y uno POR CREADOR (`campaign_creator_sentiment`, para
 * el Ranking de Creadores). La clasificación en sí es una sola pasada por
 * MiniMax sobre todos los comentarios — el mismo volumen de llamados que
 * antes, sólo se reagrupan los resultados dos veces al terminar.
 *
 * Llamado por scrapeCampaignContent() al final de POST /api/campaigns/:id/scrape-content.
 *
 * MiniMax expone una API compatible con el formato de chat completions de OpenAI
 * (https://platform.minimax.io/docs/api-reference/text-openai-api), así que se
 * consume con fetch directo — no hace falta un SDK aparte.
 */
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery({ projectId: 'hike-agentic-playground' });
const DATASET = 'ngr_ugc';

const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';
const MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const CHUNK_SIZE = 60;

// "sticker", "stickers" o "solo sticker" (con o sin mayúsculas/espacios extra) → neutral directo.
const STICKER_RE = /^(solo\s+)?stickers?$/i;

function buildPrompt(comments) {
  const block = comments
    .map((c, i) => `${i}: "${String(c).replace(/"/g, '\\"')}"`)
    .join('\n');

  return `Eres un experto en Social Listening para marcas de consumo.
Analiza los siguientes ${comments.length} comentarios y devuelve EXACTAMENTE un array JSON de ${comments.length} elementos, en el mismo orden (uno por cada comentario numerado del 0 al ${comments.length - 1}, sin saltear ni fusionar ninguno), donde cada elemento es un objeto con dos campos:

"sentiment": "positive", "neutral" o "negative"
"requires_response": true si el comentario es una queja, reclamo, pregunta urgente o mención de crisis que la marca debería responder; false en caso contrario

REGLAS DE SENTIMIENTO:
- POSITIVO (positive): satisfacción con el contenido, producto, servicio o promociones. (Ej: palabras de elogio, entusiasmo, "buenísimo", "espectacular", "me encanta", lanzamientos, aperturas).
- NEGATIVO (negative): quejas sobre calidad, mal servicio, tiempos de espera, problemas o críticas directas. (Ej: "malo", "pésimo", "estafa", "caro", "demora").
- NEUTRAL (neutral): preguntas informativas, etiquetas a amigos sin opinión, consultas de precio o disponibilidad. Nota: La intención de compra sin efusividad es neutral (ej: "precio por favor", "cuánto cuesta").

REGLAS DE REQUIRES_RESPONSE:
- true: quejas directas, reclamos de calidad/servicio, preguntas operativas sin respuesta, menciones de crisis, pedidos de contacto.
- false: elogios, comentarios genéricos, emojis, menciones positivas, preguntas retóricas.

Devuelve SOLO el array JSON, sin texto adicional ni markdown.
COMENTARIOS:
${block}`;
}

/** Saca fences de markdown (```json ... ```) por si el modelo los agrega pese a la instrucción. */
function stripMarkdownFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

/** Una llamada cruda a MiniMax. Puede tirar (HTTP error, JSON inválido, o largo distinto al pedido). */
async function callMiniMax(comments) {
  const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: buildPrompt(comments) }],
      temperature: 0.1,
      // MiniMax-M2.7 es un modelo de razonamiento: sin esto, el <think>...</think>
      // viene inline en `content` y ensucia el JSON. Con reasoning_split, el razonamiento
      // queda aparte en message.reasoning_details y `content` es sólo la respuesta final.
      reasoning_split: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MiniMax API ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('MiniMax devolvió una respuesta sin contenido');

  let parsed;
  try {
    parsed = JSON.parse(stripMarkdownFence(text));
  } catch {
    throw new Error(`MiniMax devolvió JSON inválido para un chunk de ${comments.length} comentarios`);
  }
  if (!Array.isArray(parsed) || parsed.length !== comments.length) {
    throw new Error(`MiniMax devolvió ${Array.isArray(parsed) ? parsed.length : 'no-array'} resultados para ${comments.length} comentarios`);
  }
  return parsed;
}

const MAX_SAME_SIZE_RETRIES = 2;

/**
 * Clasifica un chunk, tolerando que MiniMax devuelva un array de largo distinto
 * al pedido (pasa ocasionalmente en chunks grandes — el modelo fusiona o saltea
 * algún ítem). Reintenta el mismo chunk un par de veces y, si sigue fallando,
 * lo parte al medio y reintenta cada mitad por separado — así el desajuste queda
 * acotado a la porción problemática en vez de tirar abajo todo el análisis.
 */
async function classifyWithRetry(comments, attempt = 0) {
  try {
    return await callMiniMax(comments);
  } catch (err) {
    if (attempt < MAX_SAME_SIZE_RETRIES) {
      console.warn(`[Sentiment] reintentando chunk de ${comments.length} comentarios (intento ${attempt + 1}/${MAX_SAME_SIZE_RETRIES}): ${err.message}`);
      return classifyWithRetry(comments, attempt + 1);
    }
    if (comments.length === 1) throw err; // ya no se puede partir más

    console.warn(`[Sentiment] chunk de ${comments.length} comentarios sigue fallando tras reintentos, lo parto al medio: ${err.message}`);
    const mid = Math.ceil(comments.length / 2);
    const first = await classifyWithRetry(comments.slice(0, mid));
    const second = await classifyWithRetry(comments.slice(mid));
    return [...first, ...second];
  }
}

/**
 * @param {string} campaignId
 * @param {{creatorId: string, text: string}[]} rawItems  últimos N comentarios por posteo, tagueados con el creador de origen
 * @returns {{ positive: number, neutral: number, negative: number, sampleSize: number }}  agregado GLOBAL de campaña
 */
export async function analyzeSentiment(campaignId, rawItems) {
  const items = (rawItems ?? [])
    .map(it => ({ creatorId: it?.creatorId ?? null, text: (it?.text ?? '').toString().trim() }))
    .filter(it => it.text && it.creatorId);

  if (!items.length) {
    const empty = { positive: 0, neutral: 100, negative: 0, sampleSize: 0 };
    await persistSentiment(campaignId, empty);
    await persistSentimentByCreator(campaignId, []);
    return empty;
  }

  // Filtro de stickers: se clasifican como neutral sin gastar tokens en MiniMax.
  const classifiedItems = [];
  const toClassify = [];
  for (const it of items) {
    if (STICKER_RE.test(it.text)) {
      classifiedItems.push({ creatorId: it.creatorId, sentiment: 'neutral', requires_response: false });
    } else {
      toClassify.push(it);
    }
  }

  // Chunks de 60, secuenciales (no en paralelo). classifyWithRetry preserva el
  // orden del chunk de entrada (incluso al partirlo al medio en un reintento),
  // así que cada resultado se puede volver a asociar con su creatorId por índice.
  for (let i = 0; i < toClassify.length; i += CHUNK_SIZE) {
    const chunk = toClassify.slice(i, i + CHUNK_SIZE);
    const results = await classifyWithRetry(chunk.map(it => it.text));
    results.forEach((r, idx) => classifiedItems.push({ creatorId: chunk[idx].creatorId, ...r }));
  }

  const result = aggregate(classifiedItems);
  await persistSentiment(campaignId, result);

  const byCreator = new Map();
  for (const c of classifiedItems) {
    if (!byCreator.has(c.creatorId)) byCreator.set(c.creatorId, []);
    byCreator.get(c.creatorId).push(c);
  }
  const perCreator = [...byCreator.entries()].map(([creatorId, list]) => ({ creatorId, ...aggregate(list) }));
  await persistSentimentByCreator(campaignId, perCreator);

  return result;
}

const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

function aggregate(classified) {
  const valid = classified.filter(r => VALID_SENTIMENTS.has(r?.sentiment));
  const total = valid.length;
  if (!total) return { positive: 0, neutral: 100, negative: 0, sampleSize: 0 };

  const pos = valid.filter(r => r.sentiment === 'positive').length;
  const neg = valid.filter(r => r.sentiment === 'negative').length;

  const positive = Math.round((pos / total) * 100);
  const negative = Math.round((neg / total) * 100);
  const neutral = 100 - positive - negative; // por diferencia, para que sume exactamente 100

  return { positive, neutral, negative, sampleSize: total };
}

async function persistSentiment(campaignId, r) {
  await bq.query({
    query: `
      UPDATE ${DATASET}.campaigns SET
        sentiment_positive    = @positive,
        sentiment_neutral     = @neutral,
        sentiment_negative    = @negative,
        sentiment_sample_size = @sampleSize,
        sentiment_updated_at  = CURRENT_TIMESTAMP()
      WHERE campaign_id = @campaignId
    `,
    params: {
      campaignId,
      positive: r.positive,
      neutral: r.neutral,
      negative: r.negative,
      sampleSize: r.sampleSize,
    },
    types: { positive: 'INT64', neutral: 'INT64', negative: 'INT64', sampleSize: 'INT64' },
    location: 'US',
  });
}

/** Reemplaza por completo el sentimiento por creador de una campaña (DELETE + INSERT, mismo patrón idempotente que creator_scores). */
async function persistSentimentByCreator(campaignId, perCreator) {
  await bq.query({
    query: `DELETE FROM ${DATASET}.campaign_creator_sentiment WHERE campaign_id = @campaignId`,
    params: { campaignId },
    location: 'US',
  });

  for (const r of perCreator) {
    await bq.query({
      query: `
        INSERT INTO ${DATASET}.campaign_creator_sentiment
          (campaign_id, creator_id, positive, neutral, negative, sample_size, updated_at)
        VALUES (@campaignId, @creatorId, @positive, @neutral, @negative, @sampleSize, CURRENT_TIMESTAMP())
      `,
      params: {
        campaignId,
        creatorId: r.creatorId,
        positive: r.positive,
        neutral: r.neutral,
        negative: r.negative,
        sampleSize: r.sampleSize,
      },
      types: { positive: 'INT64', neutral: 'INT64', negative: 'INT64', sampleSize: 'INT64' },
      location: 'US',
    });
  }
}
