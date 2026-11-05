# Phase 1 · P1 Build Plan — routing shell + MSW + auth guard

_The first of the four `AGENTS.md` §12 build phases. Scope is deliberately narrow: **stand up the skeleton that every later phase hangs off, and nothing more.** No table, no graph, no edit form — those are P2–P4. This doc is the reviewable checkpoint: read it, approve or redline, then it becomes the agent's P1 brief in both repos._

**Status:** ☑ APPROVED as written — PierreJ, 23 Oct 2026. This is now the agent's P1 brief in both repos; no redlines. **References:** `phase1-slice-spec.md` (instrument) · `phase1-implementation-guide.md` Step 3 · `AGENTS.md` §12 · `EVIDENCE.md` (anchor `1462f92`).
**Repos:** `catalogue-slice-tanstack-start` (:5173) · `catalogue-slice-next` (:3000). **Shared SHA both pin:** `1462f92`.

---

## P1 definition of done

A build has finished P1 when, in **both** repos:

1. The app boots, MSW intercepts every `/api/*` call from the §4 contract, and **no request escapes to the network** (`onUnhandledRequest: "error"`).
2. `/collaborations/col_8f3` renders a **routing shell** — header placeholder + four empty tab outlets (`overview` default, `flows`, `lineage`, `consumers`) + a routed `edit` drawer outlet — all four tabs and the drawer are **real, deep-linkable URLs** with correct back/forward.
3. A **client-side auth guard** runs before the protected routes: no/!valid session → redirect to `/login?redirect=<full path>`; after a dev "login", the deep link is restored intact.
4. The three session fixtures work via a **dev role-switcher**: viewer / editor / expired resolve to the right `GET /api/session` outcome; the expired token drives the silent-refresh-then-redirect path (no white screen).
5. `mise run lint && mise run typecheck && mise run test` is green. One smoke e2e (deep-link cold-load + guard redirect) passes.

**Explicitly NOT in P1** (guard against scope creep — these are later phases): virtualized table, server sort/filter/paginate, React Flow graph, KPI tiles with real derived data, the edit form + optimistic save + `problem+json` field mapping. P1 renders the *shells* of these; they stay empty or static-stub.

---

## Shared-first ordering (do this once, consume in both)

Per the fair-fight rule, anything identical across repos is built/verified **once** and imported via `@shared/*`. For P1 that means the pieces below are consumed, not re-authored — they already live in the shared SHA `1462f92`:

- `@shared/mocks/handlers` — the six §4 endpoints (already verified, 24/24 checks green).
- `@shared/seed` — `DEV_TOKENS` (viewer/editor/admin/expired) + `CANONICAL_COLLABORATION_ID` (`col_8f3`).
- `@shared/schemas` — `Session`, `Role`, `Collaboration` types for typing the guard/context.

The only P1 code that is **allowed to differ** between repos is the §11 stack-profile delta: routing + auth-guard wiring. Everything else (the MSW browser bootstrap module, the role-switcher UI, the login stub) should be written to be as near-identical as the frameworks allow.

---

## Build order (same five steps, both repos)

