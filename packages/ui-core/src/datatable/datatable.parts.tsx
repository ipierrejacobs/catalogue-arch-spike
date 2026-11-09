/**
 * L3 — DataTable Compound Parts & Composition (`@platform/ui`)
 *
 * Implements the Tier-4 Editable DataTable compound component family:
 * - `DataTable.Root`       — wires L2 capability ports + L1 behavior + shared context
 * - `DataTable.Toolbar`    — search / bulk status + app-actions slot (`actions` / `children`)
 * - `DataTable.Header`     — sticky column headers with server-sort triggers
 * - `DataTable.Body`       — virtualized body + loading / empty / error state rendering
 * - `DataTable.Row`        — virtualized row with selection, pending state, and navigation support
 * - `DataTable.Cell`       — cell display & inline editor (`idle -> editing -> saving -> error`)
 * - `DataTable.Pagination` — server pagination controls & page-size / total summary
 *
 * COMPOSITION CONTRACT (same convention as Tier-1 Button):
 * - All element/cell/editor substitution uses Base UI `render` / `useRender` / `mergeProps`
 *   as a structural prop type (Typed Render Contract), NEVER `asChild` / `Slot` and NEVER
 *   a capability port for visual customization.
 */

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type {
	Cell,
	CellData,
	ColumnDef,
	ColumnFiltersState,
	ColumnVisibilityState,
	OnChangeFn,
	PaginationState,
	Row,
	RowData,
	RowSelectionState,
	SortingState,
} from "@tanstack/react-table";
import * as React from "react";
import {
	type DataTableBehaviorResult,
	type DataTableFeatures,
	type GridCellCoord,
	resolveUpdater,
	useDataTableBehavior,
} from "./datatable.behavior";
import {
	type DataTableFilterParam,
	type DataTableQuery,
	type DataTableSortParam,
	type DataTableViewState,
	type NavigationPort,
	type PermissionPort,
	type RowMutationHandle,
	type RowSourceResult,
	useNavigationHref,
	useOptionalNavigationPort,
	useOptionalPermissionPort,
	useOptionalRowMutation,
	useRowSource,
	useViewStatePort,
} from "./datatable.ports";
import {
	type DataTableDensity,
	type DataTableVariant,
	getDataTableBodyClassName,
	getDataTableCellClassName,
	getDataTableCellEditorInputClassName,
	getDataTableCellErrorClassName,
	getDataTableHeaderCellClassName,
	getDataTableHeaderClassName,
	getDataTableHeaderRowClassName,
	getDataTablePaginationClassName,
	getDataTableRootClassName,
	getDataTableRowClassName,
	getDataTableStatusBannerClassName,
	getDataTableTableClassName,
	getDataTableToolbarClassName,
	getDataTableViewportClassName,
} from "./datatable.styles";

/* ==========================================================================
   TYPED RENDER CONTRACTS (Cell & EditCell substitution via Base UI useRender)
   ========================================================================== */

export interface DataTableCellRenderState<TRow = unknown, TValue = unknown>
	extends Record<string, unknown> {
	readonly row: TRow;
	readonly rowId: string;
	readonly rowIndex: number;
	readonly columnId: string;
	readonly colIndex: number;
	readonly value: TValue;
	readonly focused: boolean;
	readonly editing: boolean;
	readonly saving: boolean;
	readonly error: string | null;
	readonly editable: boolean;
}

export type DataTableCellRenderProp<TRow = unknown, TValue = unknown> =
	useRender.RenderProp<DataTableCellRenderState<TRow, TValue>>;

export interface DataTableEditCellRenderState<TRow = unknown, TValue = unknown>
	extends Record<string, unknown> {
	readonly row: TRow;
	readonly rowId: string;
	readonly columnId: string;
	readonly draftValue: TValue;
	readonly saving: boolean;
	readonly error: string | null;
	readonly updateDraft: (next: unknown) => void;
	readonly commitEdit: () => Promise<boolean>;
	readonly cancelEdit: () => void;
}

export type DataTableEditCellRenderProp<TRow = unknown, TValue = unknown> =
	useRender.RenderProp<DataTableEditCellRenderState<TRow, TValue>>;

/**
 * Structural column metadata contract for cell/editCell customization and editability.
 * Passed on TanStack Table column `meta` — a typed structural prop contract, NOT a port.
 */
export interface DataTableColumnMeta<TRow = unknown, TValue = unknown> {
	/**
	 * Whether cells in this column may enter inline edit mode (subject to `PermissionPort`).
	 * @default true
	 */
	readonly editable?: boolean | undefined;
	/**
	 * Optional Base UI `render` contract for custom cell presentation.
	 */
	readonly cellRender?: DataTableCellRenderProp<TRow, TValue> | undefined;
	/**
	 * Optional Base UI `render` contract for custom inline cell editor.
	 */
	readonly editCellRender?:
		| DataTableEditCellRenderProp<TRow, TValue>
		| undefined;
	/**
	 * Optional parser converting the draft input value before calling `RowMutationPort.mutate`.
	 */
	readonly parseValue?:
		| ((draftValue: unknown, row: TRow) => unknown)
		| undefined;
}

