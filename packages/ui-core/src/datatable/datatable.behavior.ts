/**
 * L1 — DataTable Behavior Core (`@platform/ui`)
 *
 * Implements the headless behavior layer for the Tier-4 Editable DataTable:
 * 1. TanStack Table v9 NATIVE API (`useTable` + explicit `tableFeatures({...})`).
 *    NO `useReactTable`, NO `useLegacyTable`, NO `stockFeatures`, NO `/legacy`.
 * 2. MANUAL server-driven mode (`manualSorting`, `manualFiltering`, `manualPagination`,
 *    server `rowCount`). Registers ZERO client sorted/filtered/paginated row models.
 * 3. TanStack Virtual (`useVirtualizer`) windowing the loaded page with fixed row height + overscan.
 * 4. Local edit-mode state machine (`idle -> editing(cell) -> saving -> error`) in local UI state.
 * 5. Keyboard grid navigation (`ArrowUp/Down/Left/Right`, `Home`, `End`, `Enter` to edit/commit,
 *    `Escape` to cancel) with visible focus coordinates in local UI state.
 * 6. Controlled sort/filter/page state slices so the caller/adapter owns URL & query synchronization.
 */

import {
	type CellData,
	type ColumnDef,
	type ColumnFiltersState,
	type ColumnVisibilityState,
	columnFilteringFeature,
	columnSizingFeature,
	columnVisibilityFeature,
	functionalUpdate,
	globalFilteringFeature,
	type OnChangeFn,
	type PaginationState,
	type ReactTable,
	type RowData,
	type RowSelectionState,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	type SortingState,
	tableFeatures,
	type Updater,
	useTable,
} from "@tanstack/react-table";
import {
	observeElementRect,
	useVirtualizer,
	type Virtualizer,
} from "@tanstack/react-virtual";
import * as React from "react";

/**
 * Explicit v9 feature set for DataTable.
 * Notice: ZERO client row models (`sortedRowModel`, `filteredRowModel`, `paginatedRowModel`)
 * are registered because sorting, filtering, and pagination are strictly server/adapter-driven.
 */
export const dataTableFeatures = tableFeatures({
	rowSortingFeature,
	columnFilteringFeature,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSelectionFeature,
	columnVisibilityFeature,
	columnSizingFeature,
});

export type DataTableFeatures = typeof dataTableFeatures;

const EMPTY_ROWS: readonly never[] = [];
const EMPTY_SORTING: SortingState = [];
const EMPTY_COLUMN_FILTERS: ColumnFiltersState = [];
const EMPTY_ROW_SELECTION: RowSelectionState = {};
const EMPTY_COLUMN_VISIBILITY: ColumnVisibilityState = {};
const DEFAULT_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 50 };

/**
 * Coordinates of a cell in the grid (local UI state for focus & editing).
 */
export interface GridCellCoord {
	readonly rowIndex: number;
	readonly colIndex: number;
	readonly rowId: string;
	readonly columnId: string;
}

/**
 * Local edit-mode state machine: `idle -> editing(cell) -> saving -> error`.
 */
export type EditModeState =
	| { readonly kind: "idle" }
	| {
			readonly kind: "editing";
			readonly cell: GridCellCoord;
			readonly draftValue: unknown;
	  }
	| {
			readonly kind: "saving";
			readonly cell: GridCellCoord;
			readonly draftValue: unknown;
	  }
	| {
			readonly kind: "error";
			readonly cell: GridCellCoord;
			readonly draftValue: unknown;
			readonly message: string;
	  };

export type EditModeAction =
	| {
			readonly type: "START_EDIT";
			readonly cell: GridCellCoord;
			readonly initialValue: unknown;
	  }
	| { readonly type: "UPDATE_DRAFT"; readonly draftValue: unknown }
	| { readonly type: "START_SAVE" }
	| { readonly type: "SAVE_SUCCESS" }
	| { readonly type: "SAVE_ERROR"; readonly message: string }
	| { readonly type: "CANCEL_EDIT" };

export const INITIAL_EDIT_MODE_STATE: EditModeState = { kind: "idle" };

/**
 * Pure reducer for the cell edit-mode state machine.
 */
