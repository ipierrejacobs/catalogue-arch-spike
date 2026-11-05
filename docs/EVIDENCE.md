# EVIDENCE.md — Phase 1 Stack Bake-off

_The gate artifact for the framework decision. This file — not the scorecard — closes Phase 1. Same mock, same acceptance checklist, same machine → **every difference recorded here is the stack**._

**Canonical copy:** `claude/EVIDENCE.md` (project knowledge — persists across chats; Claude keeps this current as the gate closes). **Working copies:** `docs/EVIDENCE.md` in _both_ repos, kept in sync, where the agent writes numbers as it builds. Capture evidence **as you build**, not at the end (per implementation guide Step 4); fold the repo captures into this canonical copy.

**References:** `phase1-slice-spec.md` (the instrument) · `locked-decisions.md` (the memory) · `phase1-implementation-guide.md` (how to run it) · `phase1-P2-plan.md` (the current build phase's brief) · `phase1-P2-agent-command.md` (the P2 kickoff) · `AGENTS.md` §10 (what to capture).

**Finalists:** React + TanStack Start · React + Next.js.

---

## Build-phase status (AGENTS.md §12 — P1→P4)

| Phase | Scope | Start | Next | Notes |
|---|---|---|---|---|
| **P1** | routing shell + MSW + client auth guard | ✅ merged | ✅ merged | both on `p1-routing-shell` → merged to `main`; shared SHA `1462f92` untouched in both; all four gates (lint/typecheck/test/e2e) green |
| **P2** | virtualized table + server sort/filter/paginate | ◐ in progress | ◐ in progress | **started 30 Oct 2026** — building to `phase1-P2-plan.md` (Table **v9** + Virtual, reading **A**); URL-driven table state → **every sort/filter/page/search is a navigation**, so Next's RSC-on-navigation finding gets measured here against Start's in-memory router. **Step 1 (shared flows layer) CLOSED 2 Nov 2026 at shared SHA `7cb25ac`** — both siblings pinned + verified matching; `react`/`react-dom` aligned to 19.3.0 across both. Step 2 (URL-as-state wiring) next. _Branch note: Start committed to `main`; Next on `p2-flows-table` (commit `bfca5b7`) — asymmetric, see deviations._ |
| P3 | lineage graph (~400 nodes) | ☐ | ☐ | |
| P4 | edit drawer + optimistic save + `problem+json` + full token-expiry | ☐ | ☐ | fully exercises the §9 acceptance checklist |

**P1 completed 30 Oct 2026.** P1 built *shells only* (per plan "Explicitly NOT in P1"): routing shell, client-side auth guard, MSW bootstrap, dev role-switcher + login stub, typed-but-empty `search` params. No table/graph/edit yet — those are P2–P4. The Phase 1 **gate** (framework decision) is read off the *full* slice + numbers + acceptance pass, not off P1. P1's value is the first DX signal, captured below.

**P2 opened 30 Oct 2026.** Brief: `phase1-P2-plan.md` (approved). Rulings locked: TanStack Table **v9** (native API, no `useLegacyTable`/`stockFeatures`; release notes are the arbiter) and pagination seam **reading A** (server paging authoritative, `page=3` literal; Virtual windows a large loaded page). Scope is the Flows tab only. The rows seeded below (numbers + DX + the new RSC-per-interaction line) are the agent's write targets this phase — **M4-Max-only captures, nothing estimated.**

---

## Step 0 — Pre-flight decisions (closed 21 Oct 2026)

### 0.1 Repo names — **LOCKED**
- `catalogue-slice-tanstack-start` (React + TanStack Start, Vite, dev port 5173)
- `catalogue-slice-next` (React + Next.js, Turbopack, dev port 3000)

These names are baked into each `AGENTS.md`, the devcontainer `"name"` field, and CI. Do not rename after repos exist.

### 0.2 Shared-file transport — **git submodule** (with fallback)
Shared, byte-identical code (the MSW mock + seed + Zod schemas, and `Table`/`Graph`/`Form`) lives in one shared repo — `catalogue-slice-shared` (https://github.com/ipierrejacobs/catalogue-slice-shared) — mounted as a submodule at **`src/shared`** in both siblings and pinned by SHA. Byte-identity is structural, not a discipline.

**Actual paths:** the shared repo's own layout is `src/mocks/`, `src/schemas/`, `src/seed/`, `src/components/`, so from a sibling the mock resolves at `src/shared/src/mocks/handlers.ts`. App code imports via the `@shared/*` alias (see §0.4), e.g. `@shared/mocks/handlers`. _(P2 added `src/flows/` → `@shared/flows`.)_

**Fallback:** if submodule mechanics cause too much friction in the agent/container loop, switch to `scripts/sync-shared.sh` + checksum-in-CI. Record the switch here with the date and reason if it happens.

**Submodule operating notes (read before cloning or running an agent task):**
- **Clone/pull with `--recurse-submodules`.** First clone: `git clone --recurse-submodules <repo>`. After a normal `git pull`, run `git submodule update --init --recursive` or the shared dir will be stale/empty. Agents forget this — the dev container's post-create / first task step should run it explicitly.
- **Detached-HEAD is expected inside the submodule.** A submodule checks out a specific commit, not a branch, so `git status` in the shared dir shows detached HEAD by design — that is the normal, correct state for a *consumed* pin (re-pinning with `git checkout <sha>` lands there and is fine). The detached-HEAD warning only matters when you are *authoring* shared code: `cd` into the submodule, `git checkout main` **first**, commit and push there, then back in the parent repo `git add src/shared` to bump the pinned SHA. Committing while detached and not on a branch is the classic "lost my shared-code change" trap.
- **Author shared edits from a real clone or the submodule-on-`main`, and watch for divergence.** A separate clone of `catalogue-slice-shared` and the in-repo submodule are different working copies of the same repo; a commit in one isn't visible to the other until pushed + pulled. If the remote moved while you were editing, `git pull --rebase origin main` before pushing (a plain push is rejected "fetch first").
- **Change one, change both = bump the SHA in both siblings.** After pushing shared code, update the pinned SHA in *both* `catalogue-slice-tanstack-start` and `catalogue-slice-next` so they point at the same commit. Mismatched submodule SHAs between siblings silently breaks the fair fight. Verify with `git -C src/shared rev-parse HEAD` in each — the two SHAs must be identical. _(The committed pointer is `git rev-parse HEAD:src/shared`; the staged pointer is `git rev-parse :src/shared`. `HEAD:` only reflects the new SHA **after you commit** the bump — a common "why is it still the old SHA?" moment.)_
- If agents trip on any of the above more than ~twice, that's the signal to invoke the fallback.

### 0.3 Measurement machine — **M4 Max** (all §10 numbers captured here, nowhere else)
Every number in the tables below comes off this one machine. The agent may *build* anywhere (cloud container host, either laptop); the **stopwatch runs only on the M4 Max**, so numbers stay comparable.

> Reproducibility record (filled 23 Oct 2026):
> - **Chip / machine:** Apple M4 Max MacBook Pro — 16 cores (12 performance + 4 efficiency), 64 GB RAM
> - **OS / versions:** macOS 27 (Golden Gate) 27.0.1 · pinned Node 24.22.1 · pnpm 12.14.0 (exact patches pinned in `mise.toml`, both repos — see §0.4)
> - **Conditions:** plugged in, not thermally throttled, other heavy apps closed (perf numbers drift on battery/thermal).
> - **Stopwatch owner:** **PierreJ** — runs every §10 capture on this machine, so the same hand runs each measurement.

### 0.4 Scaffold choices — **symmetric & deliberate, both repos** (closed 22 Oct 2026)
Every `create` prompt was answered identically across both finalists (or with the faithful per-stack equivalent), so any difference measured later is the framework, not a setup accident. Allowed per-stack deltas are the things actually under test (bundler, router) and are marked.

| Choice | TanStack Start | Next.js | Note |
|---|---|---|---|
| Scaffolder | `@tanstack/cli create` | `create-next-app@latest` | |
| Build tool / bundler | Vite 8 | Turbopack (default) | **allowed delta** — under test |
| Lint/format toolchain | Biome | Biome | one binary (lint + format); matched both sides |
| Deployment adapter | None | n/a (no prompt) | slice is local-only + SPA-first; add a Nitro preset later only if a real deploy target is chosen, and then symmetrically |
| Demo/example pages | none (bare shell) | none (bare shell) | keeps bundle/build numbers clean |
| Add-ons | none | none | WorkOS deselected; shared libs hand-installed per AGENTS §4 |
| React Compiler | off | off | avoids confounding perf numbers; no Start default for it |
| Tailwind | v4 via `@tailwindcss/vite` | v4 via `@tailwindcss/postcss` | build-wiring is an **allowed delta**; `@theme` tokens kept identical (shared presentation layer) |
| Router | file-based TanStack Router | App Router | **allowed delta** — the routing ergonomics under test |
| Cache Components | n/a | off | SPA-first; no RSC / server caching |
| `src/` directory | yes | yes | parallel layout; shared code resolves at the same paths |
| Import alias | `@/*` → `src/*`; `@shared/*` → `src/shared/src/*` | `@/*` → `src/*`; `@shared/*` → `src/shared/src/*` | identical; see shared-alias row |
| Shared-code alias resolution | `tsconfig.paths` via Vite 8 native `resolve.tsconfigPaths: true` | `tsconfig.paths` (Next native) | **symmetric** — both resolve `@shared/*` purely from `tsconfig.json`; no bundler alias, no `vite-tsconfig-paths` plugin. (Vite notes `resolve.tsconfigPaths` "has a performance cost" — mental asterisk if a Start cold-start number looks off.) |

**Toolchain versions — pinned (the fair-fight gate).** Exact `node`/`pnpm` patch versions resolved via `mise install` and pinned verbatim in **both** `mise.toml` files; `node` = 24.22.1, `pnpm` = 12.14.0 (node bump from 24.7.0 ratified 23 Oct 2026 — see deviations log). `mise.toml` is the source of truth. The shared repo (`catalogue-slice-shared`) pins the same `pnpm` in its `packageManager` / `devEngines` and declares **no** node pin, so the node bump does not touch the shared SHA.

**App-dependency pins (added during P1 — see deviations log).** `@tanstack/react-query` 5.104.5, `zustand` 5.0.16, `vitest` 5.0.5 pinned **exact** (no caret) and identical in both repos; `@biomejs/biome` 2.4.5 (binary + `$schema`) identical in both. Same class as the `zod`/`msw`/`typescript`/`@playwright/test` pins — any drift is an unpinned fair-fight variable. _(P2 added, 2 Nov 2026: `@tanstack/react-table` **9.3.1** and `@tanstack/react-virtual` **3.14.24**, plus **`react`/`react-dom`/`@types/react`/`@types/react-dom` = 19.3.0** — all exact/no-caret, identical in both siblings.)_

**Shared-package peer contract (added 2 Nov 2026 — see deviations).** `src/shared/package.json` now declares its React-land imports as **`peerDependencies`** — `react` 19.3.0, `react-dom` 19.3.0, `@tanstack/react-query` 5.104.5, `@tanstack/react-table` 9.3.1, `@tanstack/react-virtual` 3.14.24, `zustand` 5.0.16, `zod` 4.6.7, `msw` 3.0.3 — so the shared code resolves a **single** copy of each from the consuming app instead of pulling its own. This is the structural guard that keeps the siblings from drifting on these versions; an app pin that disagrees with a peer now surfaces at install.

### 0.5 Shared-layer open decisions — **CONFIRMED** (23 Oct 2026)
The four readings baked into the shared `handlers.ts` (where §4 is silent or internally inconsistent) are **confirmed as the intended contract** — no re-cut needed. This clears the last thing gating the shared SHA: it is now ready to pin, identically, into both siblings.

| # | Decision | Status |
|---|---|---|
| 1 | Sixth endpoint = `GET /api/collaborations/:id/consumers` → `Consumer[]` (inferred `ConsumerSchema`) | ☑ Confirmed |
| 2 | Silent refresh modelled with **no** dedicated refresh endpoint — expired token re-hits `GET /api/session`, 401s again, then redirects (endpoint count stays at six) | ☑ Confirmed |
| 3 | Flows `status` filter = **union** over `flow.status` OR `flow.health` (so §4 `status=active` and §9 `status=degraded` both resolve non-empty cold) | ☑ Confirmed |
| 4 | `flowCount`/`consumerCount` tied to **actual** generated counts (3000 / 37), not the illustrative 1480 | ☑ Confirmed |

The `CONFIRM before pinning` comment headers in `handlers.ts`/`schemas.ts` can be updated to `CONFIRMED (23 Oct 2026)` on the next shared-repo commit — a documentation-only change that rides along with the SHA that both siblings will pin.

**Pinned & closed (23 Oct 2026):** the shared SHA is committed and set **identically** in both siblings' `src/shared` (verify `git -C src/shared rev-parse HEAD` matches across repos); the working `docs/EVIDENCE.md` is synced in both repos. Step 2 (shared layer) is fully closed — Step 3 (build the slice, starting P1) is unblocked.

**Reproducibility anchor — the shared-layer short-SHA every captured number traces back to:**
- **P1:** `1462f92` (mock + seed + schemas; both siblings pinned, verified matching).
- **P2:** **`7cb25ac`** (`7cb25ac66631a19653149a9e79427e8995eae924`) — **CLOSED 2 Nov 2026**, both siblings' committed `HEAD:src/shared` verified matching. Adds `src/flows/` (`FlowsSearchSchema`, `useFlows`, `FlowsTable` on Table v9 + Virtual) and the peer-dependency contract (§0.4). _Intermediate P2 SHAs, all superseded, never both-pinned: `09c79ee` (initial authoring) → `c7b9e4e` (dropped `rowSelectionFeature`) → `97f85bf` (broken-JSON peers, discarded) → `7cb25ac` (valid peers + React alignment)._ Every P2 number traces to `7cb25ac`.

---

## Numbers — side by side (same mock, same machine: M4 Max)

Fill each cell as the relevant phase lands. Leave blank until measured — never estimate.

> **P1 captured nothing valid; P2 is now in flight (30 Oct 2026).** The only figure produced during P1 was a Start cold-dev-start of **~536 ms measured inside the cloud container**, which is **quarantined — not a valid number** (§0.3: the stopwatch runs only on the M4 Max, by PierreJ). P2 is the first real capture window: it fills **HMR (on the table), table interaction @3,000 rows, route/sort-change latency, initial JS gzipped, prod build, LCP, INP**, and the new **RSC-per-interaction** row below (graph first render stays P3). All cells await M4 Max capture — nothing estimated. The `resolve.tsconfigPaths` perf asterisk (§0.4) applies to the Start cold-start cell when it is measured for real.

| Metric | How measured | TanStack Start | Next.js |
|---|---|---|---|
| Cold dev-server start | first `dev` → interactive | _(pending M4 Max; ~536 ms container figure quarantined)_ | |
| HMR latency _(P2)_ | save → reflect, on the **table** component | | |
| Prod build time _(P2 recapture)_ | clean `build` | | |
| Initial JS (gzipped) _(P2)_ | the `/collaborations/:id` route (Table v9 tree-shaking shows here) | | |
| Route-change latency _(P2)_ | tab → tab **and** sort → sort, warm cache | | |
| Table interaction latency _(P2)_ | sort/scroll at **3,000 rows** | | |
| **RSC flight per table interaction** _(P2 headline)_ | per sort/filter/page/search: **Next** = count + latency of `?_rsc=` to the dev server; **Start** = confirm **zero network** on the state change (only the mock flows fetch fires) | | |
| Graph first render _(P3)_ | **~400 nodes** | | |
| Web vitals — LCP _(P2)_ | the screen | | |
| Web vitals — INP _(P2)_ | the screen (the right vital for "is the sort snappy") | | |

---

## DX narrative

Write as you go, per stack. Keep it honest and specific — this is half the gate. _P1 entries below filled 30 Oct 2026; Table/URL-as-state bullets land in P2, Graph/AI-pipeline in P3._

### TanStack Start
- **Scaffold → first screen:** `@tanstack/cli create` → bare shell, clean. Main friction was the SPA-first wiring: finding how to disable SSR (`defaultSsr`) required reading the minified `@tanstack/react-start` dist (it's omitted from the public `RouterConstructorOptions` type), and the client entry took several iterations (virtual client entry → `src/start.ts` + `client.entry` in `vite.config.ts`) before `hydrateRoot(document, …)` was stable. Once wired, it holds.
- **Routing ergonomics (URL-as-state, typed `search` params):** Strong. File-based routes; `validateSearch` with a typed `FlowsSearchSchema` (`sort/dir/status/q/page/size`) declared empty-but-typed on the `flows` route now, so P2 only fills them in. Typed search is a first-class concept, not a bolt-on.
- **Data-fetching ergonomics (Query + Start loaders/prefetch):** `useSession()` on TanStack Query; `beforeLoad` integrates with `ensureQueryData`. Clean separation (server state in Query).
- **Auth wiring friction (client guard in `beforeLoad`):** Low. Guard runs in `beforeLoad` *before* render — no flash, no fallback-shell ceremony. `isRedirect(err)` rethrown cleanly. Context typed via `createRootRouteWithContext<{ queryClient, auth }>()`.
- **How the Table dropped in (TanStack Table v9 + Virtual):** _(P2 — shared `FlowsTable` at `7cb25ac`: native v9 `useTable` + module-scoped `tableFeatures({ rowSortingFeature, rowPaginationFeature })` (no `stockFeatures`/`legacy`), manual mode (`manualSorting`/`manualPagination` + `rowCount`), `createColumnHelper<typeof features, IntegrationFlow>` + `<table.FlexRender/>`, `useVirtualizer` row windowing. Full DX reaction after it's wired into a route in Step 2.)_
- **URL-as-state under load + RSC-on-navigation (P2 headline):** _(P2 — fill with: filling the typed `search` on the `flows` route; `navigate({ search })` per sort/filter/page; confirm the in-memory router fires zero network on a state change; prefetch ergonomics for the adjacent page)_
- **How the Graph dropped in (React Flow):** _(P3)_
- **Type-safety friction:** Mostly good, but `defaultSsr` being absent from the public router-options type is a real gap — the SPA-first knob is undocumented in the types and had to be set via `createStart(() => ({ defaultSsr: false }))`.
- **Docs / unblock friction:** The SSR-off path is under-documented; the agent resorted to reading dist. Otherwise the file-based routing + typed-search docs were sufficient.
- **Did a stack push toward server components/actions for the gated data? (friction = a finding):** **One server-ward default, cleanly disabled.** Start defaults `defaultSsr: true`, which executes `beforeLoad` on the server during initial SSR — before `localStorage` or the MSW worker exist. Disabled globally via `createStart(() => ({ defaultSsr: false }))`. No pull toward RSC or server actions for the gated data. **Strategic note for the gate:** Start with SSR globally off is essentially Vite + TanStack Router — a legitimate "what are we actually buying from Start here?" question to carry into the decision.
- **AI pipeline (Phase 3 preview): could v0 scaffold a component against this contract?** _(P3)_

### Next.js
- **Scaffold → first screen:** `create-next-app` → bare shell. Two config additions needed that Start didn't: a standalone `vitest.config.ts` (`resolve: { tsconfigPaths: true }`) because Next uses `next.config.ts` (Turbopack), not `vite.config.ts`, so Vitest didn't inherit the `@shared/*` / `@/*` aliases; and `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` so Next 16 accepts dev HMR from `http://127.0.0.1:3000`.
- **Routing ergonomics (URL-as-state, App Router `useSearchParams`):** More ceremony than Start. `useSearchParams()` returns an untyped `ReadonlyURLSearchParams` → manual extraction into `FlowsSearchSchema.safeParse`, and every component reading it needs an explicit `<Suspense>` boundary. No first-class typed-search concept.
- **Data-fetching ergonomics (TanStack Query, client; avoiding RSC for gated data):** Client Query via `MswProvider → QueryClientProvider`. Kept entirely client-side; no RSC for gated data.
- **Auth wiring friction (client-side layout/middleware guard):** Higher than Start. The client layout guard (`app/collaborations/[id]/layout.tsx`, `"use client"`) must render explicit loading/redirecting fallback shells while `useSession()` resolves and a `useEffect` fires `router.replace(...)` — there is no pre-render hook like Start's `beforeLoad`, so the redirect happens after first render with a visible `Redirecting to login…` shell. `proxy.ts` (Next 16's renamed middleware) was **not** used — guard kept strictly client-side.
- **How the Table dropped in (TanStack Table v9 + Virtual):** _(P2 — consumes the identical shared `FlowsTable` at `7cb25ac`; the drop-in note is the same since it's shared code — divergence here would be a fair-fight break. Next-specific wiring reaction lands with Step 2.)_
- **URL-as-state under load + RSC-on-navigation (P2 headline):** _(P2 — fill with: `useSearchParams` → `safeParse` + `<Suspense>`; idiomatic `router.replace` updater and the measured `?_rsc=` cost per interaction; whether the `window.history.replaceState` escape hatch was needed to meet budget, and its measured delta; both framings on the record)_
- **How the Graph dropped in (React Flow):** _(P3)_
- **Type-safety friction:** `useSearchParams` is untyped; parsing is manual. Next's scaffold `tsconfig` is also looser than Start's (see deviations) — a parked symmetry question.
- **Docs / unblock friction:** The `"node": null` export / `[Client Component SSR]` interaction (below) is poorly surfaced — the failure mode (`Module not found: msw/browser`) doesn't point at the cause.
- **Did a stack push toward server components/actions for the gated data? (friction = a finding):** **Two server-ward pulls, both resisted — this is the headline P1 result.** (1) MSW's `"node": null` conditional export made Next's `[Client Component SSR]` compile pass reject a static `msw/browser` import; kept client-only via dynamic `import("./browser")` in a `useEffect`. (2) **Even with 100% client-side Query and a `"use client"` guard, the App Router still issues HTTP RSC flight requests (`GET <route>?_rsc=…`) on every `<Link>`/`router.replace()` navigation** — these hit `onUnhandledFrame: "error"` and had to be `passthrough()`'d (`/_next/*`, `/`, `/login`, `/collaborations/*`). Start's router is in-memory; nothing touches the network on a tab change. This is the clearest evidence of App Router's server-coupling at the routing layer, and it **cannot be turned off**. _Counter-framing (both sides on the record):_ a Next advocate would note these RSC fetches are normal, cheap, and only awkward because the slice is SPA-first and mocks everything client-side — with a real server they're a non-issue. The finding stands (SPA-first is locked, §5) as a DX/architecture data point, **not a gate verdict**; it gets its real stress test in P2, where every table sort/filter is a navigation.
- **AI pipeline (Phase 3 preview): could v0 scaffold a component against this contract?** _(P3)_

---

## Team reactions (both engineers, per stack)

### TanStack Start
| | Engineer 1 | Engineer 2 |
|---|---|---|
| Confidence to maintain this for 3 years | | |
| Biggest surprise | | |
| Biggest pain | | |
| Would-I-choose-this gut call | | |

### Next.js
| | Engineer 1 | Engineer 2 |
|---|---|---|
| Confidence to maintain this for 3 years | | |
| Biggest surprise | | |
| Biggest pain | | |
| Would-I-choose-this gut call | | |

---

## Acceptance checklist pass (§9 — neither build is "done" until every box ticks)

Mirror of the spec's checklist, tracked per stack. A build isn't gate-ready until its column is all ✅. _These are **full-slice** items (P2–P4); P1 built only the shells that hang off them, so every box is still open. P1 proved, in stub form: the routing shell + deep-linkable tabs/drawer, the client-side guard redirect preserving the return path, the dev role-switcher (viewer/editor/expired), and the expired→silent-refresh→redirect-with-no-white-screen path. The first five table-relevant boxes are **P2's targets** (in progress 30 Oct 2026); graph/drawer/role/expiry fully exercised at P3–P4._

| Acceptance item | TanStack Start | Next.js |
|---|---|---|
| Deep-link `…/flows?sort=avgLatencyMs&dir=desc&status=degraded&page=3` loads that exact state cold | ☐ (P2) | ☐ (P2) |
| Table scrolls 3,000 rows ~60fps; sort/filter/paginate server-side (mock), not client slicing | ☐ (P2) | ☐ (P2) |
| Row hover prefetches; back/forward restores table state; no full reload between tabs | ☐ (P2) | ☐ (P2) |
| Lineage graph renders ~400 nodes, pans/zooms smoothly, node click routes to that entity | ☐ | ☐ |
| Edit drawer: dirty-tracking, optimistic save + rollback on injected 422, field errors from `problem+json` | ☐ | ☐ |
| Viewer role: edit disabled with reason; forged `PUT` → 403 handled | ☐ (role-gated edit control stubbed) | ☐ (role-gated edit control stubbed) |
| Token-expiry fixture: silent refresh → on failure redirect to login preserving return path, no white screen | ☐ (redirect+no-white-screen proven in P1 stub) | ☐ (redirect+no-white-screen proven in P1 stub) |
| Empty + error states for every fetch (no infinite spinners) | ☐ (P2: flows fetch) | ☐ (P2: flows fetch) |
| Keyboard: table + drawer fully operable; visible focus throughout | ☐ (P2: table) | ☐ (P2: table) |

---

## Gate decision (fill at close of Phase 1)

- **Chosen framework + meta-framework:**
- **Read off:** EVIDENCE (above) + acceptance pass — _not_ the scorecard.
- **Date / who signed off:**
- **Then:** update the **Chosen framework + meta-framework** row in `locked-decisions.md` and the scorecard artifact, and confirm.

### Open questions parked for the gate (don't pre-decide; decide by building)
- **Start-with-SSR-off ≈ Vite + TanStack Router** — if `defaultSsr: false` is permanent, name what Start adds over plain Vite + Router for this app.
- **App Router is server-coupled at the routing layer** — the RSC-on-navigation finding; weigh it against the counter-framing once P2 shows whether it actually costs anything measurable. _(P2 in progress — this is the phase that produces the number.)_
- **Lint/format gate scope** — neither repo's `lint` gate currently enforces format/import-order (both run `biome lint`, rules only). Decide, for both repos together, whether CI should also run `biome check`/format — after preflight, not mid-P.
- **Next `tsconfig` strictness** — Next's scaffold is looser than Start's (target + strict flags). Align Next up to Start, or accept as a recorded scaffold-default delta.
- **P2 branch asymmetry** — Start committed P2 Step 1 to `main` directly; Next is on `p2-flows-table`. Decide a consistent merge model (branch + PR per the P1 `#1` flow is the cleaner default) before P2 closes, so the two repos' histories stay comparable.

### Deviations log (any corner cut, or any place a stack forced a different approach — record, don't bury)
| Date | Repo | Deviation / finding | Why |
|---|---|---|---|
| 2026-10-22 | both | **Ports are not forwarded under the `devcontainer` CLI.** `forwardPorts` / `portsAttributes` are honored by VS Code's Dev Containers extension only, not the CLI (the Antigravity path). Publish the dev port explicitly via `runArgs` — `["-p","5173:5173"]` (Start) / `["-p","3000:3000"]` (Next). `forwardPorts` left in the file (harmless; still helps the VS Code flow). | CLI is the supported agent path per AGENTS.md §2; without this the dev server is unreachable from the host. |
| 2026-10-22 | both | **Reach the dev server at `http://127.0.0.1:<port>`, not `localhost`.** macOS resolves `localhost` to IPv6 `::1` first; Docker `-p` publishes on IPv4 only → `localhost` gives `ERR_CONNECTION_REFUSED` while `127.0.0.1` works. Server bind + port publish were both already correct (`ss` showed `*:5173`); the only fix is the URL. Optional: publish `127.0.0.1:<port>:<port>` to make `localhost` resolve too. | Pure host-side IPv6/IPv4 mismatch, nothing app-side — cost a long debug; recorded so the agent doesn't repeat it. |
| 2026-10-22 | both | **Playwright must be an installed dependency, not just an `e2e` script.** The drafted `postCreateCommand` ends with `pnpm exec playwright install …`, which fails (`playwright not found`, exit 254) on a bare scaffold because `@playwright/test` wasn't in `devDependencies`. Fix: add `@playwright/test` (same version both repos, installed with the pinned pnpm) + `"e2e": "playwright test"`; postCreate then runs clean from a fresh `--remove-existing-container`. | The drafted devcontainer assumed a dependency the no-add-ons scaffold didn't include. |
| 2026-10-22 | both | **Start dev port corrected to 5173; host-bind wired per-stack.** `@tanstack/cli` scaffolds the dev server on **3000** (collides with Next) — repinned to **5173** in the Start `dev` script. The server must bind all interfaces for the published port to be reachable; wired per stack (Start: Vite `--host` / `server.host`; Next: `next dev -H 0.0.0.0`) — an **allowed delta**. Both bound to `*` (all interfaces) out of the box here, so no config change was needed for binding — only the port. | 3000 collision would break running both finalists at once; host-bind is required for host reachability. |
| 2026-10-23 | shared | **Sixth §4 endpoint read as `GET /api/collaborations/:id/consumers` returning `Consumer[]`.** §4 lists 5 endpoints; the implementation guide says "six". The Consumers tab + route are first-class in the spec, so the sixth is the consumers list, not a refresh endpoint. **Response shape is inferred** (`ConsumerSchema`: id, name, team, criticality, lastConsumedAt) — spec gives none. ☑ **Confirmed 23 Oct 2026** (§0.5). | Spec is silent on the sixth endpoint's shape; took the most spec-faithful reading rather than stall. |
| 2026-10-23 | shared | **Silent refresh modelled with no dedicated refresh endpoint.** The expired fixture always 401s; the client's one silent-refresh attempt re-hits `GET /api/session`, 401s again, then redirects — keeping the count at six (consumers, not refresh). ☑ **Confirmed 23 Oct 2026** (§0.5). | §5 requires the behaviour, not a specific endpoint; avoids inventing a seventh endpoint. |
| 2026-10-23 | shared | **Flows `status` filter matches EITHER `flow.status` OR `flow.health` (union).** §4's example is `status=active` (lifecycle); §9's gate deep-link is `status=degraded` (health). A union is the only reading where both resolve non-empty cold. Verified: 2,166 rows match `active`, 665 (~22%) match `degraded` → gate page 3 returns a full 50. ☑ **Confirmed 23 Oct 2026** (§0.5). | Spec uses one param name for two vocabularies; union satisfies both §4 and §9 without a contract change. |
| 2026-10-23 | shared | **`flowCount`/`consumerCount` tied to actual generated counts (3000 / 37), not the entity example's 1480.** §6 governs ("~3,000"); the 1480 in the §4 example is illustrative. Counts are derived from the arrays so the Overview KPI tiles can't drift from the Flows table. ☑ **Confirmed 23 Oct 2026** (§0.5). | A KPI tile disagreeing with the table it summarises would be a bug; seed section is authoritative on volume. |
| 2026-10-23 | shared | **Shared layer verified before hand-off.** 24/24 data checks green (determinism byte-identical, exact counts, graph integrity, gate deep-link, role fixtures); `tsc --noEmit` clean against zod 4.6.7 / msw 3.0.3 / TS 7. One code change: MSW 3 makes `HttpResponse` generic in annotation positions → two spots to `HttpResponse<any>` (back-compatible with v2). **Pin `zod`/`msw`/`typescript` to identical versions in both repos** — MSW 2-vs-3 changes the typings, so they're an unpinned fair-fight variable like `@playwright/test`. | Instrument must be proven, not asserted; version drift in untracked deps would break byte-identity. |
| 2026-10-23 | all | **Toolchain pinned to exact patches: node 24.7.0, pnpm 12.14.0.** pnpm bumped from the earlier 10.34.7 lock — the scaffolded siblings and the shared repo's `create`-generated `packageManager`/`devEngines` resolved to pnpm 12.14.0, so the lock was aligned to that rather than downgrading three repos. Pinned in both `mise.toml` files (§0.3/§0.4) and the shared repo's `packageManager` + `devEngines`. All three repos must carry the identical pair, or the fair-fight toolchain pin is broken. _(node 24.7.0 superseded 23 Oct 2026 — see ratify entry below.)_ | Match the lock to what the toolchain produced; exact patches on all three keep the only measured difference the framework. |
| 2026-10-23 | both | **Shared submodule mounted at `src/shared`; `@shared/*` alias resolves via `tsconfig.paths` on both stacks.** Vite 8's native `resolve.tsconfigPaths: true` (already in the Start scaffold) means Start reads the alias straight from `tsconfig.json` — no `vite-tsconfig-paths` plugin, no `resolve.alias`, so the alias wiring is **symmetric** with Next (not an allowed delta). Also: `catalogue-slice-tanstack-start` default branch renamed `master` → `main` for symmetry. | Keep the shared-code resolution identical across stacks; one less confound. Vite confirms native tsconfig-paths support (has a minor perf cost). |
| 2026-10-23 | all | **Node pin ratified 24.7.0 → 24.22.1** (supersedes the 24.7.0 pin above). P1 preflight found the Start `mise.toml` had drifted to node **24.22.1**; rather than restore 24.7.0, the newer patch was ratified. Next's `mise.toml` bumped to match; both `mise.toml` files verified identical (`node = "24.22.1"`, `pnpm = "12.14.0"`); `catalogue-slice-shared`'s `package.json` confirmed to declare **no** node entry, so the shared SHA (`1462f92`) is untouched. §0.3 repro record and §0.4 updated. | pnpm already matched — node was the only drift. Ratified to avoid downgrading a working toolchain; symmetry preserved by bumping the sibling, not just the doc. |
| 2026-10-23 | both | **`test` script wired (`"test": "vitest run"`); the P1 gate was a silent no-op.** The scaffold shipped no `test` script in `package.json`, so `mise run test` → `pnpm test` exited 0 without running anything — the P1 `lint && typecheck && test` gate was effectively `lint && typecheck`. Added `"test": "vitest run"` identically in both repos so the gate actually runs Vitest. | A green gate that runs no tests would let a build pass P1 with broken/absent tests; the gate must be real before the P1 build. |
| 2026-10-23 | both | **P1 plan filename de-spaced.** The on-disk P1 plan was `docs/Phase 1 P1 Plan.md` (spaces forced URL-encoding and brief/file mismatch); renamed space-free and symmetrically in both repos to match the briefs and avoid CLI/agent path friction. | Spaces in a referenced doc path are recurring agent/CLI friction; aligning the name removes a class of "file not found" misses. |
| 2026-10-29 | Start (P1) | **MSW 3 renamed `onUnhandledRequest` → `onUnhandledFrame`.** Verified against the official MSW v3.0.0 release notes + the 2.x→3.x migration guide (not `node_modules` archaeology): the option now covers any unhandled network frame (HTTP + WebSocket); **the old name is silently ignored and defaults to `"warn"`**, so `onUnhandledFrame: "error"` is required to fail loud. A clean `tsc --noEmit` with zero casts is the proof the name is right. Escape is additionally guaranteed **type-independently** by a trailing `http.all("/api/*", () => HttpResponse.error())` catch-all, proven by an e2e probe asserting an unregistered `/api/…` request is blocked. _Process note:_ an earlier review wrongly dismissed the rename as a confabulation, reasoning from pre-MSW-3 knowledge; the correction came from the vendor's release notes. **Standing lesson for P2+: for any library that shipped after the Jan-2026 cutoff, release notes are the arbiter — not prior knowledge, not `node_modules` reads.** | DoD #1 ("no `/api/*` escape") must actually be enforced, not nominally set; the rename made a nominal set silently fall back to `warn`. |
| 2026-10-29 | Start (P1) | **TanStack Start `defaultSsr: false` via `createStart`.** Start defaults `defaultSsr: true`, executing `beforeLoad` on the server during initial SSR — before `localStorage` or the MSW worker exist. Set `createStart(() => ({ defaultSsr: false }))` in `src/start.ts`; the option is **omitted from the public `RouterConstructorOptions` type** in `@tanstack/react-start@1.169.3`, so it was found by reading dist. No RSC / server-action pull for the gated data. | SPA-first (§5) requires client-side `beforeLoad`; the SSR-first default would run the guard where the session fixtures don't exist. |
| 2026-10-29 | Start (P1) | **TanStack Devtools `/__tsd/*` passthrough (Start-only).** `@tanstack/devtools-vite` pipes browser console output to `POST /__tsd/console-pipe`; under `onUnhandledFrame: "error"` an unhandled `/__tsd/*` triggers `console.error`, which Devtools re-POSTs in a loop. Added `passthrough()` for `/__tsd/*` in `src/mocks/browser.ts`. Expected asymmetry vs Next (which has no such devtools pipe). | A console-pipe loop would spam errors and mask real ones; the passthrough is dev-tooling noise, not app traffic. |
| 2026-10-30 | Next (preflight) | **Config-parity sweep before the Next build** — four symmetry defects caught, each a would-be confound: (a) node pin drift (see 23 Oct ratify); (b) `@tanstack/react-query` 5.104.5 / `zustand` 5.0.16 / `vitest` 5.0.5 had been `pnpm add`'d ad-hoc in Start — pinned **exact** (no caret) and identical in both; (c) Biome `$schema` said 2.2.4 while the binary resolves **2.4.5** — aligned the schema and pinned the binary identically in both; (d) Tailwind-entry ignore swapped `!**/src/styles.css` → `!**/src/app/globals.css` (**intentional per-stack path delta**, same intent: don't lint the Tailwind entry). | Unpinned deps / mismatched linter config are exactly the silent confounds the fair-fight pins exist to kill; catch them before the build, not in the numbers. |
| 2026-10-30 | Next (preflight) | **The `lint` gate command itself differed between siblings.** Start's `"lint": "biome lint"` (lint rules only); Next's `"lint": "biome check"` (lint **+ format + organizeImports**, the superset). Byte-identical `src/shared` files therefore "passed" Start's lint but "failed" Next's — **not a code difference, a gate-command difference** (the whole multi-round Next-lint chase traced to this one line). Aligned Next to `biome lint`. **Parked for the gate:** neither repo's `lint` now enforces format/import-order; decide for both together whether CI should also run `biome check`. | The gate command must be identical across siblings, or the two repos are held to different bars — the subtlest fair-fight break yet. |
| 2026-10-30 | Next (P1) | **MSW `"node": null` export forces a client-only dynamic import (server-ward pull #1, resisted).** Next 16 / Turbopack compiles `"use client"` components in a `[Client Component SSR]` pass using the `"node"` export condition; `msw@3.0.3` sets `exports["./browser"].node = null`, so a static `import` of `browser.ts` fails compilation (`Module not found: Can't resolve 'msw/browser' [Client Component SSR]`). Resolved with dynamic `import("./browser")` inside `MswProvider`'s `useEffect`, keeping the worker strictly browser-only. No equivalent in Start (Vite client entry awaits `worker.start()` directly). | The mock must stay client-side (SPA-first); Next's SSR compile pass fought a static import, and the dynamic import is the client-only escape hatch. |
| 2026-10-30 | Next (P1) | **RSC flight requests on every navigation (server-ward pull #2, resisted — the headline P1 finding).** Even with 100% client-side TanStack Query and a `"use client"` layout guard, the App Router's `router.replace()` / `<Link>` issue `GET <route>?_rsc=…` over HTTP on every client transition. Route pathnames have no file extension, so MSW's `isCommonAssetRequest` doesn't exempt them and `onUnhandledFrame: "error"` rejects the navigation (500) unless `passthrough()` rules for `/_next/*`, `/`, `/login`, `/collaborations/*` follow the `/api/*` catch-all. Start's router is in-memory — nothing touches the network on a tab change, and it **cannot be turned off** in Next. **Ordering invariant pinned in code:** the `/api/*` error catch-all stays ordered **before** the route passthroughs, so DoD #1 still holds — no `/api/*` escapes; only route RSC fetches reach Next's own dev server. _Counter-framing on the record:_ a Next advocate would call these fetches normal/cheap, awkward only because the slice is SPA-first + fully mocked. Finding stands as a DX/architecture data point, not a verdict; real stress test is P2. | Clearest evidence of App Router server-coupling at the routing layer; the exact thing the slice is instrumented to detect. Recorded with both framings so the gate reads it fairly. |
| 2026-10-30 | Next (P1) | **Worker-readiness bootstrap contrast (functionally equal, more ceremony on Next).** Start awaits `worker.start()` before `hydrateRoot`, so no `/api/*` call can precede the worker. Next starts the worker in a `useEffect` (runs after first render), so `MswProvider` gates children behind a ready-flag: `useState(() => process.env.NODE_ENV === "production")` → `true` in prod (zero render delay), `false` in dev (renders an `msw-booting` fallback until `start()` resolves). `QueryClientProvider` sits inside `MswProvider`, so no `useSession()` query mounts before the worker is live — race closed. | Next's `useEffect`-based bootstrap can't await before render like Start's client entry; the ready-gate is the equivalent guarantee, verified before merge to avoid P2 first-call-vs-worker flakes. |
| 2026-10-30 | shared (P2) | **Shared flows layer authored (Table v9 + Virtual).** `src/shared/src/flows/` added at `09c79ee`: `FlowsSearchSchema` (+ `parseFlowsSearch`/`resolveFlowsSearch`/`serializeFlowsSearch`/`buildFlowsApiPath`, accepting plain objects **and** `URLSearchParams`/`ReadonlyURLSearchParams` so both routers feed it identically; `FLOWS_SEARCH_DEBOUNCE_MS = 250`, union-filter vocab constants), `useFlows` (six-param `flowsQueryKey`, `placeholderData: keepPreviousData`, `prefetchAdjacentFlowsPages` for page±1, stable `EMPTY_FLOW_ROWS` fallback), and `FlowsTable` (native v9 `useTable`, `createColumnHelper<features, IntegrationFlow>`, `<table.FlexRender/>`, `useVirtualizer` at row-height 44 / overscan 5 / viewport 480). Exact pins `@tanstack/react-table` 9.3.1 + `@tanstack/react-virtual` 3.14.24 (no-caret, both siblings). `handlers.ts` untouched. Gate green (lint/typecheck/test, 9/9). | P2 Step 1 — build the shared instrument once; identical in both so the only measured difference stays the framework. v9 native API throughout (no `stockFeatures`/`legacy`), manual mode so sort/filter/paginate stay server-side. |
| 2026-10-30 | shared (P2) | **Scope correction: dropped `rowSelectionFeature` + deferred `selectionStore` (supersedes `09c79ee` → `c7b9e4e`).** Review caught selection double-booked (registered as a v9 feature **and** held in a Zustand store) and, more importantly, **not a P2 deliverable** — no selection/bulk item is in the P2 DoD or the §9 checklist. An unused table feature inflates the absolute "initial JS gzipped" §10 number and undercuts the v9 tree-shaking story that metric exists to tell (the same reason `stockFeatures` is banned). Removed the feature + all `rowSelection` wiring from `FlowsTable`, deleted `selectionStore.ts` (recoverable from `09c79ee` when a bulk-action UI is specced), pruned the barrel exports. `zustand` no longer imported from `src/flows/`. Gate re-green. | Declare only the features the table uses (§ P2 rulings / `stockFeatures` ban); keep the bundle metric honest and §5 unambiguous (one source of truth for any state). Selection returns with its UI, not before. |
| 2026-11-02 | shared (P2) | **Shared package declared no dependencies — empty `peerDependencies: {}`; added the peer contract (supersedes `c7b9e4e` → `7cb25ac`).** P1's shared code (mock/seed/schemas) imports no React, so an empty manifest went unnoticed; P2's `FlowsTable`/`useFlows` import React, React-Table, React-Virtual and Query with **nothing declaring them** — so each sibling resolved its own React copy and silently drifted (see next row). Fix: declared `react` 19.3.0, `react-dom` 19.3.0, `@tanstack/react-query` 5.104.5, `@tanstack/react-table` 9.3.1, `@tanstack/react-virtual` 3.14.24, `zustand` 5.0.16, `zod` 4.6.7, `msw` 3.0.3 as **`peerDependencies`** (not `dependencies` — deps would pull a second copy; peers force a single resolved copy from the consumer). _Authoring hiccups, recorded: the edit first landed in a separate clone (not the submodule), then a push was rejected "fetch first" (remote had moved) → `pull --rebase`, then an interim commit `97f85bf` shipped invalid JSON (missing comma) before `7cb25ac` fixed it. Net: one good peers commit; three dead SHAs._ | A submodule compiled in-tree must declare its externals as peers or consumers drift — exactly what happened. The peer block is the durable structural guard; app pins alone would patch the symptom and leave the next dep free to drift. |
| 2026-11-02 | both (P2) | **React aligned to 19.3.0 exact across siblings.** Fallout of the empty-peers manifest: Start had resolved `react`/`react-dom`/`@types/react` **19.2.0**, Next **19.3.0** — a fair-fight break on the one dependency that must be most identical in a React-vs-React bake-off (touches bundle size, render/hydration timing, warnings → every P2 §10 number). Ratified **up** to 19.3.0 (Next already there; same stance as the node 24.22.1 ratify), pinned **exact/no-caret** in both apps' `package.json` (`react`, `react-dom`, `@types/react`, `@types/react-dom`), lockfiles re-resolved to a single `react@19.3.0` each. Enforced going forward by the peer block above. | React is the common denominator the whole comparison rests on; an unpinned patch skew would contaminate every Start-vs-Next number with "…and also different React." |