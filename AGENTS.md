# AGENTS.md — Catalogue Slice (TanStack Start build)

> Cross-agent context contract. Every AI coding agent (Antigravity/Gemini, Claude Code, Copilot, Cursor) reads this on each task and treats it as always-on project context. Humans: read `docs/phase1-slice-spec.md` (authoritative) for full detail — this file carries the build-critical subset.

## 0. What this repo is

This is **one of two sibling repos** in a Phase 1 stack bake-off. It builds the **exact same screen** as the sibling:

- `catalogue-slice-tanstack-start` ← **you are here** (React + **TanStack Start**, Vite)
- `catalogue-slice-next` (React + **Next.js**, Turbopack)

The screen, the mock, the acceptance criteria, and the shared libraries are **identical** across both. Only the items in **§11 Stack profile** (and the equivalent section in the sibling) may differ. That identity is the whole point: it makes the comparison *evidence*, not opinion.

## 1. Golden rules (non-negotiable)

1. **Fair fight.** These files must be **byte-identical** to the sibling repo: `src/mocks/handlers.ts`, the seed generator, Zod schemas, and the shared `Table` / `Graph` / `Form` component code. If you change one, change both. Never edit the sibling from here.
2. **Spec-driven, not vibe-coded.** Build to `docs/phase1-slice-spec.md` and the acceptance checklist in §9. Do not invent scope, routes, or fields. If the spec is ambiguous, stop and ask — do not guess.
3. **Human checkpoints.** After each of the four build phases in §12, stop and present a diff/plan for review before continuing. Do not run end-to-end unattended.
4. **Sandbox discipline.** You run inside the dev container (§ environment). Do not add network calls beyond the MSW mock. No telemetry, no external APIs, no new domains. Everything resolves against the mock.
5. **State placement is law (§5).** A build that smears table state into component state, or server data into the store, has *failed* regardless of how it looks.

## 2. Environment & commands

Tooling is pinned by `mise.toml` and the dev container; **do not install tools outside mise**. Run everything through mise tasks so both repos use the same command surface:

```
mise run dev        # dev server on :5173 (binds 0.0.0.0 for container port-forwarding)
mise run build      # clean production build
mise run preview    # serve the production build
mise run test       # unit/component tests (Vitest)
mise run e2e        # acceptance flows (Playwright, Chromium)
mise run lint       # ESLint
mise run typecheck  # tsc --noEmit
```

- Open/verify the container in **VS Code** (native Dev Containers support — reliable).
- For the **Antigravity** agent, drive the container via the **Dev Container CLI**: `devcontainer up` then `devcontainer exec --workspace-folder . mise run <task>`. Antigravity's built-in container flow is currently unreliable; the CLI path is the supported one for this trial.
- Node/pnpm versions are pinned in `mise.toml`. **They must match the sibling repo's exact patch versions** — see the TODO there.

## 3. The screen to build

**Route base:** `/collaborations/:id` with four deep-linkable tabs + a routed edit drawer.

| Zone | What it is | Exercises |
|---|---|---|
| Header | Name, status pill, criticality, owner, SLA target, **role-gated** Edit button | render-time auth check; semantic status color |
| Overview tab | Metadata + KPI tiles (flow count, consumer count, avg latency) | derived/server state; loading & empty states |
| Flows tab | **Virtualized table** of integration flows | large-list perf; server sort/filter/paginate; **URL-synced** table state |
| Lineage tab | **Dependency graph** apps↔flows↔MCP servers↔agents↔APIs | graph render at scale; pan/zoom; node→route nav |
| Consumers tab | Simple downstream-consumer list | cheap reuse of the fetch/list pattern |
| Edit drawer | Routed `/collaborations/:id/edit` CRUD form | validation; optimistic update + rollback; server-error mapping |

**Nested routes — all real, shareable, back/forward-correct:**
```
/collaborations/:id/overview        (default)
/collaborations/:id/flows?sort=&dir=&status=&q=&page=&size=
/collaborations/:id/lineage?depth=2
/collaborations/:id/consumers
/collaborations/:id/edit            (drawer over the active tab)
```
Table state (`sort/dir/status/q/page/size`) lives in the **URL**, not component state — it must survive reload and deep-link.

## 4. Shared libraries (identical in both repos)

- Server state: **TanStack Query**
- Table: **TanStack Table** + **TanStack Virtual**
- Graph: **React Flow** (switch to Sigma only if render budget fails — and then in both repos)
- App state (selection set, bulk-action mode): **Zustand**
- Form + validation: **React Hook Form + Zod** (kept stack-neutral on purpose, so the signal is the framework, not the ecosystem)
- Mock: **MSW**

> Routing and data-loading wiring are the *allowed* per-stack delta — see §11.

## 5. State placement (tests the separation principle)

| Kind | Example here | Goes in |
|---|---|---|
| Server state | collaboration, flows page, lineage graph, session | **TanStack Query** |
| URL state | active tab, table sort/filter/page, edit-drawer open | **Router / URL** |
| App state | multi-row selection, bulk-action mode | **Zustand** |
| UI state | field focus, local form draft, hover | **local component state** |

## 6. API contract (framework-agnostic — same for both builds)

All requests go through the **shared MSW mock** (`src/mocks/handlers.ts`), so the contract is identical whether or not the real Spring Boot backend is up.

