/**
 * `FlowsTable` Feature Container (`src/features/flows/FlowsTable.tsx`)
 *
 * ARCHITECTURAL ROLE (Container/Presentational surviving ONLY as adapter wiring):
 * - Composes the business-logic-free `@platform/ui` `DataTable` brick (Tier 4)
 *   and `Button` leaf (Tier 1) with the five real `@platform/adapters` — one provider per port,
 *   no god-adapter.
 * - ALL domain knowledge (`IntegrationFlow` column definitions, `flows` query keys,
 *   `FlowsSearch` URL parameter translation, RFC 7807 `problem+json` validation rules,
 *   and `CATALOGUE_EDITOR` permission rules) lives HERE, never inside `@platform/ui`.
 */

import {
	createQueryRowMutationAdapter,
	createQueryRowSourceAdapter,
	createRouterNavigationAdapter,
	createSessionPermissionAdapter,
	createZustandViewStateAdapter,
	createZustandViewStateStore,
	ProblemDetailError,
	type ZustandViewStateStore,
} from "@platform/adapters";
import type { DataTableViewState } from "@platform/ports";
import {
	Button,
	DataTable,
	type DataTableColumnMeta,
	type DataTableFeatures,
	type DataTableQuery,
	NavigationPortProvider,
	PermissionPortProvider,
	RowMutationPortProvider,
	RowSourcePortProvider,
	useDataTableContext,
	ViewStatePortProvider,
} from "@platform/ui";
import {
	cleanFlowsSearch,
	FLOW_HEALTH_VALUES,
	FLOW_LIFECYCLE_VALUES,
	FLOW_PAGE_SIZES,
	FLOW_SORT_FIELDS,
	type FlowSortField,
	type FlowsSearch,
	fetchFlowsPage,
	resolveFlowsSearch,
} from "@shared/flows";
import {
	FlowStatusSchema,
	HealthSchema,
	type IntegrationFlow,
	type Role,
} from "@shared/mocks/schemas";
import { seedData } from "@shared/mocks/seed";
import {
	type ColumnFiltersState,
	createColumnHelper,
	type PaginationState,
	type SortingState,
} from "@tanstack/react-table";
import * as React from "react";
import { z } from "zod";

const columnHelper = createColumnHelper<DataTableFeatures, IntegrationFlow>();

/**
 * Default app-level Zustand store backing `ViewStatePort` for the Flows table.
 * Holds ONLY view state (`rowSelection`, `bulkMode`, `columnVisibility`, saved presets) —
 * never server row data (`IntegrationFlow[]`).
 */
export const flowsViewStateStore =
	createZustandViewStateStore<DataTableViewState>();

function formatTimestamp(iso: string): string {
	return iso.slice(0, 16).replace("T", " ");
}

/**
 * Row selection checkbox rendered inside the `name` column cell via `cellRender`.
 * Reads `rowSelection` and `setRowSelection` from `DataTableContext`, which persists
 * changes through `ViewStatePort` into Zustand.
 */