/* ==========================================================================
   SHARED COMPOUND CONTEXT
   ========================================================================== */

export interface DataTableContextValue<TRow extends RowData = RowData> {
	readonly behavior: DataTableBehaviorResult<TRow>;
	readonly sourceResult: RowSourceResult<TRow>;
	readonly mutationHandle: RowMutationHandle<TRow, Partial<TRow>>;
	readonly navigationPort: NavigationPort | null;
	readonly permissionPort: PermissionPort | null;
	readonly density: DataTableDensity;
	readonly variant: DataTableVariant;
	readonly resourceType: string;
	readonly sorting: SortingState;
	readonly setSorting: OnChangeFn<SortingState>;
	readonly columnFilters: ColumnFiltersState;
	readonly setColumnFilters: OnChangeFn<ColumnFiltersState>;
	readonly globalFilter: string;
	readonly setGlobalFilter: OnChangeFn<string>;
	readonly pagination: PaginationState;
	readonly setPagination: OnChangeFn<PaginationState>;
	readonly rowSelection: RowSelectionState;
	readonly setRowSelection: OnChangeFn<RowSelectionState>;
	readonly columnVisibility: ColumnVisibilityState;
	readonly setColumnVisibility: OnChangeFn<ColumnVisibilityState>;
	readonly canEditCellCoord: (cell: GridCellCoord, row: TRow) => boolean;
	readonly getRowHref?: ((row: TRow) => string | undefined) | undefined;
}

const DataTableContext =
	React.createContext<DataTableContextValue<RowData> | null>(null);

export function useDataTableContext<
	TRow extends RowData = RowData,
>(): DataTableContextValue<TRow> {
	const ctx = React.useContext(DataTableContext);
	if (!ctx) {
		throw new Error(
			"DataTable compound parts must be rendered inside <DataTable.Root>.",
		);
	}
	return ctx as unknown as DataTableContextValue<TRow>;
}

const DENSITY_ROW_HEIGHT: Record<DataTableDensity, number> = {
	compact: 36,
	default: 44,
	comfortable: 52,
};

/* ==========================================================================
   1. DataTable.Root
   ========================================================================== */

export interface DataTableRootRenderState extends Record<string, unknown> {
	readonly density: DataTableDensity;
	readonly variant: DataTableVariant;
	readonly status: RowSourceResult<unknown>["status"];
	readonly editMode: DataTableBehaviorResult<RowData>["editState"]["kind"];
}

export type DataTableRootRenderProp =
	useRender.RenderProp<DataTableRootRenderState>;

export interface DataTableRootProps<TRow extends RowData>
	extends Omit<
		useRender.ComponentProps<"div", DataTableRootRenderState>,
		"className" | "render" | "ref"
	> {
	readonly columns: ReadonlyArray<ColumnDef<DataTableFeatures, TRow, CellData>>;
	readonly getRowId?: ((originalRow: TRow, index: number) => string) | undefined;
	readonly density?: DataTableDensity | undefined;
	readonly variant?: DataTableVariant | undefined;
	readonly rowHeight?: number | undefined;
	readonly overscan?: number | undefined;
	readonly initialViewportHeight?: number | undefined;
	readonly resourceType?: string | undefined;
	readonly viewStateKey?: string | undefined;
	readonly getRowHref?: ((row: TRow) => string | undefined) | undefined;
	readonly createRowPatch?:
		| ((columnId: string, parsedValue: unknown, row: TRow) => Partial<TRow>)
		| undefined;
	readonly sorting?: SortingState | undefined;
	readonly defaultSorting?: SortingState | undefined;
	readonly onSortingChange?: OnChangeFn<SortingState> | undefined;
	readonly columnFilters?: ColumnFiltersState | undefined;
	readonly defaultColumnFilters?: ColumnFiltersState | undefined;
	readonly onColumnFiltersChange?: OnChangeFn<ColumnFiltersState> | undefined;
	readonly globalFilter?: string | undefined;
	readonly defaultGlobalFilter?: string | undefined;
	readonly onGlobalFilterChange?: OnChangeFn<string> | undefined;
	readonly pagination?: PaginationState | undefined;
	readonly defaultPagination?: PaginationState | undefined;
	readonly onPaginationChange?: OnChangeFn<PaginationState> | undefined;
	readonly rowSelection?: RowSelectionState | undefined;
	readonly defaultRowSelection?: RowSelectionState | undefined;
	readonly onRowSelectionChange?: OnChangeFn<RowSelectionState> | undefined;
	readonly columnVisibility?: ColumnVisibilityState | undefined;
	readonly defaultColumnVisibility?: ColumnVisibilityState | undefined;
	readonly onColumnVisibilityChange?:
		| OnChangeFn<ColumnVisibilityState>
		| undefined;
	readonly render?: DataTableRootRenderProp | undefined;
	readonly className?: string | undefined;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
	readonly children?: React.ReactNode;
}

function defaultGetRowId<TRow extends RowData>(
	originalRow: TRow,
	index: number,
): string {
	const candidate = (originalRow as Record<string, unknown> | null)?.id;
	return typeof candidate === "string" || typeof candidate === "number"
		? String(candidate)
		: String(index);
}

