/**
 * @platform/ports — Narrow, per-concern capability port interfaces,
 * in-memory test/Storybook adapters, and reusable port contract verifiers.
 *
 * ARCHITECTURAL LAW:
 * - Only Tier 3–4 components in `@platform/ui` may import from `@platform/ports`.
 * - Tier 0–2 leaf/molecule components are structurally forbidden by lint
 *   (`platform-arch/no-ports-in-leaf-tiers`) from importing `@platform/ports`.
 * - One port per concern, one provider per port (never a god-adapter).
 */

import * as React from "react";

export const PORTS_MINIMUM_TIER = 3 as const;

export type PortConcern =
	| "row-source"
	| "row-mutation"
	| "navigation"
	| "permission"
	| "view-state";

export interface PortContractDescriptor<
	TConcern extends PortConcern = PortConcern,
> {
	readonly concern: TConcern;
	readonly minTier: typeof PORTS_MINIMUM_TIER;
}

/* ==========================================================================
   1. RowSourcePort<TRow, TQuery>
   ========================================================================== */

export type RowSourceStatus = "loading" | "success" | "error";

export interface DataTableSortParam {
	readonly id: string;
	readonly desc: boolean;
}

export interface DataTableFilterParam {
	readonly id: string;
	readonly value: unknown;
}

export interface DataTableQuery {
	readonly sorting?: readonly DataTableSortParam[] | undefined;
	readonly columnFilters?: readonly DataTableFilterParam[] | undefined;
	readonly globalFilter?: string | undefined;
	readonly pageIndex: number;
	readonly pageSize: number;
}

export interface RowSourceResult<TRow> {
	readonly rows: readonly TRow[];
	readonly rowCount: number;
	readonly status: RowSourceStatus;
	readonly error?: string | null | undefined;
	readonly isPlaceholderData?: boolean | undefined;
}

export interface RowSourcePort<TRow = unknown, TQuery = DataTableQuery> {
	useRows(query: TQuery): RowSourceResult<TRow>;
}

/* ==========================================================================
   2. RowMutationPort<TRow, TPatch>
   ========================================================================== */

export interface RowMutationHandle<TRow = unknown, TPatch = Partial<TRow>> {
	mutate(id: string, patch: TPatch): Promise<TRow>;
	readonly pendingIds: ReadonlySet<string>;
	readonly errorsById?: Readonly<Record<string, string>> | undefined;
}

export interface RowMutationPort<TRow = unknown, TPatch = Partial<TRow>> {
	useUpdateRow(): RowMutationHandle<TRow, TPatch>;
}

/* ==========================================================================
   3. NavigationPort
   ========================================================================== */

export interface NavigationOptions {
	readonly replace?: boolean | undefined;
	readonly search?: Record<string, unknown> | undefined;
}

export interface NavigationPort {
	navigate(to: string, opts?: NavigationOptions): void;
	useHref(to: string): string;
}

/* ==========================================================================
   4. PermissionPort
   ========================================================================== */

export interface PermissionResource {
	readonly type: string;
	readonly id?: string | undefined;
	readonly field?: string | undefined;
	readonly meta?: Record<string, unknown> | undefined;
}

export interface PermissionPort {
	can(action: string, resource: string | PermissionResource): boolean;
}

/* ==========================================================================
   5. ViewStatePort<TState> (optional)
   ========================================================================== */

export interface DataTableViewState {
	readonly rowSelection: Readonly<Record<string, boolean>>;
	readonly bulkMode: boolean;
	readonly columnVisibility?: Readonly<Record<string, boolean>> | undefined;
}

export interface ViewStatePort<TState = DataTableViewState> {
	load(key: string): TState | undefined;
	save(key: string, state: TState): void;
	subscribe?(key: string, listener: () => void): () => void;
}

/* ==========================================================================
   IN-MEMORY ADAPTERS (for Stage 2 isolation, Storybook, and unit tests)
   ========================================================================== */

export interface InMemoryRowStore<TRow extends { readonly id: string }> {
	getRows(): readonly TRow[];
	setRows(next: readonly TRow[]): void;
	getRow(id: string): TRow | undefined;
	updateRow(id: string, patch: Partial<TRow>): TRow;
	subscribe(listener: () => void): () => void;
}

