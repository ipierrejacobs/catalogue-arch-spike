# PATTERNS.md — Graduated-Capability Component Architecture

> **Copy-and-apply reference pattern** for `@platform/tokens`, `@platform/ports`, `@platform/ui`, and `@platform/adapters`.
> Validated in the Phase 2 Component Architecture Spike across two reference components at opposite ends of the capability spectrum: **`Button` (Tier 1 leaf)** and **`DataTable` (Tier 4 macro brick)**.

---

## 1. Core Architectural Thesis

1. **One folder template across every component.** Every component in `@platform/ui` uses the exact same four-layer folder structure (`behavior` · `ports` · `parts` · `styles`), regardless of complexity.
2. **Tier is determined by capability set, not visual size.** We do not debate "atom vs. molecule vs. organism." A component's tier (`0`–`4`) is a mechanical function of which external capabilities it requires.
3. **Empty layers are allowed — and enforced.** A Tier 1 leaf (`Button`) simply omits `<name>.ports.ts` (L2). The ESLint rule `platform-arch/no-ports-in-leaf-tiers` fails the build if a Tier 0–2 component imports `@platform/ports` or defines `<name>.ports.ts`.
4. **Business logic never enters `@platform/ui`.** Domain entity names (`IntegrationFlow`), API paths (`/api/collaborations/:id/flows`), permission role names (`CATALOGUE_EDITOR`), and route structures live exclusively in `@platform/adapters` and feature containers (`src/features/flows/FlowsTable.tsx`).

---

## 2. The Four-Layer Folder Template ("Empty Layers Are Allowed")

Every component under `packages/ui-core/src/<name>/` follows the same file layout:

```text
packages/ui-core/src/<name>/
├── <name>.behavior.ts     # L1: Headless behavior, a11y, state machines, keyboard nav
├── <name>.ports.ts        # L2: Capability ports & providers (OMITTED for Tiers 0–2)
├── <name>.parts.tsx       # L3: Compound parts + Base UI useRender/mergeProps contracts
├── <name>.styles.ts       # L4: Token-backed variant/density class recipes (zero raw values)
├── <name>.stories.tsx     # Tier & capability-matrix metadata + isolated stories
├── <name>.test.tsx        # Unit & contract tests (zero-provider for Tiers 0–2; in-memory ports for Tiers 3–4)
└── index.ts               # Public barrel exports
```

### Worked Comparison: `Button` (Tier 1) vs. `DataTable` (Tier 4)

| Layer | `packages/ui-core/src/button/` (Tier 1 Leaf) | `packages/ui-core/src/datatable/` (Tier 4 Macro Brick) |
|---|---|---|
| **L1 · Behavior** | `button.behavior.ts` — wraps `@base-ui/react/button` (`useButton`), resolves `nativeButton` when `render` swaps the element tag. | `datatable.behavior.ts` — TanStack Table v9 native `useTable` + explicit `tableFeatures` (manual sort/filter/pagination, zero client row models), `@tanstack/react-virtual` fixed-height windowing, local `idle → editing → saving → error` state machine, and 2D keyboard grid navigation. |
| **L2 · Ports** | **ABSENT** (`button.ports.ts` does not exist; forbidden by `platform-arch/no-ports-in-leaf-tiers`). | `datatable.ports.ts` — binds the 5 narrow ports from `@platform/ports` (`RowSourcePort`, `RowMutationPort`, `NavigationPort`, `PermissionPort`, optional `ViewStatePort`), one context provider per port. |
| **L3 · Parts** | `button.parts.tsx` — single `Button` part with `useRender` + `mergeProps` (`ButtonRenderProp`) for polymorphic element substitution (e.g. `AppLink`). | `datatable.parts.tsx` — compound parts (`DataTable.Root`, `Toolbar`, `Header`, `Body`, `Row`, `Cell`, `Pagination`) sharing context + typed `cellRender` / `editCellRender` structural contracts. |
| **L4 · Styles** | `button.styles.ts` — maps `variant` (`solid` · `soft` · `outline` · `ghost` · `danger`) and `size` (`sm` · `md` · `lg`) to `--cmp-btn-*` token utilities. | `datatable.styles.ts` — maps `density` (`compact` · `default` · `comfortable`), `variant` (`surface` · `bordered`), and cell interactive states to `--cmp-table-*` and `--sem-*` token utilities. |
| **Barrel** | `index.ts` | `index.ts` |

---

## 3. Graduated-Capability Tier Matrix

Classify every component by the capabilities it needs (`●` required · `◐` optional · `—` forbidden):

