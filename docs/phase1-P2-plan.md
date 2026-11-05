# Phase 1 · P2 Build Plan — Flows tab: virtualized table + URL-driven server sort/filter/paginate

_The second of the four `AGENTS.md` §12 build phases. P1 built the skeleton; **P2 hangs the first real feature off it and turns every table interaction into a URL navigation** — which is where Next's RSC-on-navigation finding (logged in P1) stops being an observation and becomes a measured number against Start's in-memory router. Scope is the Flows tab and nothing else: no lineage graph, no edit form (P3/P4). This doc is the reviewable checkpoint: read it, approve or redline, then it becomes the agent's P2 brief in both repos._

**Status:** ☑ **APPROVED as written — PierreJ, 30 Oct 2026.** This is now the agent's P2 brief in both repos; no redlines. Both open items decided (see **§ Rulings locked**): Table **v9**, pagination seam **reading A**. **References:** `phase1-slice-spec.md` §2–§4, §7 (instrument) · `phase1-implementation-guide.md` Step 3 (P2) · `AGENTS.md` §5, §9, §11, §12 · `EVIDENCE.md` (P1 findings + anchor; P2 row now in progress) · `phase1-P1-plan.md` (the sibling checkpoint doc this mirrors).
**Repos:** `catalogue-slice-tanstack-start` (:5173) · `catalogue-slice-next` (:3000). **Shared SHA at P1 close:** `1462f92` — **P2 advances it** (new shared Table/query/schema + two new dep pins); both siblings re-pin to the identical new SHA.

---

## Why P2 is the real test (not a repeat of P1)

P1's headline finding, on the record from both sides (`EVIDENCE.md`, Next deviations, 30 Oct): even with 100% client-side Query and a `"use client"` guard, the App Router issues `GET <route>?_rsc=…` over HTTP on **every** `<Link>` / `router.replace()` navigation, and it **cannot be turned off**; Start's router is in-memory, so a tab change touches no network. P1 saw this on *tab* changes — a handful of navigations. The state-placement law (§5) puts `sort/dir/status/q/page/size` **in the URL**, so in P2 **every sort click, every filter toggle, every page step, every keystroke-debounced search is a navigation.** The finding that cost a few flight requests in P1 now fires on the hot path of the feature. **That is the measurement P2 exists to take** — captured with P1's counter-framing already in hand ("normal/cheap, awkward only because the slice is SPA-first + fully mocked"), so the gate reads it fairly rather than as a verdict.

---

## Rulings locked (PierreJ, 30 Oct 2026)

Both items the draft flagged are now decided; recorded here so the brief is self-contained:

1. **TanStack Table major → v9.** `@tanstack/react-table` v9 (stable 4 Aug 2026), pinned exact and identical in both repos. v9 is post-cutoff, so **its release notes + "Migrating to V9" guide are the arbiter** (standing P2+ lesson, EVIDENCE 29 Oct). Greenfield slice → **native v9 API only; do not use the deprecated `useLegacyTable` / `@tanstack/react-table/legacy` shim** (it defeats v9's tree-shaking, which the §10 "initial JS gzipped" number measures, and leans on a deprecated path). Concrete v9 deltas the agent must build to — verified against the v9 React migration guide:
   - **Hook is `useTable`, not `useReactTable`** (renamed for cross-library consistency).
   - **Features are explicit.** v9 is tree-shakable: declare only what this table uses via `tableFeatures({ … })`; **do not import `stockFeatures`** (that re-bundles everything v8-style and makes the bundle metric meaningless). Row-model factories now live on the `features` object, not separate `getCoreRowModel`/`getSortedRowModel` options.
   - **Server-driven = manual mode.** Because the mock does all sort/filter/paginate, the table runs manual — mirror the URL's state into table state and register **no** client-side sorted/filtered/paginated row models. The server returns rows already ordered/filtered/paged; the table only renders + reflects. This also keeps the feature set (and bundle) minimal.
   - **State rebuilt on TanStack Store (atom-per-slice), React-Compiler-compatible.** Default subscription is to all registered state; fine here. If the table-interaction re-render number looks off, narrower selectors are the lever — note it, don't pre-optimize.
   - **Table v9 + TanStack Virtual is a documented pairing** (TanStack's own pagination guide frames virtualization as the alternative/companion); verify the integration against the v9 example, not a v8 one.
2. **Pagination↔virtualization seam → reading A.** Server pagination stays authoritative: `page`/`size` in the URL, the §9 gate deep-link's `page=3` stays literal. The table requests a **large page** for the scroll stress (`size` up to the mock's 500 cap) and **TanStack Virtual windows the DOM rows**, so even a big page mounts only a handful of nodes. "Scrolls 3,000 rows at 60 fps" is proven by virtualization within a page + walking pages with `keepPreviousData` (no flash); nothing is ever client-sliced. (Reading B — windowed infinite-scroll that reinterprets `page=3` — is dropped.)

_Secondary reading confirmed:_ "row hover prefetches" names no per-row endpoint (§4 has no `/flows/:flowId`), so it's built as **adjacent-page prefetch on hover/scroll-intent** — the only endpoint-backed prefetch here.

---

## P2 definition of done

A build has finished P2 when, in **both** repos, the Flows tab is real and every box below is true:

1. **Server-driven, not client-sliced.** Sort / filter / search / paginate all go through the shared mock's `processFlows` (`GET /api/collaborations/:id/flows?sort=&dir=&status=&q=&page=&size=` → Spring `Page`). The browser never slices, sorts, or filters the row set itself. (The mock already does all of this and is **frozen at the shared SHA — do not touch `handlers.ts`.**)
2. **Table state lives in the URL.** All six params are URL-owned; the table reads its state *from* the URL and writes changes *to* the URL. Deep-link `…/flows?sort=avgLatencyMs&dir=desc&status=degraded&page=3` loads that exact state **cold** (the §9 gate deep-link; `status=degraded` resolves via the mock's union filter, decision #3).
3. **Virtualized (reading A).** The loaded page's rows scroll at ~60 fps with only a window of DOM rows mounted (TanStack Virtual), so the dataset doesn't melt the DOM.
4. **No full reload, history-correct.** Tab↔tab and all table-state changes happen with no document reload; browser back/forward restores exact prior table state.
5. **Prefetch earns its keep.** Adjacent-page prefetch on intent + `placeholderData: keepPreviousData`, so paging/sorting doesn't flash empty against the mock's 150–400 ms jitter.
6. **States + a11y.** Flows fetch has explicit loading (skeleton, not an infinite spinner), empty (filter → zero rows), and error states. Table is fully keyboard-operable with visible focus throughout (the free a11y bar).
7. **Gate green.** `mise run lint && mise run typecheck && mise run test` clean in both; the P2 Playwright e2e (below) passes.
8. **Evidence written as you go** to `docs/EVIDENCE.md` in each repo — numbers (M4 Max only) + DX notes + the RSC-on-navigation measurement — folded into canonical `claude/EVIDENCE.md` at the checkpoint.

**Explicitly NOT in P2** (scope fence — later phases): the lineage graph and its node→route nav (P3); Overview KPI tiles with real derived data and the Consumers list (P3); the edit drawer, optimistic save + rollback, and `problem+json` → field mapping (P4); the forged-`PUT` 403 and the full token-expiry exercise (P4; P1 proved the stub). P2 renders only the Flows tab for real.

**§9 acceptance boxes P2 closes** (the table-relevant subset): deep-link cold-load · 3,000-row 60 fps server-driven · hover-prefetch + back/forward restore + no reload · empty/error states for the flows fetch · keyboard + focus for the table. The graph/drawer/role/expiry boxes stay open for P3–P4.

---

## Shared-first ordering (build once in `@shared`, consume in both)

Per the fair-fight rule (§1), everything identical across repos is authored **once** in `catalogue-slice-shared`, the SHA is bumped, and **both** siblings re-pin to it (verify `git -C src/shared rev-parse HEAD` matches — mismatched submodule SHAs silently break the fair fight, per EVIDENCE §0.2). P2's shared additions:

- **`FlowsSearchSchema`** (`@shared/schemas` or `@shared/flows`) — Zod shape + defaults + a `parseFlowsSearch(input) → FlowsSearch` helper for the six params (`sort ∈ FLOW_SORT_FIELDS`, `dir ∈ asc|desc`, `status`, `q`, `page ≥ 0`, `size`). Both stacks parse identically; only *how the URL is fed in* differs (§11 delta). `FLOW_SORT_FIELDS` already lives in `schemas.ts` — reuse it, don't redefine.
- **`useFlows(collabId, params)`** — the TanStack Query hook: queryKey carries all six params; `placeholderData: keepPreviousData`; an `ensure/prefetch` helper for the adjacent page. Server state in Query, per the law.
- **`FlowsTable`** — TanStack **Table v9** (`useTable`, explicit `tableFeatures`, manual mode) column defs for `IntegrationFlow` + TanStack Virtual row windowing + sortable headers + the status/search controls. **Server-driven by contract:** it receives `{ rows, totalElements, params }` and emits `onParamsChange`; it holds **no** sort/filter/page state of its own. (A `FlowsTable` that sorts or slices internally has failed §5 regardless of looks.)
- **Two new dep pins** (the P2 fair-fight gate) — **exact, no caret, identical in both**, joining the existing exact-pin set (`react-query` 5.104.5, `zustand` 5.0.16, `vitest` 5.0.5, `zod`/`msw`/`typescript`/`biome`/`@playwright/test`):
  - `@tanstack/react-table` — **v9** (`9.0.0`+; pin the exact resolved patch, identical both sides). Native v9 API, no legacy shim — see **§ Rulings locked** for the concrete deltas.
  - `@tanstack/react-virtual` — stable `3.14.x` line (core `3.17.x`); no major in flux.

**The only P2 code allowed to differ between repos** is the §11 stack-profile delta: URL-as-state wiring (routing + search-param plumbing). Everything above is shared and byte-identical.

---

## Build order (same five steps, both repos)

### Step 1 — Shared flows layer
Author `FlowsSearchSchema` + `useFlows` + `FlowsTable` in `catalogue-slice-shared` per **Shared-first** above; pin the two new deps exact/identical; bump the shared SHA; re-pin both siblings; **verify the two `src/shared` SHAs match** before any app wiring. `tsc --noEmit` clean against Table v9.
- **v9 gotcha surface to clear here, once, in shared:** `useTable` (not `useReactTable`); `tableFeatures({…})` with only the features this manual/server-driven table needs (no `stockFeatures`, no `/legacy`); confirm the v9 + Virtual wiring against a v9 example.
- **Capture:** "how the Table dropped in" (§10 DX note). It's shared, so it's the *same* note in both — and that sameness is itself a signal. Note any v9-specific friction (new `features` ceremony, Store-based state) distinctly from framework friction.

### Step 2 — URL-as-state wiring (**THE allowed delta — §11**)

**TanStack Start:**
- `validateSearch: FlowsSearchSchema` on `routes/collaborations/$id/flows.tsx` (the empty-but-typed stub P1 left) → typed `search` straight off the route. Read it; drive `useFlows` from it.
- Update via `navigate({ search: (prev) => ({ ...prev, … }), replace: true })`. Router is in-memory → **no network on a state change**; the only request is the mock flows fetch.
- Prefetch the adjacent page via `beforeLoad`/`loader` `ensureQueryData` (+ intent prefetch on hover/near-end).

**Next.js:**
- `useSearchParams()` → `FlowsSearchSchema.safeParse` (untyped `ReadonlyURLSearchParams`, manual extraction — the P1 ergonomics finding); wrap the reading component in the required `<Suspense>` boundary.
- **Build the idiomatic updater first:** `router.replace(pathname + "?" + serialize(params))`. This fires `GET /collaborations/[id]/flows?…&_rsc=…` on every change — **measure it** (Step 5). Prefetch adjacent page via `queryClient.prefetchQuery`.
- **Then, only if the idiomatic path misses the interaction-latency budget,** add the `window.history.replaceState` escape hatch (updates searchParams without a server round-trip) and measure again. **Record both** as findings — the idiomatic cost *and* whether Next needs a non-obvious workaround to make URL-as-table-state cheap. This is "friction is a finding," applied symmetrically, and it gives P1's counter-framing its real test. Do **not** silently reach for the workaround first; that would hide the exact thing the slice is instrumented to detect.
- **Invariant (carry from P1):** the `/api/*` error catch-all stays ordered **before** the `/collaborations/*` route passthrough in the shared `browser.ts` wiring, so DoD #1 (no `/api/*` escape) holds even as table navigations multiply the `?_rsc=` traffic. Re-verify after Step 3.

### Step 3 — Server-driven table behaviors
Wire each interaction as URL → query → mock, never client-side. Table runs **manual** (v9: no client row models registered):
- **Sort:** header click → `sort`/`dir` in URL (whitelist = `FLOW_SORT_FIELDS`). `avgLatencyMs desc` is the gate's sort and is skewed in the seed for a meaningful ordering.
- **Filter:** a `status` control surfacing the **union vocabulary** — lifecycle (`active/draft/deprecated/retired`) **and** health (`healthy/degraded/down`) — through the one `status` param (mock decision #3). The gate deep-link's `status=degraded` (a health value) must resolve non-empty.
- **Search:** debounced `q` → URL (**debounce interval lives in the shared layer** so it's not a per-repo confound).
- **Paginate:** `page`/`size` in URL; `page=3` deep-link lands cold; `size` large enough (up to the 500 cap) to make virtualization do real work.
- **Virtualize** the loaded page's rows (TanStack Virtual; fixed row height + overscan). `placeholderData: keepPreviousData` so sort/page swaps don't flash empty.

### Step 4 — States, prefetch, a11y
- **States:** loading skeleton (no infinite spinner), empty (filter → zero), error (surface the flows-fetch error path; the mock 404s a wrong `:id` and problem+json is already shaped).
- **Prefetch:** adjacent-page on hover/scroll-intent (the endpoint-backed reading of "row hover prefetches"); verify it visibly beats the jitter on a warm page.
- **Keyboard/focus:** row navigation (arrow/Home/End), headers sortable by keyboard, visible focus throughout — the free a11y bar from accessible primitives.

### Step 5 — Measure (M4 Max only) + gate green
- **Numbers — PierreJ on the M4 Max, per §0.3; container figures are quarantined, never recorded.** Fill these §10 cells (first valid captures for several): **HMR on the table component** · **table interaction latency @ 3,000 rows** (sort + scroll) · **route/sort-change latency, warm cache** · **initial JS gzipped for `/collaborations/:id`** (table deps now land — v9 tree-shaking should show here, which is *why* no `stockFeatures`/legacy shim) · **prod build time** (recapture) · **LCP + INP** for the screen (INP is the right vital for "is the sort snappy"). The `resolve.tsconfigPaths` asterisk still applies to any Start cold-start recapture.
- **P2 headline metric (seeded in EVIDENCE):** per table interaction — **Next: count + latency of `?_rsc=` flight requests**; **Start: confirm zero network on the state change** (only the mock flows fetch fires). This is the number P2 exists to produce; record it with both framings.
- **Gate:** `mise run lint && typecheck && test` green. **P2 Playwright e2e:** cold-load the gate deep-link `…/flows?sort=avgLatencyMs&dir=desc&status=degraded&page=3` → assert exact state; click a sort header → assert URL + rows change server-side; toggle a filter; browser back/forward → assert table state restored with no reload; a 3,000-row scroll smoke that asserts only a windowed row count is in the DOM.
- Write DX notes + numbers to `docs/EVIDENCE.md` in each repo as you go; fold into canonical `claude/EVIDENCE.md` at the checkpoint.

---

## Checkpoint protocol (per AGENTS.md §1.3 / §12)

Run P2 in both repos, then **stop** and present before P3 — no unattended run-through:
1. The **search-param + routing wiring diff** per repo (the §11 delta, side by side): Start's typed `validateSearch` + `navigate` vs Next's `useSearchParams` + `safeParse` + updater.
2. The **shared `FlowsTable` / `useFlows` / schema diff** (should be near-identical consumption; flag any divergence — divergence here is a fair-fight break, not a style choice).
3. The **RSC-on-navigation measurement**: Next's per-interaction flight count/latency vs Start's zero, idiomatic path and (if taken) the `history.replaceState` mitigation — with both framings on the record.
4. The P2 **DX-notes delta** already written to each `EVIDENCE.md` (incl. v9's `features`/Store ceremony noted separately from framework friction).
5. Any **deviation/finding** logged in the EVIDENCE deviations table (especially: did Next need the `history.replaceState` escape hatch to meet budget? did Table v9 surprise?).

---

## Risks / watch-items specific to P2

- **Table v9 is post-cutoff (stable Aug 2026) and a genuine major** — `useReactTable`→`useTable`, explicit `tableFeatures`, Store-based atom state. **Release notes + v9 migration guide are the arbiter; no `useLegacyTable`/`/legacy` shim, no `stockFeatures`** (both defeat the bundle metric and lean on a deprecated path). Clear this once in the shared `FlowsTable` so it can't diverge.
- **Next `router.replace` vs `history.replaceState`** — build idiomatic first and measure; only then test the mitigation. Reaching for the workaround first hides the finding; refusing to test it at all is unfair to the counter-framing. Do both, in that order, recorded.
- **`/api/*` catch-all ordering** — the P1 invariant must survive the multiplied route navigations; re-verify no `/api/*` escapes after Step 3.
- **Confound hygiene in the shared layer** — `keepPreviousData`, the `q` debounce interval, overscan, row height, and the v9 `features` set must be identical (they're shared) or paging/scroll "feel" becomes a framework ghost that's really a config difference. Same class as the P1 `biome lint` vs `biome check` gate-command break.
- **Deep-link cold vs warm** — the gate asserts *cold*; make sure the e2e loads the URL fresh (new context), not after a warm navigation that would mask a broken from-URL hydrate.