/**
 * Shared in-memory reactive row store so `createInMemoryRowSourceAdapter` and
 * `createInMemoryRowMutationAdapter` operate on the same in-memory dataset
 * (enabling optimistic update + rollback in isolation without TanStack Query).
 */
export function createInMemoryRowStore<TRow extends { readonly id: string }>(
	initialRows: readonly TRow[],
): InMemoryRowStore<TRow> {
	let currentRows: readonly TRow[] = [...initialRows];
	const listeners = new Set<() => void>();

	const notify = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	return {
		getRows: () => currentRows,
		setRows(next) {
			currentRows = [...next];
			notify();
		},
		getRow(id) {
			return currentRows.find((r) => r.id === id);
		},
		updateRow(id, patch) {
			let updated: TRow | undefined;
			currentRows = currentRows.map((row) => {
				if (row.id !== id) return row;
				updated = { ...row, ...patch };
				return updated;
			});
			if (!updated) {
				throw new Error(`Row "${id}" not found in in-memory store`);
			}
			notify();
			return updated;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

export interface InMemoryRowSourceOptions<
	TRow extends { readonly id: string },
	TQuery extends DataTableQuery = DataTableQuery,
> {
	readonly store?: InMemoryRowStore<TRow> | undefined;
	readonly initialRows?: readonly TRow[] | undefined;
	readonly status?: RowSourceStatus | undefined;
	readonly error?: string | null | undefined;
	readonly filterRow?: ((row: TRow, query: TQuery) => boolean) | undefined;
	readonly compareRows?:
		| ((a: TRow, b: TRow, sort: DataTableSortParam) => number)
		| undefined;
}

function defaultFilterRow<TRow extends Record<string, unknown>>(
	row: TRow,
	query: DataTableQuery,
): boolean {
	if (query.columnFilters && query.columnFilters.length > 0) {
		for (const cf of query.columnFilters) {
			if (cf.value === undefined || cf.value === "") continue;
			const cellVal = row[cf.id];
			if (String(cellVal ?? "") !== String(cf.value)) {
				return false;
			}
		}
	}
	const q = query.globalFilter?.trim().toLowerCase();
	if (q) {
		return Object.values(row).some((val) =>
			String(val ?? "")
				.toLowerCase()
				.includes(q),
		);
	}
	return true;
}

function defaultCompareRows<TRow extends Record<string, unknown>>(
	a: TRow,
	b: TRow,
	sort: DataTableSortParam,
): number {
	const dir = sort.desc ? -1 : 1;
	const av = a[sort.id];
	const bv = b[sort.id];
	if (typeof av === "number" && typeof bv === "number") {
		return (av - bv) * dir;
	}
	return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
}

const EMPTY_IN_MEMORY_ROWS: readonly never[] = [];

export function createInMemoryRowSourceAdapter<
	TRow extends { readonly id: string },
	TQuery extends DataTableQuery = DataTableQuery,
>(
	options: InMemoryRowSourceOptions<TRow, TQuery>,
): RowSourcePort<TRow, TQuery> & { readonly store: InMemoryRowStore<TRow> } {
	const store =
		options.store ?? createInMemoryRowStore<TRow>(options.initialRows ?? []);
	const status = options.status ?? "success";
	const error = options.error ?? null;

	return {
		store,
		useRows(query: TQuery): RowSourceResult<TRow> {
			const allRows = React.useSyncExternalStore(
				store.subscribe,
				store.getRows,
				store.getRows,
			);

			if (status === "loading") {
				return {
					rows: EMPTY_IN_MEMORY_ROWS as readonly TRow[],
					rowCount: 0,
					status: "loading",
					error: null,
				};
			}

			if (status === "error") {
				return {
					rows: EMPTY_IN_MEMORY_ROWS as readonly TRow[],
					rowCount: 0,
					status: "error",
					error: error ?? "Failed to load rows",
				};
			}

			const filterPred =
				options.filterRow ??
				(defaultFilterRow as unknown as (row: TRow, q: TQuery) => boolean);
			const compareFn =
				options.compareRows ??
				(defaultCompareRows as unknown as (
					a: TRow,
					b: TRow,
					sort: DataTableSortParam,
				) => number);

			const filtered = allRows.filter((row) => filterPred(row, query));
			const primarySort = query.sorting?.[0];
			if (primarySort) {
				filtered.sort((a, b) => compareFn(a, b, primarySort));
			}

			const start = query.pageIndex * query.pageSize;
			const paged = filtered.slice(start, start + query.pageSize);

			return {
				rows: paged,
				rowCount: filtered.length,
				status: "success",
				error: null,
			};
		},
	};
}

export interface InMemoryRowMutationOptions<
	TRow extends { readonly id: string },
	TPatch = Partial<TRow>,
> {
	readonly store: InMemoryRowStore<TRow>;
	/**
	 * Simulated delay in milliseconds so `saving` state and `pendingIds`
	 * are observable during optimistic updates.
	 * @default 15
	 */
	readonly simulatedDelayMs?: number | undefined;
	/**
	 * Optional validator or failure injector. Throw an `Error` (or return a rejected Promise)
	 * to trigger optimistic rollback.
	 */
	readonly validateOrReject?:
		| ((id: string, patch: TPatch, currentRow: TRow) => Promise<void> | void)
		| undefined;
}

export function createInMemoryRowMutationAdapter<
	TRow extends { readonly id: string },
	TPatch = Partial<TRow>,
>(
	options: InMemoryRowMutationOptions<TRow, TPatch>,
): RowMutationPort<TRow, TPatch> {
	const { store, simulatedDelayMs = 15, validateOrReject } = options;
	let pendingIds = new Set<string>();
	let errorsById: Record<string, string> = {};
	const listeners = new Set<() => void>();

	const notify = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	};

	const getSnapshot = () => pendingIds;

	const mutate = async (id: string, patch: TPatch): Promise<TRow> => {
		const previousRows = store.getRows();
		const currentRow = store.getRow(id);
		if (!currentRow) {
			throw new Error(`Row "${id}" does not exist`);
		}

		// 1. Optimistic write into the shared row store + mark pending
		pendingIds = new Set(pendingIds).add(id);
		const nextErrors = { ...errorsById };
		delete nextErrors[id];
		errorsById = nextErrors;
		notify();

		const optimisticallyUpdated = store.updateRow(
			id,
			patch as unknown as Partial<TRow>,
		);

		try {
			if (simulatedDelayMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));
			}
			await validateOrReject?.(id, patch, currentRow);

			const afterPending = new Set(pendingIds);
			afterPending.delete(id);
			pendingIds = afterPending;
			notify();
			return optimisticallyUpdated;
		} catch (err) {
			// 2. Rollback to snapshot on failure
			store.setRows(previousRows);
			const afterPending = new Set(pendingIds);
			afterPending.delete(id);
			pendingIds = afterPending;
			const message = err instanceof Error ? err.message : "Mutation failed";
			errorsById = { ...errorsById, [id]: message };
			notify();
			throw err instanceof Error ? err : new Error(message);
		}
	};

	return {
		useUpdateRow(): RowMutationHandle<TRow, TPatch> {
			const currentPendingIds = React.useSyncExternalStore(
				subscribe,
				getSnapshot,
				getSnapshot,
			);
			return {
				mutate,
				pendingIds: currentPendingIds,
				errorsById,
			};
		},
	};
}