function FlowRowSelectCheckbox({
	rowId,
}: {
	readonly rowId: string;
}): React.ReactElement {
	const { rowSelection, setRowSelection } =
		useDataTableContext<IntegrationFlow>();
	const isSelected = Boolean(rowSelection[rowId]);

	return (
		<input
			type="checkbox"
			aria-label={`Select flow ${rowId}`}
			data-testid={`flows-select-row-${rowId}`}
			checked={isSelected}
			onClick={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
			onChange={(e) => {
				const checked = e.target.checked;
				setRowSelection((prev) => {
					const next = { ...prev };
					if (checked) {
						next[rowId] = true;
					} else {
						delete next[rowId];
					}
					return next;
				});
			}}
			className="mr-btn-px-sm cursor-pointer"
		/>
	);
}

/**
 * Toolbar controls for bulk selection clearing and column visibility toggling,
 * exercising `ViewStatePort` (`rowSelection`, `bulkMode`, `columnVisibility`) in Zustand.
 */
function FlowsViewStateToolbarControls(): React.ReactElement {
	const {
		rowSelection,
		setRowSelection,
		columnVisibility,
		setColumnVisibility,
	} = useDataTableContext<IntegrationFlow>();

	const selectedIds = Object.keys(rowSelection).filter(
		(id) => rowSelection[id],
	);
	const isBulkMode = selectedIds.length > 0;
	const isThroughputHidden = columnVisibility.throughputPerMin === false;

	return (
		<div
			data-testid="flows-view-state-controls"
			data-bulk-mode={isBulkMode ? "true" : "false"}
			className="flex items-center space-x-btn-px-sm"
		>
			<Button
				variant="ghost"
				size="sm"
				data-testid="flows-toggle-throughput-col-btn"
				onClick={() => {
					setColumnVisibility((prev) => ({
						...prev,
						throughputPerMin: prev.throughputPerMin === false,
					}));
				}}
			>
				{isThroughputHidden ? "Show Throughput" : "Hide Throughput"}
			</Button>
			{isBulkMode && (
				<Button
					variant="soft"
					size="sm"
					data-testid="flows-clear-selection-btn"
					onClick={() => setRowSelection({})}
				>
					Clear selection ({selectedIds.length})
				</Button>
			)}
		</div>
	);
}

/**
 * Zod schema for inline edits on an `IntegrationFlow` row.
 * Mirrors the RFC 7807 `application/problem+json` 422 contract in `handlers.ts`
 * (`errors{}` field map generated from Zod issues).
 */
export const IntegrationFlowPatchSchema = z.object({
	name: z.string().min(1, "must not be blank").optional(),
	status: FlowStatusSchema.optional(),
	health: HealthSchema.optional(),
	avgLatencyMs: z.number().int().min(1, "must be ≥ 1").optional(),
	throughputPerMin: z.number().int().min(0, "must be ≥ 0").optional(),
});

export type IntegrationFlowPatch = z.infer<typeof IntegrationFlowPatchSchema>;

/**
 * Validates and applies a partial `IntegrationFlow` patch against the shared seed store,
 * throwing an RFC 7807 `ProblemDetailError` (422 `application/problem+json` with `errors{}`)
 * when validation fails.
 */
export async function mutateIntegrationFlowRow(
	collabId: string,
	flowId: string,
	patch: Partial<IntegrationFlow>,
	options?: {
		readonly mutationDelayMs?: number | undefined;
		readonly roles?: readonly string[] | undefined;
	},
): Promise<IntegrationFlow> {
	const delayMs = options?.mutationDelayMs ?? 25;
	if (delayMs > 0) {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	if (options?.roles) {
		const canEdit =
			options.roles.includes("CATALOGUE_EDITOR") ||
			options.roles.includes("CATALOGUE_ADMIN");
		if (!canEdit) {
			throw new ProblemDetailError({
				type: "https://catalogue/errors/forbidden",
				title: "Forbidden",
				status: 403,
				detail: "Requires CATALOGUE_EDITOR",
			});
		}
	}

	const parsed = IntegrationFlowPatchSchema.safeParse(patch);
	if (!parsed.success) {
		const errors: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const field = issue.path.join(".") || "_";
			if (!(field in errors)) {
				errors[field] = issue.message;
			}
		}
		const firstEntry = Object.entries(errors)[0];
		throw new ProblemDetailError({
			type: "https://catalogue/errors/validation",
			title: "Validation failed",
			status: 422,
			detail: firstEntry
				? `${firstEntry[0]} ${firstEntry[1]}`
				: "One or more fields are invalid",
			errors,
		});
	}

	const allFlows = seedData().flows;
	const index = allFlows.findIndex((f) => f.id === flowId);
	if (index < 0) {
		throw new ProblemDetailError({
			type: `https://catalogue/errors/not-found/${collabId}`,
			title: "Not Found",
			status: 404,
			detail: `No integration flow '${flowId}'`,
		});
	}

	const current = allFlows[index];
	if (!current) {
		throw new Error(`No integration flow '${flowId}'`);
	}

	const updated: IntegrationFlow = {
		...current,
		...parsed.data,
	};
	allFlows[index] = updated;
	return updated;
}

/**
 * Column definitions for `IntegrationFlow` — owned by the feature container,
 * using `DataTableColumnMeta`'s typed `cellRender` / `editCellRender` contracts.
 */
export const integrationFlowColumns = columnHelper.columns([
	columnHelper.accessor("name", {
		id: "name",
		header: "Flow Name",
		meta: {
			editable: true,
			cellRender: (props, state) => (
				<div {...props} data-flow-col="name">
					<FlowRowSelectCheckbox rowId={state.rowId} />
					<span className="truncate font-btn text-fg-primary">
						{String(state.value)}
					</span>
				</div>
			),
			editCellRender: (props) => (
				<input {...props} data-flow-editor="name" />
			),
		} satisfies DataTableColumnMeta<IntegrationFlow, string>,
	}),
	columnHelper.accessor("middleware", {
		id: "middleware",
		header: "Middleware",
		meta: {
			editable: false,
		} satisfies DataTableColumnMeta<
			IntegrationFlow,
			IntegrationFlow["middleware"]
		>,
	}),
	columnHelper.accessor("direction", {
		id: "direction",
		header: "Direction",
		meta: {
			editable: false,
		} satisfies DataTableColumnMeta<
			IntegrationFlow,
			IntegrationFlow["direction"]
		>,
	}),
	columnHelper.accessor("status", {
		id: "status",
		header: "Status",
		meta: {
			editable: true,
		} satisfies DataTableColumnMeta<IntegrationFlow, IntegrationFlow["status"]>,
	}),
	columnHelper.accessor("health", {
		id: "health",
		header: "Health",
		meta: {
			editable: false,
			cellRender: (props, state) => (
				<div
					{...props}
					data-flow-col="health"
					data-health-value={String(state.value)}
				>
					{String(state.value)}
				</div>
			),
		} satisfies DataTableColumnMeta<IntegrationFlow, IntegrationFlow["health"]>,
	}),
	columnHelper.accessor("avgLatencyMs", {
		id: "avgLatencyMs",
		header: "Avg Latency (ms)",
		meta: {
			editable: true,
			parseValue: (draft) => Number(draft),
			cellRender: (props, state) => (
				<div
					{...props}
					data-flow-col="avgLatencyMs"
					data-latency-value={String(state.value)}
				>
					{String(state.value)} ms
				</div>
			),
			editCellRender: (props) => (
				<input {...props} data-flow-editor="avgLatencyMs" />
			),
		} satisfies DataTableColumnMeta<IntegrationFlow, number>,
	}),
	columnHelper.accessor("throughputPerMin", {
		id: "throughputPerMin",
		header: "Throughput (/min)",
		meta: {
			editable: true,
			parseValue: (draft) => Number(draft),
		} satisfies DataTableColumnMeta<IntegrationFlow, number>,
	}),
	columnHelper.accessor("lastRunAt", {
		id: "lastRunAt",
		header: "Last Run",
		cell: (info) => formatTimestamp(info.getValue()),
		meta: {
			editable: false,
		} satisfies DataTableColumnMeta<IntegrationFlow, string>,
	}),
]);

/**
 * Translates `@platform/ports` `DataTableQuery` into the `FlowsSearch` URL/API contract.
 */
export function toFlowsSearchFromQuery(query: DataTableQuery): FlowsSearch {
	const topSort = query.sorting?.[0];
	const sortField =
		topSort && FLOW_SORT_FIELDS.includes(topSort.id as FlowSortField)
			? (topSort.id as FlowSortField)
			: undefined;
	const statusFilter = query.columnFilters?.find((f) => f.id === "status");
	const statusVal =
		statusFilter && typeof statusFilter.value === "string"
			? statusFilter.value.trim()
			: "";

	return resolveFlowsSearch({
		sort: sortField,
		dir: topSort ? (topSort.desc ? "desc" : "asc") : "asc",
		status: statusVal || undefined,
		q: query.globalFilter?.trim() || undefined,
		page: query.pageIndex,
		size: query.pageSize,
	});
}

/**
 * Builds the canonical TanStack Query key `['flows', collabId, resolvedParams]`
 * for `RowSourcePort`.
 */
export function buildFlowsRowSourceQueryKey(
	collabId: string,
	query: DataTableQuery,
) {
	const resolved = resolveFlowsSearch(toFlowsSearchFromQuery(query));
	return [
		"flows",
		collabId,
		{
			sort: resolved.sort ?? null,
			dir: resolved.dir,
			status: resolved.status,
			q: resolved.q,
			page: resolved.page,
			size: resolved.size,
		},
	] as const;
}

/**
 * Builds the query key for a single `IntegrationFlow` detail view mirroring a row
 * (`"multiple places on screen"`).
 */
export function buildFlowDetailQueryKey(collabId: string, flowId: string) {
	return ["flow-detail", collabId, flowId] as const;
}

const DEFAULT_EDITOR_ROLES: readonly Role[] = [
	"CATALOGUE_VIEWER",
	"CATALOGUE_EDITOR",
];

export interface FlowsTableContainerProps {
	readonly collabId: string;
	readonly search: FlowsSearch;
	readonly onNavigateSearch: (
		nextSearch: FlowsSearch,
		opts?: { readonly replace?: boolean | undefined },
	) => void;
	readonly onNavigateHref?: ((to: string) => void) | undefined;
	/**
	 * Active session roles from `GET /api/session`.
	 * @default ["CATALOGUE_VIEWER", "CATALOGUE_EDITOR"]
	 */
	readonly sessionRoles?: readonly Role[] | undefined;
	/**
	 * Optional boolean shorthand when `sessionRoles` is not explicitly provided.
	 */
	readonly canEditFlow?: boolean | undefined;
	/**
	 * Simulated delay for flow row mutations in milliseconds.
	 * @default 25
	 */
	readonly mutationDelayMs?: number | undefined;
	/**
	 * Optional custom flow row mutation handler (defaults to `mutateIntegrationFlowRow`).
	 */
	readonly onMutateFlow?:
		| ((
				flowId: string,
				patch: Partial<IntegrationFlow>,
		  ) => Promise<IntegrationFlow>)
		| undefined;
	/**
	 * Optional Zustand store backing `ViewStatePort` (defaults to `flowsViewStateStore`).
	 */
	readonly viewStateStore?: ZustandViewStateStore<DataTableViewState> | undefined;
}

export function FlowsTableContainer({
	collabId,
	search,
	onNavigateSearch,
	onNavigateHref,
	sessionRoles,
	canEditFlow,
	mutationDelayMs = 25,
	onMutateFlow,
	viewStateStore = flowsViewStateStore,
}: FlowsTableContainerProps): React.ReactElement {
	const resolved = resolveFlowsSearch(search);

	const effectiveRoles: readonly Role[] = React.useMemo(() => {
		if (sessionRoles) {
			return sessionRoles;
		}
		if (canEditFlow === false) {
			return ["CATALOGUE_VIEWER"];
		}
		return DEFAULT_EDITOR_ROLES;
	}, [sessionRoles, canEditFlow]);

	const rolesRef = React.useRef<readonly Role[]>(effectiveRoles);
	React.useEffect(() => {
		rolesRef.current = effectiveRoles;
	}, [effectiveRoles]);

	const onMutateFlowRef = React.useRef(onMutateFlow);
	React.useEffect(() => {
		onMutateFlowRef.current = onMutateFlow;
	}, [onMutateFlow]);

	// 1. Real RowSourcePort adapter backed by TanStack Query (`useQuery` + `keepPreviousData`)
	const rowSourceAdapter = React.useMemo(
		() =>
			createQueryRowSourceAdapter<IntegrationFlow>({
				getQueryKey: (query) => buildFlowsRowSourceQueryKey(collabId, query),
				queryFn: (query, { signal }) =>
					fetchFlowsPage(collabId, toFlowsSearchFromQuery(query), { signal }),
			}),
		[collabId],
	);

	// 2. Real RowMutationPort adapter backed by TanStack Query (`useMutation` + cache snapshot rollback)
	const rowMutationAdapter = React.useMemo(
		() =>
			createQueryRowMutationAdapter<IntegrationFlow>({
				queryKeyPrefix: ["flows", collabId],
				detailQueryKey: (flowId) => buildFlowDetailQueryKey(collabId, flowId),
				mutationFn: (flowId, patch) => {
					if (onMutateFlowRef.current) {
						return onMutateFlowRef.current(flowId, patch);
					}
					return mutateIntegrationFlowRow(collabId, flowId, patch, {
						mutationDelayMs,
						roles: rolesRef.current,
					});
				},
			}),
		[collabId, mutationDelayMs],
	);

	// 3. Real NavigationPort adapter backed by TanStack Router navigation callbacks
	const onNavigateRef = React.useRef({ onNavigateSearch, onNavigateHref });
	React.useEffect(() => {
		onNavigateRef.current = { onNavigateSearch, onNavigateHref };
	}, [onNavigateSearch, onNavigateHref]);

	const navigationAdapter = React.useMemo(
		() =>
			createRouterNavigationAdapter({
				onNavigate: ({ to, replace, search: nextSearch }) => {
					if (nextSearch) {
						onNavigateRef.current.onNavigateSearch(
							cleanFlowsSearch(nextSearch as FlowsSearch),
							{ replace: replace ?? true },
						);
						return;
					}
					onNavigateRef.current.onNavigateHref?.(to);
				},
			}),
		[],
	);

	// 4. Real PermissionPort adapter backed by session roles (`GET /api/session`)
	const permissionAdapter = React.useMemo(
		() =>
			createSessionPermissionAdapter({
				roles: effectiveRoles,
			}),
		[effectiveRoles],
	);

	// 5. Real ViewStatePort adapter backed by Zustand (`rowSelection`, `bulkMode`, `columnVisibility`)
	const viewStateAdapter = React.useMemo(
		() =>
			createZustandViewStateAdapter<DataTableViewState>({
				store: viewStateStore,
			}),
		[viewStateStore],
	);

	// Leaf Tier-1 Button receives `disabled` and `title` as plain props computed by the feature
	// from the permission check — `PermissionPort` lives at Tier 4 (`DataTable`), never in `Button`.
	const canEditOrCreate = permissionAdapter.can("edit", {
		type: "flow",
	});

	// Controlled table slices derived strictly from URL search state (§5 State-Placement Law)
	const sorting: SortingState = resolved.sort
		? [{ id: resolved.sort, desc: resolved.dir === "desc" }]
		: [];

	const columnFilters: ColumnFiltersState = resolved.status
		? [{ id: "status", value: resolved.status }]
		: [];

	const pagination: PaginationState = {
		pageIndex: resolved.page,
		pageSize: resolved.size,
	};

	const emitSearchUpdate = (next: FlowsSearch) => {
		navigationAdapter.navigate(`/collaborations/${collabId}/flows`, {
			replace: true,
			search: cleanFlowsSearch(next) as Record<string, unknown>,
		});
	};

	const handleSortingChange = (nextSorting: SortingState) => {
		const top = nextSorting[0];
		if (top && FLOW_SORT_FIELDS.includes(top.id as FlowSortField)) {
			emitSearchUpdate({
				...resolved,
				sort: top.id as FlowSortField,
				dir: top.desc ? "desc" : "asc",
				page: 0,
			});
		} else {
			emitSearchUpdate({
				...resolved,
				sort: undefined,
				dir: undefined,
				page: 0,
			});
		}
	};

	const handleColumnFiltersChange = (nextFilters: ColumnFiltersState) => {
		const statusEntry = nextFilters.find((f) => f.id === "status");
		const nextStatus =
			statusEntry && typeof statusEntry.value === "string"
				? statusEntry.value.trim()
				: undefined;
		emitSearchUpdate({
			...resolved,
			dir: resolved.sort ? resolved.dir : undefined,
			status: nextStatus || undefined,
			page: 0,
		});
	};

	const handleGlobalFilterChange = (nextGlobal: string) => {
		emitSearchUpdate({
			...resolved,
			dir: resolved.sort ? resolved.dir : undefined,
			q: nextGlobal.trim() || undefined,
			page: 0,
		});
	};

	const handlePaginationChange = (nextPagination: PaginationState) => {
		const sizeChanged = nextPagination.pageSize !== resolved.size;
		emitSearchUpdate({
			...resolved,
			dir: resolved.sort ? resolved.dir : undefined,
			page: sizeChanged ? 0 : Math.max(0, nextPagination.pageIndex),
			size: nextPagination.pageSize,
		});
	};

	const handleResetFilters = () => {
		emitSearchUpdate({
			sort: undefined,
			dir: undefined,
			status: undefined,
			q: undefined,
			page: 0,
			size: resolved.size,
		});
	};

	return (
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
								getRowHref={(row) =>
									`/collaborations/${collabId}/flows/${row.id}`
								}
								sorting={sorting}
								onSortingChange={(updater) => {
									const next =
										typeof updater === "function" ? updater(sorting) : updater;
									handleSortingChange(next);
								}}
								columnFilters={columnFilters}
								onColumnFiltersChange={(updater) => {
									const next =
										typeof updater === "function"
											? updater(columnFilters)
											: updater;
									handleColumnFiltersChange(next);
								}}
								globalFilter={resolved.q}
								onGlobalFilterChange={(updater) => {
									const next =
										typeof updater === "function"
											? updater(resolved.q)
											: updater;
									handleGlobalFilterChange(next);
								}}
								pagination={pagination}
								onPaginationChange={(updater) => {
									const next =
										typeof updater === "function"
											? updater(pagination)
											: updater;
									handlePaginationChange(next);
								}}
							>
								<DataTable.Toolbar
									searchPlaceholder="Search integration flows..."
									actions={
										<>
											<FlowsViewStateToolbarControls />
											<Button
												variant="soft"
												size="sm"
												data-testid="flows-reset-url-btn"
												onClick={handleResetFilters}
											>
												Reset URL filters
											</Button>
											<Button
												variant="solid"
												size="sm"
												disabled={!canEditOrCreate}
												title={
													!canEditOrCreate
														? "Requires CATALOGUE_EDITOR role"
														: undefined
												}
												data-testid="flows-create-btn"
											>
												New Flow
											</Button>
										</>
									}
								>
									<label className="flex items-center space-x-btn-px-sm text-btn-sm text-fg-secondary">
										<span>Status / Health</span>
										<select
											aria-label="Filter by status or health"
											data-testid="flows-status-select"
											value={resolved.status}
											onChange={(e) =>
												handleColumnFiltersChange(
													e.target.value
														? [{ id: "status", value: e.target.value }]
														: [],
												)
											}
											className="rounded-btn border border-table-border bg-surface px-btn-px-sm py-table-cell-py text-btn-sm text-fg-primary"
										>
											<option value="">All</option>
											<optgroup label="Lifecycle">
												{FLOW_LIFECYCLE_VALUES.map((s) => (
													<option key={`lifecycle-${s}`} value={s}>
														{s}
													</option>
												))}
											</optgroup>
											<optgroup label="Health">
												{FLOW_HEALTH_VALUES.map((h) => (
													<option key={`health-${h}`} value={h}>
														{h}
													</option>
												))}
											</optgroup>
										</select>
									</label>

									<label className="flex items-center space-x-btn-px-sm text-btn-sm text-fg-secondary">
										<span>Page size</span>
										<select
											aria-label="Rows per page"
											data-testid="flows-size-select"
											value={resolved.size}
											onChange={(e) =>
												handlePaginationChange({
													pageIndex: 0,
													pageSize: Number(e.target.value),
												})
											}
											className="rounded-btn border border-table-border bg-surface px-btn-px-sm py-table-cell-py text-btn-sm text-fg-primary"
										>
											{FLOW_PAGE_SIZES.map((s) => (
												<option key={s} value={s}>
													{s}
												</option>
											))}
										</select>
									</label>
								</DataTable.Toolbar>
								<DataTable.Header />
								<DataTable.Body />
								<DataTable.Pagination />
							</DataTable.Root>
						</ViewStatePortProvider>
					</PermissionPortProvider>
				</NavigationPortProvider>
			</RowMutationPortProvider>
		</RowSourcePortProvider>
	);
}