export function DataTableRoot<TRow extends RowData>(
	props: DataTableRootProps<TRow>,
): React.ReactElement {
	const {
		columns,
		getRowId = defaultGetRowId,
		density = "default",
		variant = "surface",
		rowHeight,
		overscan = 5,
		initialViewportHeight = 360,
		resourceType = "item",
		viewStateKey,
		getRowHref,
		createRowPatch,
		sorting: controlledSorting,
		defaultSorting = [],
		onSortingChange,
		columnFilters: controlledColumnFilters,
		defaultColumnFilters = [],
		onColumnFiltersChange,
		globalFilter: controlledGlobalFilter,
		defaultGlobalFilter = "",
		onGlobalFilterChange,
		pagination: controlledPagination,
		defaultPagination = { pageIndex: 0, pageSize: 25 },
		onPaginationChange,
		rowSelection: controlledRowSelection,
		defaultRowSelection,
		onRowSelectionChange,
		columnVisibility: controlledColumnVisibility,
		defaultColumnVisibility,
		onColumnVisibilityChange,
		render,
		className,
		ref,
		children,
		...elementProps
	} = props;

	const mutationHandle = useOptionalRowMutation<TRow, Partial<TRow>>();
	const navigationPort = useOptionalNavigationPort();
	const permissionPort = useOptionalPermissionPort();
	const viewStatePort = useViewStatePort<DataTableViewState>();

	const persistedViewState =
		viewStateKey && viewStatePort ? viewStatePort.load(viewStateKey) : undefined;

	const [uncontrolledSorting, setUncontrolledSorting] =
		React.useState<SortingState>(defaultSorting);
	const [uncontrolledColumnFilters, setUncontrolledColumnFilters] =
		React.useState<ColumnFiltersState>(defaultColumnFilters);
	const [uncontrolledGlobalFilter, setUncontrolledGlobalFilter] =
		React.useState<string>(defaultGlobalFilter);
	const [uncontrolledPagination, setUncontrolledPagination] =
		React.useState<PaginationState>(defaultPagination);
	const [uncontrolledRowSelection, setUncontrolledRowSelection] =
		React.useState<RowSelectionState>(
			() =>
				defaultRowSelection ??
				(persistedViewState?.rowSelection as RowSelectionState | undefined) ??
				{},
		);
	const [uncontrolledColumnVisibility, setUncontrolledColumnVisibility] =
		React.useState<ColumnVisibilityState>(
			() =>
				defaultColumnVisibility ??
				(persistedViewState?.columnVisibility as
					| ColumnVisibilityState
					| undefined) ??
				{},
		);

	const sorting = controlledSorting ?? uncontrolledSorting;
	const columnFilters = controlledColumnFilters ?? uncontrolledColumnFilters;
	const globalFilter = controlledGlobalFilter ?? uncontrolledGlobalFilter;
	const pagination = controlledPagination ?? uncontrolledPagination;
	const rowSelection = controlledRowSelection ?? uncontrolledRowSelection;
	const columnVisibility =
		controlledColumnVisibility ?? uncontrolledColumnVisibility;

	const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
		const next = resolveUpdater(updater, sorting);
		if (controlledSorting === undefined) {
			setUncontrolledSorting(next);
		}
		onSortingChange?.(next);
	};

	const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (
		updater,
	) => {
		const next = resolveUpdater(updater, columnFilters);
		if (controlledColumnFilters === undefined) {
			setUncontrolledColumnFilters(next);
		}
		onColumnFiltersChange?.(next);
	};

	const handleGlobalFilterChange: OnChangeFn<string> = (updater) => {
		const next = resolveUpdater(updater, globalFilter);
		if (controlledGlobalFilter === undefined) {
			setUncontrolledGlobalFilter(next);
		}
		onGlobalFilterChange?.(next);
	};

	const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
		const next = resolveUpdater(updater, pagination);
		if (controlledPagination === undefined) {
			setUncontrolledPagination(next);
		}
		onPaginationChange?.(next);
	};

	const persistViewState = (
		nextSelection: RowSelectionState,
		nextVisibility: ColumnVisibilityState,
	) => {
		if (viewStateKey && viewStatePort) {
			viewStatePort.save(viewStateKey, {
				rowSelection: nextSelection,
				bulkMode: Object.keys(nextSelection).some((k) => nextSelection[k]),
				columnVisibility: nextVisibility,
			});
		}
	};

	const handleRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
		const next = resolveUpdater(updater, rowSelection);
		if (controlledRowSelection === undefined) {
			setUncontrolledRowSelection(next);
		}
		persistViewState(next, columnVisibility);
		onRowSelectionChange?.(next);
	};

	const handleColumnVisibilityChange: OnChangeFn<ColumnVisibilityState> = (
		updater,
	) => {
		const next = resolveUpdater(updater, columnVisibility);
		if (controlledColumnVisibility === undefined) {
			setUncontrolledColumnVisibility(next);
		}
		persistViewState(rowSelection, next);
		onColumnVisibilityChange?.(next);
	};

	const querySorting: readonly DataTableSortParam[] = sorting.map((s) => ({
		id: s.id,
		desc: s.desc,
	}));
	const queryFilters: readonly DataTableFilterParam[] = columnFilters.map(
		(f) => ({
			id: f.id,
			value: f.value,
		}),
	);

	const sourceResult = useRowSource<TRow, DataTableQuery>({
		sorting: querySorting,
		columnFilters: queryFilters,
		globalFilter,
		pageIndex: pagination.pageIndex,
		pageSize: pagination.pageSize,
	});

	const getColumnMeta = (
		columnId: string,
	): DataTableColumnMeta<TRow> | undefined => {
		const col = columns.find((c) => {
			const id =
				c.id ??
				((c as { accessorKey?: string }).accessorKey
					? String((c as { accessorKey?: string }).accessorKey)
					: undefined);
			return id === columnId;
		});
		return col?.meta as DataTableColumnMeta<TRow> | undefined;
	};

	const canEditCellCoord = (cell: GridCellCoord, _row: TRow): boolean => {
		const meta = getColumnMeta(cell.columnId);
		if (meta?.editable === false) {
			return false;
		}
		if (permissionPort) {
			return permissionPort.can("edit", {
				type: resourceType,
				id: cell.rowId,
				field: cell.columnId,
			});
		}
		return true;
	};

	const handleCommitCell = async (
		cell: GridCellCoord,
		draftValue: unknown,
		row: TRow,
	): Promise<void> => {
		if (!canEditCellCoord(cell, row)) {
			throw new Error("Permission denied");
		}
		const meta = getColumnMeta(cell.columnId);
		const parsedValue = meta?.parseValue
			? meta.parseValue(draftValue, row)
			: draftValue;
		const patch = createRowPatch
			? createRowPatch(cell.columnId, parsedValue, row)
			: ({ [cell.columnId]: parsedValue } as Partial<TRow>);
		await mutationHandle.mutate(cell.rowId, patch);
	};

	const resolvedRowHeight = rowHeight ?? DENSITY_ROW_HEIGHT[density];

	const behavior = useDataTableBehavior<TRow>({
		rows: sourceResult.rows,
		rowCount: sourceResult.rowCount,
		columns,
		getRowId,
		rowHeight: resolvedRowHeight,
		overscan,
		initialViewportHeight,
		sorting,
		onSortingChange: handleSortingChange,
		columnFilters,
		onColumnFiltersChange: handleColumnFiltersChange,
		globalFilter,
		onGlobalFilterChange: handleGlobalFilterChange,
		pagination,
		onPaginationChange: handlePaginationChange,
		rowSelection,
		onRowSelectionChange: handleRowSelectionChange,
		columnVisibility,
		onColumnVisibilityChange: handleColumnVisibilityChange,
		canEditCell: canEditCellCoord,
		onCommitCell: handleCommitCell,
	});

	const ctxValue: DataTableContextValue<TRow> = {
		behavior,
		sourceResult,
		mutationHandle,
		navigationPort,
		permissionPort,
		density,
		variant,
		resourceType,
		sorting,
		setSorting: handleSortingChange,
		columnFilters,
		setColumnFilters: handleColumnFiltersChange,
		globalFilter,
		setGlobalFilter: handleGlobalFilterChange,
		pagination,
		setPagination: handlePaginationChange,
		rowSelection,
		setRowSelection: handleRowSelectionChange,
		columnVisibility,
		setColumnVisibility: handleColumnVisibilityChange,
		canEditCellCoord,
		getRowHref,
	};

	const rootState: DataTableRootRenderState = {
		density,
		variant,
		status: sourceResult.status,
		editMode: behavior.editState.kind,
	};

	const renderedRoot = useRender({
		defaultTagName: "div",
		render,
		ref,
		state: rootState,
		props: mergeProps<"div">(elementProps, {
			className: getDataTableRootClassName({ variant, className }),
			"data-density": density,
			"data-variant": variant,
			"data-status": sourceResult.status,
			"data-edit-mode": behavior.editState.kind,
			children:
				children ?? (
					<>
						<DataTableToolbar />
						<DataTableHeader />
						<DataTableBody />
						<DataTablePagination />
					</>
				),
		} as React.ComponentPropsWithRef<"div">),
	});

	return (
		<DataTableContext.Provider
			value={ctxValue as unknown as DataTableContextValue<RowData>}
		>
			{renderedRoot}
		</DataTableContext.Provider>
	);
}