export interface NavigationRecord {
	readonly to: string;
	readonly opts?: NavigationOptions | undefined;
}

export function createInMemoryNavigationAdapter(options?: {
	readonly basePath?: string | undefined;
}): NavigationPort & { readonly history: NavigationRecord[] } {
	const history: NavigationRecord[] = [];
	const basePath = options?.basePath ?? "";

	return {
		history,
		navigate(to: string, opts?: NavigationOptions) {
			history.push({ to, opts });
		},
		useHref(to: string): string {
			if (!optsNeedsSearch(to) && basePath) {
				return `${basePath}${to}`;
			}
			return `${basePath}${to}`;
		},
	};
}

function optsNeedsSearch(to: string): boolean {
	return to.includes("?");
}

export function createInMemoryPermissionAdapter(
	policy:
		| boolean
		| ((action: string, resource: string | PermissionResource) => boolean) = true,
): PermissionPort {
	return {
		can(action: string, resource: string | PermissionResource): boolean {
			if (typeof policy === "boolean") {
				return policy;
			}
			return policy(action, resource);
		},
	};
}

export function createInMemoryViewStateAdapter<TState = DataTableViewState>(
	initialEntries?: Readonly<Record<string, TState>>,
): ViewStatePort<TState> & { readonly map: Map<string, TState> } {
	const map = new Map<string, TState>(
		initialEntries ? Object.entries(initialEntries) : [],
	);
	const keyListeners = new Map<string, Set<() => void>>();

	return {
		map,
		load(key: string): TState | undefined {
			return map.get(key);
		},
		save(key: string, state: TState): void {
			map.set(key, state);
			const listeners = keyListeners.get(key);
			if (listeners) {
				for (const listener of listeners) {
					listener();
				}
			}
		},
		subscribe(key: string, listener: () => void): () => void {
			let set = keyListeners.get(key);
			if (!set) {
				set = new Set();
				keyListeners.set(key, set);
			}
			set.add(listener);
			return () => {
				set?.delete(listener);
			};
		},
	};
}

