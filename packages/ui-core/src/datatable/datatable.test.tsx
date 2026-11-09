// @vitest-environment jsdom
/**
 * Stage 2 · Sub-step 1 — DataTable L1 Behavior Core Tests (`@platform/ui`)
 *
 * Verifies in isolation (in-memory only, zero network/Query/Router):
 * 1. TanStack Table v9 native `useTable` + explicit `tableFeatures` with ZERO client
 *    sorted/filtered/paginated row models registered (`manualSorting`, `manualFiltering`, `manualPagination`).
 * 2. TanStack Virtual windowing a 150-row page (only visible + overscan rows rendered) and scrolling.
 * 3. Controlled sort/filter/page state reflected into an in-memory rows adapter.
 * 4. Local edit-mode state machine (`idle -> editing -> saving -> idle / error`) + keyboard grid nav.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
	assertNavigationPortContract,
	assertPermissionPortContract,
	assertRowMutationPortContract,
	assertRowSourcePortContract,
	assertViewStatePortContract,
	createInMemoryNavigationAdapter,
	createInMemoryPermissionAdapter,
	createInMemoryRowMutationAdapter,
	createInMemoryRowSourceAdapter,
	createInMemoryRowStore,
	createInMemoryViewStateAdapter,
} from "@platform/ports";
import {
	act,
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import {
	createColumnHelper,
	type PaginationState,
	type SortingState,
} from "@tanstack/react-table";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type DataTableFeatures,
	dataTableFeatures,
	type GridCellCoord,
	resolveUpdater,
	useDataTableBehavior,
} from "./datatable.behavior";
import {
	NavigationPortProvider,
	PermissionPortProvider,
	RowMutationPortProvider,
	RowSourcePortProvider,
	useNavigationPort,
	usePermissionPort,
	useRowMutationPort,
	useRowSourcePort,
	useViewStatePort,
	ViewStatePortProvider,
} from "./datatable.ports";
import {
	EmptyStory,
	ErrorStateStory,
	HappyPathStory,
	INITIAL_STORY_ROWS,
	LoadingStory,
	OptimisticEditRollbackStory,
	OptimisticEditSuccessStory,
	StoryTableHarness,
} from "./datatable.stories";

afterEach(() => {
	cleanup();
});

interface DemoRow {
	readonly id: string;
	readonly label: string;
	readonly metric: number;
}

const columnHelper = createColumnHelper<DataTableFeatures, DemoRow>();
const demoColumns = columnHelper.columns([
	columnHelper.accessor("id", { header: "ID" }),
	columnHelper.accessor("label", { header: "Label" }),
	columnHelper.accessor("metric", { header: "Metric" }),
]);

const ALL_DEMO_ROWS: readonly DemoRow[] = Array.from(
	{ length: 300 },
	(_, i) => ({
		id: `item-${i + 1}`,
		label: `Item ${i + 1}`,
		metric: (i + 1) * 10,
	}),
);

/**
 * Hand-written in-memory rows adapter used to drive L1 behavior in Sub-step 1.
 */
function queryInMemoryRows(params: {
	sorting: SortingState;
	globalFilter: string;
	pagination: PaginationState;
	rowsSource?: readonly DemoRow[];
}): { rows: readonly DemoRow[]; rowCount: number } {
	const base = params.rowsSource ?? ALL_DEMO_ROWS;
	const q = params.globalFilter.trim().toLowerCase();
	const filtered = q
		? base.filter((r) => r.label.toLowerCase().includes(q) || r.id.includes(q))
		: [...base];

	const firstSort = params.sorting[0];
	if (firstSort) {
		const dir = firstSort.desc ? -1 : 1;
		filtered.sort((a, b) => {
			if (firstSort.id === "metric") return (a.metric - b.metric) * dir;
			if (firstSort.id === "label") return a.label.localeCompare(b.label) * dir;
			return a.id.localeCompare(b.id) * dir;
		});
	}

	const start = params.pagination.pageIndex * params.pagination.pageSize;
	const paged = filtered.slice(start, start + params.pagination.pageSize);
	return {
		rows: paged,
		rowCount: filtered.length,
	};
}

