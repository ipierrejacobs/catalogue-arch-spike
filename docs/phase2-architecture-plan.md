# Phase 2 · Component Architecture Spike — Build Plan (Graduated-Capability model)

_Phase 2 of the dependency stack (Concern 3), run **on the winning stack's shape** using the full target stack: **React + TanStack Start + TanStack Query + TanStack Router + TypeScript + Tailwind v4 + Base UI + Vite**. This trials the recommendations in `Graduated-Capability Component Architecture for an SPA-First Enterprise React Platform (2026).md` by **building two reference components** — a **Button (Tier 1)** and an **editable server-driven DataTable (Tier 4)** — that prove the same four-layer template serves both without leaking ports into the leaf. Same working method as the bake-off: an architectural brief the agent treats as binding, a kickoff command, and per-stage agent prompts._

**Status:** ☐ **DRAFT — awaiting sign-off.** On approval this becomes the agent's Phase 2 brief (dropped into the spike repo as `docs/phase2-architecture-plan.md`).
**References:** the architecture doc (above) is the authority for *what* to build · `claude/locked-decisions.md` (canonical status) · `claude/constraints.md` (Phase 0 non-negotiables) · `AGENTS.md` §1/§2/§5/§11 (fair-fight, env, state-placement law, stack profile) · `claude/phase1-slice-spec.md` §4 (the `IntegrationFlow` contract the DataTable renders).

---

## ⚠️ Dependency-stack flag (read before approving)

Per the project's core mental model, **Concern 3 (components) sits on Concern 1 (stack), which is not yet gated.** `locked-decisions.md` still shows the **framework decision as ☐ TBD (Phase 1)** — the bake-off slice is mid-build (P2 Step 2), and the Phase 1 gate ("stack decision with evidence") has **not** closed. Strictly, Phase 2 starts *after* that gate.

This request is a deliberate, **scoped trial** ("I want to trial the recommendations"), not a productization. That's legitimate and useful — but to respect the dependency order, this plan treats the spike as **contingent**, not committing:

- **It builds on TanStack Start specifically** because the doc's port examples (`RouterProvider`-shaped `NavigationPort`, Start loaders feeding `useRows`) are Start-shaped, and Start is the paper leader (4.69 vs 4.30). If the Phase 1 gate picks **Next.js**, the headless core + ports + presentation layers port unchanged; **only the adapter package's router/loader wiring changes** (`NavigationPort` backed by `useRouter`/`useSearchParams` instead of Start `navigate`). That portability is itself a Phase 2 finding worth capturing.
- **No decision locks here.** The Phase 2 gate artifact (reference component + documented patterns) is what would let us *later* record "Component primitive layer" and "Component/adapter contract" in the register — and only once the stack gate underneath it is closed. Until then this is a spike that de-risks Phase 2 and pressure-tests the paper leader, not a gate closure.

**If you'd rather not build on an unratified stack at all,** the alternative is to hold this until the Phase 1 gate closes. I'm proceeding on the read that a contingent spike on the paper leader is what you want ("before continuing with the stack bake-off… I want to trial"). Say the word and I'll re-scope.

---

## What Phase 2 is (and is not)

**Is:** prove the **four-layer template** — Behavior/State → *optional* Ports → Parts/Composition → Presentation/Tokens — on two components at opposite ends of the capability gradient, so the contract others copy is real code, not prose. The doc's own validation test (Recommendation 7): _"If the same template serves both without leaking ports into Button, the architecture is validated."_

