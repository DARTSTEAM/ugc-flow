# 🤖 Project Mission & Agent Context

## 1. Project Overview
- **Name:** UGC Flow
- **Purpose:** Internal web dashboard for NGR Digital to manage UGC (User-Generated Content) creator pipelines — from discovery and qualification to campaign assignment and messaging.
- **Tech Stack:** TypeScript, React 19, Vite 7, Tailwind CSS v4, Express 5, Google BigQuery, Docker, Google Cloud Run, Google Cloud Build

---

## 2. Architecture & Key Structure

- **Design Pattern:** Single-page application (SPA) with a co-located Express API server. In dev, the API runs as a Vite middleware plugin (same port, `http://localhost:5173`). In production, the built frontend is served statically by Express (`server/prod.js`) on port 8080 inside a Docker container.
- **Data source:** Google BigQuery — project `hike-agentic-playground`, dataset `ngr_ugc`. Tables: `creators`, `messages`, `qualifications`, `creator_scores`, `campaigns`, `campaign_creators`, `brands`.
- **Authentication:** BigQuery access relies on ambient GCP credentials (ADC). No explicit auth config in code — the deployment environment (Cloud Run) must have the appropriate service account.

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
| `  CampanasTab.tsx` | Campaign list view with status management. |
| `  CampanaDetail.tsx` | Campaign detail with UGC funnel and status tracking. |
| `  NuevaCampanaModal.tsx` | Modal to create a new campaign. |
| `  UGCDrawer.tsx` | Slide-in drawer for creator detail/edit. |
| `server/index.js` | Express API. Exports the `app` for Vite middleware; also runs standalone (port 3001) when invoked directly. |
| `server/prod.js` | Production server: serves `/dist` statically + mounts the API. |
| `vite.config.ts` | Vite config; includes the custom `apiServer()` plugin that mounts `server/index.js` as Vite middleware in dev. |
| `Dockerfile` | Two-stage build: Stage 1 builds the frontend, Stage 2 runs Express with `dist/` + `server/`. |
| `cloudbuild.yaml` | CI/CD: Cloud Build → Docker image → Container Registry → Cloud Run (us-central1). |
| `Design_System.md` | Visual design specification (colors, typography, components). **Read this before making UI changes.** |

---

## 3. System Rules & Coding Standards

### Design System (read `Design_System.md` for full details)
- **Brand color:** `#fc9a00` (orange/amber). Used for primary buttons, active nav, and highlights.
- **Typography:** DM Sans (body/UI), DM Mono (data/code elements).
- **Dark mode:** Toggled by adding/removing the `dark` class on `<html>`. Stored in `localStorage` under key `ugcflow-theme`. CSS variables in `src/index.css` handle both modes.
- **Styling approach:** Use CSS custom properties (e.g. `var(--color-brand)`, `var(--color-surface)`) via inline `style={{}}` props OR Tailwind v4 utility classes. **Do not mix both systems arbitrarily** — prefer CSS vars for semantic color, Tailwind for layout/spacing.
- **Rounded corners:** `rounded-xl` (12px) for interactive elements, `rounded-2xl` (16px) for cards/modals.
- **Micro-animations:** All interactive elements must have `transition-all duration-200` and `active:scale-[0.98]`.

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