### Step 1 — MSW browser bootstrap
- `npx msw init public/ --save` to emit `mockServiceWorker.js` into the served static dir (`public/` in both — Next serves it natively; Vite serves `public/` at root).
- Add `src/mocks/browser.ts`: `setupWorker(...handlers)` importing `handlers` from `@shared/mocks/handlers`.
- Start the worker **before the app mounts**, dev-only, awaited, with `onUnhandledRequest: "error"` so any un-mocked `/api/*` call fails loud (that's the "no request escapes" DoD). Gate behind `import.meta.env.DEV` (Start) / `process.env.NODE_ENV !== "production"` (Next).
  - **Start:** await `worker.start()` in the client entry before `RouterProvider` renders.
  - **Next:** worker start belongs in a client boundary that runs before data fetching — a top-level client component that blocks render until `start()` resolves. This is the first spot Next's client/server split creates friction vs Start; **if it pushes toward an RSC/server-side mock, that's a finding — record it, keep the mock client-side** (§5 locked: SPA-first).
- **Capture:** first DX note — how cleanly the mock bootstrapped on each stack.

### Step 2 — Auth plumbing (session query + context)
- A `useSession()` built on **TanStack Query** hitting `GET /api/session` (server state lives in Query, per the state-placement law — *not* in a store or context).
- A dev **token source**: the bearer token the mock reads. Hold the *selected* dev token in a tiny client holder (localStorage + a Zustand slice is fine — this is dev-only app state, not the session itself) so the role-switcher can flip viewer/editor/expired and every subsequent `/api/*` call carries it. The resolved *session* always comes from the Query cache, never the store.
- Wire an `Authorization: Bearer <token>` default onto the fetch/axios client all `@shared` calls use.

### Step 3 — Routing shell + guard (THE allowed delta)

**TanStack Start:**
- File-based routes: `routes/collaborations/$id.tsx` (layout w/ header + tab nav + `<Outlet/>`), child routes `overview` (index), `flows`, `lineage`, `consumers`, and `edit` as a routed drawer over the active tab.
- Guard in the `$id` route (or a `_authed` layout route) `beforeLoad`: read `context.auth`; if unauthenticated `throw redirect({ to: "/login", search: { redirect: location.href } })`. Type the context via `createRootRouteWithContext<{ auth: AuthState }>()`; supply `auth` at render through `<RouterProvider context={{ auth }} />`. Wrap the check so `isRedirect(err)` rethrows cleanly.
- `search` params for the future table state are **declared + validated** on the `flows` route now (empty-but-typed), so P2 only fills them in.

**Next.js:**
- App Router segments: `app/collaborations/[id]/layout.tsx` (header + tab nav), `.../overview/page.tsx` (+ redirect the index to it), `flows`, `lineage`, `consumers`, and `edit` via a parallel/intercepting route or a drawer driven by the segment — pick the lightest routed-drawer that keeps `/edit` a real URL.
- Guard **client-side** in the layout (a client component that reads `useSession()` and `router.replace("/login?redirect="+encodeURIComponent(pathname+search))` when unauthed). **Do not** reach for `proxy.ts` (Next 16's renamed middleware) for the auth gate — SPA-first is locked, and a server-edge guard is exactly the RSC-ward pull the slice is watching for. If you *try* proxy.ts and back out, **that's a recordable finding**, not a detour.
- Table-state search params: plan the `useSearchParams` read now; leave empty for P2.

> This step is the whole point of P1 as an evidence instrument: the guard + URL-as-state ergonomics are the first real DX signal. Capture both engineers' first reaction to each.

### Step 4 — Login stub + role-switcher
- `/login` route in both: reads `?redirect=`, shows three dev buttons (viewer / editor / expired), sets the selected token, then restores the deep link — Start via `router.history.push(search.redirect)`; Next via `router.replace(redirect)`. This is a **dev harness, not a real login** — no credentials, no real IdP.
- **Expired path:** selecting "expired" sets `DEV_TOKENS.expired`; `GET /api/session` 401s; the client makes its one silent-refresh attempt (re-hits `/api/session` per confirmed decision #2), 401s again, redirects to `/login?redirect=` preserving the path — **asserting no white-screen** (that's the §9 token-expiry box, stubbed at P1, fully exercised by P4).

---

## Step 5 — Gate P1 green
- `mise run lint && mise run typecheck && mise run test` clean.
- One Playwright smoke: cold-load `/collaborations/col_8f3/consumers` while unauthed → lands on `/login?redirect=…/consumers` → pick editor → returns to `…/consumers`. (Consumers tab chosen as smoke target: it's the cheapest shell, so the test asserts routing+guard, not feature code.)
- Write the P1 DX notes into `docs/EVIDENCE.md` in each repo (scaffold→first-screen, auth-wiring friction, any RSC pull). Fold into canonical `claude/EVIDENCE.md` at the checkpoint.

---

## Checkpoint protocol (per AGENTS.md §1.3 / §12)

Run P1 in both repos, then **stop** and present for review before P2:
1. The route tree + guard diff for each repo (the allowed delta, side by side).
2. The shared MSW bootstrap diff (should be near-identical — flag any divergence).
3. The P1 DX notes delta already written to each `EVIDENCE.md`.
4. Any deviation/finding (especially: did Next pull toward server-side for the mock or the guard?) logged in the EVIDENCE deviations table.

No unattended run through to P2. The human checkpoint is the review of items 1–4.

---

## Risks / watch-items specific to P1

- **MSW service-worker path.** `mockServiceWorker.js` must be served at the app root on both. If a 404 on the worker script appears, it's a static-dir/base-path issue, not app code — same class as the `127.0.0.1`-not-`localhost` deviation already logged.
- **Next client-boundary for the mock.** The highest-probability place Next forces an asymmetry. Keep it client-side; record the friction rather than solving it with RSC.
- **`resolve.tsconfigPaths` perf asterisk (EVIDENCE §0.4).** P1 is the first cold-dev-start capture. If Start's number looks off, this is the suspect before any framework conclusion.
- **Guard ≠ authz.** The TanStack guide is explicit: a route guard is not a data-authorization boundary. The mock still 403s a forged `PUT` server-side (§7) — P1 only wires the *client* gate; don't let the guard's presence imply the `PUT` protection is done (that's P4).