export function editModeReducer(
	state: EditModeState,
	action: EditModeAction,
): EditModeState {
	switch (action.type) {
		case "START_EDIT":
			if (state.kind === "saving") return state;
			return {
				kind: "editing",
				cell: action.cell,
				draftValue: action.initialValue,
			};
		case "UPDATE_DRAFT":
			if (state.kind === "editing" || state.kind === "error") {
				return {
					kind: "editing",
					cell: state.cell,
					draftValue: action.draftValue,
				};
			}
			return state;
		case "START_SAVE":
			if (state.kind === "editing" || state.kind === "error") {
				return {
					kind: "saving",
					cell: state.cell,
					draftValue: state.draftValue,
				};
			}
			return state;
		case "SAVE_SUCCESS":
			return { kind: "idle" };
		case "SAVE_ERROR":
			if (state.kind === "saving" || state.kind === "editing") {
				return {
					kind: "error",
					cell: state.cell,
					draftValue: state.draftValue,
					message: action.message,
				};
			}
			return state;
		case "CANCEL_EDIT":
			if (state.kind === "saving") return state;
			return { kind: "idle" };
		default:
			return state;
	}
}

/**
 * Controlled query/URL state slice that leaves the component.
 * The brick reflects these values and emits changes via callbacks; it never owns
 * them in internal `useState` as the source of truth.
 */
export interface DataTableControlledState {
	readonly sorting?: SortingState | undefined;
	readonly onSortingChange?: OnChangeFn<SortingState> | undefined;
	readonly columnFilters?: ColumnFiltersState | undefined;
	readonly onColumnFiltersChange?: OnChangeFn<ColumnFiltersState> | undefined;
	readonly globalFilter?: string | undefined;
	readonly onGlobalFilterChange?: OnChangeFn<string> | undefined;
	readonly pagination?: PaginationState | undefined;
	readonly onPaginationChange?: OnChangeFn<PaginationState> | undefined;
	readonly rowSelection?: RowSelectionState | undefined;
	readonly onRowSelectionChange?: OnChangeFn<RowSelectionState> | undefined;
	readonly columnVisibility?: ColumnVisibilityState | undefined;
	readonly onColumnVisibilityChange?:
		| OnChangeFn<ColumnVisibilityState>
		| undefined;
}

export interface UseDataTableBehaviorOptions<TRow extends RowData>
	extends DataTableControlledState {
	/**
	 * Already-sorted, already-filtered, already-paginated rows for the current page.
	 */
	readonly rows: readonly TRow[];
	/**
	 * Total number of matching rows on the server / data source across all pages.
	 */
	readonly rowCount: number;
	/**
	 * Column definitions for TanStack Table v9.
	 */
	readonly columns: ReadonlyArray<ColumnDef<DataTableFeatures, TRow, CellData>>;
	/**
	 * Stable row identifier extractor.
	 */
	readonly getRowId: (originalRow: TRow, index: number) => string;
	/**
	 * Fixed row height in pixels for TanStack Virtual windowing.
	 * @default 44
	 */
	readonly rowHeight?: number | undefined;
	/**
	 * Virtualizer overscan row count.
	 * @default 8
	 */
	readonly overscan?: number | undefined;
	/**
	 * Initial viewport height fallback for headless/test environments where
	 * `ResizeObserver` / layout metrics report 0.
	 * @default 440
	 */
	readonly initialViewportHeight?: number | undefined;
	/**
	 * Predicate determining whether a given cell may enter edit mode.
	 */
	readonly canEditCell?: ((cell: GridCellCoord, row: TRow) => boolean) | undefined;
	/**
	 * Reads the initial draft value when entering edit mode on a cell.
	 */
	readonly getCellValue?: ((cell: GridCellCoord, row: TRow) => unknown) | undefined;
	/**
	 * Invoked when the user commits an edit (e.g. pressing Enter in edit mode or calling `commitEdit`).
	 * May return a Promise; resolves -> `idle`, rejects/throws -> `error(cell, draftValue, message)`.
	 */
	readonly onCommitCell?:
		| ((cell: GridCellCoord, draftValue: unknown, row: TRow) => Promise<void> | void)
		| undefined;
	/**
	 * Optional IoC state reducer override for the edit-mode state machine.
	 */
	readonly editStateReducer?:
		| ((state: EditModeState, action: EditModeAction) => EditModeState)
		| undefined;
}

