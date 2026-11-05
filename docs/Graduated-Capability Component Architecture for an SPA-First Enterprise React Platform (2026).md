# Graduated-Capability Component Architecture for an SPA-First Enterprise React Platform (2026)

The best fit is a layered hybrid with one component "shape" (headless behavior → optional capability ports → composable parts → token-driven presentation), in which capability ports are opt-in per tier rather than mandatory. A label never declares a DataPort. An editable data table declares DataPort, RouterPort, SessionPort and PersistencePort, and the application supplies the adapters. No single pattern in your list covers the whole spectrum by itself. Headless hooks/primitives (Base UI or React Aria, plus TanStack Table) handle behavior and accessibility. Ports-and-adapters handles the heavy, environment-bound capabilities. Compound components with slots/render props handle composition. A DTCG → Style Dictionary → CSS-variables pipeline handles presentation and configuration.

## TL;DR

- **Adopt a layered hybrid, not a single pattern.** Every component follows the same four-layer template (Behavior/State → Ports → Parts/Composition → Presentation/Tokens), and each layer may be empty. Consistency comes from the shape and the conventions, not from forcing every brick to carry every contract. This answers the graduated-capability requirement directly: React Spectrum's own architecture notes that "each component has the pieces of this architecture that make sense for their purpose."
- **The 4-vs-5 tension is resolved by ownership of the port, not the adapter.** A macro brick is "self-contained" because it declares its ports (typed interfaces for data, navigation, session, persistence) and owns all UI state and behavior. It is "business-logic-free" because the application injects the adapters (TanStack Query hooks, TanStack Router navigate, the auth client). This is Cockburn's ports-and-adapters applied at component scale, and React Aria's RouterProvider and TanStack Table's "manual" server-side mode already follow it.
- **Concrete stack for 2026:** Base UI (v1.0.0 shipped Dec 11, 2025 as the new `@base-ui/react` package with 35 unstyled components, per base-ui.com's release notes; shadcn/ui's default since July 2026) as the primitive layer, with React Aria Components as the alternative when you need its deeper i18n/a11y and its hooks escape hatch. TanStack Query for server state, Zustand/Jotai only for genuine cross-cutting client state, and TanStack Table v9 plus Virtual for macro grids. DTCG 2025.10 tokens → Style Dictionary v5 → CSS variables → Tailwind `@theme`. React Compiler 1.0 is turned on. RSC is out of scope for this SPA.

## Key Findings

1. **Capability needs really are graduated, and the leading libraries already model that.** React Aria splits each component into state hook (React Stately), behavior hook (React Aria) and rendered component, and says plainly that "not all components have a state hook."\[1\] Its getting-started docs separate *stateless* components (buttons, progress bars, links) from *stateful* ones (text fields, checkboxes, selects).\[2\] Your atom/molecule/organism gradient is the same split, extended upward with data/routing/session.
2. **Container/Presentational is retired as a rule but alive as an idea.** Dan Abramov's 2019 update says he no longer suggests splitting components that way and that "Hooks let me do the same thing without an arbitrary division."\[3\] The modern equivalent is "headless hook + presentational parts." Juntao Qiu's Headless Component article on martinfowler.com describes it as "extracting all non-visual logic and state management, separating the brain of a component from its looks."\[4\]
3. **Headless is the industry consensus for the behavior layer at every tier.** TanStack Table defines headless as providing "the logic, state, processing and API for UI elements and interactions" while "not provid[ing] markup, styles, or pre-built implementations."\[5\] Base UI, React Aria and TanStack Table/Virtual all follow this model.
4. **Composition APIs have converged on render props, not `asChild`.** Base UI has no `asChild`; it uses a `render` prop that accepts an element or a `(props, state) => element` function, plus `useRender` and `mergeProps` so your own components can expose the same API.\[6\]\[7\]\[8\] shadcn/ui made Base UI the default for new projects in July 2026, while keeping Radix supported ("Radix is not being deprecated").\[9\]
5. **Ports-and-adapters maps cleanly onto React context, provided ports stay narrow.** Cockburn's 2005 goal is to let an application "be developed and tested in isolation from its eventual run-time devices and databases."\[10\] In a component library, "devices and databases" means the router, the fetch layer, the auth/session client and storage. React's own docs list theming, current account and routing as the canonical context use cases, and they also warn: "Just because you need to pass some props several levels deep doesn't mean you should put that information into context."\[11\]
6. **Server state is a separate capability from app state.** TkDodo (TanStack Query maintainer) calls React Query "an async state manager" which "assumes that the frontend application doesn't 'own' the data," and advises you to "resist the urge to sync server data to a different state manager."\[12\] This settles the three-way split: local UI state, app state in Zustand/Jotai, server state in TanStack Query.

