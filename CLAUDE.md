# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**AutoPro AI** — a Russian-language car rental management PWA (multi-tenant SaaS). UI text, enum *values*, and most comments are in Russian; keep new user-facing strings in Russian. Originally scaffolded from Google AI Studio ([README.md](README.md)).

Two separate npm projects in one repo:
- **Root** — React 19 + Vite SPA (frontend).
- **[backend/](backend/)** — Express 5 + PostgreSQL REST API. Its own `package.json`, `tsconfig.json`, `node_modules`, and `.env`.

## Commands

Frontend (repo root):
```bash
npm install
npm run dev        # Vite dev server on 0.0.0.0:3000
npm run build      # -> dist/
npm run preview
```

Backend (`cd backend`):
```bash
npm install
npm run dev        # ts-node-dev --respawn server.ts, listens on PORT (5000 via backend/.env)
npm run build      # tsc -> backend/dist/
npm start          # node dist/server.js
```

There is no test runner, linter, or formatter configured. Type-check the frontend with `npx tsc --noEmit` (root tsconfig has `noEmit: true`); the backend type-checks via `npm run build`.

**Dev gotcha:** [vite.config.ts](vite.config.ts) defines no `/api` proxy, but [services/api.ts](services/api.ts) calls the relative path `/api`. Running `npm run dev` alone gives 404s on every API call — either add a `server.proxy` entry pointing at `http://localhost:5000` or serve both behind the same origin.

Env vars:
- `.env.local` (root): `GEMINI_API_KEY` — injected into the browser bundle as both `process.env.API_KEY` and `process.env.GEMINI_API_KEY` via Vite `define`.
- `backend/.env`: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV` (`production` enables Postgres SSL with `rejectUnauthorized: false`).

## Architecture

### Frontend: single stateful root

[App.tsx](App.tsx) (~800 lines) is the entire application shell — it holds *all* domain state (`cars`, `clients`, `rentals`, `transactions`, `investors`, `staff`, `fines`, `requests`, `allUsers`), does routing via a `currentView: AppView` string union plus `selectedEntityId`, and renders every screen conditionally. There is no router, no Context, no state library. Components in [components/](components/) are presentational and receive data + callbacks as props.

Consequences to work with, not against:
- **Mutations follow write-then-refetch.** `apiAction(fn)` wraps any `BackendAPI` call: set global loading → call → `loadData()` (re-fetches all eight collections in parallel) → clear loading. Errors surface via `alert()`. Adding a new mutation means adding a handler in `App.tsx` and threading it down as a prop.
- **Adding a screen** requires touching three places: a member in `AppView` ([types.ts](types.ts)), an entry in `NAVIGATION_ITEMS` ([constants.tsx](constants.tsx), with its `roles` array), and a render branch in `App.tsx`.
- Domain types live in [types.ts](types.ts). Stale build artifacts `types.js`/`types.d.ts` sit next to it and are excluded from the bundle by `build.rollupOptions.external` in [vite.config.ts](vite.config.ts) — do not import from them.

### Backend: generic CRUD factory + multi-tenancy

[backend/server.ts](backend/server.ts) is a single file. Its core is `setupCrud(resource, fields)`, which generates `GET/POST/PUT/DELETE /api/<resource>` for `cars`, `clients`, `investors`, `rentals`, `transactions`, `fines`, `requests`. Adding a column to one of these means: add it to the `CREATE TABLE` in `initDB()`, add an idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migration below it, add the camelCase field to the `setupCrud` field list, and add it to the interface in `types.ts`.

Key invariants:
- **`owner_id` is the tenant boundary.** Every row belongs to an ADMIN's fleet. `authenticateToken` resolves `req.user.ownerId` — for STAFF it is their admin's id (from the JWT, falling back to a DB lookup), for everyone else it is their own id. All generated queries scope on `owner_id = $1 OR owner_id IS NULL` (the NULL branch is deliberate legacy-data support).
- **DB is snake_case, API is camelCase.** `mapKeys` + `toCamelCase`/`toSnakeCase` translate at the boundary; `rentals.extensions` is JSONB and needs explicit `::jsonb` casts and `JSON.parse` on read.
- **Schema is created and migrated at boot** by `initDB()`, which runs before `app.listen`. There are no migration files.
- `staff` is *not* in the CRUD factory — staff are rows in the `users` table with `role = 'STAFF'` and an `owner_id`, served by hand-written `/api/staff` endpoints. Likewise `/api/admin/users` (SUPERADMIN only), `/api/requests/:id/status` (approving a request creates a client + reservation rental), and `/api/fines/:id/pay` (transactional: mark paid, decrement client debt, insert income transaction).
- `/api/public/fleet/:slug` and `/api/public/request` are the only unauthenticated routes — they power the guest catalog.
- Server sets `process.env.TZ = 'Europe/Moscow'` at startup; date handling assumes it.

### Auth and access control

JWT in `localStorage` under `token`, attached by `BackendAPI.getHeaders()`; a 401 clears the token. Four roles (`UserRole`): SUPERADMIN, ADMIN, STAFF, CLIENT.

Access is enforced in three independent layers — a change usually needs all three:
1. `roles` on `NAVIGATION_ITEMS` decides what appears in the nav.
2. `App.tsx` gates render branches on `currentUser.permissions` (`StaffPermissions`) for STAFF, and `checkAccess()` blocks new cars/rentals when the subscription lapsed or the plan's car limit (Start 5 / Business 20 / Premium unlimited, hardcoded in `getPlanLimit()`) is hit — showing `SubscriptionExpiredModal`.
3. The backend scopes by `req.user.ownerId` and role-checks the SUPERADMIN routes.

### Entry modes

The app decides its mode on load from the `?fleet=<slug>` URL param: with a slug it fetches the public fleet and shows `CLIENT_CATALOG` (works logged-out); otherwise it restores the session and loads the admin workspace. CLIENT users only ever load their own requests.

### Styling and assets

Tailwind is loaded from a **CDN `<script>` in [index.html](index.html)**, not built — there is no `tailwind.config` or `postcss.config`, and the `tailwindcss`/`postcss`/`autoprefixer` devDependencies are unused. Use utility classes directly; a custom Tailwind theme would require setting up the build first. Font Awesome (`<i className="fas fa-...">`) also comes from a CDN. [index.html](index.html) additionally carries an **importmap pinning React/recharts/@google/genai to esm.sh at versions that differ from `package.json`** — Vite resolves the bundled versions in dev/build, so the importmap only matters for the raw-HTML path.

PWA: [service-worker.js](service-worker.js) (cache-first, `autopro-v1`) registered from [index.tsx](index.tsx); the manifest is [metadata.json](metadata.json).

### Gemini

[services/geminiService.ts](services/geminiService.ts) calls `@google/genai` **directly from the browser** with the build-injected key, model `gemini-3-flash-preview`, and returns Russian-language fleet advice; it degrades gracefully to a message when the key is absent. Used by [components/AiAdvisor.tsx](components/AiAdvisor.tsx).
