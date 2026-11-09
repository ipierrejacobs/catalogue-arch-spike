/**
 * L2 — DataTable Capability Ports & Per-Concern Context Hooks (`@platform/ui`)
 *
 * Tier 4 (Macro Brick): declares five narrow, per-concern capability ports:
 * 1. `RowSourcePort<TRow, TQuery>`   — server/external row query (`useRows(query)`)
 * 2. `RowMutationPort<TRow, TPatch>` — optimistic row mutation (`useUpdateRow()`)
 * 3. `NavigationPort`                — URL sync & row->detail navigation (`navigate`, `useHref`)
 * 4. `PermissionPort`                — row/column editability (`can(action, resource)`)
 * 5. `ViewStatePort<TState>`         — optional selection / bulk-mode persistence (`load`, `save`)
 *
 * ARCHITECTURAL RULE:
 * - ONE provider per port, ONE context per port. Never a god-adapter.
 * - Adapter objects passed into providers are kept stable to prevent context re-renders.
 */

import type {
	DataTableFilterParam,
	DataTableQuery,
	DataTableSortParam,
	DataTableViewState,
	NavigationOptions,
	NavigationPort,
	PermissionPort,
	PermissionResource,
	RowMutationHandle,
	RowMutationPort,
	RowSourcePort,
	RowSourceResult,
	RowSourceStatus,
	ViewStatePort,
} from "@platform/ports";
import * as React from "react";

export type {
	DataTableFilterParam,
	DataTableQuery,
	DataTableSortParam,
	DataTableViewState,
	NavigationOptions,
	NavigationPort,
	PermissionPort,
	PermissionResource,
	RowMutationHandle,
	RowMutationPort,
	RowSourcePort,
	RowSourceResult,
	RowSourceStatus,
	ViewStatePort,
};

/* ==========================================================================
   1. RowSourcePort Context + Provider + Hook
   ========================================================================== */

const RowSourcePortContext = React.createContext<RowSourcePort<
	unknown,
	unknown
> | null>(null);

export interface RowSourcePortProviderProps<
	TRow = unknown,
	TQuery = DataTableQuery,
> {
	readonly adapter: RowSourcePort<TRow, TQuery>;
	readonly children: React.ReactNode;
}

export function RowSourcePortProvider<TRow = unknown, TQuery = DataTableQuery>({
	adapter,
	children,
}: RowSourcePortProviderProps<TRow, TQuery>): React.ReactElement {
	return React.createElement(
		RowSourcePortContext.Provider,
		{ value: adapter as unknown as RowSourcePort<unknown, unknown> },
		children,
	);
}

export function useRowSourcePort<
	TRow = unknown,
	TQuery = DataTableQuery,
>(): RowSourcePort<TRow, TQuery> {
	const ctx = React.useContext(RowSourcePortContext);
	if (!ctx) {
		throw new Error(
			"useRowSourcePort must be used within a <RowSourcePortProvider>.",
		);
	}
	return ctx as unknown as RowSourcePort<TRow, TQuery>;
}

export function useRowSource<
	TRow = unknown,
	TQuery = DataTableQuery,
>(query: TQuery): RowSourceResult<TRow> {
	const port = useRowSourcePort<TRow, TQuery>();
	return Reflect.apply(port.useRows, port, [query]) as RowSourceResult<TRow>;
}

/* ==========================================================================
   2. RowMutationPort Context + Provider + Hook
   ========================================================================== */

const RowMutationPortContext = React.createContext<RowMutationPort<
	unknown,
	unknown
> | null>(null);

export interface RowMutationPortProviderProps<
	TRow = unknown,
	TPatch = Partial<TRow>,
> {
	readonly adapter: RowMutationPort<TRow, TPatch>;
	readonly children: React.ReactNode;
}

export function RowMutationPortProvider<
	TRow = unknown,
	TPatch = Partial<TRow>,
>({
	adapter,
	children,
}: RowMutationPortProviderProps<TRow, TPatch>): React.ReactElement {
	return React.createElement(
		RowMutationPortContext.Provider,
		{ value: adapter as unknown as RowMutationPort<unknown, unknown> },
		children,
	);
}

export function useRowMutationPort<
	TRow = unknown,
	TPatch = Partial<TRow>,
>(): RowMutationPort<TRow, TPatch> {
	const ctx = React.useContext(RowMutationPortContext);
	if (!ctx) {
		throw new Error(
			"useRowMutationPort must be used within a <RowMutationPortProvider>.",
		);
	}
	return ctx as unknown as RowMutationPort<TRow, TPatch>;
}

