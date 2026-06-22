# 🤖 Project Mission & Agent Context

## 1. Project Overview
- **Name:** UGC Flow
- **Purpose:** Internal web dashboard for NGR Digital to manage UGC (User-Generated Content) creator pipelines — from discovery and qualification to campaign assignment and messaging.
- **Tech Stack:** TypeScript, React 19, Vite 7, Tailwind CSS v4, Express 5, Google BigQuery, Kernel.sh (cloud browser/scraper), Playwright, Docker, Google Cloud Run, Google Cloud Build

---

## 2. Architecture & Key Structure

- **Design Pattern:** Single-page application (SPA) with a co-located Express API server. In dev, the API runs as a Vite middleware plugin (same port, `http://localhost:5173`). In production, the built frontend is served statically by Express (`server/prod.js`) on port 8080 inside a Docker container.
- **Data source:** Google BigQuery — project `hike-agentic-playground`, dataset `ngr_ugc`. Tables: `creators`, `messages`, `qualifications`, `creator_scores`, `campaigns`, `campaign_creators`, `brands`.
- **Authentication:** BigQuery access relies on ambient GCP credentials (ADC). No explicit auth config in code — the deployment environment (Cloud Run) must have the appropriate service account.
- **Scraping:** Creator profile scraping runs through Kernel.sh (cloud browser). The `server/kernel/` module handles browser pool management and platform-specific scrapers. Required env vars: `KERNEL_API_KEY`, `KERNEL_PROFILE_INSTAGRAM`, `KERNEL_PROXY_ID`, `HEADFUL_PLATFORMS`. See `.env.example` for reference.

### Critical Directories & Files

| Path | Purpose |
|---|---|
| `src/App.tsx` | Root component. Owns all data-fetching state (UGCs + campaigns), dark mode, and tab routing. |
| `src/api.ts` | Thin fetch wrapper — all API calls to `/api/*` live here. |
| `src/data.ts` | TypeScript type definitions (UGC, Campana, Mensaje, etc.) + **mock data** (`UGCS_MOCK`, `CAMPANAS_MOCK`) used for offline/dev reference. |
| `src/utils.ts` | Stateless helpers: `scoreColor`, badge configs (`ESTADO_UGC_CONFIG`, `CANAL_CONFIG`), avatar utils. |
| `src/index.css` | Global CSS — design tokens, dark mode overrides, Tailwind v4 `@theme` block. |
| `src/components/` | Feature components (one per tab + modals/drawers): |
| `  UGCsTab.tsx` | Creator list with filters, search, sorting, and inline editing. |
| `  ChatsTab.tsx` | Messaging center per creator, split-pane view. |
| `  CampanasTab.tsx` | Campaign list with status-color cards, filter nav (Todas/Activas/Borradores/Cerradas), KPI stats bar, and paginated grid (20 per page). |
| `  CampanaDetail.tsx` | Campaign detail with UGC funnel, status tracking, and action buttons (Pausar/Lanzar live here, not in cards). |
| `  NuevaCampanaModal.tsx` | Modal to create a new campaign. |
| `  UGCDrawer.tsx` | Slide-in drawer for creator detail/edit with evaluation tabs. |
| `  ProspeccionTab.tsx` | UGC search/discovery view with color-coded status cards, filter nav, stats bar, and paginated grid (20 per page). |
| `server/index.js` | Express API. Exports the `app` for Vite middleware; also runs standalone (port 3001) when invoked directly. Includes scraper endpoints (`/api/scrape/profile`, etc.). |
| `server/kernel/index.js` | Scraper orchestrator — exposes `scrapeCreatorProfiles()`. Entry point for the Kernel.sh integration. |
| `server/kernel/browser-pool.js` | Manages Playwright browser instances via Kernel.sh cloud browser API. |
| `server/kernel/scrapers/instagram-profile.js` | Instagram-specific profile scraper (followers, bio, engagement). |
| `server/prod.js` | Production server: serves `/dist` statically + mounts the API. |
| `vite.config.ts` | Vite config; includes the custom `apiServer()` plugin that mounts `server/index.js` as Vite middleware in dev. |
| `Dockerfile` | Two-stage build: Stage 1 builds the frontend, Stage 2 runs Express with `dist/` + `server/`. |
| `cloudbuild.yaml` | CI/CD: Cloud Build → Docker image → Container Registry → Cloud Run (us-central1). |
| `Design_System.md` | Visual design specification (colors, typography, components). **Read this before making UI changes.** |

---

## 3. System Rules & Coding Standards

### Design System (read `Design_System.md` for full details)

#### Paleta de Colores — Ámbar Puro (decisión permanente, no revertir)

La paleta usa la estrategia **Restrained**: un solo acento (naranja) sobre neutrales tintados con el mismo hue del naranja. Esta decisión fue tomada deliberadamente para crear cohesión entre el brand y el chrome. **No cambiar los neutrales a Slate (H≈257-265) ni a ningún otro hue frío.**

**Regla de oro:** Todo color de superficie, borde y texto en modo claro DEBE derivar de los tokens CSS. Nunca hardcodear Slate (`#F8F9FA`, `#E2E8F0`, `#475569`, `#94A3B8`, etc.) — esos son los valores viejos.

**Tokens de neutrales light (Ámbar Puro):**
```
--color-bg-app:        oklch(97.5% 0.010 74)   ← fondo general
--color-surface:       oklch(99.5% 0.005 74)   ← cards, modales
--color-surface-alt:   oklch(96.8% 0.013 73)   ← tab bars, table headers
--color-border:        oklch(90.5% 0.016 73)   ← bordes estándar
--color-border-subtle: oklch(94.8% 0.009 74)   ← divisores suaves
--color-text-1:        oklch(16%   0.022 68)   ← texto principal
--color-text-2:        oklch(44%   0.015 70)   ← texto secundario
--color-text-3:        oklch(70%   0.010 72)   ← texto muted
```