**The two components (the doc's own pilot pair):**
1. **Button — Tier 1.** Behavior from Base UI; **ports layer empty**; `render` prop for element substitution (render-as-link); token-backed `variant`/`size`. ~6 props, testable with **zero providers**. This is the *negative* proof — if Button ends up importing a port, the gradient leaked.
2. **Editable DataTable — Tier 4.** TanStack Table v9 (manual mode) + TanStack Virtual behavior core; declares `RowSourcePort`, `RowMutationPort`, `NavigationPort`, `PermissionPort`, optional `ViewStatePort`; compound parts with `cell`/`editCell` render functions; same tokens as Button. App supplies the adapters (TanStack Query hooks, Router navigate, auth client) — **business logic lives only in the adapters/columns**, never in the brick.

The doc's third suggested component (a Tier-2 molecule — TextField/Combobox) is **explicitly out of scope** for this spike to keep it to the two-ended proof the request asked for. (The full Phase 2 scope in the mission — "a leaf input, a data-driven list, a routed composite" — would add it back; noted as a follow-up, not dropped silently.)

**Is not:** the token *pipeline* in CI (that's **Phase 3** — this spike hand-authors a minimal token file so the presentation layer is real, but does **not** stand up Figma → DTCG → Style Dictionary → CI; flag if a request tries to pull that forward). Not the AI design-to-code flow (Phase 3). Not a new framework evaluation (Phase 1). Not migration/codemods (Phase 5).

---

## The target stack for the spike (full, pinned, exact)

Per the mission's "full React + TanStack Start stack." Post-cutoff libraries are the arbiter of their own API — **release notes + migration guides win over prior memory** (the standing P2+ lesson; see Risks).

| Layer | Choice | Pin discipline | Notes |
|---|---|---|---|
| Framework / meta | React 19 + **TanStack Start 1.x** (stable 13 Oct 2026, requires **Vite 8**) | exact | Start is the spike host; see portability note above |
| Router | **TanStack Router** (file-based, typed `search`) | exact | backs `NavigationPort` |
| Server state | **TanStack Query v5** | exact (match bake-off: `5.104.5`) | backs `RowSourcePort`/`RowMutationPort` adapters |
| Table core | **@tanstack/react-table v9** (native API) | exact, no caret | `useTable` + `tableFeatures({…})`, **manual** mode, **no** `stockFeatures`/`/legacy` |
| Virtualization | **@tanstack/react-virtual** `3.17.x` | exact, no caret | windows the loaded page |
| App state | **Zustand** (only for cross-cutting: saved views, bulk mode) | exact (match bake-off `5.0.16`) | exposed to the brick via `ViewStatePort`, never imported directly |
| Primitive layer | **Base UI** `@base-ui/react` (v1.0.0 shipped 11 Dec 2025; current 1.9.0, 9 Oct 2026; shadcn default since 2 Jul 2026) | exact | **the new package name** `@base-ui/react` — old `@mui/base` / `@base-ui-components/react` are deprecated |
| Styling | **Tailwind v4** (`@theme inline`) + CSS variables | exact | theme switch = CSS-var swap, zero React re-renders |
| Compiler | **React Compiler 1.0** + its ESLint rules, on from day one | — | TanStack Table v9 is Compiler-compatible (TanStack Store foundation); v8 is not — another reason v9 |
| Lang / build / mock | TypeScript · Vite 8 · MSW (reuse bake-off `handlers.ts` for the DataTable's data) | exact | run through the dev container + `mise` tasks, per `AGENTS.md` §2 |

**Composition rule (whole spike):** standardize on Base UI-style **`render` / `useRender` / `mergeProps`**. Do **not** introduce `asChild`/Slot. New bricks expose the *same* `render` contract as the primitives beneath them.

**State-placement law (carried verbatim from `AGENTS.md` §5 — it governs the DataTable):** server state in TanStack Query (via port); URL state (`sort/dir/status/q/page/size`) in the Router; app state (selection, bulk mode) in Zustand (via port); UI state (hover, editing-cell draft, field focus) local. Smearing table state into component state, or server data into the store, **fails the spike** regardless of how it looks.

---

## The four-layer template (the one shape every component follows)

Every component is a folder with the same files; **any layer may be empty**, and emptiness is enforced, not optional:

```
packages/
  ui-core/                      # @platform/ui — the bricks (no app, no business logic)
    src/<name>/
      <name>.behavior.ts        # L1: headless hook / primitive wrapper. MAY be empty.
      <name>.ports.ts           # L2: typed port interfaces + context hooks. EMPTY for Tier 0–2.
      <name>.parts.tsx          # L3: compound parts; render/useRender substitution points.
      <name>.styles.ts          # L4: token-driven variants (Tailwind classes / CSS vars). No raw values.
      <name>.stories.tsx        # tier + capability-set metadata; in-memory adapters for ports.
      <name>.test.tsx           # Tier 0–2: zero providers. Tier 3–4: in-memory adapters + contract tests.
      index.ts                  # public API
  ports/                        # @platform/ports — narrow, per-concern interfaces + in-memory test adapters
  adapters/                     # @platform/adapters — app-owned: Query hooks, Router nav, auth, view-state.
                                #   THE ONLY place business rules may live outside feature code.
  tokens/                       # minimal hand-authored token set for THIS spike (Phase 3 productizes the pipeline)
```

**Consistency is the shape + lint, not uniform props.** A lint rule forbids `@platform/ui/*` Tier 0–2 components from importing `@platform/ports` — that rule *is* the graduated-capability guarantee. Tier is declared in each component's Storybook metadata, **classified by capability set, not visual size** (the doc's governance point: don't let the team re-debate "is FormField a molecule or organism").

### Layer-by-layer contract

- **L1 Behavior/state.** One primitive family for the whole app: **Base UI** (`@base-ui/react`). Macro grids add TanStack Table v9 + Virtual. **Never mix Base UI and React Aria in one field/form composite** — their field/form contexts don't cross (documented hazard).
- **L2 Ports (Tier 3–4 only).** Narrow, per-concern, typed. Opt-in. A Tier-3 component may *declare* a port but must work without one (controlled-props fallback). The doc's canonical set:
  - `RowSourcePort<TRow, TQuery> { useRows(query): { rows; rowCount; status } }`
  - `RowMutationPort<TRow> { useUpdateRow(): { mutate(id, patch); pendingIds } }`
  - `NavigationPort { navigate(to, opts?); useHref(to) }`  ← React Aria's `RouterProvider` is the production-shaped precedent
  - `PermissionPort { can(action, resource): boolean }`
  - `ViewStatePort { load(key); save(key, state) }`
- **L3 Parts/composition.** Compound parts (`DataTable.Root/Toolbar/Header/Body/Cell/Pagination`) sharing state via context; substitution via `render`+`useRender`+`mergeProps`.
- **L4 Presentation/config.** Token-backed variants only — **no raw values**. Theme/density = CSS-variable swap.

---

## Phase 2 definition of done

The spike has finished when **all** of these hold:

1. **One template, two components.** Button and DataTable are both the four-layer folder shape; they differ *only* in which layers are populated.
2. **The leaf stays clean (negative proof).** `button.ports.ts` is **absent/empty**; the lint rule that forbids Tier 0–2 → `@platform/ports` is **green**; Button renders and is fully tested with **zero providers**; render-as-link works via `render` with the link adapter supplied by the app, not the Button.
3. **The macro brick is business-logic-free.** DataTable declares its ports and owns behavior/UI-state/composition/presentation; **no** API shape, permission rule, or navigation target appears inside `@platform/ui`. `OrdersTable`-style wiring (here: `FlowsTable` feature container) composes the brick with adapters in the app layer.
4. **State placement holds (§5).** Sort/filter/page in the URL; server data in Query (via `RowSourcePort`); selection/bulk in Zustand (via `ViewStatePort`); editing-cell draft local. A contract test proves each real adapter satisfies its port interface.
5. **Manual, virtualized, server-driven.** TanStack Table v9 `useTable` + explicit `tableFeatures` (no `stockFeatures`, no `/legacy`); `manualSorting/manualFiltering/manualPagination` with server `rowCount`; TanStack Virtual windows the page; optimistic edit via `RowMutationPort` adapter (cache write in `onMutate` + rollback — the doc's "multiple places on screen" case, since a detail panel may mirror the row).
6. **Composition contract shared.** Both components expose the Base UI `render` contract; **no `asChild`** anywhere; `useRender`/`mergeProps` used for the bricks' own substitution points.
7. **Tokens real, pipeline deferred.** Presentation reads from a hand-authored token file; **no** Figma/DTCG/Style-Dictionary/CI (that's Phase 3). A one-line note records the seam where Phase 3 will plug in.
8. **Compiler clean.** React Compiler 1.0 + ESLint rules on; adapter objects stable; **one provider per port** (no god-adapter, no context soup). `mise run lint && typecheck && test` green.
9. **Patterns documented.** A `PATTERNS.md` others copy: the folder template, the tier/capability matrix, how to add a port, the render/useRender substitution recipe, and the "empty layers are allowed" rule — **with the Button and DataTable as the two worked examples.**

**Explicitly NOT in Phase 2** (scope fence): the Tier-2 molecule (TextField/Combobox) — follow-up; the CI token pipeline + AI design-to-code flow — **Phase 3**; the lineage graph, edit drawer, auth/expiry exercise — those are bake-off slice features, not this architecture spike; any register lock — **contingent on the Phase 1 stack gate** closing first.

---

## Build order (four stages, stop for human review at each)

Mirrors the bake-off's staged, checkpointed loop (`AGENTS.md` §1.3/§12 — no unattended run-through). Per-stage agent prompts are in the companion files (`phase2-stageN-agent-command.md`); the kickoff command (`phase2-agent-command.md`) sequences them.

### Stage 0 — Scaffold the four-layer skeleton + token seed + the lint guard
Stand up `@platform/ui`, `@platform/ports`, `@platform/adapters`, `@platform/tokens` in the Start app's workspace. Author the **minimal token set** (primitive → semantic → component tiers, hand-written `.css` vars + Tailwind `@theme inline` mapping — no pipeline). Write the **lint rule** that forbids Tier 0–2 → `@platform/ports` and wire React Compiler + its ESLint rules. **Nothing renders yet.** → **STOP:** present the workspace layout, the token file, and a *failing* demonstration that the lint rule bites when a leaf imports a port.

### Stage 1 — Button (Tier 1): the negative proof
Build Button as four layers with L2 **empty**: Base UI behavior, `render`-prop substitution (render-as-link via an app `AppLink`), token `variant`/`size`. Test with **zero providers**. Add Storybook metadata (tier 1, capability set). → **STOP:** present the Button folder (showing no `ports.ts`), the zero-provider test, the render-as-link story, and lint green.

### Stage 2 — DataTable (Tier 4) behavior core + ports, with in-memory adapters
Build the DataTable brick: TanStack Table v9 manual core + Virtual, the edit-mode state machine (idle → editing(cell) → saving → error), keyboard grid nav, compound parts, `cell`/`editCell` render functions. Declare the five ports. Drive it **entirely from in-memory adapters** (no app, no network) so the brick is proven business-logic-free first. → **STOP:** present the brick rendering against in-memory adapters, the ports file, and the contract tests.

### Stage 3 — Wire the real adapters in the app + the feature container
In `@platform/adapters`, back the ports with the real stack: `RowSourcePort` → `useQuery` against the shared MSW `IntegrationFlow` contract (`keepPreviousData`); `RowMutationPort` → `useMutation` (optimistic `onMutate` + rollback); `NavigationPort` → TanStack Router `navigate` + typed `search` (URL-synced sort/filter/page; row→detail); `PermissionPort` → the session/auth client; `ViewStatePort` → Zustand. Build the `FlowsTable` feature container that composes the brick with these. Verify the full state-placement law and run the gate. → **STOP:** present the end-to-end DataTable, the adapter package, the §5 verification, and `lint && typecheck && test` green.

---

## Checkpoint protocol (per `AGENTS.md` §1.3/§12)

Run each stage, then **stop** and present before the next — no unattended run-through. At the Stage 3 checkpoint, present the **gate artifact**: the two reference components + `PATTERNS.md`, plus the four validation proofs (leaf stays port-free; macro brick business-logic-free; state placement holds; one template serves both). I'll then offer to record — **contingent on the Phase 1 gate** — the "Component primitive layer = Base UI" and "Component/adapter contract" rows in `locked-decisions.md`.

---

## Risks / watch-items specific to Phase 2

- **Building on an unratified stack.** The load-bearing one (see the flag above). Mitigation: the port boundary is exactly what makes the core portable to Next; capture the "what changes if Next wins" delta as a finding.
- **Post-cutoff library APIs.** Base UI `@base-ui/react` (v1 Dec 2025) and **TanStack Table v9** (native `useTable`/`tableFeatures`, Aug 2026) both post-date training and both trip prior memory. **Release notes + migration guides are the arbiter** — no `useReactTable`, no `stockFeatures`, no `/legacy`, no `asChild`. Verify the exact installed patch; pin exact.
- **Over-abstraction (the doc's headline anti-pattern).** Ports on leaves, a god-adapter, context soup. The lint guard + "one provider per port" + the Button negative-proof are the structural defenses; if Button grows a port, **stop** — the gradient leaked.
- **Context re-renders.** Even with React Compiler, context still re-renders all consumers on value change. Keep adapter objects stable; split providers per port; theme via CSS vars not context.
- **Primitive-family mixing.** Base UI and React Aria field/form contexts don't cross — pick Base UI and hold it for the whole spike.
- **Token pipeline scope-creep.** If a stage reaches for Figma/DTCG/Style Dictionary/CI, that's Phase 3 — flag and defer; the spike uses a hand-authored token file only.
