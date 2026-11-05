# P1 Kickoff — `catalogue-slice-tanstack-start`

_Build sub-phase **P1** of the Phase 1 bake-off: **scaffold shell → routing shell + MSW wired + session/auth guard**. This is the task brief handed to the coding agent to open the build. It does **not** restate the spec — it scopes P1, names the starting commands, and points at the authority._

**Repo:** `catalogue-slice-tanstack-start` (React + **TanStack Start**, Vite 8, dev port **5173**)
**Authority (read first, in order):** `AGENTS.md` (always-on contract) · `docs/phase1-slice-spec.md` (the instrument) · `claude/EVIDENCE.md` §0 (pre-flight, closed) · `claude/locked-decisions.md` (the memory).
**Sibling:** `catalogue-slice-next` — builds the identical screen. Never edit it from here; never edit the shared submodule's pinned contract to make P1 easier.

---

## 0. Where this sits (don't skip a dependency)

Phase 1 is the **stack** gate — the bottom of the dependency stack. P1 is its first build sub-phase. Two things P1 must **not** do, because they belong to later phases that this gate is explicitly not allowed to pre-empt:

- **No component-architecture work.** The headless-core + ports/adapters model is **Phase 2**. In P1 the `Table` / `Graph` / `Form` code is **consumed as-is** from the shared submodule (`@shared/*`) — not redesigned, not abstracted, not "improved."
- **No pipeline work.** Token pipeline and the design→code AI flow are **Phase 3**. Nothing in P1.

If the spec feels ambiguous, **stop and ask** (AGENTS §1.2) — do not invent scope.

---

## 1. Preconditions — verify before writing any P1 code

Per `EVIDENCE.md`, Steps 0–2 are **closed**: both repos are scaffolded (bare shell, no demo pages), the shared layer is pinned, and the toolchain is pinned. Confirm that's actually true in this clone before building on it:

```bash
# Shared submodule present and at the SAME SHA as the sibling (fair-fight gate)
git submodule update --init --recursive
git -C src/shared rev-parse HEAD        # must equal the sibling's src/shared HEAD

# Toolchain is the pinned pair, resolved via mise (node 24.7.0 / pnpm 12.14.0)
mise install && mise reshim
mise exec -- node -v && mise exec -- pnpm -v

# Shared contract resolves through the @shared/* alias (tsconfig paths, Vite 8 native)
mise run typecheck                      # clean against zod/msw/TS pins
```

If the `src/shared` SHA does **not** match the sibling, stop — the comparison is void until it does. If submodule mechanics fight the container loop more than ~twice, that's the documented signal to invoke the `sync-shared.sh` fallback (record it in `EVIDENCE.md` §0.2 with date + reason).

**Do not re-cut the shared files.** `handlers.ts`, `seed.ts`, `rng.ts`, `schemas.ts` are confirmed and pinned (EVIDENCE §0.5). The four baked-in readings (sixth endpoint = `/consumers`; silent refresh via re-hitting `/api/session`; `status` filter = union over `flow.status`/`flow.health`; counts tied to actual 3000/37) are the contract. Consume them; don't relitigate them here.

---

## 2. P1 scope — in / out

**In P1 (build this):**

| # | Deliverable | Exercises |
|---|---|---|
| 1 | **Routing shell** — `/collaborations/:id` with all five routes resolving: `overview` (default), `flows`, `lineage`, `consumers`, and the routed `edit` drawer over the active tab. Tab bodies may be **placeholders** except where noted below. | nested deep-linkable routing; back/forward correctness |
| 2 | **MSW wired** into the dev runtime so every `@shared/mocks/handlers` endpoint intercepts; app boots against the mock with jittered latency. | the whole slice runs with no real backend |
| 3 | **Session fetch** — `GET /api/session` on load via TanStack Query; user + roles in context. | server-state via Query; the auth source of truth |
| 4 | **Client-side route guard** — unauthenticated load → redirect `/login?return=<path>`; after "login," the deep link is restored intact. | SPA-first guard; return-path integrity |
| 5 | **Role capability at render** — header **Edit** button gated to `CATALOGUE_EDITOR`+; a viewer sees it **disabled with a reason** (render-time capability check). | render-time auth check (not just route gating) |
| 6 | **Token-expiry behavior** — expired fixture → one silent-refresh attempt (re-hit `/api/session`) → on repeat 401, redirect to login **preserving return path**, **no white screen**. | the "never white-screen on expiry" contract |
| 7 | **Loading / empty / error states** for the P1 fetches (session, collaboration) — no spinner-forever, no raw crash. | the error-state discipline, established early |
| 8 | **Overview tab** rendered for real (metadata + KPI tiles from the collaboration fetch) — the cheapest real tab, proves the fetch→render path end-to-end. | derived/server state; loading & empty states |