/* ==========================================================================
   2. DataTable.Toolbar (App-Actions Slot + Search / Bulk Summary)
   ========================================================================== */

export interface DataTableToolbarRenderState extends Record<string, unknown> {
	readonly selectedCount: number;
	readonly globalFilter: string;
}

export type DataTableToolbarRenderProp =
	useRender.RenderProp<DataTableToolbarRenderState>;

export interface DataTableToolbarProps
	extends Omit<
		useRender.ComponentProps<"div", DataTableToolbarRenderState>,
		"className" | "render" | "ref"
	> {
	/**
	 * Slot for application-level toolbar actions (e.g. `<Button>` leaves).
	 */
	readonly actions?: React.ReactNode | undefined;
	/**
	 * Placeholder text for the built-in search input.
	 * @default "Filter rows..."
	 */
	readonly searchPlaceholder?: string | undefined;
	/**
	 * Hide the built-in search input if the app supplies a custom filter control.
	 * @default false
	 */
	readonly hideSearch?: boolean | undefined;
	readonly render?: DataTableToolbarRenderProp | undefined;
	readonly className?: string | undefined;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

export function DataTableToolbar(
	props: DataTableToolbarProps,
): React.ReactElement {
	const {
		actions,
		searchPlaceholder = "Filter rows...",
		hideSearch = false,
		render,
		className,
		ref,
		children,
		...elementProps
	} = props;

	const { globalFilter, setGlobalFilter, rowSelection } =
		useDataTableContext();
	const selectedCount = Object.keys(rowSelection).filter(
		(k) => rowSelection[k],
	).length;

	const state: DataTableToolbarRenderState = {
		selectedCount,
		globalFilter,
	};

	const defaultContent = (
		<>
			<div className="flex items-center space-x-btn-px-sm">
				{!hideSearch && (
					<input
						type="search"
						aria-label={searchPlaceholder}
						placeholder={searchPlaceholder}
						value={globalFilter}
						onChange={(e) => setGlobalFilter(e.target.value)}
						className={getDataTableCellEditorInputClassName()}
						data-testid="datatable-toolbar-search"
					/>
				)}
				{selectedCount > 0 && (
					<span
						data-testid="datatable-selected-count"
						className="text-btn-sm text-fg-secondary"
					>
						{selectedCount} selected
					</span>
				)}
				{children}
			</div>
			{actions !== undefined && (
				<div
					data-testid="datatable-toolbar-actions"
					className="flex items-center space-x-btn-px-sm"
				>
					{actions}
				</div>
			)}
		</>
	);

	return useRender({
		defaultTagName: "div",
		render,
		ref,
		state,
		props: mergeProps<"div">(elementProps, {
			role: "toolbar",
			className: getDataTableToolbarClassName(className),
			children: defaultContent,
		} as React.ComponentPropsWithRef<"div">),
	});
}

/* ==========================================================================
   3. DataTable.Header
   ========================================================================== */

export interface DataTableHeaderRenderState extends Record<string, unknown> {
	readonly density: DataTableDensity;
}

export type DataTableHeaderRenderProp =
	useRender.RenderProp<DataTableHeaderRenderState>;

export interface DataTableHeaderProps
	extends Omit<
		useRender.ComponentProps<"div", DataTableHeaderRenderState>,
		"className" | "render" | "ref"
	> {
	readonly render?: DataTableHeaderRenderProp | undefined;
	readonly className?: string | undefined;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

export function DataTableHeader(
	props: DataTableHeaderProps,
): React.ReactElement {
	const { render, className, ref, children, ...elementProps } = props;
	const { behavior, density } = useDataTableContext();
	const headerGroups = behavior.table.getHeaderGroups();

	const defaultContent = children ?? (
		<table className={getDataTableTableClassName()}>
			<thead>
				{headerGroups.map((headerGroup) => (
					<tr key={headerGroup.id} className={getDataTableHeaderRowClassName()}>
						{headerGroup.headers.map((header) => {
							const canSort = header.column.getCanSort();
							const sortDir = header.column.getIsSorted();
							const ariaSort =
								sortDir === "asc"
									? "ascending"
									: sortDir === "desc"
										? "descending"
										: "none";
							const toggleSorting = header.column.getToggleSortingHandler();
							return (
								<th
									key={header.id}
									scope="col"
									aria-sort={ariaSort}
									tabIndex={canSort ? 0 : undefined}
									data-column-id={header.column.id}
									data-sortable={canSort ? "true" : "false"}
									data-sort-dir={sortDir ? String(sortDir) : "none"}
									className={getDataTableHeaderCellClassName()}
									onClick={canSort ? toggleSorting : undefined}
									onKeyDown={
										canSort
											? (e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														toggleSorting?.(e);
													}
												}
											: undefined
									}
								>
									{header.isPlaceholder ? null : (
										<behavior.table.FlexRender header={header} />
									)}
								</th>
							);
						})}
					</tr>
				))}
			</thead>
		</table>
	);

	return useRender({
		defaultTagName: "div",
		render,
		ref,
		state: { density },
		props: mergeProps<"div">(elementProps, {
			className: getDataTableHeaderClassName(className),
			children: defaultContent,
		} as React.ComponentPropsWithRef<"div">),
	});
}

/* ==========================================================================
   4. DataTable.Body
   ========================================================================== */

export interface DataTableBodyRenderState extends Record<string, unknown> {
	readonly status: RowSourceResult<unknown>["status"];
	readonly rowCount: number;
}

export type DataTableBodyRenderProp =
	useRender.RenderProp<DataTableBodyRenderState>;

export interface DataTableBodyProps<TRow extends RowData = RowData>
	extends Omit<
		useRender.ComponentProps<"div", DataTableBodyRenderState>,
		"className" | "render" | "ref" | "children"
	> {
	readonly loadingFallback?: React.ReactNode | undefined;
	readonly emptyFallback?: React.ReactNode | undefined;
	readonly errorFallback?:
		| React.ReactNode
		| ((errorMessage: string) => React.ReactNode)
		| undefined;
	readonly children?:
		| React.ReactNode
		| ((
				row: Row<DataTableFeatures, TRow>,
				virtualRowIndex: number,
		  ) => React.ReactNode)
		| undefined;
	readonly render?: DataTableBodyRenderProp | undefined;
	readonly className?: string | undefined;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

export function DataTableBody<TRow extends RowData = RowData>(
	props: DataTableBodyProps<TRow>,
): React.ReactElement {
	const {
		loadingFallback = "Loading rows...",
		emptyFallback = "No rows match the current filter.",
		errorFallback,
		children,
		render,
		className,
		ref,
		...elementProps
	} = props;

	const { behavior, sourceResult } = useDataTableContext<TRow>();
	const virtualItems = behavior.rowVirtualizer.getVirtualItems();
	const modelRows = behavior.table.getRowModel().rows;

	let bodyInner: React.ReactNode;
	if (sourceResult.status === "loading") {
		bodyInner = (
			<output
				data-status="loading"
				data-testid="datatable-status-loading"
				className={getDataTableStatusBannerClassName()}
			>
				{loadingFallback}
			</output>
		);
	} else if (sourceResult.status === "error") {
		const message = sourceResult.error ?? "Failed to load rows";
		bodyInner = (
			<div
				role="alert"
				data-status="error"
				data-testid="datatable-status-error"
				className={getDataTableStatusBannerClassName()}
			>
				{typeof errorFallback === "function"
					? errorFallback(message)
					: (errorFallback ?? message)}
			</div>
		);
	} else if (modelRows.length === 0) {
		bodyInner = (
			<output
				data-status="empty"
				data-testid="datatable-status-empty"
				className={getDataTableStatusBannerClassName()}
			>
				{emptyFallback}
			</output>
		);
	} else {
		bodyInner = (
			<div
				data-testid="datatable-virtual-body"
				className={getDataTableBodyClassName()}
				style={{
					height: behavior.rowVirtualizer.getTotalSize(),
				}}
			>
				{virtualItems.map((vRow) => {
					const row = modelRows[vRow.index];
					if (!row) return null;
					if (typeof children === "function") {
						return (
							<React.Fragment key={row.id}>
								{children(row, vRow.index)}
							</React.Fragment>
						);
					}
					return (
						<DataTableRow
							key={row.id}
							row={row}
							virtualRowIndex={vRow.index}
							virtualStart={vRow.start}
							virtualSize={vRow.size}
						/>
					);
				})}
			</div>
		);
	}

	const state: DataTableBodyRenderState = {
		status: sourceResult.status,
		rowCount: sourceResult.rowCount,
	};

	return useRender({
		defaultTagName: "div",
		render,
		ref: ref ?? behavior.scrollContainerRef,
		state,
		props: mergeProps<"div">(elementProps, {
			role: "grid",
			tabIndex: 0,
			"aria-rowcount": sourceResult.rowCount,
			"data-testid": "datatable-grid",
			className: getDataTableViewportClassName(
				getDataTableTableClassName(className),
			),
			onKeyDown: behavior.handleGridKeyDown,
			children: bodyInner,
		} as React.ComponentPropsWithRef<"div">),
	});
}

/* ==========================================================================
   5. DataTable.Row
   ========================================================================== */

export interface DataTableRowRenderState<TRow = unknown>
	extends Record<string, unknown> {
	readonly row: TRow;
	readonly rowId: string;
	readonly rowIndex: number;
	readonly selected: boolean;
	readonly pending: boolean;
}

export type DataTableRowRenderProp<TRow = unknown> = useRender.RenderProp<
	DataTableRowRenderState<TRow>
>;

export interface DataTableRowProps<TRow extends RowData = RowData>
	extends Omit<
		useRender.ComponentProps<"div", DataTableRowRenderState<TRow>>,
		"className" | "render" | "ref"
	> {
	readonly row: Row<DataTableFeatures, TRow>;
	readonly virtualRowIndex: number;
	readonly virtualStart?: number | undefined;
	readonly virtualSize?: number | undefined;
	readonly render?: DataTableRowRenderProp<TRow> | undefined;
	readonly className?: string | undefined;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

export function DataTableRow<TRow extends RowData = RowData>(
	props: DataTableRowProps<TRow>,
): React.ReactElement {
	const {
		row,
		virtualRowIndex,
		virtualStart,
		virtualSize,
		render,
		className,
		ref,
		children,
		...elementProps
	} = props;

	const { mutationHandle, navigationPort, getRowHref } =
		useDataTableContext<TRow>();
	const isSelected = row.getIsSelected();
	const isPending = mutationHandle.pendingIds.has(row.id);
	const rowHref = getRowHref?.(row.original);
	const resolvedHref = useNavigationHref(rowHref ?? "");

	const state: DataTableRowRenderState<TRow> = {
		row: row.original,
		rowId: row.id,
		rowIndex: virtualRowIndex,
		selected: isSelected,
		pending: isPending,
	};

	const positioningStyle: React.CSSProperties | undefined =
		virtualStart !== undefined
			? {
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					transform: `translateY(${virtualStart}px)`,
					height: virtualSize,
				}
			: undefined;

	const defaultCells =
		children ??
		row
			.getVisibleCells()
			.map((cell, colIndex) => (
				<DataTableCell
					key={cell.id}
					cell={cell}
					rowIndex={virtualRowIndex}
					colIndex={colIndex}
				/>
			));

	return useRender({
		defaultTagName: "div",
		render,
		ref,
		state,
		props: mergeProps<"div">(elementProps, {
			role: "row",
			tabIndex: -1,
			"data-testid": `datatable-row-${row.id}`,
			"data-row-id": row.id,
			"data-row-index": virtualRowIndex,
			"data-selected": isSelected ? "true" : "false",
			"data-pending": isPending ? "true" : "false",
			"data-clickable": rowHref ? "true" : "false",
			"data-href": rowHref ? resolvedHref : undefined,
			style: positioningStyle,
			className: getDataTableRowClassName(className),
			onClick: () => {
				if (rowHref && navigationPort) {
					navigationPort.navigate(rowHref);
				}
			},
			children: defaultCells,
		} as React.ComponentPropsWithRef<"div">),
	});
}

/* ==========================================================================
   6. DataTable.Cell (with Typed Render Contract for cell & editCell)
   ========================================================================== */

export interface DataTableCellProps<
	TRow extends RowData = RowData,
	TValue = CellData,
> extends Omit<
		useRender.ComponentProps<"div", DataTableCellRenderState<TRow, TValue>>,
		"className" | "render" | "ref"
	> {
	readonly cell: Cell<DataTableFeatures, TRow, TValue>;
	readonly rowIndex: number;
	readonly colIndex: number;
	/**
	 * Direct Base UI `render` override for the cell container/content.
	 */
	readonly render?: DataTableCellRenderProp<TRow, TValue> | undefined;
	/**
	 * Direct Base UI `render` override for the inline cell editor when editing.
	 */
	readonly editRender?: DataTableEditCellRenderProp<TRow, TValue> | undefined;
	readonly className?: string | undefined;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

export function DataTableCell<
	TRow extends RowData = RowData,
	TValue = CellData,
>(props: DataTableCellProps<TRow, TValue>): React.ReactElement {
	const {
		cell,
		rowIndex,
		colIndex,
		render,
		editRender,
		className,
		ref,
		children,
		...elementProps
	} = props;

	const { behavior, canEditCellCoord } = useDataTableContext<TRow>();
	const rowId = cell.row.id;
	const columnId = cell.column.id;
	const coord: GridCellCoord = {
		rowIndex,
		colIndex,
		rowId,
		columnId,
	};

	const columnMeta = cell.column.columnDef.meta as
		| DataTableColumnMeta<TRow, TValue>
		| undefined;
	const isEditable = canEditCellCoord(coord, cell.row.original);
	const isFocused = behavior.isCellFocused(rowIndex, colIndex);
	const isEditing = behavior.isCellEditing(rowId, columnId);
	const isSaving = behavior.isCellSaving(rowId, columnId);
	const cellError = behavior.getCellError(rowId, columnId);

	const draftValue = (
		(isEditing || isSaving) &&
		(behavior.editState.kind === "editing" ||
			behavior.editState.kind === "saving" ||
			behavior.editState.kind === "error")
			? behavior.editState.draftValue
			: cell.getValue()
	) as TValue;

	const editCellState: DataTableEditCellRenderState<TRow, TValue> = {
		row: cell.row.original,
		rowId,
		columnId,
		draftValue,
		saving: isSaving,
		error: cellError,
		updateDraft: behavior.updateDraft,
		commitEdit: behavior.commitEdit,
		cancelEdit: behavior.cancelEdit,
	};

	const resolvedEditRender = editRender ?? columnMeta?.editCellRender;

	// Always call useRender unconditionally (with `enabled: isEditing || isSaving`) to obey Rules of Hooks
	const renderedEditor = useRender({
		defaultTagName: "input",
		enabled: isEditing || isSaving,
		render: resolvedEditRender,
		state: editCellState,
		props: mergeProps<"input">(
			{},
			{
				type: "text",
				"aria-label": `Edit ${columnId} for ${rowId}`,
				"aria-invalid": cellError ? true : undefined,
				"data-testid": `datatable-cell-editor-${rowId}-${columnId}`,
				"data-saving": isSaving ? "true" : "false",
				"data-error": cellError ? "true" : "false",
				disabled: isSaving,
				value: String(draftValue ?? ""),
				className: getDataTableCellEditorInputClassName(),
				onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
					behavior.updateDraft(e.target.value);
				},
				onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
					if (e.key === "Enter") {
						e.preventDefault();
						e.stopPropagation();
						void behavior.commitEdit();
					} else if (e.key === "Escape") {
						e.preventDefault();
						e.stopPropagation();
						behavior.cancelEdit();
					}
				},
			} as React.ComponentPropsWithRef<"input">,
		),
	});

	const cellState: DataTableCellRenderState<TRow, TValue> = {
		row: cell.row.original,
		rowId,
		rowIndex,
		columnId,
		colIndex,
		value: cell.getValue(),
		focused: isFocused,
		editing: isEditing,
		saving: isSaving,
		error: cellError,
		editable: isEditable,
	};

	const resolvedCellRender =
		isEditing || isSaving ? render : (render ?? columnMeta?.cellRender);

	const defaultCellContent =
		isEditing || isSaving ? (
			<div className="flex w-full items-center">
				{renderedEditor}
				{cellError && (
					<span
						role="alert"
						data-testid={`datatable-cell-error-${rowId}-${columnId}`}
						className={getDataTableCellErrorClassName()}
					>
						{cellError}
					</span>
				)}
			</div>
		) : (
			(children ?? <behavior.table.FlexRender cell={cell} />)
		);

	return useRender({
		defaultTagName: "div",
		render: resolvedCellRender,
		ref,
		state: cellState,
		props: mergeProps<"div">(elementProps, {
			role: "gridcell",
			tabIndex: -1,
			"aria-readonly": !isEditable ? true : undefined,
			"data-testid": `datatable-cell-${rowId}-${columnId}`,
			"data-row-id": rowId,
			"data-column-id": columnId,
			"data-focused": isFocused ? "true" : "false",
			"data-editing": isEditing ? "true" : "false",
			"data-saving": isSaving ? "true" : "false",
			"data-error": cellError ? "true" : "false",
			"data-editable": isEditable ? "true" : "false",
			className: getDataTableCellClassName(className),
			onClick: () => {
				behavior.setFocusedCell(coord);
			},
			onDoubleClick: () => {
				behavior.setFocusedCell(coord);
				if (isEditable) {
					behavior.startEdit(coord);
				}
			},
			children: defaultCellContent,
		} as React.ComponentPropsWithRef<"div">),
	});
}

/* ==========================================================================
   7. DataTable.Pagination
   ========================================================================== */

export interface DataTablePaginationRenderState
	extends Record<string, unknown> {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly pageCount: number;
	readonly rowCount: number;
	readonly canPreviousPage: boolean;
	readonly canNextPage: boolean;
}

export type DataTablePaginationRenderProp =
	useRender.RenderProp<DataTablePaginationRenderState>;

export interface DataTablePaginationProps
	extends Omit<
		useRender.ComponentProps<"div", DataTablePaginationRenderState>,
		"className" | "render" | "ref"
	> {
	readonly render?: DataTablePaginationRenderProp | undefined;
	readonly className?: string | undefined;
	readonly ref?: React.Ref<HTMLDivElement> | undefined;
}

export function DataTablePagination(
	props: DataTablePaginationProps,
): React.ReactElement {
	const { render, className, ref, children, ...elementProps } = props;
	const { behavior, pagination, sourceResult } = useDataTableContext();
	const pageCount = behavior.table.getPageCount();
	const canPreviousPage = behavior.table.getCanPreviousPage();
	const canNextPage = behavior.table.getCanNextPage();

	const state: DataTablePaginationRenderState = {
		pageIndex: pagination.pageIndex,
		pageSize: pagination.pageSize,
		pageCount,
		rowCount: sourceResult.rowCount,
		canPreviousPage,
		canNextPage,
	};

	const defaultContent = children ?? (
		<>
			<span data-testid="datatable-pagination-summary">
				Page {pagination.pageIndex + 1} of {Math.max(1, pageCount)} (
				{sourceResult.rowCount} total)
			</span>
			<div className="flex items-center space-x-btn-px-sm">
				<button
					type="button"
					data-testid="datatable-page-prev"
					disabled={!canPreviousPage}
					onClick={() => behavior.table.previousPage()}
					className="rounded-btn border border-table-border px-btn-px-sm py-table-cell-py disabled:opacity-50"
				>
					Previous
				</button>
				<button
					type="button"
					data-testid="datatable-page-next"
					disabled={!canNextPage}
					onClick={() => behavior.table.nextPage()}
					className="rounded-btn border border-table-border px-btn-px-sm py-table-cell-py disabled:opacity-50"
				>
					Next
				</button>
			</div>
		</>
	);

	return useRender({
		defaultTagName: "div",
		render,
		ref,
		state,
		props: mergeProps<"div">(elementProps, {
			role: "navigation",
			"aria-label": "Table pagination",
			className: getDataTablePaginationClassName(className),
			children: defaultContent,
		} as React.ComponentPropsWithRef<"div">),
	});
}

/* ==========================================================================
   COMPOUND NAMESPACE EXPORT
   ========================================================================== */

export const DataTable = {
	Root: DataTableRoot,
	Toolbar: DataTableToolbar,
	Header: DataTableHeader,
	Body: DataTableBody,
	Row: DataTableRow,
	Cell: DataTableCell,
	Pagination: DataTablePagination,
} as const;