/* ==========================================================================
   REUSABLE PORT CONTRACT ASSERTIONS (used in Stage 2 in-memory & Stage 3 real)
   ========================================================================== */

export interface PortHookRunnerResult<TValue> {
	readonly result: { readonly current: TValue };
}

export type PortHookRunner = <TValue>(
	callback: () => TValue,
) => PortHookRunnerResult<TValue>;

const VALID_ROW_SOURCE_STATUSES: ReadonlySet<RowSourceStatus> = new Set([
	"loading",
	"success",
	"error",
]);

/**
 * Verifies that a `RowSourcePort` implementation satisfies the port contract:
 * `useRows(query)` returns `{ rows, rowCount, status, error? }` matching the
 * status invariants (`loading` / `success` / `error`) and page-size bounds.
 */
export function assertRowSourcePortContract<
	TRow = unknown,
	TQuery extends DataTableQuery = DataTableQuery,
>(
	port: RowSourcePort<TRow, TQuery>,
	runHook: PortHookRunner,
	sampleQuery: TQuery = {
		pageIndex: 0,
		pageSize: 10,
	} as TQuery,
): RowSourceResult<TRow> {
	if (typeof port.useRows !== "function") {
		throw new Error(
			"RowSourcePort contract violation: useRows must be a function",
		);
	}
	const invokeRows = port.useRows.bind(port);
	const { result } = runHook(() => invokeRows(sampleQuery));
	const current = result.current;

	if (!current || typeof current !== "object") {
		throw new Error(
			"RowSourcePort contract violation: useRows() must return a result object",
		);
	}
	if (!Array.isArray(current.rows)) {
		throw new Error(
			"RowSourcePort contract violation: rows must be an array",
		);
	}
	if (
		typeof current.rowCount !== "number" ||
		Number.isNaN(current.rowCount) ||
		current.rowCount < 0
	) {
		throw new Error(
			"RowSourcePort contract violation: rowCount must be a non-negative number",
		);
	}
	if (!VALID_ROW_SOURCE_STATUSES.has(current.status)) {
		throw new Error(
			`RowSourcePort contract violation: invalid status "${String(current.status)}"`,
		);
	}
	if (current.status === "success") {
		if (current.rows.length > sampleQuery.pageSize) {
			throw new Error(
				"RowSourcePort contract violation: returned rows exceed requested pageSize",
			);
		}
		if (current.rowCount < current.rows.length) {
			throw new Error(
				"RowSourcePort contract violation: rowCount cannot be smaller than rows.length",
			);
		}
	}
	if (current.status === "error") {
		if (typeof current.error !== "string" || current.error.length === 0) {
			throw new Error(
				"RowSourcePort contract violation: error status must provide a non-empty error message",
			);
		}
	}
	return current;
}

export interface RowMutationContractOptions<
	TRow,
	TPatch = Partial<TRow>,