**Tokens de brand:**
```
--color-brand:         #fc9a00   ← naranja principal (único acento)
--color-brand-hover:   #e08500
--color-brand-light:   #fff7e6   ← wash muy claro para chips y badges
--color-brand-border:  #fcd580
--color-brand-muted:   #f98631
--color-danger:        #db3c3c
--color-danger-hover:  #c02b2b
```

**Colores fijos intencionales (no sustituir por CSS vars):**
- Tarjetas de campaña: `backgroundColor: cardBg` (pasteles fijos), texto `#111827` / `#6b7280` — legibilidad en ambos modos
- Hover semántico de ícono chat: `#ecfdf5` / `#059669`
- Hover semántico de ícono eliminar: `#fff1f2` / `#e11d48`
- Colores de canal (WhatsApp verde, Instagram violeta, Email azul)
- Progreso de campaña cerrada: `#CBD5E1`

**Otros lineamientos:**
- **Brand color:** `#fc9a00` (naranja/ámbar). Botones primarios, nav activo, highlights, focus rings.
- **Typography:** DM Sans (body/UI), DM Mono (datos/código).
- **Dark mode:** Clase `dark` en `<html>`. localStorage key `ugcflow-theme`. Las superficies dark se mantienen en azul-oscuro frío (#090A0F, #13151E) — el calor en dark mode lo aporta el naranja contra las superficies oscuras.
- **Styling approach:** CSS vars (`var(--color-*)`) para color semántico via `style={{}}`. Tailwind para layout/spacing. No mezclar arbitrariamente.
- **Status-color cards:** CampanasTab y ProspeccionTab usan pasteles fijos (no CSS vars) por legibilidad dark/light. Texto dentro de tarjetas pasteles usa hex fijos.
- **Pagination pattern:** `PAGE_SIZE = 20`, `visibleCount` state, botón "Ver más (N restantes)". Filtros resetean `visibleCount`.
- **Rounded corners:** `rounded-xl` (12px) para interactivos, `rounded-2xl` (16px) para cards/modales.
- **Micro-animations:** `transition-all duration-200` + `active:scale-[0.98]` en todos los interactivos.

### Code Style
- **Language:** TypeScript (.tsx / .ts). Use explicit types; avoid `any`.
- **Components:** Functional components only. Props typed with explicit interfaces.
- **State:** `useState` / `useEffect` at the `App.tsx` level; components receive data via props. No global state library.
- **API calls:** All live in `src/api.ts`. Components call handlers passed as props from `App.tsx` — they never call `fetch` directly.
- **Error handling:** API errors are caught in `App.tsx` handlers with `console.error`. There is no toast/notification system — errors are silently logged (known technical debt).
- **Server (JS):** `server/index.js` is plain ESM JavaScript (`"type": "module"`). Do not convert to TypeScript unless refactoring is explicitly requested.
- **No test framework** is currently configured. There are no unit or integration tests.
- **No linter config** (no `.eslintrc` / `prettier.config` in root). Match existing code style manually.

### Git
- No enforced commit convention currently. Use descriptive commit messages.

---

## 4. Current State & Task Backlog

- [ ] **No error notifications:** API failures are only `console.error`'d. Add a toast/snackbar system so users see errors in the UI.
- [ ] **Mock data not used in production:** `UGCS_MOCK` and `CAMPANAS_MOCK` in `data.ts` are never imported by the app — they exist as dev reference only. Consider moving them to a `__mocks__` folder or removing them to reduce confusion.
- [ ] **Tag assignment is deterministic/fake:** Creator `etiquetas` (e.g. 'Moda', 'Foodie') are assigned by `idx % extraTags.length` in `App.tsx`. These should come from the BigQuery `creators` table or a dedicated tagging system.
- [ ] **Hardcoded user in sidebar:** The logged-in user ("Santiago / Marketing") is hardcoded in `App.tsx`. There is no auth layer — implement authentication if multi-user support is needed.
- [ ] **No test coverage:** Zero unit or integration tests. Set up Vitest (built-in with Vite) and write at minimum: tests for `utils.ts` helpers, API mock tests.
- [ ] **No linter/formatter:** Add ESLint + Prettier configuration to standardize code style and catch errors early.
- [ ] **`brand_id` not shown in UI:** The `creators` table has a `brand_id` column fetched from BigQuery but it is not surfaced in the UI — verify if it should appear in UGC cards or drawer.
- [ ] **Notification button is non-functional:** The bell icon in the header has a hardcoded dot but no functionality. Implement or remove.

---

## 5. Session History (Context Log)

- **2026-06-02:** Environment initialized by agent. Project structure fully mapped. Dev server confirmed running at `http://localhost:5173` via `npm run dev`. No `Agents.md` existed prior — created from scratch.
- **2026-06-16:** Major UI overhaul session. CampanasTab redesigned with status-color cards, filter nav, KPI stats bar, clickable cards (hover indicator), pagination, and action buttons moved to CampanaDetail only. ProspeccionTab updated with stronger pastel colors, aligned color system, and pagination. Dark mode text fix: fixed-color headings on pastel card backgrounds. New `server/kernel/` scraper module added with Kernel.sh + Playwright for creator profile scraping (Instagram). UGCDrawer and CampanaDetail expanded with evaluation tabs and additional UI.