| Capability | Tier 0: Token Utility | Tier 1: Interactive Primitive (`Button`) | Tier 2: Composite Control | Tier 3: Connected Widget | Tier 4: Macro Brick (`DataTable`) |
|---|:---:|:---:|:---:|:---:|:---:|
| **L4 Presentation + tokens** (`@platform/tokens`) | ● | ● | ● | ● | ● |
| **L1 A11y + behavior** (`@base-ui/react` / headless core) | — | ● | ● | ● | ● |
| **L1 Internal UI state** (focus, hover, edit draft) | — | ◐ | ● | ● | ● |
| **L2 Routing port** (`NavigationPort`) | — | — | — | ◐ | ● |
| **L2 Server data port** (`RowSourcePort` / `RowMutationPort`) | — | — | — | ● | ● |
| **L2 App-state port** (`ViewStatePort`) | — | — | — | — | ◐ |
| **L2 Session/permission port** (`PermissionPort`) | — | — | — | ◐ | ● |

### How the Architectural Lint Guard Works

`platform-arch/no-ports-in-leaf-tiers` (configured in `eslint.config.mjs`) inspects every file in `packages/ui-core/src/**`:
1. It reads the file's `@tier <0..4>` JSDoc tag first; if absent, it falls back to the sibling `<component>.stories.tsx` `tier:` metadata; if neither is present, it **fails closed to Tier 1**.
2. Any file resolved to Tier `0`, `1`, or `2` that imports `@platform/ports` or is named `*.ports.ts(x)` fails lint immediately — even if placed inside a Tier-4 folder (`packages/ui-core/src/datatable/`). Location cannot launder tier.

Every component file in `@platform/ui` must declare its tier in its header comment:

```ts
/**
 * @tier 1
 * Tier 1 interactive primitive — ports-free.
 */
```

---

## 4. Recipe: The `render` / `useRender` / `mergeProps` Pattern (No `asChild`)

We standardize on `@base-ui/react/use-render` and `@base-ui/react/merge-props` for both root-element polymorphism and structural sub-part customization. Never use Radix-style `asChild` (`cloneElement`).

### 4.1 Root Polymorphism on a Leaf (`Button` + `AppLink`)

In `packages/ui-core/src/button/button.behavior.ts`, disable Base UI's native `<button>` assumption whenever a custom `render` prop is supplied so rendering an `<a>` adds `role="button"`, `aria-disabled`, and keyboard activation without console warnings:

```ts
import { useButton } from "@base-ui/react/button";

export function useButtonBehavior(options: UseButtonBehaviorOptions) {
  const hasCustomRender = options.hasCustomRender ?? false;
  const nativeButton = options.nativeButton ?? !hasCustomRender;

  const { getButtonProps, buttonRef } = useButton({
    disabled: options.disabled,
    focusableWhenDisabled: options.focusableWhenDisabled,
    nativeButton,
  });

  return { getButtonProps, buttonRef, nativeButton };
}
```

In `packages/ui-core/src/button/button.parts.tsx`, combine behavior props, style classes, and caller props via `mergeProps` and `useRender`:

```tsx
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

export type ButtonRenderProp = useRender.RenderProp<ButtonRenderState>;

export function Button(props: ButtonProps): React.ReactElement {
  const { variant = "solid", size = "md", disabled = false, render, className, ref, ...elementProps } = props;
  const { getButtonProps, buttonRef } = useButtonBehavior({
    disabled,
    hasCustomRender: render !== undefined,
  });

  const state: ButtonRenderState = { variant, size, disabled };
  const mergedProps = mergeProps<"button">(
    elementProps,
    getButtonProps({
      className: getButtonClassName({ variant, size, className }),
      "data-variant": variant,
      "data-size": size,
    }),
  );

  return useRender({
    defaultTagName: "button",
    render,
    ref: [buttonRef, ref].filter(Boolean) as React.Ref<HTMLButtonElement>[],
    state,
    props: mergedProps,
  });
}
```

In the application (`src/components/AppLink.tsx`), wrap router links without adding a `NavigationPort` to `Button`:

```tsx
// Usage in app code:
<Button variant="solid" render={<AppLink to="/collaborations/col_8f3/flows" />}>
  View Flows
</Button>
```