export function useOptionalRowMutationPort<
	TRow = unknown,
	TPatch = Partial<TRow>,
>(): RowMutationPort<TRow, TPatch> | null {
	const ctx = React.useContext(RowMutationPortContext);
	return ctx as unknown as RowMutationPort<TRow, TPatch> | null;
}

const EMPTY_PENDING_SET: ReadonlySet<string> = new Set();

const FALLBACK_ROW_MUTATION_HANDLE: RowMutationHandle<unknown, unknown> = {
	mutate: async () => {
		throw new Error(
			"No RowMutationPortProvider is mounted for this DataTable",
		);
	},
	pendingIds: EMPTY_PENDING_SET,
};

export function useOptionalRowMutation<
	TRow = unknown,
	TPatch = Partial<TRow>,
>(): RowMutationHandle<TRow, TPatch> {
	const port = useOptionalRowMutationPort<TRow, TPatch>();
	if (!port) {
		return FALLBACK_ROW_MUTATION_HANDLE as unknown as RowMutationHandle<
			TRow,
			TPatch
		>;
	}
	return Reflect.apply(
		port.useUpdateRow,
		port,
		[],
	) as RowMutationHandle<TRow, TPatch>;
}

/* ==========================================================================
   3. NavigationPort Context + Provider + Hook
   ========================================================================== */

const NavigationPortContext = React.createContext<NavigationPort | null>(null);

export interface NavigationPortProviderProps {
	readonly adapter: NavigationPort;
	readonly children: React.ReactNode;
}

export function NavigationPortProvider({
	adapter,
	children,
}: NavigationPortProviderProps): React.ReactElement {
	return React.createElement(
		NavigationPortContext.Provider,
		{ value: adapter },
		children,
	);
}

export function useNavigationPort(): NavigationPort {
	const ctx = React.useContext(NavigationPortContext);
	if (!ctx) {
		throw new Error(
			"useNavigationPort must be used within a <NavigationPortProvider>.",
		);
	}
	return ctx;
}

export function useOptionalNavigationPort(): NavigationPort | null {
	return React.useContext(NavigationPortContext);
}

export function useNavigationHref(to: string): string {
	const port = useOptionalNavigationPort();
	if (!port) {
		return to;
	}
	return Reflect.apply(port.useHref, port, [to]) as string;
}

/* ==========================================================================
   4. PermissionPort Context + Provider + Hook
   ========================================================================== */

const PermissionPortContext = React.createContext<PermissionPort | null>(null);

export interface PermissionPortProviderProps {
	readonly adapter: PermissionPort;
	readonly children: React.ReactNode;
}

export function PermissionPortProvider({
	adapter,
	children,
}: PermissionPortProviderProps): React.ReactElement {
	return React.createElement(
		PermissionPortContext.Provider,
		{ value: adapter },
		children,
	);
}

export function usePermissionPort(): PermissionPort {
	const ctx = React.useContext(PermissionPortContext);
	if (!ctx) {
		throw new Error(
			"usePermissionPort must be used within a <PermissionPortProvider>.",
		);
	}
	return ctx;
}

export function useOptionalPermissionPort(): PermissionPort | null {
	return React.useContext(PermissionPortContext);
}

/* ==========================================================================
   5. ViewStatePort Context + Provider + Hook (Optional by design)
   ========================================================================== */

const ViewStatePortContext = React.createContext<ViewStatePort<unknown> | null>(
	null,
);

export interface ViewStatePortProviderProps<TState = DataTableViewState> {
	readonly adapter: ViewStatePort<TState>;
	readonly children: React.ReactNode;
}

export function ViewStatePortProvider<TState = DataTableViewState>({
	adapter,
	children,
}: ViewStatePortProviderProps<TState>): React.ReactElement {
	return React.createElement(
		ViewStatePortContext.Provider,
		{ value: adapter as unknown as ViewStatePort<unknown> },
		children,
	);
}

/**
 * `ViewStatePort` is optional: returns `null` when no `<ViewStatePortProvider>` is mounted.
 */
export function useViewStatePort<
	TState = DataTableViewState,
>(): ViewStatePort<TState> | null {
	const ctx = React.useContext(ViewStatePortContext);
	return ctx as unknown as ViewStatePort<TState> | null;
}
