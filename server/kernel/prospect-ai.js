import { newPage } from './browser-pool.js';

/**
 * Evaluación IA de un candidato de prospección: juzga afinidad de nicho a
 * partir de bio/categoría y busca un email de contacto (bio o, si no está ahí,
 * siguiendo un solo salto al link externo de la bio, ej. Linktree).
 *
 * Usa MiniMax (mismo proveedor que sentiment-service.js, sin SDK nuevo) y la
 * misma sesión de navegador Kernel que ya abrió el scraper de la plataforma
 * (vía newPage() de browser-pool.js) — no crea sesiones nuevas.
 *
 * Nunca lanza: cualquier falla (link caído, MiniMax sin configurar, JSON
 * inválido) devuelve lo que se pudo obtener de forma determinística, sin
 * frenar el resto de la prospección.
 */

const MINIMAX_BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1';
const MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const LINK_NAV_TIMEOUT = 15000;
const MAX_PAGE_TEXT = 4000; // chars enviados al LLM — alcanza para una landing de Linktree

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Busca un email en texto libre, descartando falsos positivos típicos (assets de imagen). */
function extractEmail(text) {
  if (!text) return null;
  const matches = text.match(EMAIL_RE);
  if (!matches) return null;
  return matches.find(m => !/\.(png|jpe?g|gif|svg|webp)$/i.test(m)) ?? null;
}

/** Sigue el link externo de la bio un solo salto y devuelve su texto visible, o null si falla. */
async function fetchExternalLinkText(platform, url) {
  let page = null;
  try {
    page = await newPage(platform);
    await page.goto(url, { waitUntil: 'load', timeout: LINK_NAV_TIMEOUT });
    const text = await page.evaluate(() => document.body?.innerText ?? '');
    return text.slice(0, MAX_PAGE_TEXT);
  } catch (err) {
    console.warn(`[Prospecting/AI] no se pudo abrir el link externo (${url}): ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

function stripMarkdownFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}

function buildPrompt({ niche, bio, categoria, pageText }) {
  return `Sos un experto en scouting de creadores UGC para marcas.
Nicho buscado: "${niche}"

Perfil del creador:
- Categoría declarada: ${categoria || '(sin categoría)'}
- Bio: "${(bio || '(sin bio)').slice(0, 500)}"
${pageText ? `- Contenido de su link externo en la bio (ej. Linktree): """${pageText}"""` : ''}

Tareas:
1. Juzgá si la temática de este perfil encaja con el nicho "${niche}" a partir de la bio y categoría (no tenés acceso a las imágenes/videos).
2. Buscá un email de contacto visible en la bio o en el contenido del link externo.

Devolvé SOLO un objeto JSON, sin texto adicional ni markdown, con este formato exacto:
{"nicheFit": true|false, "nicheFitReason": "una frase breve explicando por qué", "email": "email encontrado o null"}`;
}

async function callMiniMax(prompt) {
  const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
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
  return text;
}

/**
 * @param {{ platform: 'instagram'|'tiktok', niche: string, bio?: string, categoria?: string, externalUrl?: string }} params
 * @returns {Promise<{ email: string|null, nicheFit: boolean|null, nicheFitReason: string|null }>}
 */
export async function evaluateProspecto({ platform, niche, bio, categoria, externalUrl }) {
  // 1. Email determinístico desde la bio — gratis, sin red ni LLM.
  let email = extractEmail(bio);
  let pageText = null;

  // 2. Si no apareció en la bio y hay link externo, lo seguimos un solo salto.
  if (!email && externalUrl) {
    pageText = await fetchExternalLinkText(platform, externalUrl);
    if (pageText) email = extractEmail(pageText);
  }

  if (!process.env.MINIMAX_API_KEY) {
    console.warn('[Prospecting/AI] MINIMAX_API_KEY no configurada — se omite juicio de nicho');
    return { email, nicheFit: null, nicheFitReason: null };
  }

  // 3. Juicio de nicho vía MiniMax (y último intento de email si el regex no
  //    lo agarró, ej. "contactame en fulano arroba gmail punto com").
  try {
    const raw = await callMiniMax(buildPrompt({ niche, bio, categoria, pageText }));
    const parsed = JSON.parse(stripMarkdownFence(raw));
    return {
      email: email ?? (typeof parsed.email === 'string' ? parsed.email : null),
      nicheFit: typeof parsed.nicheFit === 'boolean' ? parsed.nicheFit : null,
      nicheFitReason: typeof parsed.nicheFitReason === 'string' ? parsed.nicheFitReason : null,
    };
  } catch (err) {
    console.warn(`[Prospecting/AI] evaluación de nicho falló: ${err.message}`);
    return { email, nicheFit: null, nicheFitReason: null };
  }
}