## Details

### 1. Capability-by-tier matrix

Legend: ● required/intrinsic · ◐ optional/occasional · ○ none. "Port" means the capability is injected through a typed interface, not implemented inside the component.

| Capability | Tier 0: Atoms (Label, Icon, Text) | Tier 1: Interactive atoms (Button, Link, Checkbox, Switch) | Tier 2: Molecules (TextField w/ validation, Select, Combobox, DatePicker, FormField) | Tier 3: Organisms (Dialog/Menu composites, Form section, Filter bar, Paginated list) | Tier 4: Macro bricks (Data-driven list, Editable data table w/ server sort/filter/paginate, routed composite) |
|---|---|---|---|---|---|
| Presentation/layout | ● | ● | ● | ● | ● |
| Config/theming/tokens | ● (tokens only) | ● | ● | ● | ● |
| Accessibility/behavior/state machine | ○ (semantics only, e.g. `htmlFor`) | ● (press, focus, keyboard) | ● (listbox, calendar, validation, field wiring) | ● (focus trap, roving focus, dismissal) | ● (grid keyboard nav, cell focus, edit mode machine) |
| Internal UI state | ○ | ◐ (toggle, pressed) | ● (open, selection, draft value, validation state) | ● | ● (sorting, filters, pagination, selection, editing cell, dirty rows) |
| Routing | ○ | ◐ (Link only, via RouterPort/RouterProvider) | ○ | ◐ (tabs/nav tied to URL) | ● (URL-synced sort/filter/page; row → detail route) |
| Data fetching (server state) | ○ | ○ | ◐ (async options for Combobox; behind a port) | ◐ (lists) | ● (query + mutation + optimistic update + invalidation) |
| App/shared state | ○ | ○ | ○ | ◐ (e.g. global filter context) | ◐ (saved views, column prefs) |
| Session/auth | ○ | ○ (permissions should arrive as `disabled`/`hidden` props, not session access) | ○ | ◐ | ● (can-edit per row/column, user-scoped views) |

Three points follow from the matrix:
- **Tiers 0–2 should never import a port.** At most they accept callbacks or async loaders as props (a Combobox `loadOptions`). That keeps them trivially testable and reusable in any app.
- **Tier 3 is the boundary.** It may *declare* an optional port but must work without one (controlled props fallback).
- **Tier 4 is where hexagonal pays for itself.** The only way a table that edits, paginates and syncs to the URL can stay business-logic-free is if the data, routing and session concerns arrive as adapters.

### 2. The approaches, evaluated

**A. Hexagonal / ports-and-adapters for UI**
- *What it is:* The component (the "inside") declares narrow, typed ports such as `DataPort<TRow, TQuery>`, `MutationPort<TRow>`, `RouterPort` and `SessionPort`. The app (the "outside") supplies adapters, through context providers or props, that are backed by TanStack Query, TanStack Router and your auth client. Cockburn's original article is explicit that the pattern is only inside vs outside, not layers.\[13\]
- *Graduated spread:* Excellent, as long as ports are opt-in per tier. Poor if every component must accept a universal adapter.
- *Pros:* best testability (mock adapters in Storybook and unit tests); swappable backends; strong type-safety, since ports are TypeScript interfaces; resolves principle 4 vs 5.
- *Cons:* highest conceptual overhead; easy to over-apply to leaves; context-based injection can cause wide re-renders if adapters are unstable objects (Nadia Makarevich: "every time the value prop on the Context provider changes, everyone who uses this Context will re-render").\[14\] There is also a risk of re-implementing TanStack Query behind an abstraction that adds nothing.
- *Principles:* 1 ● (shape), 2 ●, 3 ◐ (needs composition patterns too), 4 ● (structure), 5 ● (adapters hold the logic).