> **Handler order note (`mergeProps`):** `@base-ui/react/merge-props` executes merged event handlers **right-to-left** (`b` before `a`). When writing a custom target component like `AppLink`, place `props` (`b`, containing Base UI's button handlers) to the right of `AppLink`'s own defaults (`a`), and guard navigation on `aria-disabled="true"` / `data-disabled`.

### 4.2 Structural Sub-Part Customization on a Macro Brick (`cellRender` / `editCellRender`)

Column cell rendering is a **typed structural prop contract**, not a capability port. `DataTableColumnMeta<TRow, TValue>` in `packages/ui-core/src/datatable/datatable.parts.tsx` exposes `cellRender` and `editCellRender` using `useRender.RenderProp`:

```tsx
export interface DataTableColumnMeta<TRow = unknown, TValue = unknown> {
  readonly editable?: boolean | undefined;
  readonly cellRender?: useRender.RenderProp<DataTableCellRenderState<TRow, TValue>> | undefined;
  readonly editCellRender?: useRender.RenderProp<DataTableEditCellRenderState<TRow, TValue>> | undefined;
  readonly parseValue?: ((draftValue: unknown, row: TRow) => unknown) | undefined;
}
```

When `DataTable.Cell` is in `editing` or `saving` mode, it renders the inline editor (or `columnMeta.editCellRender`) rather than `columnMeta.cellRender`:

```tsx
const resolvedCellRender =
  isEditing || isSaving ? render : (render ?? columnMeta?.cellRender);
```

---

## 5. Recipe: How to Add a Capability Port (and When NOT To)

### 5.1 Decision Gate — Port vs. Prop

Before adding a port to `@platform/ports`:
- **Use a plain prop or `render` contract** if the parent already has the value synchronously (`disabled`, `title`, `sorting`, `onSortingChange`, `cellRender`). Example: `Button` receives `disabled={!canEdit}` as a prop computed by `FlowsTableContainer`; `Button` **never** reads `PermissionPort`.
- **Use a capability port (Tiers 3–4 only)** when a multi-part brick must coordinate directly with an external system concern across its compound tree (server row fetching + windowing, row mutations with `pendingIds` + optimistic rollback, URL/router href resolution, per-cell permission checks, or persisted view state).

### 5.2 Four-Step Port Implementation Checklist

1. **Declare the narrow port interface, in-memory test adapter, and contract verifier in `@platform/ports` (`packages/ports/src/index.ts`):**
   - Keep every port narrow and single-concern (`RowSourcePort`, `RowMutationPort`, `NavigationPort`, `PermissionPort`, `ViewStatePort`).
   - Ship an in-memory adapter (`createInMemory*Adapter`) so Tier 3–4 bricks can be developed and tested in complete isolation without MSW, Router, or TanStack Query.
   - Ship a reusable contract assertion helper (`assert*PortContract`) using neutral sample values (`/items/item-1`, `type: "item"`, `id: "item-1"`, `"sample-view"`).

2. **Bind a single-concern Context Provider + React-Compiler-safe hook in `<name>.ports.ts`:**
   - Provide **one provider per port** (`RowSourcePortProvider`, `RowMutationPortProvider`, etc.) — **never** a monolithic god-adapter.
   - When a port interface exposes a hook method (such as `port.useRows(query)` or `port.useUpdateRow()`), wrap the call in a top-level hook using `Reflect.apply` so `eslint-plugin-react-compiler` and Biome `useHookAtTopLevel` verify hook stability:

   ```ts
   export function useRowSource<TRow = unknown, TQuery = DataTableQuery>(
     query: TQuery,
   ): RowSourceResult<TRow> {
     const port = useRowSourcePort<TRow, TQuery>();
     return Reflect.apply(port.useRows, port, [query]) as RowSourceResult<TRow>;
   }
   ```

3. **Implement the real stack adapter in `@platform/adapters` (`packages/adapters/src/<concern>.adapter.ts`):**
   - Verify the real adapter passes the Stage-2 `assert*PortContract` helper **unchanged**.
   - For mutations (`createQueryRowMutationAdapter`), use the **TanStack Query cache `onMutate` + snapshot rollback** pattern (updating both cached `SpringPageEnvelope<TRow>` list queries and any mirrored single-row detail cache entries) and map RFC 7807 `application/problem+json` (422) `errors{}` back to field/row state.

4. **Compose the providers in the Feature Container (`src/features/flows/FlowsTable.tsx`):**
   - Instantiate stable adapter objects via `React.useMemo` and nest the individual port providers around `<DataTable.Root>`:

   ```tsx
   <RowSourcePortProvider adapter={rowSourceAdapter}>
     <RowMutationPortProvider adapter={rowMutationAdapter}>
       <NavigationPortProvider adapter={navigationAdapter}>
         <PermissionPortProvider adapter={permissionAdapter}>
           <ViewStatePortProvider adapter={viewStateAdapter}>
             <DataTable.Root<IntegrationFlow>
               columns={integrationFlowColumns}
               getRowId={(row) => row.id}
               resourceType="flow"
               viewStateKey={`flows-view-${collabId}`}
               sorting={sorting}
               onSortingChange={...}
               columnFilters={columnFilters}
               onColumnFiltersChange={...}
               globalFilter={resolved.q}
               onGlobalFilterChange={...}
               pagination={pagination}
               onPaginationChange={...}
             >
               <DataTable.Toolbar actions={...} />
               <DataTable.Header />
               <DataTable.Body />
               <DataTable.Pagination />
             </DataTable.Root>
           </ViewStatePortProvider>
         </PermissionPortProvider>
       </NavigationPortProvider>
     </RowMutationPortProvider>
   </RowSourcePortProvider>
   ```

---

## 6. State-Placement Law (`AGENTS.md` §5)

Every piece of state in a Tier-4 feature belongs to exactly one seam. Smearing state across seams (e.g., copying server rows into Zustand, or holding URL sort/filter/page in `useState`) is a gate failure.

| State Seam | Concrete Examples | Authoritative Owner | Port / Mechanism |
|---|---|---|---|
| **1. Server state** | `SpringPage<IntegrationFlow>` rows, `totalElements`, mirrored flow detail, session roles | **TanStack Query** (`QueryClient` cache) | `RowSourcePort` (`useQuery` + `keepPreviousData`) · `RowMutationPort` (`useMutation` cache `onMutate` + snapshot rollback) |
| **2. URL state** | `sort`, `dir`, `status`, `q`, `page`, `size` | **Router / URL search params** (`validateSearch`) | Controlled props on `DataTable.Root` + `NavigationPort` (`replace: true`) |
| **3. App state** | Multi-row `rowSelection`, `bulkMode`, `columnVisibility`, saved view presets | **Zustand** (`createZustandViewStateStore`) | `ViewStatePort` (`load` / `save` / `subscribe`) |
| **4. Local UI state** | Active editing cell (`idle → editing → saving → error`), uncommitted draft input, `focusedCell` coordinates | **Local React state** inside `useDataTableBehavior` | L1 `useReducer` / `useState` (never leaves the component until commit) |

---

## 7. Collected Gate Proofs (Where Each Proof Lives)

| Proof | Requirement | Verification Evidence |
|---|---|---|
| **(a) Leaf stays port-free** | `button.ports.ts` is absent; `platform-arch/no-ports-in-leaf-tiers` rejects a Tier-1 file importing `@platform/ports` even inside `datatable/`; `Button` unit tests pass with zero providers. | `packages/ui-core/src/__tests__/stage0-scaffold.test.ts` (`ESLint.lintText` bite + allow tests) · `packages/ui-core/src/button/button.test.tsx` (5 zero-provider tests) |
| **(b) Macro brick is business-logic-free** | Zero occurrences of domain entities, API paths, role names, or field names (`flows`, `collaborations`, `IntegrationFlow`, `/api/`, `CATALOGUE_`, `slaTargetMs`, `avgLatencyMs`, `throughputPerMin`) in `packages/ui-core/src/datatable/` or `packages/ports/src/`; all domain rules live in `src/features/flows/FlowsTable.tsx`. | `grep -rnE "flows\|collaborations\|IntegrationFlow\|/api/\|CATALOGUE_\|slaTargetMs\|avgLatencyMs\|throughputPerMin" packages/ui-core/src/datatable packages/ports/src` → **0 matches** |
| **(c) State-placement law holds (`AGENTS.md` §5)** | Four dedicated per-seam tests verifying: (1) server rows only in TanStack Query (never in Zustand); (2) `sort/dir/status/q/page/size` in URL (surviving cold reload & deep-link, no internal `useState` drift); (3) selection/bulk-mode/column-visibility in Zustand via `ViewStatePort`; (4) editing-cell draft/focus/keyboard nav strictly local. | `packages/adapters/src/__tests__/stage3-adapters.test.tsx` (`Stage 3 · Sub-step 3` suite — Seams 1, 2, 3, and 4) |
| **(d) One template serves both** | `Button` (Tier 1) and `DataTable` (Tier 4) use the identical four-layer folder structure (`<name>.behavior.ts`, `<name>.ports.ts`, `<name>.parts.tsx`, `<name>.styles.ts`, `index.ts`), differing only in which layers are populated; Stage 3 required **zero** edits to `@platform/ui` (`git diff main -- packages/ui-core` is empty). | `packages/ui-core/src/button/` vs. `packages/ui-core/src/datatable/` · `packages/ui-core/src/__tests__/stage0-scaffold.test.ts` |