**Endpoints**
```
GET  /api/session                              → { user, roles[] }   (401 if unauthenticated)
GET  /api/collaborations/:id                   → Collaboration
PUT  /api/collaborations/:id                   → Collaboration        (requires CATALOGUE_EDITOR)
GET  /api/collaborations/:id/flows?sort=&dir=&status=&q=&page=&size=  → Spring Page<IntegrationFlow>
GET  /api/collaborations/:id/lineage?depth=2   → { nodes[], edges[] }
```

**Paging = Spring Data `Page`** (not a custom envelope):
```jsonc
{ "content": [ /* rows */ ], "totalElements": 1480, "number": 0, "size": 50, "totalPages": 30 }
```

**Errors = RFC 7807 `application/problem+json`** (Spring Boot 3 `ProblemDetail`):
```jsonc
{ "type":"https://catalogue/errors/validation", "title":"Validation failed",
  "status":422, "detail":"slaTargetMs must be ≥ 1",
  "errors": { "slaTargetMs": "must be ≥ 1" } }
```
The form **must map `errors{}` back onto fields**. Keep this — it's a real enterprise detail and a common place frameworks get awkward.

## 7. Auth (SPA-first, client-side guard)

- **JWT bearer** on every call. `GET /api/session` resolves user + roles.
- **Guard:** unauthenticated load → redirect `/login?return=<path>`; after login, return to the deep link intact.
- **Roles:** `CATALOGUE_VIEWER` (read), `CATALOGUE_EDITOR` (edit), `CATALOGUE_ADMIN`. Edit button + `PUT` gated to EDITOR+; a viewer sees the button disabled **with a reason**, and a forged `PUT` still 403s at the mock.
- **401 mid-session:** one silent refresh attempt; on failure, bounce to login preserving the return path. **Never white-screen on expiry.**
- Guard **client-side** (SPA). If the stack pushes you toward server components/actions to do this, that friction is itself a finding — record it, don't cave to it.

## 8. Mock seed (identical both repos)

- 1 collaboration, **~3,000 flows** (table must *virtualize*, not just paginate), **~400 lineage nodes / ~900 edges**, 3 session fixtures (viewer, editor, expired).
- Inject **jittered latency 150–400ms** so Query caching/prefetch earns its keep.
- Same seed = same numbers = fair comparison.

## 9. Acceptance checklist — "done" means every box ticked

- [ ] Deep-link to `/collaborations/:id/flows?sort=avgLatencyMs&dir=desc&status=degraded&page=3` loads that exact state **cold**.
- [ ] Table scrolls 3,000 rows at ~60fps; sort/filter/paginate go through the mock, **not** client-side slicing.
- [ ] Row hover prefetches; back/forward restores table state; no full reload between tabs.
- [ ] Lineage graph renders ~400 nodes, pans/zooms smoothly, node click routes to that entity.
- [ ] Edit drawer: dirty-tracking, optimistic save + rollback on injected 422, field errors mapped from `problem+json`.
- [ ] Viewer role: edit disabled with reason; forged `PUT` → 403 handled.
- [ ] Token-expiry fixture: silent refresh → on failure redirect to login preserving return path, no white screen.
- [ ] Empty + error states for **every** fetch (no infinite spinners).
- [ ] Keyboard: table + drawer fully operable; visible focus throughout.

## 10. Evidence to capture (this closes the gate — write it to `docs/EVIDENCE.md`)

As you build, record for this stack:

**DX notes (narrative):** scaffold→first-screen time; routing ergonomics (URL-as-state); data-fetching ergonomics; auth wiring friction; how the **table** and **graph** dropped in; type-safety friction; docs/unblock friction; whether an AI tool could scaffold a component against this contract.

**Numbers (same mock, same machine):** cold dev-server start · HMR latency (on the table component) · prod build time · initial JS gzipped for `/collaborations/:id` · route-change latency (warm cache) · table interaction latency at 3,000 rows · graph first render (~400 nodes) · LCP/INP.

**Team reactions (both engineers):** confidence to maintain for 3 years · biggest surprise · biggest pain · would-I-choose-this gut call.

## 11. Stack profile — THE per-repo delta (the only thing allowed to differ)

| Concern | This repo: **TanStack Start** |
|---|---|
| Meta-framework | TanStack Start on **Vite** |
| Routing | File-based **TanStack Router**; `search` params **typed + validated** per route |
| Data loading | **TanStack Query**, optionally fed by Start **route loaders / prefetch** in `beforeLoad`/`loader` |
| Auth guard | Client guard in route **`beforeLoad`** |
| Build | **Vite** |
| Dev port | **5173** |

Everything outside this table stays identical to the sibling.

## 12. How to work in this repo (agent loop)

1. **Read** `docs/phase1-slice-spec.md` + this file. Confirm the shared files (§1.1) match the sibling before editing.
2. **Plan** in four phases, stopping at each for review:
   - P1 — scaffold + routing shell + MSW wired + session/auth guard
   - P2 — Flows tab: virtualized table with URL-synced server sort/filter/paginate + prefetch
   - P3 — Lineage tab (graph) + Overview/Consumers tabs
   - P4 — Edit drawer: form, optimistic save + rollback, `problem+json` → field mapping
3. **Implement** against the acceptance checklist (§9); run `mise run lint && mise run typecheck && mise run test` before declaring a phase done.
4. **Capture** evidence (§10) into `docs/EVIDENCE.md` as you go — not at the end.
5. **Never** cut a corner the sibling didn't. If you must deviate, record it as a finding.

> Note: if Antigravity does not auto-load `AGENTS.md`, point its agent at this file explicitly at the start of a session (or add a thin native rules file that just says "follow AGENTS.md").
