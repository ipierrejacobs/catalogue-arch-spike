# Phase 2 — Component Architecture Spike · EVIDENCE

_Copy this to `docs/EVIDENCE.md` in the spike repo. The agent fills it **as it goes**, not at the end (per `AGENTS.md` §1.3 / §12). This spike's evidence is the **contract and its proofs**, not a stopwatch — see §0.3._

**Spike:** Graduated-Capability Component Architecture, trialed on the full React + TanStack Start stack.
**Authority for what to build:** `docs/phase2-architecture-plan.md` + `docs/graduated-capability-architecture.md`.
**Status:** ☐ in progress.

---

## §0 — Standing rules for this capture

- **§0.1 Release notes are the arbiter.** Base UI (`@base-ui/react`, v1 Dec 2025) and TanStack Table **v9** (native `useTable`/`tableFeatures`, Aug 2026) both post-date the training cutoff and both trip prior memory. When behavior disagrees with recollection, the library's own release notes / migration guide win. Record the exact installed patch versions in §1.
- **§0.2 Do NOT fabricate perf numbers.** Unlike the bake-off, this spike is about whether the architecture holds, not interaction latency. Leave perf cells empty unless a real capture is run on the reference machine; a contract that works is the deliverable.
- **§0.3 The evidence is the four proofs.** Phase 2 closes on: (a) the leaf stays port-free, (b) the macro brick is business-logic-free, (c) the state-placement law holds, (d) one template serves both. Everything below rolls up to those.
- **§0.4 Tier by capability set, not visual size.** Record each component's declared tier + capability set; do not re-debate "molecule vs organism."
- **§0.5 Log every deviation** in the §5 table, especially any port interface that had to change when a real adapter was wired (that is the headline "are the ports right or over-abstracted" finding).

---

## §1 — Installed stack (fill at Stage 0)

| Dep | Pinned version (exact) | Notes |
|---|---|---|
| `@base-ui/react` | `1.9.0` | NEW package name; `@mui/base` / `@base-ui-components/react` are deprecated |
| `@tanstack/react-table` | `9.3.1` | v9 native API only (no `stockFeatures`, no `/legacy`) |
| `@tanstack/react-virtual` | `3.14.24` | matches existing bake-off exact pin (`src/shared/package.json` peerDep; latest npm is `3.14.26`) |
| `@tanstack/react-query` | `5.104.5` | match bake-off pin |
| `zustand` | `5.0.16` | match bake-off pin |
| React Compiler | `babel-plugin-react-compiler@1.0.0` + `eslint-plugin-react-compiler@19.1.0-rc.2` | + ESLint rules on? ☑ |
| TanStack Start / Vite | `1.169.3` / `8.0.0` | `@tanstack/react-router@1.170.45`, `typescript@7.0.2`, `@biomejs/biome@2.4.5`, `eslint@10.14.0` |

---

## §2 — The four validation proofs (the gate)

| Proof | How shown | Result |
|---|---|---|
| (a) Leaf stays port-free | `button.ports.ts` absent · lint guard green · **bite-demo**: fixture importing `@platform/ports` fails lint, then green after delete · Button tests pass with **zero providers** | ☑ (`packages/ui-core/src/button/button.test.tsx` + `stage0-scaffold.test.ts`) |
| (b) Macro brick business-logic-free | `grep` `@platform/ui` for any entity/endpoint/permission/nav name → none · column defs + rules live only in the `FlowsTable` feature container | ☐ |
| (c) State-placement law holds (§5) | per-seam tests: sort/filter/page in URL · server rows only in Query · selection/bulk in Zustand · editing-cell draft/hover/focus local | ☐ |
| (d) One template serves both | Button and DataTable are the same four-layer folder shape; differ only in which layers are populated | ☐ |

---

## §3 — DX / architecture notes (narrative, per stage)

**Stage 0 — scaffold + tokens + lint guard.**
- Workspace shape / what the four-layer template felt like to stand up: Clean pnpm monorepo split under `packages/` (`@platform/tokens`, `@platform/ports`, `@platform/ui`, `@platform/adapters`) mapped in `tsconfig.json` (`bundler` resolution) and Vite `tsconfigPaths`.
- Token seed (primitive → semantic → component; CSS vars + Tailwind `@theme inline`): Hand-authored in `packages/tokens/src/tokens.css` with three strict tiers (`--prim-*` → `--sem-*` → `--cmp-*`) and Tailwind v4 `@theme inline` utility bindings. Theme (`[data-theme="dark"]`) and density (`[data-density="compact"|"comfortable"]`) are pure CSS-variable swaps with zero React context. Includes the explicit Phase 3 seam comment for DTCG 2025.10 → Style Dictionary v5 (`outputReferences: true`).
- Did the lint guard bite cleanly? Yes — enforced structurally in both Biome (`lint/style/noRestrictedImports` override on `packages/ui-core/src/**` excluding `data-table`) and ESLint (`platform-arch/no-ports-in-leaf-tiers` + `platform-arch/no-prohibited-apis` + `react-compiler/react-compiler`). Confirmed with a live bite-demo fixture (`packages/ui-core/src/button/button.bite-demo.ts` importing `@platform/ports`) which failed `mise run lint` with `Graduated-Capability Violation`, plus an automated Vitest suite (`packages/ui-core/src/__tests__/stage0-scaffold.test.ts`) that programmatically asserts the rule bites on both `@platform/ports` imports and non-empty `<name>.ports.ts` files in Tier 0–2 leaves.