export interface DataTableBehaviorResult<TRow extends RowData> {
	readonly table: ReactTable<DataTableFeatures, TRow>;
	readonly scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	readonly rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
	readonly editState: EditModeState;
	readonly focusedCell: GridCellCoord | null;
	readonly setFocusedCell: React.Dispatch<
		React.SetStateAction<GridCellCoord | null>
	>;
	readonly startEdit: (cell: GridCellCoord, initialValue?: unknown) => boolean;
	readonly updateDraft: (draftValue: unknown) => void;
	readonly cancelEdit: () => void;
	readonly commitEdit: () => Promise<boolean>;
	readonly handleGridKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
	readonly isCellEditing: (rowId: string, columnId: string) => boolean;
	readonly isCellSaving: (rowId: string, columnId: string) => boolean;
	readonly getCellError: (rowId: string, columnId: string) => string | null;
	readonly isCellFocused: (rowIndex: number, colIndex: number) => boolean;
}

/**
 * Helper to apply a TanStack `Updater<T>` against a current state value when bridging
 * controlled callbacks.
 */
export function resolveUpdater<TState>(
	updater: Updater<TState>,
	current: TState,
): TState {
	return functionalUpdate(updater, current);
}

/**
 * L1 headless behavior hook for DataTable.
 */