**Explicitly out of P1 (later sub-phases — leave the seams, don't build the bodies):**

- **P2** — Flows tab: the virtualized table, URL-synced server sort/filter/paginate, row-hover prefetch. In P1 the `/flows` route exists and accepts the `sort/dir/status/q/page/size` search params (typed/validated — see §3), but the table body is a placeholder.
- **P3** — Lineage graph + the Consumers list body.
- **P4** — Edit drawer form internals: dirty-tracking, optimistic save + rollback, `problem+json` → field mapping. In P1 the `/edit` **route/drawer opens** over the active tab; the form inside is a placeholder.

---

## 3. Per-stack delta — the only things allowed to differ (P1 rows)

Everything outside this table stays byte-identical to the sibling. These are the §11 / EVIDENCE §0.4 rows that bite in P1:

| Concern | This repo (TanStack Start) |
|---|---|
| Routing | File-based **TanStack Router**; the `/flows` route declares its `search` params (`sort/dir/status/q/page/size`) **typed + validated** per route — this is the router ergonomics under test, wire it now even though the table body is P2 |
| Auth guard | Client guard in route **`beforeLoad`** (redirect to `/login?return=` before the route resolves) |
| Data loading | **TanStack Query**; may be fed by Start **route loaders / prefetch** in `beforeLoad`/`loader` — allowed, record how it felt |
| Build / bundler | **Vite 8** |
| Dev port + bind | **5173**; bind all interfaces via Vite `--host` / `server.host` |
| Tailwind wiring | v4 via `@tailwindcss/vite` (build-wiring delta; `@theme` tokens identical to sibling) |

If the stack ever pushes you toward **server components / server actions** to do the gated session/guard work, **do not cave** — implement it client-side and **record the friction as a finding** in `EVIDENCE.md`. That friction is itself a result (spec §5, AGENTS §7).

---

## 4. Known traps already logged — don't rediscover them

These cost real debug time and are in the `EVIDENCE.md` deviations log. Apply them from the first run:

- **Ports under the `devcontainer` CLI:** `forwardPorts` is VS Code-only. The CLI (the Antigravity path) needs the port published via `runArgs` → `["-p","5173:5173"]`. Without it the dev server is unreachable from the host.
- **Reach the server at `http://127.0.0.1:5173`, not `localhost`** — macOS resolves `localhost` to IPv6 first; Docker `-p` publishes IPv4 only → `localhost` gives `ERR_CONNECTION_REFUSED` while `127.0.0.1` works.
- **Dev port is 5173, not 3000.** `@tanstack/cli` scaffolds on 3000 (collides with Next); it's repinned to 5173 in the `dev` script.
- **Submodule recursion:** after any plain `git pull`, run `git submodule update --init --recursive` or `src/shared` goes stale/empty. The container post-create step does this — don't assume, verify.
- **Playwright is an installed dep** (`@playwright/test`), not just an `e2e` script — the acceptance suite needs it. (Acceptance e2e runs land with the later sub-phases, but the dep must already be present.)

---

## 5. Definition of done for P1 (the acceptance **subset** P1 owns)

P1 is done when every one of these is true on **this** machine, against the shared mock — the rest of the §9 checklist stays unticked until its sub-phase lands:

- [ ] All five routes resolve and are **deep-linkable** (`overview`/`flows`/`lineage`/`consumers` + `edit` drawer over the active tab); back/forward is correct; no full reload between tabs.
- [ ] `/flows` **accepts and round-trips** `sort/dir/status/q/page/size` as typed/validated search params (table body still a placeholder — state plumbing is what's proven here).
- [ ] App boots entirely against **MSW**; every endpoint intercepts with jittered latency.
- [ ] **Unauthenticated** load → redirect `/login?return=<path>`; after login the original deep link is restored.
- [ ] **Viewer** role: Edit button disabled **with a reason** (render-time capability check), not merely hidden.
- [ ] **Expired** fixture: silent refresh → repeat 401 → redirect preserving return path, **no white screen**.
- [ ] **Overview** tab renders real metadata + KPI tiles from the collaboration fetch, with loading/empty/error states.
- [ ] `mise run lint && mise run typecheck && mise run test` all green before declaring P1 done.

**State placement is law (spec §3).** Server data → Query; active tab + search params + drawer-open → URL/router; nothing server-shaped smeared into local state. A P1 that parks table/tab state in component state has failed P1 regardless of how it looks.

---

## 6. Capture as you go + the checkpoint

Write to `docs/EVIDENCE.md` **while building P1**, not after (implementation guide Step 4). The P1-relevant cells:

- **Numbers:** cold dev-server start, prod build time, initial gzipped JS for `/collaborations/:id`, route-change latency (tab→tab, warm cache). (HMR-on-the-table, table-interaction, graph-render numbers come with P2/P3.) Stopwatch runs **only on the M4 Max** (EVIDENCE §0.3), same engineer each time.
- **DX narrative:** scaffold→first-screen time; routing ergonomics (typed `search` params / URL-as-state); auth wiring friction in `beforeLoad`; whether anything pushed you toward RSC/server actions for the gated data.

**Stop at the end of P1 and present a diff/plan for human review** (AGENTS §1.3, §12). Do not run P1→P4 unattended. P2 (Flows table) does not start until the P1 checkpoint is signed off.

---

## 7. First commands

```bash
# From a fresh clone of catalogue-slice-tanstack-start
git submodule update --init --recursive
git -C src/shared rev-parse HEAD                      # confirm == sibling

devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . mise install
devcontainer exec --workspace-folder . mise run typecheck    # shared layer resolves clean
devcontainer exec --workspace-folder . mise run dev          # serves on 5173

# open http://127.0.0.1:5173   (NOT localhost)
```

Then build §2 items 1–8 in that order, honoring §3 (deltas), §4 (traps) and §5 (done). Ask before guessing.