**Stage 1 — Button (Tier 1, negative proof).**
- Base UI behavior wrap: `packages/ui-core/src/button/button.behavior.ts` wraps `@base-ui/react/button`. Notable `@base-ui/react@1.9.0` finding: `useButton` defaults `nativeButton: true` and logs a dev error if `render` produces a non-`<button>` element (like `<a>`) while `nativeButton` is `true`. Setting `nativeButton = options.nativeButton ?? !options.hasCustomRender` in `resolveButtonBehaviorProps` gives native `<button type="button">` by default and seamless non-native `role="button"` / `aria-disabled` / Space-key activation when `render` is passed.
- `render`/`useRender` substitution (render-as-link, AppLink in the app): `button.parts.tsx` exposes `ButtonRenderProp` (`useRender.RenderProp<ButtonRenderState>`) and merges token classes + `data-variant` / `data-size` via `@base-ui/react/merge-props`. `src/components/AppLink.tsx` lives in the app layer and maps `to` → `href`, so `<Button render={<AppLink to="/orders" />}>` renders an `<a>` with all button behavior/tokens and zero router imports inside `@platform/ui`. Notable `@base-ui/react` composition detail: `mergeProps(a, b)` executes event handlers right-to-left (`b` before `a`), so `AppLink` puts its own handler leftmost and checks `aria-disabled` / `data-disabled` injected by Base UI when `Button` is disabled.
- Zero-provider testing — any friction? Zero friction. All 5 tests in `packages/ui-core/src/button/button.test.tsx` render `<Button>` directly via `@testing-library/react` with zero context providers.

**Stage 2 — DataTable core + ports (in-memory).**
- v9 native API drop-in (`useTable`, explicit `tableFeatures`, manual mode). Note v9-specific ceremony **separately** from framework friction: ___
- Edit-mode state machine (idle → editing → saving → error) + keyboard grid nav: ___
- Did the five port interfaces feel right, or over-abstracted, against in-memory adapters? ___

**Stage 3 — real adapters + feature container.**
- RowSource/RowMutation/Navigation/Permission/ViewState adapters on the real stack: ___
- Optimistic edit (cache `onMutate` + rollback; `problem+json` → field errors): ___
- **Did any port interface have to change when wired to the real stack?** (the key finding) ___

---

## §4 — Portability finding: what changes if Next wins the Phase 1 gate

_The spike is built on TanStack Start (paper leader). The headless core + ports + presentation are framework-agnostic; only `@platform/adapters` router wiring is Start-shaped. Record concretely what would change if the Phase 1 stack gate picks Next instead._

- `NavigationPort` adapter (Start `navigate` + typed `search` → Next `useRouter`/`useSearchParams`): ___
- Anything else that touched the framework (loaders/prefetch, route-level auth guard): ___
- Did any **brick** code depend on Start? (should be none — if yes, that's a leak) ___

---

## §5 — Deviations / findings log

| Stage | Deviation or finding | Why | Resolution |
|---|---|---|---|
| Stage 0 | `@tanstack/react-virtual` pinned at `3.14.24` | Matches existing bake-off pin in `package.json` & `src/shared/package.json` (`3.17.x` does not exist on npm; latest is `3.14.26`). | Kept exact `3.14.24` pin to match existing workspace lockfile and `src/shared` peer dependency. |
| Stage 0 | `typescript-eslint@8.72.1` hard-blocks `typescript@7.0.2` | `typescript-eslint` throws `typescript-eslint does not support TS 7.0` at import time. | Used `@babel/parser` in ESTree mode (`plugins: ["typescript", "jsx", "estree"]`, bundled with `babel-plugin-react-compiler@1.0.0`) inside `eslint.config.mjs`, which natively parses TS 7.0 + JSX and powers both `eslint-plugin-react-compiler` and `platform-arch/*` rules. |

---

## §6 — Gate artifact checklist (Stage 3 close)

- [ ] Two reference components (Button Tier 1 · DataTable Tier 4) on one template
- [ ] `PATTERNS.md` others can copy (folder template · tier/capability matrix · how to add a port · render/useRender recipe · "empty layers are allowed")
- [ ] The four proofs in §2 all ☑
- [ ] §4 portability note written
- [ ] `mise run verify` (lint + typecheck + test) green
- [ ] **Register update is CONTINGENT** — "Component primitive layer = Base UI" and "Component/adapter contract" stay pending in `locked-decisions.md` until the Phase 1 stack gate closes