**B. Compound components + slots / render prop / `asChild`**
- *What it is:* A parent shares implicit state with its parts through context (`<Table.Root><Table.Header/>…`). Consumers substitute elements through slots or render props. Kent C. Dodds' compound-components article implements this with context.\[15\] React Aria Components exposes a context per component plus a `slots` mechanism so a parent can feed props to multiple same-type children.\[16\]\[17\]\[18\] Base UI's `render` prop merges the part's props onto your element, and per the Base UI composition handbook "the render element's value wins" for overlapping attributes while refs are all kept.\[6\]
- *Graduated spread:* Strong from Tier 2 upward; unnecessary for Tier 0–1. A Label needs no compound API.
- *Pros:* expressive, Lego-like; excellent extensibility; consumers control markup.
- *Cons:* implicit coupling through context; harder to type deeply; `asChild` (Radix Slot) clones a single child and merges props *implicitly*, which can hide prop/ref collisions and confuses multi-child cases (hence Radix's `Slottable`).\[19\]\[20\] Base UI's explicit render function is easier to type and debug.\[21\]
- *Principles:* 1 ◐, 2 ●, 3 ● (this *is* the composition mechanism), 4 ◐, 5 ●.

**C. Headless UI / behavior-as-hook**
- *What it is:* Logic and a11y live in hooks or unstyled primitives: React Aria hooks + React Stately, Base UI parts, TanStack Table's table instance, TanStack Virtual.
- *Graduated spread:* Natural. Hooks are inherently à la carte (`useButton` vs `useComboBox` + `useComboBoxState` vs `useTable` with explicitly registered `tableFeatures`). TanStack Table v9 makes the graduation explicit: you register only the features you use, "keep[ing] bundles small" and giving accurate types.\[22\]
- *Pros:* best a11y leverage; framework-agnostic cores; good type inference; trivially testable via `renderHook`; works with React Compiler (Table v9 is described by TanStack as following "React's rules" and playing "well with the Compiler").\[23\]
- *Cons:* you own all markup and styling, so this needs a design-system layer; there is a learning curve (React Aria's hook API is low-level; TanStack Table's row-model pipeline is non-trivial); mixing Base UI and React Aria in one tree is a known hazard because their field/form contexts don't cross the boundary.\[24\]
- *Principles:* 1 ●, 2 ●, 3 ◐, 4 ◐ (behavior/state only), 5 ●.

**D. Container/Presentational**
- *What it is:* Smart components fetch and hold state; dumb components render.
- *Status:* Abramov withdrew it as a recommendation in 2019 because hooks provide the separation "without an arbitrary division"; he had seen it "enforced without any necessity and with almost dogmatic fervor."\[3\]
- *Where it survives:* As the *app-side adapter wiring* for Tier 4. A thin "feature container" (e.g. `OrdersTable` in the app) composes the business-free `DataTable` brick with adapters. Do not mandate it per component.
- *Principles:* 1 ○ (it is a split, not a uniform shape), 2 ●, 3 ◐, 4 ○ (it splits self-containment apart), 5 ● for presentational halves only.

**E. Inversion of Control (state reducers, control props, prop getters)**
- *What it is:* Kent C. Dodds' IoC lets the consumer override internal decisions: `stateReducer` ("hook calls dev's code for further changes 👈 this is the inversion of control part"), controlled props, and prop getters. Downshift is the canonical example.\[25\]
- *Graduated spread:* A targeted tool, valuable at Tier 2–4 (e.g. override how the table's edit machine reacts to Escape, or block selection of locked rows). Dodds himself warns that adding IoC for a single use case "would just make the code more complicated."\[26\]
- *Pros:* maximal flexibility with no forking; keeps business rules outside the brick (the consumer's reducer holds the rule).
- *Cons:* API surface grows; reducers are hard to type exhaustively; can become a back door for business logic if not governed.
- *Principles:* supports 5 strongly (rules injected), 4 ◐.

**F. Render props / function-as-child**
- *What it is:* Behavior is passed to the consumer's render function. It was largely replaced by hooks for logic sharing (Dodds: "we don't need them as often anymore"),\[26\] but it has **returned as the element-substitution API** in Base UI (`render={(props, state) => …}`) and React Aria Components (render-prop children and className functions with state).
- *Verdict:* Use it for presentation substitution and cell renderers (TanStack Table column `cell` functions), not for logic injection.

**G. Atomic Design as taxonomy**
- *What it is:* Brad Frost's atoms → molecules → organisms → templates → pages. Organisms are "relatively complex UI components composed of groups of molecules and/or atoms and/or other organisms."\[27\] Frost stresses it is "not a linear process" but a mental model.\[28\]
- *Mapping:* atoms ≈ Tier 0–1, molecules ≈ Tier 2, organisms ≈ Tier 3–4, templates/pages = app (adapter wiring + routes). It is a *naming and governance* taxonomy, not an architecture. It says nothing about state, data or a11y, so pair it with the capability matrix rather than treating it as the architecture.
- *Risk:* teams over-debate classification ("is a FormField a molecule or an organism?"). Classify by **capability set**, not visual size.

**Summary scoring** (1 = poor, 5 = excellent)

| Approach | Complexity (5 = low) | Scalability | Learning curve (5 = easy) | Flexibility | Extensibility | Type-safety | Testability | Graduated-spread fit |
|---|---|---|---|---|---|---|---|---|
| Hexagonal ports (opt-in) | 2 | 5 | 2 | 4 | 5 | 5 | 5 | 5 (if opt-in) / 1 (if universal) |
| Compound + slots/render | 3 | 4 | 3 | 5 | 5 | 3 | 4 | 4 |
| Headless hooks/primitives | 3 | 5 | 3 | 5 | 4 | 4 | 5 | 5 |
| Container/Presentational | 4 | 2 | 5 | 2 | 2 | 3 | 4 | 2 |
| IoC (reducers/getters) | 2 | 4 | 2 | 5 | 5 | 3 | 4 | 3 (targeted) |
| Render props | 3 | 3 | 3 | 5 | 4 | 4 | 4 | 3 |
| Atomic Design | 5 | 3 | 5 | n/a | n/a | n/a | n/a | 2 (taxonomy only) |

These scores are my synthesis of the sources above, not measured data.

### 3. Recommended architecture: "Headless core, optional ports, composable parts, tokenized skin"

**The single template every component follows (principle 1):**

```
components/<name>/
  <name>.behavior.ts   // L1: headless hook or primitive wrapper (Base UI / React Aria / TanStack). May be empty.
  <name>.ports.ts      // L2: typed port interfaces + context hooks. EMPTY for Tier 0–2. Opt-in for 3–4.
  <name>.parts.tsx     // L3: compound parts, render-prop/useRender substitution points.
  <name>.styles.ts     // L4: token-driven variants (CSS vars / Tailwind classes). No raw values.
  index.ts             // public API
```

Consistency is enforced by lint rules (Tier 0–2 packages may not import `@platform/ports`) and by Storybook conventions, not by giving every component the same props.

**Layer by layer:**
- **L1 Behavior/state.** Choose **one** primitive family per app. Default to Base UI, which shipped stable v1.0.0 on Dec 11, 2025 (base-ui.com release notes: "The package name has changed from @base-ui-components/react to @base-ui/react"); shadcn's July 2026 changelog cited "6M+ weekly downloads," but npm now shows 22,331,365 weekly downloads for `@base-ui/react` (v1.9.0), and the Base UI and Radix work comes from the same team. Choose React Aria Components if your enterprise weighting favors its i18n (dates, numbers, RTL), the documented hooks escape hatch, and per-component contexts for building custom compositional APIs.\[16\]\[29\]\[30\]\[31\] Macro grids use TanStack Table v9 (headless; features registered explicitly) + TanStack Virtual. Do not mix Base UI and React Aria inside the same field or form composite.
- **L2 Ports (Tier 3–4 only).** Narrow and per-concern, for example:
  - `RowSourcePort<TRow, TQuery> { useRows(query): { rows, rowCount, status } }`
  - `RowMutationPort<TRow> { useUpdateRow(): { mutate(id, patch), pendingIds } }`
  - `NavigationPort { navigate(to, opts?); useHref(to) }`
  - `PermissionPort { can(action, resource): boolean }`
  - `ViewStatePort { load(key); save(key, state) }`

  React Aria's `RouterProvider` is a production example of this exact shape. It "accepts a navigate function from a framework or client side router, and provides it to all nested React Aria links," with an optional `useHref`, and a `RouterConfig` TypeScript module augmentation makes router options type-safe.\[32\]\[33\] Note that React Aria's newest docs also show a per-link `render` prop that delegates to the router's own link component, so treat RouterProvider as the established method and `render` as the emerging one.\[34\]
- **L3 Parts/composition.** Compound parts (`DataTable.Root/Toolbar/Header/Body/Cell/Pagination`). Substitution goes through Base UI-style `render` props implemented with `useRender` + `mergeProps`, so your bricks expose the same composition contract as the primitives beneath them. Prefer `render` over `asChild` for new code.
- **L4 Presentation/config.** Tokens authored in **DTCG 2025.10** (first stable spec, Oct 28, 2025, which adds theming/multi-brand and modern color spaces).\[35\] Built with **Style Dictionary v5** (`css/variables` with `outputReferences` so aliases remain `var()` references).\[36\]\[37\] Mapped into **Tailwind v4 `@theme inline`** so utilities resolve to tokens.\[37\] Theme switching is a CSS-variable swap, not a React context, so it costs zero re-renders.

**State placement rule (applies at every tier):**
- Local UI state lives in L1 (hook or primitive).
- Server state lives *only* in TanStack Query, reached through a port adapter. Never copied into Zustand.
- App state lives in Zustand/Jotai, and only when multiple distant features share it (saved views, global filters). It is exposed to bricks through a port, never imported directly.

**Instantiation 1: Button (Tier 1)**
- L1: Base UI `Button` (or React Aria `useButton`), giving press/focus/keyboard/disabled semantics.
- L2: **empty.** No session or permission access. Authorization arrives as `disabled`/`hidden` props computed by the app.
- L3: `render` prop so it can render as a router link: `<Button render={<AppLink to="/orders" />}>`. The link adapter lives in the app, not in the Button.
- L4: `variant`/`size` mapped to token-backed classes.
- Contract surface: about 6 props. Testable with zero providers.

**Instantiation 2: Editable data table (Tier 4)**
- L1: TanStack Table v9 with `manualSorting/manualFiltering/manualPagination` and `rowCount` from the server. TanStack's docs say `manualPagination` makes the table "assume that the data that you pass in is already paginated."\[38\] Add a local edit-mode state machine (idle → editing(cell) → saving → error), keyboard grid navigation, and TanStack Virtual for large pages. Table state slices that must leave the component (sort/filter/page) are exposed as controlled state or v9 external atoms, so they can become query keys and URL params.\[39\]
- L2: `RowSourcePort`, `RowMutationPort`, `NavigationPort` (URL sync, row → detail), `PermissionPort` (cell editability), optional `ViewStatePort`.
- App-side adapters (business logic lives *here*): `useRows` wraps `useQuery({ queryKey: ['orders', query], placeholderData: keepPreviousData })`. `useUpdateRow` wraps `useMutation` with optimistic updates. TanStack Query documents two approaches: updating UI from the mutation's returned `variables`, which is simpler when the result shows in one place, or writing the cache in `onMutate` with snapshot and rollback, which is better when "multiple places on the screen" need it.\[40\] A table plus a detail panel usually calls for the cache approach. `NavigationPort` is backed by TanStack Router `navigate`/search params, and `PermissionPort` by the auth client.
- L3: compound parts; column `cell`/`editCell` render functions; `Toolbar` slot for app-specific actions.
- L4: same tokens as Button. Density/theme via CSS variables.
- Testing: Storybook and unit tests with in-memory adapters, plus contract tests that every real adapter satisfies the port.

Button and table share **the same four-layer shape**; they differ only in which layers are populated. That is the graduated-capability requirement satisfied without a lowest-common-denominator contract.

**How principle 4 vs 5 is resolved, precisely:** "Self-contained" means the brick owns its *behavior, UI state, composition and presentation*, and *declares* everything else it needs as typed ports with sensible defaults or controlled fallbacks. "No business logic" means validation rules, permission rules, API shapes, pricing, workflow and navigation targets live in adapters, reducers (IoC) and column definitions supplied by the feature. Only the feature layer (an Atomic Design "template/page") is allowed to know about `orders` or `invoices`.

### 4. React 19, React Compiler and RSC implications

- **React Compiler 1.0** (stable Oct 7, 2025; works with React 17+) auto-memoizes components and hooks.\[41\]\[42\] It reduces the cost of context-provided adapters but does not remove the "all consumers re-render on value change" property of context. Keep adapter objects stable and split providers per port.\[14\] Its lint rules enforce the Rules of React, which headless hooks already follow.\[43\]
- **React 19** makes `ref` a regular prop, which simplifies L3 parts (no `forwardRef`). Base UI's render prop keeps all refs when merging.\[6\]
- **RSC:** Out of scope for this auth-gated SPA. Base UI and React Aria interactive parts are client components anyway. Container/Presentational patterns re-emerge under RSC (server "containers"),\[44\] so if you later adopt SSR or RSC, the port boundary is where server-fetched data would enter. The architecture does not need to change.

## Recommendations

1. **Ratify the four-layer template and the capability matrix as the Phase 2 standard.** Make tier membership a documented property of each component (e.g. in its Storybook metadata), classified by capability set rather than Atomic Design visual size.
2. **Pick one primitive family.** Default to Base UI (with shadcn/ui as the copy-in starting point). Choose React Aria Components instead if i18n/date-heavy enterprise forms dominate. Revisit only at a major version boundary.
3. **Ship a `@platform/ports` package** with narrow, per-concern interfaces and in-memory test adapters. Lint so Tier 0–2 cannot import it.
4. **Ship a `@platform/adapters` package** owned by the app/platform team: TanStack Query hooks, TanStack Router navigation, auth/permission clients, view-state persistence. This is the only place business rules may live outside feature code.
5. **Standardize composition on `render`/`useRender`/`mergeProps`**; avoid introducing new `asChild` APIs.
6. **Stand up the token pipeline first** (DTCG 2025.10 → Style Dictionary v5 → CSS vars → Tailwind `@theme inline`), because every tier depends on it and it is the cheapest layer to get right.
7. **Pilot with two components end-to-end:** Button (Tier 1) and an editable server-driven DataTable (Tier 4). If the same template serves both without leaking ports into Button, the architecture is validated.
8. **Enable React Compiler 1.0 and its ESLint rules from day one**, and use TanStack Table v9 (Compiler-compatible) rather than v8.

## Anti-patterns to avoid

- **God adapter.** One `AppAdapter` with data + session + routing + i18n + feature flags. Every brick then depends on everything, tests need the whole world, and any change re-renders every consumer. Use one port per concern, one provider per port.
- **Context soup.** Twenty nested providers, each with unstable object values. Memoize provider values (or rely on Compiler), split fast-changing state from stable functions, and prefer CSS variables for theming.\[14\] React's docs say to try props or `children` before context.\[11\]
- **Premature ports on leaves.** A Button that reads session to decide visibility, or a Select that fetches its own options from a hardcoded endpoint. Pass `disabled`, `options` or `loadOptions` instead.
- **Over-abstracting simple components.** Giving a Label a behavior hook, a ports file and a compound API "for consistency." Consistency is the template, and empty layers are allowed.
- **Prop-drilling through macro bricks.** Threading `navigate`, `user`, `queryClient` through ten levels of table parts. This is exactly what ports + context are for, at Tier 3–4 only.
- **Copying server state into app state.** Syncing TanStack Query results into Zustand loses background refetching and cache correctness. TkDodo explicitly warns against it.\[45\]\[46\]
- **Business logic smuggled through IoC.** A `stateReducer` or column definition that grows into a workflow engine inside the design-system package. Reducers belong to the feature, not the library.
- **Mixed primitive families in one composite.** Base UI fields and React Aria fields don't share field/form context.\[24\]
- **Implicit `asChild` collisions.** Slot merges props silently, and child props win for most attributes.\[47\] Prefer explicit `render` functions where the precedence matters.

## Caveats

- Version currency moves fast. Base UI's own release notes confirm "v1.8.0 release notes. Sep 4, 2026," but 1.8.0 is no longer current: npm lists `@base-ui/react` 1.9.0 as latest (released Oct 9, 2026, per Untitled UI's comparison article). The "2-to-1" shadcn/create pick ratio comes from shadcn's July 2026 changelog.
- React Aria's routing guidance is changing. The RouterProvider quotes come from Adobe-hosted versioned docs (2023 introduction, later `useHref` addition). Current docs promote a per-component `render` prop and `onAction` for collections.\[34\]\[48\] Verify against the version you install.
- Style Dictionary's DTCG docs state verbatim: "the latest format 2025.10 does not have full support yet in Style Dictionary This is a work in progress in v5." The changelog shows 2025.10 structured color support in 5.3.0 and dimension object values in 5.4.0, while GitHub issue #1590 still marks Gradient and Duration as in progress, with Resolvers pending. Pin versions and add token lint tests.\[49\]
- DTCG 2025.10 is not a W3C Recommendation and is not on the Standards Track. On Oct 28, 2025 its Format, Color and Resolver modules were published as "Final Community Group Reports," and the Format module states: "This specification is considered stable."
- The scoring table and the capability matrix are analytical syntheses, not empirical benchmarks.
- Hexagonal architecture applied to individual UI components is an extrapolation of Cockburn's application-level pattern.\[50\]\[51\] The canonical sources describe application boundaries, and the component-scale use here is supported by analogous library designs (RouterProvider, TanStack Table manual mode, Juntao Qiu's layered React articles on martinfowler.com) rather than by a single authoritative "hexagonal components" reference.

## Sources

1. [react-spectrum.adobe.com](https://react-spectrum.adobe.com/architecture.html)
2. [Getting Started](https://reactspectrum.blob.core.windows.net/reactspectrum/c025734f9a02b6ed473e8f45c86d39d705eb52b2/docs/react-aria/getting-started.html)
3. [Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)
4. [Headless Component: a pattern for composing React UIs](https://www.martinfowler.com/articles/headless-component.html)
5. [Introduction](https://tanstack.com/table/latest/docs/introduction)
6. [Composition · Base UI](https://base-ui.com/react/handbook/composition)
7. [Base UI Rules for AI Coding Agents: render, Field, Popups](https://www.shadcn.io/prompts/base-ui)
8. [useRender · Base UI](https://base-ui.com/react/utils/use-render)
9. [July 2026 - Base UI as the Default - shadcn/ui](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
10. [Ports & Adapters Architecture. This post is part of The Software…](https://medium.com/the-software-architecture-chronicles/ports-adapters-architecture-d19f2d476eca)
11. [Passing Data Deeply with Context – React](https://react.dev/learn/passing-data-deeply-with-context)
12. [React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager)
13. [Hexagonal Architecture Explained](https://www.arhohuttunen.com/hexagonal-architecture/)
14. [Advanced React: deep dives, investigations, performance patterns and techniques - DOKUMEN.PUB](https://dokumen.pub/advanced-react-deep-dives-investigations-performance-patterns-and-techniques-n-2672370.html)
15. [React Hooks: Compound Components](https://kentcdodds.com/blog/compound-components-with-react-hooks)
16. [Advanced Customization](https://react-spectrum.adobe.com/react-aria/advanced.html)
17. [react-aria.adobe.com](https://react-aria.adobe.com/customization)
18. [Hooks](https://react-aria.adobe.com/hooks)
19. [Slot](https://www.radix-ui.com/primitives/docs/utilities/slot)
20. [React Slot/asChild Composition Pattern](https://boda.sh/blog/react-slot-aschild-pattern/)
21. [base-ui-react - Skill](https://smithery.ai/skills/jackspace/base-ui-react)
22. [Quick Start](https://tanstack.com/table/latest/docs/framework/vanilla/quick-start)
23. [TanStack Table V9: Taking Form](https://tanstack.com/blog/tanstack-table-v9-taking-form)
24. [Untitled UI React vs. Base UI: Which Should You Use in 2026?](https://www.untitledui.com/blog/untitled-ui-vs-base-ui)
25. [The State Reducer Pattern with React Hooks](https://kentcdodds.com/blog/the-state-reducer-pattern-with-react-hooks)
26. [Inversion of Control](https://kentcdodds.com/blog/inversion-of-control)
27. [Atomic Design Methodology](https://atomicdesign.bradfrost.com/chapter-2/)
28. [Atomic Design Brad Frost](https://www.softouch.on.ca/kb/data/Atomic%20Design.pdf)
29. [Advanced Customization](https://reactspectrum.blob.core.windows.net/reactspectrum/e37224fec9f7a7327b1fa2288a33f0a95ee5d9ff/docs/react-aria/advanced.html)
30. [React Aria Components - smashing.tools](https://smashing.tools/ui-component/react-aria-components)
31. [Building a custom compositional API with React Aria - LogRocket Blog](https://blog.logrocket.com/custom-compositional-api-react-aria/)
32. [Tabs](https://react-spectrum.adobe.com/react-spectrum/Tabs.html)
33. [Client Side Routing](https://react-spectrum.adobe.com/v3/routing.html)
34. [Link | React Aria](https://react-spectrum.adobe.com/react-aria/Link.html)
35. [Design Tokens specification reaches first stable version](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
36. [Formats](https://styledictionary.com/reference/hooks/formats/)
37. [Design tokens: what they are and how they get into code · Modeinspect](https://modeinspect.com/blog/design-tokens)
38. [Pagination (React) Guide](https://tanstack.com/table/latest/docs/framework/react/guide/pagination)
39. [Pagination (Solid) Guide](https://tanstack.com/table/latest/docs/framework/solid/guide/pagination)
40. [Optimistic Updates](https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates)
41. [React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1)
42. [React 19: What's New for Developers \[2026\]](https://scrimba.com/articles/react-19-whats-new-for-developers/)
43. [Introducing React Compiler 1.0. The React team is thrilled to announce…](https://medium.com/@onix_react/introducing-react-compiler-1-0-3a15141ac6ae)
44. [DEV Community](https://dev.to/fibonacid/rsc-and-the-echo-of-presentational-and-container-components-33i)
45. [What is the pattern to keep client-state in sync with server-state · TanStack/query · Discussion #3539 · GitHub](https://github.com/TanStack/query/discussions/3539)
46. [practical react query 8lg](https://dev.to/tkdodo/practical-react-query-8lg?comments_sort=latest)
47. [Composability - Radix UI Primitives](https://radix-ui-primitives.mintlify.app/concepts/composability)
48. [GridList](https://react-spectrum.adobe.com/react-aria/GridList.html)
49. [Migrate the token pipeline to DTCG and Style Dictionary 5 · Issue #24 · common-origin/common-origin-design-system · GitHub](https://github.com/common-origin/common-origin-design-system/issues/24)
50. [Hexagonal architecture (software)](<https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)>)
51. [Modularizing React Applications with Established UI Patterns](https://www.martinfowler.com/articles/modularizing-react-apps.html)
