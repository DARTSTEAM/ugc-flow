# Kernel.sh & Scrapers — Guía técnica

Este documento cubre la arquitectura completa del sistema de scraping: cómo funciona Kernel.sh como proveedor de browsers en la nube, cómo se conectan los scrapers a él, y el detalle del scraper de Instagram.

---

## 1. ¿Qué es Kernel.sh?

[Kernel.sh](https://kernel.sh) es un servicio de **browsers en la nube** ("cloud browsers"). En vez de correr Chromium dentro del mismo contenedor de Cloud Run (lo que requeriría ~1.5 GB de imagen y consume CPU en el server), Kernel.sh provisiona el browser en su infraestructura remota y nosotros nos conectamos a él via **CDP (Chrome DevTools Protocol) sobre WebSocket**.

```
Cloud Run (Node.js)
    │
    ├─ Playwright-core (sin binarios locales)
    │       │
    │       └─ CDP WebSocket ──────────────► Kernel.sh (browser headful en la nube)
    │                                               │
    │                                            Instagram, TikTok, YouTube...
    │
    └─ Firestore (guarda los resultados)
```

### Ventajas clave
- **Imagen Docker liviana**: se usa `node:24-alpine` sin Playwright ni Chromium localmente (`playwright-core` solo, sin `playwright`).
- **Browser Profiles persistentes**: las cookies de login se guardan por perfil. El browser de Instagram ya está logueado cuando arranca.
- **Headful sin costo de infra**: Kernel corre el browser con interfaz gráfica en su nube; necesario para evitar detección de bots en Instagram y TikTok.
- **Residential Proxy**: un Proxy ID compartido rotación de IPs residenciales para todas las plataformas.
- **Live View**: durante una sesión activa, Kernel expone una URL de video en vivo para debug en tiempo real.

---

## 2. Variables de entorno (`.env.schema`)

Todas las variables son inyectadas en tiempo de ejecución por **Varlock + Google Secret Manager**. No existe un archivo `.env` en el repo.

| Variable | Descripción | Tipo |
|---|---|---|
| `KERNEL_API_KEY` | Clave de API de Kernel.sh — autentica la creación de browsers | 🔐 Secret (GSM) |
| `KERNEL_PROFILE_INSTAGRAM` | ID del Browser Profile de Instagram (con sesión iniciada) | ID público |
| `KERNEL_PROFILE_TIKTOK` | ID del Browser Profile de TikTok | ID público |
| `KERNEL_PROFILE_YOUTUBE` | ID del Browser Profile de YouTube | ID público |
| `KERNEL_PROFILE_TWITTER` | ID del Browser Profile de Twitter/X | ID público |
| `KERNEL_PROXY_ID` | ID del Residential Proxy compartido entre todas las plataformas | ID público |
| `HEADFUL_PLATFORMS` | Plataformas que requieren browser headful (default: `tiktok,instagram,twitter,x`) | String CSV |

> **IMPORTANTE:** Los Profile IDs (`jkznhfoh2...`, `lbq27e4...`, etc.) no son secretos — son identificadores de session en Kernel. El secreto real es el `KERNEL_API_KEY`.

### ¿Cómo agregar un nuevo profile?
1. Entrá al [dashboard de Kernel.sh](https://kernel.sh/dashboard).
2. Creá un nuevo Browser Profile para la plataforma.
3. Abrí el Live View y logueate manualmente en la red social.
4. Cerrá el browser — las cookies quedan persistidas en el profile.
5. Copiá el Profile ID y guardalo en `.env.schema` como `KERNEL_PROFILE_<PLATFORM>=<id>`.

---

## 3. `kernel.js` — Pool de browsers

**Ubicación:** [`backend/src/kernel.js`](../backend/src/kernel.js)

Este módulo maneja el ciclo de vida de los browsers de Kernel. Implementa un **pool** (una conexión por plataforma) para no crear un browser nuevo en cada request.

### Flujo de inicialización

```
getBrowser('instagram')
    │
    ├─ ¿Hay browser conectado en el pool? → retorna directo
    │
    ├─ ¿Hay una Promise de inicialización en curso? → espera esa Promise
    │
    └─ Crea nuevo browser:
            1. new Kernel() — inicializa el SDK con KERNEL_API_KEY
            2. kernel.browsers.create({ profile, proxy_id, headless, stealth })
            3. chromium.connectOverCDP(cdp_ws_url) — Playwright conecta al browser remoto
            4. Usa browser.contexts()[0] — el contexto default que tiene las cookies del profile
            5. Guarda { kernel, browser, context, kernelSessionId } en el pool
```

### Funciones principales

| Función | Propósito |
|---|---|
| `getBrowser(platform)` | Obtiene (o inicializa) el browser para la plataforma |
| `newPage(platform)` | Abre una nueva tab en el contexto existente — preserva el login |
| `newTabForPlatform(platform)` | Alias de `newPage`, útil para videos donde queremos tab fresca |
| `closeBrowser(platform)` | Cierra el browser Y elimina la sesión de Kernel (libera recursos) |
| `closeAllBrowsers()` | Cierra todos los browsers al apagar el proceso |
| `startReplay(platform)` | Inicia grabación de video de la sesión (solo en dev) |
| `stopAndSaveReplay(...)` | Guarda el video en `debug/replay-*.mp4` |

### Configuración headful vs headless

Instagram y TikTok **siempre corren en modo headful** (con interfaz gráfica) porque en modo headless detectan automáticamente el bot y muestran CAPTCHAs o crashean el target.

```javascript
// En config.js, headfulPlatforms default = ['tiktok', 'instagram', 'twitter', 'x']
headless: config.kernel.headfulPlatforms.includes(platform) ? false : true
```

---

## 4. `config.js` — Límites del scraper

**Ubicación:** [`backend/src/config.js`](../backend/src/config.js)

Todos los límites se configuran via variables de entorno con valores default razonables.

### Límites actuales (producción)

| Variable de entorno | Default code | Valor en `.env.schema` | Descripción |
|---|---|---|---|
| `COMMENTS_PER_POST` | 100 | 10 | Comentarios máximos a extraer por post de Instagram |
| `POSTS_PER_PROFILE` | 5 | 4 | Posts recientes a scrapear por perfil de Instagram |
| `POSTS_PER_HASHTAG` | 50 | 5 | Posts por hashtag |
| `TIKTOK_VIDEOS_PER_PROFILE` | 5 | 4 | Videos por perfil de TikTok |
| `TIKTOK_COMMENTS_PER_VIDEO` | 100 | 5 | Comentarios por video de TikTok |
| `TIKTOK_POSTS_PER_HASHTAG` | 25 | 10 | Posts TikTok por hashtag |
| `SCRAPER_NAV_TIMEOUT_MS` | 60000 | 60000 | Timeout de navegación (ms) |
| `SCRAPER_SCROLL_DELAY_MS` | 1500 | 1500 | Delay entre scrolls (ms) |
| `MAX_YOUTUBE_COMMENTS` | 100 | — | Comentarios máximos por video de YouTube |

> ⚠️ Los valores en `.env.schema` son los que Varlock inyecta en producción (Cloud Run). Los defaults del código son el fallback si la variable no está definida.

---

## 5. Instagram Scraper — `instagram-comments.js`

**Ubicación:** [`backend/src/scrapers/instagram-comments.js`](../backend/src/scrapers/instagram-comments.js)

### Arquitectura general

El scraper de Instagram opera en dos fases:

```
Fase 1: DISCOVERY (perfil)
    Visita https://www.instagram.com/<handle>/
    └─ Extrae URLs de los N posts más recientes del grid
    └─ Captura metadata básica: likes, commentCount por post

Fase 2: EXTRACTION (post a post)
    Para cada post descubierto:
    └─ Abre el modal del post (click en el primer post del grid)
    └─ Extrae comentarios (red + DOM)
    └─ Navega al siguiente post via ArrowRight (sin recargar la página)
```

### Función principal: `scrapeCommentsForTarget(pageOrTarget, target)`

**Firma del `target`** (viene de `tenants.js`):

```javascript
{
  url: 'https://www.instagram.com/bembosPeru/',
  maxPosts: 5,      // default: 5 (config.scraper.postsPerProfile)
  maxComments: 100  // default: 100 (config.scraper.commentsPerPost)
}
```

**Flujo de la función:**

1. **Obtiene una página Kernel**: Si se le pasa un `target` sin page, llama a `newPage("instagram")` para obtener una tab del browser pool.

2. **Navega al perfil**: `page.goto(profileUrl, { waitUntil: "domcontentloaded" })`.

3. **Cierra popups**: Intenta descartar modales de cookies/login con selectores como `button:has-text("Decline")`.

4. **Hace scroll** 2 veces para cargar el grid de posts.

5. **Discovery de posts**: Evalúa en el DOM todos los `a[href*="/p/"]` y `a[href*="/reel/"]`. Extrae URL, likes y commentCount de los aria-labels o del innerText.

6. **Loop de extracción**:
   - Clickea el primer post (abre el modal).
   - Por cada post: llama a `scrapePostComments()`.
   - Navega al siguiente con `ArrowRight` (evita recargar la página completa — es una SPA).
   - Detecta si la URL cambió con `waitForFunction`.

7. **Retorna**:
```javascript
{
  comments: [...],        // todos los comentarios de todos los posts
  postsMeta: [...],       // metadata de cada post (likes, commentCount, url, thumbnail)
  discoveryMs: number,    // tiempo de discovery en ms
  extractionMs: number,   // tiempo de extracción en ms
  commentCountDeclared: number // suma de commentCount declarado en los posts
}
```

### Función de extracción por post: `scrapePostComments(page, postUrl, maxComments, shouldNavigate)`

Esta función combina **dos estrategias** de extracción y las fusiona:

#### Estrategia 1: Network Interception (preferida)

```javascript
page.on("response", async (res) => {
  if (url.includes("graphql") || url.includes("/api/v1/comments/") || url.includes("comments")) {
    const json = JSON.parse(text);
    extractCommentsFromJson(json);  // walk recursivo del JSON
  }
});
```

Instagram expone sus comentarios via requests GraphQL o `api/v1/comments/` en el formato:
```json
{ "text": "comentario", "user": { "username": "autor" }, "created_at": 1234567890 }
```

La función `extractCommentsFromJson` hace un recorrido recursivo del JSON (hasta 60 niveles de profundidad) buscando objetos con `text` + `user.username`.

#### Estrategia 2: DOM scraping (fallback)

Si la intercepción de red no captura nada (ej: cuando se navega via modal en vez de URL directa), el scraper evalúa el DOM con dos layouts:

**Layout 2025 (URL directa):**
```
<section>
  <div>  ← comment row
    <div>  ← author group (contiene <time>)
      <span class="_ap3a _aaco">username</span>
      <time>3w</time>
    </div>
    <div>  ← comment text (NO tiene <time>)
      Texto del comentario
    </div>
  </div>
</section>
```
Estrategia: encuentra todos los `span._ap3a._aaco` (spans de autor), sube por el DOM hasta encontrar el "split container" (un div con dos hijos: uno con `<time>` y otro sin), y extrae el texto del hijo sin `<time>`.

**Layout modal legacy (click desde feed/explore):**
```
div[role="dialog"] ul li
  └─ a[role="link"] → autor
  └─ span[dir="auto"] → texto del comentario
  └─ time → timestamp
```

#### Merge de resultados

Ambas estrategias usan un `Map` con clave `${author}:${text}` para deduplicar:
```javascript
const finalMap = new Map();
for (const c of interceptedComments.values()) finalMap.set(key, c);
for (const c of data.domComments) {
  if (!finalMap.has(key)) finalMap.set(key, c);
}
```
La intercepción de red tiene **prioridad** sobre el DOM (más confiable, tiene más metadata como `likes` y `date` exacto).

#### Extracción de metadata del post

Por cada post se extrae:
- **Caption/Descripción**: Selector `h1`, `span._ap30`, `span.x193iq5w` (modal) o `og:description` (fallback).
- **Likes**: Busca el SVG del corazón (`svg[aria-label*="Like"]`), toma el número adyacente en la sección. Fallback: `og:description`.
- **commentCount**: "View all X comments" button → stats section → count de `ul li`.
- **Tipo**: Si hay `<video>` en el modal → `"video"`, sino `"image"`.
- **Thumbnail**: `img.x5yr21d` dentro del modal → `og:image` como fallback.

#### `expandComments(page)`

Antes de hacer DOM scraping, expande comentarios ocultos:
1. Clickea botones "Load more comments" hasta 5 veces.
2. Scrollea el contenedor de comentarios 3 veces para cargar más.

---

## 6. Flujo completo: de tenant a Firestore

```
tenants.js (target.url = 'https://www.instagram.com/bembosPeru/')
    │
    ▼
job-runner.js → runInstagramComments(tenant, target)
    │
    ├─ newPage('instagram') → Kernel.sh (browser headful con cookies)
    │
    ├─ scrapeCommentsForTarget(page, target)
    │       └─ returns { comments, postsMeta }
    │
    ├─ analyzeWithGemini(comments)
    │       └─ returns { sentiment, wordCloud, topicClusters, summary, ... }
    │
    └─ saveToFirestore('tenants/<id>/scans', {
           brand, platform, source: 'kernel-scraper',
           raw_comments, commentsCount,
           sentiment, wordCloud, topicClusters,
           comments_analyzed, summary, alerts,
           timestamp
       })
```

---

## 7. Debugging

### Ver el browser en vivo
Cada vez que se crea un browser, se loguea la URL de Live View:
```
📺 LIVE VIEW: https://browser.kernel.sh/session/<session_id>/view
```
Esto permite ver exactamente lo que el scraper está viendo en tiempo real.

### Replay de sesiones (solo dev)
En desarrollo (`NODE_ENV !== 'production'`), se pueden grabar y descargar replays:
```javascript
const replay = await startReplay('instagram');
// ... scraping ...
await stopAndSaveReplay('instagram', replay);
// Guarda debug/replay-instagram-<id>.mp4
```

### Variables de debug
```bash
SCRAPER_DEBUG=true  # activa logs extra de DOM en instagram-comments.js
```

---

## 8. Gotchas y anti-patrones conocidos

| ⚠️ Gotcha | Descripción |
|---|---|
| **No usar `newContext()`** | Crear un nuevo contexto borra las cookies del profile. Siempre usar `browser.contexts()[0]` o `newPage()`. |
| **`waitUntil: "networkidle"` en posts directos** | Instagram es una SPA; `networkidle` espera hasta que la red se calme (500ms sin más de 2 requests). Necesario para que los comentarios carguen. |
| **Login wall** | Si la sesión expiró, Instagram redirige a `/accounts/login`. El scraper lo detecta y retorna vacío. Requiere re-login manual en el Kernel dashboard. |
| **Nombres de marca vs display names** | El scraper siempre guarda el `brand` del `target` en tenants.js, NO el nombre del perfil. Esto previene variaciones como "Dunkin Donuts" vs "Dunkin". |
| **`raw_comments` causa OOM** | El array completo de comentarios puede pesar cientos de KB por doc. Siempre usar `.select()` en Firestore para excluir este campo en queries masivas. |
| **`Uncaught signal: 6` en Cloud Run** | SIGABRT por OOM. Señal de que la query está cargando `raw_comments` sin `.select()`, o el límite de RAM es insuficiente (actualmente 1Gi). |