function BehaviorHarness(props: {
	pageSize?: number;
	onCommitCell?: (
		cell: GridCellCoord,
		draftValue: unknown,
		row: DemoRow,
	) => Promise<void> | void;
}): React.ReactElement {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = React.useState("");
	const [pagination, setPagination] = React.useState<PaginationState>({
		pageIndex: 0,
		pageSize: props.pageSize ?? 150,
	});

	const { rows, rowCount } = queryInMemoryRows({
		sorting,
		globalFilter,
		pagination,
	});

	const behavior = useDataTableBehavior<DemoRow>({
		rows,
		rowCount,
		columns: demoColumns,
		getRowId: (row) => row.id,
		sorting,
		onSortingChange: (u) => setSorting((prev) => resolveUpdater(u, prev)),
		globalFilter,
		onGlobalFilterChange: (u) =>
			setGlobalFilter((prev) => resolveUpdater(u, prev)),
		pagination,
		onPaginationChange: (u) => setPagination((prev) => resolveUpdater(u, prev)),
		rowHeight: 40,
		overscan: 3,
		initialViewportHeight: 200,
		onCommitCell: props.onCommitCell,
	});

	const virtualItems = behavior.rowVirtualizer.getVirtualItems();
	const modelRows = behavior.table.getRowModel().rows;

	return (
		<div>
			<div data-testid="meta-total-rows">{rowCount}</div>
			<div data-testid="meta-page-count">{behavior.table.getPageCount()}</div>
			<div data-testid="meta-virtual-count">{virtualItems.length}</div>
			<div data-testid="meta-edit-kind">{behavior.editState.kind}</div>
			{behavior.editState.kind === "error" && (
				<div data-testid="meta-edit-error">{behavior.editState.message}</div>
			)}
			<button
				type="button"
				data-testid="sort-metric-desc"
				onClick={() => setSorting([{ id: "metric", desc: true }])}
			>
				Sort Metric Desc
			</button>
			<div
				ref={behavior.scrollContainerRef}
				data-testid="grid-scroll"
				style={{ height: 200, overflow: "auto" }}
			>
				<table
					data-testid="grid-table"
					onKeyDown={behavior.handleGridKeyDown}
				>
					<tbody
						style={{
							display: "grid",
							height: behavior.rowVirtualizer.getTotalSize(),
							position: "relative",
						}}
					>
						{virtualItems.map((vRow) => {
							const row = modelRows[vRow.index];
							if (!row) return null;
							return (
								<tr
									key={row.id}
									data-testid={`vrow-${row.id}`}
									data-row-index={vRow.index}
									style={{
										position: "absolute",
										top: 0,
										transform: `translateY(${vRow.start}px)`,
										height: vRow.size,
									}}
								>
									{row.getVisibleCells().map((cell, colIndex) => {
										const isFocused = behavior.isCellFocused(
											vRow.index,
											colIndex,
										);
										const isEditing = behavior.isCellEditing(
											row.id,
											cell.column.id,
										);
										const isSaving = behavior.isCellSaving(
											row.id,
											cell.column.id,
										);
										return (
											<td
												key={cell.id}
												data-testid={`cell-${row.id}-${cell.column.id}`}
												data-focused={isFocused ? "true" : "false"}
												data-editing={isEditing ? "true" : "false"}
												data-saving={isSaving ? "true" : "false"}
											>
												{isEditing &&
												(behavior.editState.kind === "editing" ||
													behavior.editState.kind === "error") ? (
													<input
														data-testid="cell-editor-input"
														value={String(behavior.editState.draftValue ?? "")}
														onChange={(e) =>
															behavior.updateDraft(e.target.value)
														}
													/>
												) : (
													<behavior.table.FlexRender cell={cell} />
												)}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

describe("Stage 2 · Sub-step 1 — DataTable L1 Behavior Core (v9 Manual + Virtual + Edit Machine)", () => {
	it("registers explicit v9 features with ZERO client sorted/filtered/paginated row models", () => {
		expect(dataTableFeatures).toHaveProperty("rowSortingFeature");
		expect(dataTableFeatures).toHaveProperty("columnFilteringFeature");
		expect(dataTableFeatures).toHaveProperty("globalFilteringFeature");
		expect(dataTableFeatures).toHaveProperty("rowPaginationFeature");
		expect(dataTableFeatures).toHaveProperty("rowSelectionFeature");
		expect(dataTableFeatures).toHaveProperty("columnVisibilityFeature");
		expect(dataTableFeatures).toHaveProperty("columnSizingFeature");

		// Prove NO client row models are registered in manual mode
		expect("sortedRowModel" in dataTableFeatures).toBe(false);
		expect("filteredRowModel" in dataTableFeatures).toBe(false);
		expect("paginatedRowModel" in dataTableFeatures).toBe(false);
	});

	it("windows a 150-row page via TanStack Virtual and reflects manual server sorting", () => {
		render(<BehaviorHarness pageSize={150} />);

		expect(screen.getByTestId("meta-total-rows").textContent).toBe("300");
		expect(screen.getByTestId("meta-page-count").textContent).toBe("2");

		// Viewport height is 200px with rowHeight=40 (5 visible rows) + overscan=3 => 8 rendered rows out of 150!
		const virtualCount = Number(
			screen.getByTestId("meta-virtual-count").textContent,
		);
		expect(virtualCount).toBeGreaterThanOrEqual(5);
		expect(virtualCount).toBeLessThan(20);
		expect(screen.getByTestId("vrow-item-1")).toBeTruthy();
		expect(screen.queryByTestId("vrow-item-150")).toBeNull();

		// Trigger manual sort descending -> in-memory adapter puts item-300 first
		fireEvent.click(screen.getByTestId("sort-metric-desc"));
		expect(screen.getByTestId("vrow-item-300")).toBeTruthy();
	});

	it("drives keyboard grid navigation and the local edit-mode state machine (idle -> editing -> saving -> idle / error)", async () => {
		const onCommitCell = vi.fn(
			async (_cell: GridCellCoord, draftValue: unknown) => {
				if (String(draftValue) === "INVALID") {
					throw new Error("Validation failed: invalid label");
				}
			},
		);

		render(<BehaviorHarness pageSize={20} onCommitCell={onCommitCell} />);

		const grid = screen.getByTestId("grid-table");

		// ArrowRight moves focus from (0,0) to (0,1) [item-1, label]
		fireEvent.keyDown(grid, { key: "ArrowRight" });
		expect(
			screen.getByTestId("cell-item-1-label").getAttribute("data-focused"),
		).toBe("true");

		// ArrowDown moves focus to (1,1) [item-2, label]
		fireEvent.keyDown(grid, { key: "ArrowDown" });
		expect(
			screen.getByTestId("cell-item-2-label").getAttribute("data-focused"),
		).toBe("true");

		// Enter starts editing (idle -> editing)
		fireEvent.keyDown(grid, { key: "Enter" });
		expect(screen.getByTestId("meta-edit-kind").textContent).toBe("editing");

		const editor = screen.getByTestId("cell-editor-input") as HTMLInputElement;
		expect(editor.value).toBe("Item 2");

		// Escape cancels editing (editing -> idle)
		fireEvent.keyDown(grid, { key: "Escape" });
		expect(screen.getByTestId("meta-edit-kind").textContent).toBe("idle");

		// Enter starts editing again, update draft to invalid value, press Enter -> error state
		fireEvent.keyDown(grid, { key: "Enter" });
		fireEvent.change(screen.getByTestId("cell-editor-input"), {
			target: { value: "INVALID" },
		});
		fireEvent.keyDown(grid, { key: "Enter" });

		await waitFor(() => {
			expect(screen.getByTestId("meta-edit-kind").textContent).toBe("error");
		});
		expect(screen.getByTestId("meta-edit-error").textContent).toBe(
			"Validation failed: invalid label",
		);

		// Fix draft and press Enter -> saving -> idle
		fireEvent.change(screen.getByTestId("cell-editor-input"), {
			target: { value: "Updated Item 2" },
		});
		fireEvent.keyDown(grid, { key: "Enter" });

		await waitFor(() => {
			expect(screen.getByTestId("meta-edit-kind").textContent).toBe("idle");
		});
		expect(onCommitCell).toHaveBeenCalledTimes(2);
	});
});

describe("Stage 2 · Sub-step 2 — L2 Ports, Per-Port Providers, and In-Memory Adapter Contract Suite", () => {
	it("satisfies RowSourcePort contract with in-memory adapter (filtering, sorting, paging, loading & error states)", () => {
		const rowSource = createInMemoryRowSourceAdapter<DemoRow>({
			initialRows: ALL_DEMO_ROWS.slice(0, 50),
		});

		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<RowSourcePortProvider adapter={rowSource}>
				{children}
			</RowSourcePortProvider>
		);

		const successRes = assertRowSourcePortContract(
			{
				useRows: (query) => useRowSourcePort<DemoRow>().useRows(query),
			},
			(cb) => renderHook(cb, { wrapper }),
			{
				sorting: [{ id: "metric", desc: true }],
				globalFilter: "Item 4",
				pageIndex: 0,
				pageSize: 5,
			},
		);

		expect(successRes.status).toBe("success");
		// Matches Item 4, Item 40..49 => 11 rows total, page size 5 => 5 rows returned, highest metric first (Item 49)
		expect(successRes.rowCount).toBe(11);
		expect(successRes.rows).toHaveLength(5);
		expect(successRes.rows[0]?.id).toBe("item-49");

		// Loading state adapter verified via assertRowSourcePortContract
		const loadingSource = createInMemoryRowSourceAdapter<DemoRow>({
			initialRows: [],
			status: "loading",
		});
		const loadingRes = assertRowSourcePortContract(loadingSource, (cb) =>
			renderHook(cb),
		);
		expect(loadingRes.status).toBe("loading");
		expect(loadingRes.rows).toHaveLength(0);

		// Error state adapter verified via assertRowSourcePortContract
		const errorSource = createInMemoryRowSourceAdapter<DemoRow>({
			initialRows: [],
			status: "error",
			error: "Simulated source error",
		});
		const errRes = assertRowSourcePortContract(errorSource, (cb) =>
			renderHook(cb),
		);
		expect(errRes.status).toBe("error");
		expect(errRes.error).toBe("Simulated source error");
	});

	it("satisfies RowMutationPort contract: optimistic write, pendingIds tracking, and rollback on failure", async () => {
		const store = createInMemoryRowStore<DemoRow>([
			{ id: "item-1", label: "Original Label", metric: 100 },
		]);
		const rowMutation = createInMemoryRowMutationAdapter<
			DemoRow,
			Partial<DemoRow>
		>({
			store,
			simulatedDelayMs: 20,
			validateOrReject: (_id, patch) => {
				if (patch.metric !== undefined && patch.metric < 1) {
					throw new Error("metric must be >= 1");
				}
			},
		});

		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<RowMutationPortProvider adapter={rowMutation}>
				{children}
			</RowMutationPortProvider>
		);

		const report = await assertRowMutationPortContract<
			DemoRow,
			Partial<DemoRow>
		>(
			{
				useUpdateRow: () =>
					useRowMutationPort<DemoRow, Partial<DemoRow>>().useUpdateRow(),
			},
			{
				runHook: (cb) => renderHook(cb, { wrapper }),
				targetId: "item-1",
				validPatch: { label: "Optimistic Label" },
				invalidPatch: { label: "Bad Edit", metric: 0 },
				readRow: (id) => store.getRow(id),
				act: async (fn) => await act(async () => await fn()),
			},
		);

		expect(report.optimisticObservedDuringFlight).toBe(true);
		expect(report.pendingObservedDuringFlight).toBe(true);
		expect(report.updatedRow.label).toBe("Optimistic Label");
		expect(report.rolledBackAfterFailure).toBe(true);
		expect(report.rejectionError?.message).toBe("metric must be >= 1");
		expect(store.getRow("item-1")).toEqual({
			id: "item-1",
			label: "Optimistic Label",
			metric: 100,
		});
	});

	it("satisfies NavigationPort, PermissionPort, and optional ViewStatePort contracts with one provider per port", () => {
		const navAdapter = createInMemoryNavigationAdapter({ basePath: "/app" });
		const permAdapter = createInMemoryPermissionAdapter((action, resource) => {
			if (action === "edit" && typeof resource === "object") {
				return resource.field !== "id";
			}
			return true;
		});
		const viewStateAdapter = createInMemoryViewStateAdapter();

		// Direct contract assertions from @platform/ports using neutral placeholders
		const navContract = assertNavigationPortContract(navAdapter);
		expect(navContract.navigatedTo).toBe("/items/item-1");
		expect(navContract.hrefResult).toBe("/app/items/item-1");
		expect(navAdapter.history).toEqual([
			{
				to: "/items/item-1",
				opts: { replace: true, search: { page: 2 } },
			},
		]);

		const permContract = assertPermissionPortContract(permAdapter);
		expect(permContract.canEdit).toBe(true);
		expect(
			permAdapter.can("edit", { type: "item", id: "item-1", field: "id" }),
		).toBe(false);

		const savedView = assertViewStatePortContract(viewStateAdapter, {
			rowSelection: { "item-1": true },
			bulkMode: true,
		});
		expect(viewStateAdapter.map.has("sample-view")).toBe(true);
		expect(savedView).toEqual({
			rowSelection: { "item-1": true },
			bulkMode: true,
		});

		// Verify ViewStatePort is genuinely optional (returns null when provider is omitted)
		const { result: omittedViewState } = renderHook(() => useViewStatePort());
		expect(omittedViewState.current).toBeNull();

		// Verify independent per-port providers
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<NavigationPortProvider adapter={navAdapter}>
				<PermissionPortProvider adapter={permAdapter}>
					<ViewStatePortProvider adapter={viewStateAdapter}>
						{children}
					</ViewStatePortProvider>
				</PermissionPortProvider>
			</NavigationPortProvider>
		);

		const { result: hooksResult } = renderHook(
			() => ({
				nav: useNavigationPort(),
				perm: usePermissionPort(),
				view: useViewStatePort(),
			}),
			{ wrapper },
		);

		expect(hooksResult.current.nav).toBe(navAdapter);
		expect(hooksResult.current.perm).toBe(permAdapter);
		expect(hooksResult.current.view).toBe(viewStateAdapter);
	});
});

describe("Stage 2 · Sub-step 3 — Compound DataTable Parts, Token Styles, and In-Memory Stories", () => {
	it("renders compound parts (Root/Toolbar/Header/Body/Row/Cell/Pagination), Toolbar actions slot, and typed cellRender/editCellRender via useRender/mergeProps", () => {
		const onToolbarAction = vi.fn();
		render(<StoryTableHarness onToolbarAction={onToolbarAction} />);

		// Toolbar search & actions slot (rendering a Tier-1 Button leaf)
		expect(screen.getByRole("toolbar")).toBeTruthy();
		expect(screen.getByTestId("datatable-toolbar-search")).toBeTruthy();
		const actionBtn = screen.getByTestId("toolbar-action-btn");
		fireEvent.click(actionBtn);
		expect(onToolbarAction).toHaveBeenCalledTimes(1);

		// Header & Pagination
		expect(screen.getAllByRole("columnheader")).toHaveLength(4);
		expect(
			screen.getByTestId("datatable-pagination-summary").textContent,
		).toContain("Page 1 of 4 (40 total)");

		// Typed cellRender substitution on "label" column
		const labelCell = screen.getByTestId("datatable-cell-item-1-label");
		expect(labelCell.getAttribute("data-custom-cell")).toBe("label");
		expect(labelCell.textContent).toBe("Record 1");

		// Double-click enters edit mode and renders custom editCellRender via useRender/mergeProps
		fireEvent.doubleClick(labelCell);
		const editor = screen.getByTestId(
			"datatable-cell-editor-item-1-label",
		) as HTMLInputElement;
		expect(editor.getAttribute("data-custom-editor")).toBe("label");
		expect(editor.value).toBe("Record 1");
	});

	it("renders Loading, Empty, and ErrorState stories from in-memory RowSourcePort", () => {
		const { unmount: unmountLoading } = render(<LoadingStory />);
		expect(screen.getByTestId("datatable-status-loading").textContent).toBe(
			"Loading rows...",
		);
		unmountLoading();

		const { unmount: unmountEmpty } = render(<EmptyStory />);
		expect(screen.getByTestId("datatable-status-empty").textContent).toBe(
			"No rows match the current filter.",
		);
		unmountEmpty();

		const { unmount: unmountError } = render(<ErrorStateStory />);
		expect(screen.getByTestId("datatable-status-error").textContent).toBe(
			"Unable to load items from data source.",
		);
		unmountError();
	});

	it("drives OptimisticEditSuccessStory end-to-end: editing -> saving (optimistic write) -> idle", async () => {
		const store = createInMemoryRowStore(INITIAL_STORY_ROWS.slice(0, 10));
		render(<OptimisticEditSuccessStory store={store} simulatedDelayMs={25} />);

		const labelCell = screen.getByTestId("datatable-cell-item-1-label");
		fireEvent.doubleClick(labelCell);

		const editor = screen.getByTestId(
			"datatable-cell-editor-item-1-label",
		) as HTMLInputElement;
		fireEvent.change(editor, { target: { value: "Updated Record 1" } });
		fireEvent.keyDown(editor, { key: "Enter" });

		// Optimistically written to the store immediately while mutation is in flight
		expect(store.getRow("item-1")?.label).toBe("Updated Record 1");
		expect(labelCell.getAttribute("data-saving")).toBe("true");

		// Resolves -> edit machine returns to idle and new value stays in the cell
		await waitFor(() => {
			expect(labelCell.getAttribute("data-saving")).toBe("false");
			expect(labelCell.getAttribute("data-editing")).toBe("false");
		});
		expect(labelCell.textContent).toBe("Updated Record 1");
		expect(store.getRow("item-1")?.label).toBe("Updated Record 1");
	});

	it("drives OptimisticEditRollbackStory end-to-end: editing -> saving -> rejection rolls back store AND transitions edit machine to error", async () => {
		const store = createInMemoryRowStore(INITIAL_STORY_ROWS.slice(0, 10));
		render(<OptimisticEditRollbackStory store={store} simulatedDelayMs={25} />);

		const labelCell = screen.getByTestId("datatable-cell-item-1-label");
		fireEvent.doubleClick(labelCell);

		const editor = screen.getByTestId(
			"datatable-cell-editor-item-1-label",
		) as HTMLInputElement;
		fireEvent.change(editor, { target: { value: "Reject this update" } });
		fireEvent.keyDown(editor, { key: "Enter" });

		// 1. Optimistically applied in the store while saving is in flight
		expect(store.getRow("item-1")?.label).toBe("Reject this update");
		expect(labelCell.getAttribute("data-saving")).toBe("true");

		// 2. After artificial latency, validator rejects -> store rolls back to "Record 1"
		//    AND edit state machine transitions saving -> error with message displayed!
		await waitFor(() => {
			expect(labelCell.getAttribute("data-error")).toBe("true");
		});
		expect(store.getRow("item-1")?.label).toBe("Record 1");
		expect(
			screen.getByTestId("datatable-cell-error-item-1-label").textContent,
		).toBe("Validation failed: label was rejected by policy");

		// Pressing Escape cancels the error state back to idle showing the rolled-back value
		const activeEditor = screen.getByTestId(
			"datatable-cell-editor-item-1-label",
		);
		fireEvent.keyDown(activeEditor, { key: "Escape" });
		expect(labelCell.getAttribute("data-error")).toBe("false");
		expect(labelCell.getAttribute("data-editing")).toBe("false");
		expect(labelCell.textContent).toBe("Record 1");
	});

	it("enforces PermissionPort cell editability gating and L4 token-only style discipline", () => {
		render(
			<StoryTableHarness
				canEditPredicate={(_action, resource) => {
					if (typeof resource === "object" && resource.field === "category") {
						return false;
					}
					return true;
				}}
			/>,
		);

		const categoryCell = screen.getByTestId("datatable-cell-item-1-category");
		expect(categoryCell.getAttribute("data-editable")).toBe("false");
		expect(categoryCell.getAttribute("aria-readonly")).toBe("true");

		// Double-clicking a permission-denied cell does NOT enter edit mode
		fireEvent.doubleClick(categoryCell);
		expect(categoryCell.getAttribute("data-editing")).toBe("false");
		expect(
			screen.queryByTestId("datatable-cell-editor-item-1-category"),
		).toBeNull();

		// Verify L4 datatable.styles.ts contains ZERO raw hex, rgb/hsl, or px values
		const stylesSource = fs.readFileSync(
			path.resolve(__dirname, "./datatable.styles.ts"),
			"utf8",
		);
		expect(stylesSource).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(stylesSource).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\s*\(/);
		expect(stylesSource).not.toMatch(/\b\d+(?:\.\d+)?px\b/);
	});

	it("renders HappyPathStory cleanly with zero external providers", () => {
		render(<HappyPathStory />);
		expect(screen.getByTestId("datatable-grid")).toBeTruthy();
	});
});
