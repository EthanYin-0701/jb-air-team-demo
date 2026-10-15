# AGENT.md

Guidance for AI coding agents (and humans) working on this repository.

## Project Overview

PawGroove ("爪爪舞台") is a Next.js (App Router, TypeScript) web app that turns a pet photo/video plus a reference dance video into a short AI-generated pet-dancing video. It uses OpenRouter for both prompt refinement (a user-selected Gemini text model) and video generation (a user-selected video model).

Design intent lives in [`plans/`](./plans) — read `plans/README.md` first, then the numbered docs, for product scope, UX, architecture, model-selection rules, and the verified OpenRouter API contracts. The current source under `src/` is a scoped-down MVP of that design (see "Known Simplifications" below and [`README.md`](./README.md)).

## Repository Layout

- `src/app/` — Next.js routes: `page.tsx` (creation studio), `jobs/[id]/page.tsx` (result page), `api/*` (models, assets, quotes, jobs, storage).
- `src/lib/` — core logic: `db.ts` (file-backed JSON store), `openrouter.ts` (catalog fetch/merge + generation calls), `worker.ts` (in-process job pipeline), `ssrf.ts` (URL import guard).
- `src/__tests__/` — Jest unit tests (SSRF validator, catalog merge/pagination, job state machine). These must not make real network/OpenRouter calls — mock `fetch`.
- `plans/` — the original design documents; treat as the source of truth for intended product behavior, not as a description of the current code.

## Known Simplifications (current code vs. `plans/04-architecture.md`)

- No PostgreSQL — a JSON file (`db.json`) stands in for the database.
- No S3 — assets are stored under the local `storage/` directory and served through a token-gated route.
- No persistent queue / separate Worker — job processing runs in-process (async function), not in an isolated worker.
- No authentication / login flow — single implicit local user.
- Pet-video frame extraction is a metadata stub, not real `ffmpeg` extraction.

Do not treat these as bugs; they are deliberate scope reductions for a sandbox environment without provisioned infrastructure. If you add real infra (DB, object storage, queue), update this file and `README.md`.

## Working Conventions

- Keep OpenRouter catalog/classification rules faithful to `plans/07-model-selection.md` and `plans/08-openrouter-api-verification.md`: Text dropdown = `output_modalities=text&arch=Gemini`; Video dropdown = `output_modalities=video` merged with `/api/v1/videos/models`. Never hardcode a fixed model as a fallback, never fabricate token/cost values — missing values must stay `null`/"unavailable", not `0`.
- Never expose `OPENROUTER_API_KEY` to the client; all OpenRouter calls happen in server-side route handlers / `lib/openrouter.ts`.
- When adding features, prefer extending the existing job state machine (`queued -> analyzing -> submitting -> provider_queued -> generating -> processing -> succeeded/failed/cancelled`) rather than introducing parallel status fields.
- Run `npm test` and `npm run build` before considering a change complete; both must pass. Tests must remain network-free (mock `fetch`).
- `storage/`, `db.json`, and `.env.local` are local/dev artifacts — keep them gitignored, never commit real secrets.

## Commands

```bash
npm install        # install dependencies
npm run dev         # start dev server
npm test            # run unit tests (no network calls)
npm run build        # production build / type-check
```
