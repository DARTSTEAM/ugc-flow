const CSE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

// La API de Custom Search sólo pagina de a 10 resultados y no deja pasar
// `start` de 91 (tope de 100 resultados totales por query).
const CSE_PAGE_SIZE = 10;
const CSE_MAX_START = 91;

// Segmentos de path que nunca son un username real de Instagram.
const IG_INVALID_PATH_SEGMENTS = new Set([
  'explore', 'p', 'reel', 'reels', 'tags', 'stories', 'accounts', 'directory',
  'tv', 'about', 'developer', 'legal', 'web', 'lite', 'session',
]);

// Usernames de Instagram: letras, números, puntos y guiones bajos, 1-30 chars.
const IG_USERNAME_RE = /^[a-zA-Z0-9._]{1,30}$/;

// Usernames de TikTok (después del @): letras, números, puntos y guiones bajos, 1-24 chars.
const TT_USERNAME_RE = /@([a-zA-Z0-9._]{1,24})/;

/**
 * Construye el string de búsqueda de Google Dorking para encontrar perfiles
 * de un nicho (y opcionalmente una locación) determinados, en Instagram o TikTok.
 */
export function buildGoogleDork({ niche, location, platform = 'instagram' }) {
  if (platform === 'tiktok') {
    let query = `site:tiktok.com/ "${niche}"`;
    if (location) query += ` "${location}"`;
    return query;
  }
  let query = `site:instagram.com "${niche}"`;
  if (location) query += ` "${location}"`;
  query += ' -inurl:explore -inurl:p -inurl:reel -inurl:reels -inurl:tags -inurl:stories -inurl:directory';
  return query;
}

function extractInstagramUsername(link) {
  try {
    const url = new URL(link);
    if (!url.hostname.includes('instagram.com')) return null;
    const [first] = url.pathname.split('/').filter(Boolean);
    if (!first) return null;
    if (IG_INVALID_PATH_SEGMENTS.has(first.toLowerCase())) return null;
    if (!IG_USERNAME_RE.test(first)) return null;
    return first;
  } catch {
    return null;
  }
}

// Sólo perfiles (URL con @handle), nunca videos individuales (/video/<id>).
function extractTikTokUsername(link) {
  try {
    const url = new URL(link);
    if (!url.hostname.includes('tiktok.com')) return null;
    if (url.pathname.includes('/video/')) return null;
    const match = url.pathname.match(TT_USERNAME_RE);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Busca perfiles (Instagram o TikTok, según `platform`) vía Google Custom
 * Search JSON API. Pagina de a 10 resultados hasta juntar `maxResults` o
 * agotar lo que Google tiene para esa query.
 *
 * Nunca lanza — errores de red, cuota u otra falla de la API devuelven
 * `{ usernames: [...lo que se llegó a juntar], blocked, error }` para que el
 * caller pueda seguir con lo que haya.
 *
 * @param {string} query
 * @param {{ platform?: 'instagram'|'tiktok', maxResults?: number }} [opts]
 * @returns {Promise<{ usernames: string[], blocked: boolean, error?: string }>}
 */
export async function searchProfiles(query, { platform = 'instagram', maxResults = 30 } = {}) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) {
    const error = 'GOOGLE_API_KEY o GOOGLE_SEARCH_CX no configurados en .env';
    console.error(`[Prospecting] ${error}`);
    return { usernames: [], blocked: false, error };
  }

  const extractUsername = platform === 'tiktok' ? extractTikTokUsername : extractInstagramUsername;

  const seen = new Set();
  const usernames = [];

  for (let start = 1; start <= CSE_MAX_START && usernames.length < maxResults; start += CSE_PAGE_SIZE) {
    const url = `${CSE_ENDPOINT}?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&start=${start}`;

    let json;
    try {
      const res = await fetch(url);
      json = await res.json().catch(() => null);

      if (!res.ok) {
        const reason = json?.error?.message || `HTTP ${res.status}`;
        console.error(`[Prospecting] Google Custom Search API error: ${reason}`);
        // Cuota agotada / rate limit — tratarlo como "bloqueado" para que el
        // caller lo loguee de forma distinta a un error transitorio de red.
        const blocked = res.status === 429 || /quota|rateLimitExceeded/i.test(reason);
        return { usernames, blocked, error: reason };
      }
    } catch (err) {
      console.error(`[Prospecting] Google Custom Search API request falló: ${err.message}`);
      return { usernames, blocked: false, error: err.message };
    }

    const items = json?.items ?? [];
    if (!items.length) break; // sin más resultados para esta query

    for (const item of items) {
      const username = extractUsername(item.link);
      if (!username || seen.has(username.toLowerCase())) continue;
      seen.add(username.toLowerCase());
      usernames.push(username);
      if (usernames.length >= maxResults) break;
    }

    if (items.length < CSE_PAGE_SIZE) break; // última página
  }

  console.log(`[Prospecting] Google Custom Search (${platform}) devolvió ${usernames.length} usernames candidatos para: "${query}"`);
  return { usernames, blocked: false };
}