> {
	readonly runHook: PortHookRunner;
	readonly targetId?: string | undefined;
	readonly validPatch: TPatch;
	readonly invalidPatch?: TPatch | undefined;
	readonly readRow?: ((id: string) => TRow | undefined) | undefined;
	readonly act?: (<T>(fn: () => T | Promise<T>) => Promise<T>) | undefined;
}

export interface RowMutationContractReport<TRow> {
	readonly updatedRow: TRow;
	readonly optimisticObservedDuringFlight: boolean;
	readonly pendingObservedDuringFlight: boolean;
	readonly rolledBackAfterFailure: boolean;
	readonly rejectionError: Error | null;
}

/**
 * Verifies that a `RowMutationPort` implementation satisfies the port contract:
 * 1. `useUpdateRow()` returns `{ mutate, pendingIds }`.
 * 2. Optimistic update is observable in-flight and `pendingIds.has(targetId)` is `true` while pending.
 * 3. On resolution, `pendingIds.has(targetId)` returns to `false` and the updated row is returned.
 * 4. When `invalidPatch` is provided, the mutation rejects, `pendingIds.has(targetId)` returns to `false`,
 *    and the row rolls back to its pre-failure snapshot.
 */
export async function assertRowMutationPortContract<
	TRow = unknown,
	TPatch = Partial<TRow>,
>(
	port: RowMutationPort<TRow, TPatch>,
	options: RowMutationContractOptions<TRow, TPatch>,
): Promise<RowMutationContractReport<TRow>> {
	if (typeof port.useUpdateRow !== "function") {
		throw new Error(
			"RowMutationPort contract violation: useUpdateRow must be a function",
		);
	}
	const {
		runHook,
		targetId = "item-1",
		validPatch,
		invalidPatch,
		readRow,
		act: runInAct = async <T>(fn: () => T | Promise<T>): Promise<T> =>
			await fn(),
	} = options;

	const invokeUpdateRow = port.useUpdateRow.bind(port);
	const { result } = runHook(() => invokeUpdateRow());

	if (typeof result.current?.mutate !== "function") {
		throw new Error(
			"RowMutationPort contract violation: useUpdateRow().mutate must be a function",
		);
	}
	if (typeof result.current?.pendingIds?.has !== "function") {
		throw new Error(
			"RowMutationPort contract violation: useUpdateRow().pendingIds must be a ReadonlySet",
		);
	}

	const initialSnapshot = readRow?.(targetId);

	// 1. Optimistic success lifecycle
	let inFlightPromise!: Promise<TRow>;
	await runInAct(() => {
		inFlightPromise = result.current.mutate(targetId, validPatch);
	});

	const pendingObservedDuringFlight = result.current.pendingIds.has(targetId);
	if (!pendingObservedDuringFlight) {
		throw new Error(
			`RowMutationPort contract violation: pendingIds did not contain "${targetId}" while mutation was in flight`,
		);
	}

	const inFlightRow = readRow?.(targetId);
	const optimisticObservedDuringFlight =
		readRow === undefined
			? true
			: JSON.stringify(inFlightRow) !== JSON.stringify(initialSnapshot);
	if (!optimisticObservedDuringFlight) {
		throw new Error(
			`RowMutationPort contract violation: row "${targetId}" was not optimistically updated while in flight`,
		);
	}

	const updatedRow = await runInAct(async () => await inFlightPromise);
	if (result.current.pendingIds.has(targetId)) {
		throw new Error(
			`RowMutationPort contract violation: pendingIds still contained "${targetId}" after mutation resolved`,
		);
	}

	// 2. Optimistic rollback lifecycle (when invalidPatch is supplied)
	let rolledBackAfterFailure = false;
	let rejectionError: Error | null = null;

	if (invalidPatch !== undefined) {
		const beforeFailureSnapshot = readRow?.(targetId);
		let failPromise!: Promise<TRow>;
		await runInAct(() => {
			failPromise = result.current.mutate(targetId, invalidPatch);
		});

		if (!result.current.pendingIds.has(targetId)) {
			throw new Error(
				`RowMutationPort contract violation: pendingIds did not contain "${targetId}" during failing mutation`,
			);
		}

		try {
			await runInAct(async () => await failPromise);
		} catch (err) {
			rejectionError = err instanceof Error ? err : new Error(String(err));
		}

		if (!rejectionError) {
			throw new Error(
				"RowMutationPort contract violation: expected invalidPatch mutation to reject",
			);
		}
		if (result.current.pendingIds.has(targetId)) {
			throw new Error(
				`RowMutationPort contract violation: pendingIds still contained "${targetId}" after mutation rejected`,
			);
		}
		if (readRow) {
			const afterFailureSnapshot = readRow(targetId);
			rolledBackAfterFailure =
				JSON.stringify(afterFailureSnapshot) ===
				JSON.stringify(beforeFailureSnapshot);
			if (!rolledBackAfterFailure) {
				throw new Error(
					`RowMutationPort contract violation: row "${targetId}" did not roll back to its pre-mutation snapshot after failure`,
				);
			}
		} else {
			rolledBackAfterFailure = true;
		}
	}

	return {
		updatedRow,
		optimisticObservedDuringFlight,
		pendingObservedDuringFlight,
		rolledBackAfterFailure,
		rejectionError,
	};
}