export function useDataTableBehavior<TRow extends RowData>(
	options: UseDataTableBehaviorOptions<TRow>,
): DataTableBehaviorResult<TRow> {
	const {
		rows,
		rowCount,
		columns,
		getRowId,
		sorting = EMPTY_SORTING,
		onSortingChange,
		columnFilters = EMPTY_COLUMN_FILTERS,
		onColumnFiltersChange,
		globalFilter = "",
		onGlobalFilterChange,
		pagination = DEFAULT_PAGINATION,
		onPaginationChange,
		rowSelection = EMPTY_ROW_SELECTION,
		onRowSelectionChange,
		columnVisibility = EMPTY_COLUMN_VISIBILITY,
		onColumnVisibilityChange,
		rowHeight = 44,
		overscan = 8,
		initialViewportHeight = 440,
		canEditCell,
		getCellValue,
		onCommitCell,
		editStateReducer = editModeReducer,
	} = options;

	const stableData = (rows.length > 0 ? rows : EMPTY_ROWS) as TRow[];

	const table = useTable({
		features: dataTableFeatures,
		columns,
		data: stableData,
		rowCount,
		getRowId,
		manualSorting: true,
		manualFiltering: true,
		manualPagination: true,
		state: {
			sorting,
			columnFilters,
			globalFilter,
			pagination,
			rowSelection,
			columnVisibility,
		},
		onSortingChange,
		onColumnFiltersChange,
		onGlobalFilterChange,
		onPaginationChange,
		onRowSelectionChange,
		onColumnVisibilityChange,
	});

	const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
	const modelRows = table.getRowModel().rows;

	const rowVirtualizer = useVirtualizer({
		count: modelRows.length,
		getScrollElement: () => scrollContainerRef.current,
		estimateSize: () => rowHeight,
		getItemKey: (index) => modelRows[index]?.id ?? index,
		overscan,
		initialRect: { width: 1024, height: initialViewportHeight },
		observeElementRect: (instance, cb) =>
			observeElementRect(instance, (rect) => {
				cb({
					width: rect.width > 0 ? rect.width : 1024,
					height: rect.height > 0 ? rect.height : initialViewportHeight,
				});
			}),
	});

	const [editState, dispatchEdit] = React.useReducer(
		editStateReducer,
		INITIAL_EDIT_MODE_STATE,
	);
	const [focusedCell, setFocusedCell] = React.useState<GridCellCoord | null>(
		null,
	);

	const resolveCoord = (
		rowIndex: number,
		colIndex: number,
	): GridCellCoord | null => {
		const row = modelRows[rowIndex];
		if (!row) return null;
		const cells = row.getVisibleCells();
		const cell = cells[colIndex];
		if (!cell) return null;
		return {
			rowIndex,
			colIndex,
			rowId: row.id,
			columnId: cell.column.id,
		};
	};

	const startEdit = (cell: GridCellCoord, initialValue?: unknown): boolean => {
		const row = modelRows[cell.rowIndex];
		if (!row) return false;
		if (canEditCell && !canEditCell(cell, row.original)) {
			return false;
		}
		const resolvedInitial =
			initialValue !== undefined
				? initialValue
				: getCellValue
					? getCellValue(cell, row.original)
					: row.getAllCells().find((c) => c.column.id === cell.columnId)?.getValue();

		setFocusedCell(cell);
		dispatchEdit({
			type: "START_EDIT",
			cell,
			initialValue: resolvedInitial,
		});
		return true;
	};

	const updateDraft = (draftValue: unknown): void => {
		dispatchEdit({ type: "UPDATE_DRAFT", draftValue });
	};

	const cancelEdit = (): void => {
		dispatchEdit({ type: "CANCEL_EDIT" });
	};

	const commitEdit = async (): Promise<boolean> => {
		if (editState.kind !== "editing" && editState.kind !== "error") {
			return false;
		}
		const targetCell = editState.cell;
		const draftValue = editState.draftValue;
		const row = modelRows.find((r) => r.id === targetCell.rowId);
		if (!row) {
			dispatchEdit({ type: "CANCEL_EDIT" });
			return false;
		}

		dispatchEdit({ type: "START_SAVE" });
		try {
			await onCommitCell?.(targetCell, draftValue, row.original);
			dispatchEdit({ type: "SAVE_SUCCESS" });
			return true;
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to save cell edit";
			dispatchEdit({ type: "SAVE_ERROR", message });
			return false;
		}
	};

	const handleGridKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
		const rowTotal = modelRows.length;
		const firstRow = modelRows[0];
		const colTotal = firstRow ? firstRow.getVisibleCells().length : 0;
		if (rowTotal === 0 || colTotal === 0) return;

		if (editState.kind === "editing" || editState.kind === "error") {
			if (event.key === "Escape") {
				event.preventDefault();
				cancelEdit();
				return;
			}
			if (event.key === "Enter") {
				event.preventDefault();
				void commitEdit();
				return;
			}
			return;
		}

		if (editState.kind === "saving") {
			return;
		}

		const current = focusedCell ?? resolveCoord(0, 0);
		if (!current) return;

		switch (event.key) {
			case "ArrowDown": {
				event.preventDefault();
				const next = resolveCoord(
					Math.min(rowTotal - 1, current.rowIndex + 1),
					current.colIndex,
				);
				if (next) setFocusedCell(next);
				break;
			}
			case "ArrowUp": {
				event.preventDefault();
				const next = resolveCoord(
					Math.max(0, current.rowIndex - 1),
					current.colIndex,
				);
				if (next) setFocusedCell(next);
				break;
			}
			case "ArrowRight": {
				event.preventDefault();
				const next = resolveCoord(
					current.rowIndex,
					Math.min(colTotal - 1, current.colIndex + 1),
				);
				if (next) setFocusedCell(next);
				break;
			}
			case "ArrowLeft": {
				event.preventDefault();
				const next = resolveCoord(
					current.rowIndex,
					Math.max(0, current.colIndex - 1),
				);
				if (next) setFocusedCell(next);
				break;
			}
			case "Home": {
				event.preventDefault();
				const targetRow = event.ctrlKey || event.metaKey ? 0 : current.rowIndex;
				const next = resolveCoord(targetRow, 0);
				if (next) setFocusedCell(next);
				break;
			}
			case "End": {
				event.preventDefault();
				const targetRow =
					event.ctrlKey || event.metaKey ? rowTotal - 1 : current.rowIndex;
				const next = resolveCoord(targetRow, colTotal - 1);
				if (next) setFocusedCell(next);
				break;
			}
			case "Enter":
			case "F2": {
				event.preventDefault();
				startEdit(current);
				break;
			}
			default:
				break;
		}
	};

	const isCellEditing = (rowId: string, columnId: string): boolean =>
		(editState.kind === "editing" || editState.kind === "error") &&
		editState.cell.rowId === rowId &&
		editState.cell.columnId === columnId;

	const isCellSaving = (rowId: string, columnId: string): boolean =>
		editState.kind === "saving" &&
		editState.cell.rowId === rowId &&
		editState.cell.columnId === columnId;

	const getCellError = (rowId: string, columnId: string): string | null =>
		editState.kind === "error" &&
		editState.cell.rowId === rowId &&
		editState.cell.columnId === columnId
			? editState.message
			: null;

	const isCellFocused = (rowIndex: number, colIndex: number): boolean =>
		focusedCell !== null &&
		focusedCell.rowIndex === rowIndex &&
		focusedCell.colIndex === colIndex;

	return {
		table,
		scrollContainerRef,
		rowVirtualizer,
		editState,
		focusedCell,
		setFocusedCell,
		startEdit,
		updateDraft,
		cancelEdit,
		commitEdit,
		handleGridKeyDown,
		isCellEditing,
		isCellSaving,
		getCellError,
		isCellFocused,
	};
}