/**
 * Verifies that a `NavigationPort` implementation satisfies the port contract:
 * calls `navigate` with the supplied target + options and resolves `useHref` for that target.
 */
export function assertNavigationPortContract(
	port: NavigationPort,
	samplePath = "/items/item-1",
	sampleOpts: NavigationOptions = {
		replace: true,
		search: { page: 2 },
	},
): {
	readonly navigatedTo: string;
	readonly navigatedOpts: NavigationOptions;
	readonly hrefResult: string;
} {
	if (typeof port.navigate !== "function") {
		throw new Error(
			"NavigationPort contract violation: navigate must be a function",
		);
	}
	if (typeof port.useHref !== "function") {
		throw new Error(
			"NavigationPort contract violation: useHref must be a function",
		);
	}
	port.navigate(samplePath, sampleOpts);
	const maybeHistory = (
		port as NavigationPort & { readonly history?: readonly NavigationRecord[] }
	).history;
	if (Array.isArray(maybeHistory)) {
		const lastEntry = maybeHistory[maybeHistory.length - 1];
		if (
			!lastEntry ||
			lastEntry.to !== samplePath ||
			lastEntry.opts !== sampleOpts
		) {
			throw new Error(
				"NavigationPort contract violation: navigate did not record the arguments it was given",
			);
		}
	}
	const resolveHref = port.useHref;
	const hrefResult = resolveHref(samplePath);
	if (typeof hrefResult !== "string" || hrefResult.length === 0) {
		throw new Error(
			"NavigationPort contract violation: useHref must return a non-empty string",
		);
	}
	return {
		navigatedTo: samplePath,
		navigatedOpts: sampleOpts,
		hrefResult,
	};
}

/**
 * Verifies that a `PermissionPort` implementation satisfies the port contract.
 */
export function assertPermissionPortContract(
	port: PermissionPort,
	sampleResource: string | PermissionResource = {
		type: "item",
		id: "item-1",
		field: "label",
	},
): { readonly canEdit: boolean; readonly canView: boolean } {
	if (typeof port.can !== "function") {
		throw new Error(
			"PermissionPort contract violation: can must be a function",
		);
	}
	const canEdit = port.can("edit", sampleResource);
	const canView = port.can("view", sampleResource);
	if (typeof canEdit !== "boolean" || typeof canView !== "boolean") {
		throw new Error(
			"PermissionPort contract violation: can() must return a boolean",
		);
	}
	return { canEdit, canView };
}

/**
 * Verifies that a `ViewStatePort` implementation satisfies load/save round-trip semantics.
 */
export function assertViewStatePortContract<TState>(
	port: ViewStatePort<TState>,
	sampleState: TState,
	key = "sample-view",
): TState | undefined {
	if (typeof port.load !== "function" || typeof port.save !== "function") {
		throw new Error(
			"ViewStatePort contract violation: load and save must be functions",
		);
	}
	port.save(key, sampleState);
	return port.load(key);
}
