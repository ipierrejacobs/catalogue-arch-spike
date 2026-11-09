// @vitest-environment jsdom
/**
 * Stage 3 · Sub-steps 1–3 — Real Adapters (`RowSourcePort`, `NavigationPort`,
 * `RowMutationPort`, `PermissionPort`, `ViewStatePort`), Full `FlowsTable` Feature
 * Container Assembly, and `AGENTS.md` §5 Per-Seam State-Placement Law Verification
 */

import {
	createQueryRowMutationAdapter,
	createQueryRowSourceAdapter,
	createRouterNavigationAdapter,
	createSessionPermissionAdapter,
	createZustandViewStateAdapter,
	createZustandViewStateStore,
	ProblemDetailError,
	type SpringPageEnvelope,
} from "@platform/adapters";
import {
	assertNavigationPortContract,
	assertPermissionPortContract,
	assertRowMutationPortContract,
	assertRowSourcePortContract,
	assertViewStatePortContract,
	type DataTableViewState,
} from "@platform/ports";
import {
	type FlowsSearch,
	parseFlowsSearch,
	setFlowsTokenGetter,
} from "@shared/flows";
import { handlers } from "@shared/mocks/handlers";
import type { IntegrationFlow } from "@shared/mocks/schemas";
import {
	CANONICAL_COLLABORATION_ID,
	DEV_TOKENS,
	seedData,
} from "@shared/mocks/seed";
import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import { setupServer } from "msw/node";
import * as React from "react";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	buildFlowDetailQueryKey,
	buildFlowsRowSourceQueryKey,
	FlowsTableContainer,
	flowsViewStateStore,
} from "../../../../src/features/flows/FlowsTable";
import { getDevToken, setDevToken } from "../../../../src/lib/token-store";

const server = setupServer(...handlers);

beforeAll(() => {
	setFlowsTokenGetter(getDevToken);
	server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
	cleanup();
	server.resetHandlers();
	setDevToken(null);
	flowsViewStateStore.getState().clear();
});

afterAll(() => {
	setFlowsTokenGetter(null);
	server.close();
});

describe("Stage 3 · Sub-step 1 — Real RowSourcePort + NavigationPort Adapters & FlowsTable URL Sync", () => {
	it("runs the Stage-2 assertRowSourcePortContract and assertNavigationPortContract unchanged against real adapters", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		interface SampleItem {
			readonly id: string;
			readonly label: string;
		}

		const sampleRows: readonly SampleItem[] = [
			{ id: "item-1", label: "Item 1" },
			{ id: "item-2", label: "Item 2" },
		];

		// 1. Real RowSourcePort adapter (loading -> success, and error)
		const realRowSource = createQueryRowSourceAdapter<SampleItem>({
			getQueryKey: (q) => ["items", q],
			queryFn: async (q) => ({
				content: sampleRows.slice(0, q.pageSize),
				totalElements: sampleRows.length,
				number: q.pageIndex,
				size: q.pageSize,
				totalPages: 1,
			}),
		});

		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);

		// Initial loading state passes contract
		const initialRes = assertRowSourcePortContract(realRowSource, (cb) =>
			renderHook(cb, { wrapper }),
		);
		expect(initialRes.status).toBe("loading");

		// Pre-populated cache / resolved query state passes contract
		queryClient.setQueryData(
			["items", { pageIndex: 0, pageSize: 10 }],
			{
				content: sampleRows,
				totalElements: 2,
				number: 0,
				size: 10,
				totalPages: 1,
			},
		);
		const successRes = assertRowSourcePortContract(realRowSource, (cb) =>
			renderHook(cb, { wrapper }),
		);
		expect(successRes.status).toBe("success");
		expect(successRes.rows).toHaveLength(2);
		expect(successRes.rowCount).toBe(2);

		// 2. Real NavigationPort adapter passes contract unchanged
		const onNavigateSpy = vi.fn();
		const realNavigation = createRouterNavigationAdapter({
			basePath: "/app",
			onNavigate: onNavigateSpy,
		});

		const navContract = assertNavigationPortContract(realNavigation);
		expect(navContract.navigatedTo).toBe("/items/item-1");
		expect(navContract.hrefResult).toBe("/app/items/item-1");
		expect(onNavigateSpy).toHaveBeenCalledWith({
			to: "/items/item-1",
			replace: true,
			search: { page: 2 },
		});
	});

	it("cold deep-links /collaborations/:id/flows?sort=avgLatencyMs&dir=desc&status=degraded&page=3 against MSW and syncs sort/filter/page to URL", async () => {
		setDevToken(DEV_TOKENS.editor);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		// Parse cold deep-link URL search params using the route's validateSearch parser
		const coldSearch = parseFlowsSearch(
			new URLSearchParams("sort=avgLatencyMs&dir=desc&status=degraded&page=3"),
		);
		expect(coldSearch).toEqual({
			sort: "avgLatencyMs",
			dir: "desc",
			status: "degraded",
			page: 3,
		});

		const searchHistory: Array<{
			search: FlowsSearch;
			replace: boolean | undefined;
		}> = [];

		function RoutedFlowsHarness() {
			const [currentSearch, setCurrentSearch] =
				React.useState<FlowsSearch>(coldSearch);
			return (
				<QueryClientProvider client={queryClient}>
					<FlowsTableContainer
						collabId={CANONICAL_COLLABORATION_ID}
						search={currentSearch}
						onNavigateSearch={(nextSearch, opts) => {
							searchHistory.push({
								search: nextSearch,
								replace: opts?.replace,
							});
							setCurrentSearch(nextSearch);
						}}
					/>
				</QueryClientProvider>
			);
		}

		render(<RoutedFlowsHarness />);

		// Initially in loading state while MSW jittered delay resolves
		expect(screen.getByTestId("datatable-status-loading")).toBeTruthy();

		// Wait for MSW response for page 3 (665 degraded flows total, 14 pages of 50)
		await waitFor(
			() => {
				expect(
					screen.getByTestId("datatable-pagination-summary").textContent,
				).toContain("Page 4 of 14 (665 total)");
			},
			{ timeout: 2500 },
		);

		// Verify all rendered rows on the cold deep-link page have health="degraded"
		// and descending avgLatencyMs order
		const healthCells = document.querySelectorAll('[data-flow-col="health"]');
		expect(healthCells.length).toBeGreaterThan(0);
		for (const cell of healthCells) {
			expect(cell.getAttribute("data-health-value")).toBe("degraded");
		}

		const latencyCells = Array.from(
			document.querySelectorAll('[data-flow-col="avgLatencyMs"]'),
		).map((el) => Number(el.getAttribute("data-latency-value")));
		expect(latencyCells.length).toBeGreaterThan(1);
		for (let i = 1; i < latencyCells.length; i++) {
			expect(latencyCells[i - 1]).toBeGreaterThanOrEqual(latencyCells[i]);
		}

		// Verify TanStack Query cache holds the exact ['flows', collabId, params] key
		const cachedPage3 = queryClient.getQueryData(
			buildFlowsRowSourceQueryKey(CANONICAL_COLLABORATION_ID, {
				sorting: [{ id: "avgLatencyMs", desc: true }],
				columnFilters: [{ id: "status", value: "degraded" }],
				globalFilter: "",
				pageIndex: 3,
				pageSize: 50,
			}),
		);
		expect(cachedPage3).toBeDefined();

		// Clicking "Next" updates the URL search params via NavigationPort (page: 4, replace: true)
		// while keepPreviousData keeps the table rows mounted during transition (no loading flash)
		fireEvent.click(screen.getByTestId("datatable-page-next"));
		expect(searchHistory.at(-1)).toEqual({
			search: {
				sort: "avgLatencyMs",
				dir: "desc",
				status: "degraded",
				page: 4,
			},
			replace: true,
		});
		// keepPreviousData: loading banner does NOT replace the virtual body while page 4 fetches
		expect(screen.queryByTestId("datatable-status-loading")).toBeNull();
		expect(screen.getByTestId("datatable-virtual-body")).toBeTruthy();

		await waitFor(
			() => {
				expect(
					screen.getByTestId("datatable-pagination-summary").textContent,
				).toContain("Page 5 of 14 (665 total)");
			},
			{ timeout: 2500 },
		);
	});
});

describe("Stage 3 · Sub-step 2 — Real RowMutationPort + PermissionPort Adapters (Cache Optimistic Updates, 422 problem+json Mapping, Role Gating)", () => {
	it("runs assertRowMutationPortContract and assertPermissionPortContract unchanged against real adapters, verifying cache onMutate + snapshot rollback across list and detail caches", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		interface SampleRow {
			readonly id: string;
			readonly label: string;
			readonly avgLatencyMs: number;
		}

		const initialRow: SampleRow = {
			id: "item-1",
			label: "Initial Item",
			avgLatencyMs: 120,
		};

		// Seed BOTH the paged list cache AND the mirrored single-row detail cache ("multiple places on screen")
		const listKey = ["items", "list", { page: 0 }] as const;
		const detailKey = (id: string) => ["items", "detail", id] as const;

		queryClient.setQueryData<SpringPageEnvelope<SampleRow>>(listKey, {
			content: [initialRow],
			totalElements: 1,
			number: 0,
			size: 10,
			totalPages: 1,
		});
		queryClient.setQueryData<SampleRow>(detailKey("item-1"), initialRow);

		let detailObservedOptimisticInFlight = false;

		const realRowMutation = createQueryRowMutationAdapter<SampleRow>({
			queryKeyPrefix: ["items", "list"],
			detailQueryKey: detailKey,
			invalidateOnSettled: false,
			mutationFn: async (id, patch) => {
				// Observe detail cache while mutation is in flight
				const currentDetail = queryClient.getQueryData<SampleRow>(
					detailKey(id),
				);
				if (currentDetail?.label === "Optimistic Label") {
					detailObservedOptimisticInFlight = true;
				}
				await new Promise((resolve) => setTimeout(resolve, 20));

				if (
					typeof patch.avgLatencyMs === "number" &&
					patch.avgLatencyMs < 1
				) {
					throw new ProblemDetailError({
						type: "https://catalogue/errors/validation",
						title: "Validation failed",
						status: 422,
						detail: "avgLatencyMs must be ≥ 1",
						errors: {
							avgLatencyMs: "must be ≥ 1",
						},
					});
				}

				const currentList =
					queryClient.getQueryData<SpringPageEnvelope<SampleRow>>(listKey);
				const existing =
					currentList?.content.find((r) => r.id === id) ?? initialRow;
				return {
					...existing,
					...patch,
				};
			},
		});

		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);

		// Run Stage-2 assertRowMutationPortContract UNCHANGED
		const report = await assertRowMutationPortContract(realRowMutation, {
			runHook: (cb) => renderHook(cb, { wrapper }),
			targetId: "item-1",
			validPatch: { label: "Optimistic Label", avgLatencyMs: 85 },
			invalidPatch: { avgLatencyMs: 0 },
			readRow: (id) => {
				const listPage =
					queryClient.getQueryData<SpringPageEnvelope<SampleRow>>(listKey);
				return listPage?.content.find((r) => r.id === id);
			},
			act: async (fn) => {
				let res!: Awaited<ReturnType<typeof fn>>;
				await act(async () => {
					res = await fn();
				});
				return res;
			},
		});

		expect(report.optimisticObservedDuringFlight).toBe(true);
		expect(report.pendingObservedDuringFlight).toBe(true);
		expect(report.rolledBackAfterFailure).toBe(true);
		expect(detailObservedOptimisticInFlight).toBe(true);

		// Verify detail cache ALSO rolled back to the post-success snapshot (`avgLatencyMs: 85`)
		const detailAfterRollback = queryClient.getQueryData<SampleRow>(
			detailKey("item-1"),
		);
		expect(detailAfterRollback).toEqual({
			id: "item-1",
			label: "Optimistic Label",
			avgLatencyMs: 85,
		});

		// Verify 422 problem+json errors{} was mapped back to field/row state
		expect(realRowMutation.getFieldErrors("item-1")).toEqual({
			avgLatencyMs: "must be ≥ 1",
		});
		expect(realRowMutation.getRowError("item-1")).toBe(
			"avgLatencyMs: must be ≥ 1",
		);
		expect(report.rejectionError?.message).toBe("avgLatencyMs: must be ≥ 1");

		// 2. Real PermissionPort adapter passes Stage-2 assertPermissionPortContract unchanged
		const viewerPermission = createSessionPermissionAdapter({
			roles: ["CATALOGUE_VIEWER"],
		});
		const viewerReport = assertPermissionPortContract(viewerPermission);
		expect(viewerReport).toEqual({ canEdit: false, canView: true });

		const editorPermission = createSessionPermissionAdapter({
			roles: ["CATALOGUE_VIEWER", "CATALOGUE_EDITOR"],
		});
		const editorReport = assertPermissionPortContract(editorPermission);
		expect(editorReport).toEqual({ canEdit: true, canView: true });
	});

	it("optimistically updates both FlowsTable and a mirrored detail panel via Query cache, and rolls both back with field error mapping on a 422 problem+json rejection", async () => {
		setDevToken(DEV_TOKENS.editor);
		const targetFlow = seedData().flows[0];
		if (!targetFlow) {
			throw new Error("Expected seedData().flows[0] to exist");
		}
		const originalLatency = targetFlow.avgLatencyMs;

		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		// Pre-populate the mirrored detail panel cache for `targetFlow.id`
		queryClient.setQueryData<IntegrationFlow>(
			buildFlowDetailQueryKey(CANONICAL_COLLABORATION_ID, targetFlow.id),
			targetFlow,
		);

		function MirroredFlowDetailPanel({ flowId }: { readonly flowId: string }) {
			const detailQuery = useQuery<IntegrationFlow>({
				queryKey: buildFlowDetailQueryKey(CANONICAL_COLLABORATION_ID, flowId),
				queryFn: async () => {
					const found = seedData().flows.find((f) => f.id === flowId);
					if (!found) throw new Error("Not found");
					return found;
				},
				staleTime: 60_000,
			});
			return (
				<aside data-testid="mirrored-flow-detail-panel">
					<span data-testid="mirrored-detail-latency">
						{detailQuery.data?.avgLatencyMs}
					</span>
				</aside>
			);
		}

		try {
			render(
				<QueryClientProvider client={queryClient}>
					<FlowsTableContainer
						collabId={CANONICAL_COLLABORATION_ID}
						search={{ page: 0, size: 25 }}
						sessionRoles={["CATALOGUE_VIEWER", "CATALOGUE_EDITOR"]}
						mutationDelayMs={40}
						onNavigateSearch={vi.fn()}
					/>
					<MirroredFlowDetailPanel flowId={targetFlow.id} />
				</QueryClientProvider>,
			);

			// Wait for initial page to load
			await waitFor(
				() => {
					expect(
						screen.getByTestId(
							`datatable-cell-${targetFlow.id}-avgLatencyMs`,
						),
					).toBeTruthy();
				},
				{ timeout: 2500 },
			);

			expect(screen.getByTestId("mirrored-detail-latency").textContent).toBe(
				String(originalLatency),
			);

			// 1. Trigger an invalid edit (`avgLatencyMs = 0` -> 422 problem+json: `avgLatencyMs: must be ≥ 1`)
			const latencyCell = screen.getByTestId(
				`datatable-cell-${targetFlow.id}-avgLatencyMs`,
			);
			fireEvent.doubleClick(latencyCell);

			const editorInput = screen.getByTestId(
				`datatable-cell-editor-${targetFlow.id}-avgLatencyMs`,
			) as HTMLInputElement;
			fireEvent.change(editorInput, { target: { value: "0" } });
			fireEvent.keyDown(editorInput, { key: "Enter" });

			// While the 40ms mutation is in flight, the mirrored detail panel reflects the optimistic cache write ("0")
			await waitFor(() => {
				expect(screen.getByTestId("mirrored-detail-latency").textContent).toBe(
					"0",
				);
			});

			// Once the 422 ProblemDetailError rejects, BOTH the table cell and the mirrored detail panel roll back,
			// and the 422 field error is mapped onto the cell's error state
			await waitFor(() => {
				const errorBadge = screen.getByTestId(
					`datatable-cell-error-${targetFlow.id}-avgLatencyMs`,
				);
				expect(errorBadge.textContent).toBe("avgLatencyMs: must be ≥ 1");
			});

			expect(screen.getByTestId("mirrored-detail-latency").textContent).toBe(
				String(originalLatency),
			);

			// Press Escape to dismiss the error state and verify the cell displays the rolled-back original value
			const grid = screen.getByTestId("datatable-virtual-body");
			fireEvent.keyDown(grid, { key: "Escape" });

			expect(
				screen
					.getByTestId(`datatable-cell-${targetFlow.id}-avgLatencyMs`)
					.textContent,
			).toContain(`${originalLatency} ms`);
		} finally {
			// Restore seed flow latency in case of any mutation
			targetFlow.avgLatencyMs = originalLatency;
		}
	});

	it("enforces role-based cell editability via PermissionPort while passing disabled/title as plain props to Button", async () => {
		setDevToken(DEV_TOKENS.viewer);
		const firstFlowId = seedData().flows[0]?.id ?? "flow_0001";

		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		const { rerender } = render(
			<QueryClientProvider client={queryClient}>
				<FlowsTableContainer
					collabId={CANONICAL_COLLABORATION_ID}
					search={{ page: 0, size: 25 }}
					sessionRoles={["CATALOGUE_VIEWER"]}
					onNavigateSearch={vi.fn()}
				/>
			</QueryClientProvider>,
		);

		await waitFor(
			() => {
				expect(
					screen.getByTestId(`datatable-cell-${firstFlowId}-name`),
				).toBeTruthy();
			},
			{ timeout: 2500 },
		);

		// Viewer: cells are non-editable (`data-editable="false"`) and double-clicking does not open an editor
		const viewerNameCell = screen.getByTestId(
			`datatable-cell-${firstFlowId}-name`,
		);
		expect(viewerNameCell.getAttribute("data-editable")).toBe("false");
		fireEvent.doubleClick(viewerNameCell);
		expect(
			screen.queryByTestId(`datatable-cell-editor-${firstFlowId}-name`),
		).toBeNull();

		// Viewer: Tier-1 Button receives disabled + reason title as plain props
		const createBtn = screen.getByTestId(
			"flows-create-btn",
		) as HTMLButtonElement;
		expect(createBtn.disabled).toBe(true);
		expect(createBtn.getAttribute("title")).toBe(
			"Requires CATALOGUE_EDITOR role",
		);

		// Re-render with CATALOGUE_EDITOR role: editable cells become editable and Button is enabled
		rerender(
			<QueryClientProvider client={queryClient}>
				<FlowsTableContainer
					collabId={CANONICAL_COLLABORATION_ID}
					search={{ page: 0, size: 25 }}
					sessionRoles={["CATALOGUE_VIEWER", "CATALOGUE_EDITOR"]}
					onNavigateSearch={vi.fn()}
				/>
			</QueryClientProvider>,
		);

		const editorNameCell = screen.getByTestId(
			`datatable-cell-${firstFlowId}-name`,
		);
		expect(editorNameCell.getAttribute("data-editable")).toBe("true");
		// Read-only column (`middleware`) remains non-editable even for editors
		const middlewareCell = screen.getByTestId(
			`datatable-cell-${firstFlowId}-middleware`,
		);
		expect(middlewareCell.getAttribute("data-editable")).toBe("false");

		expect(
			(screen.getByTestId("flows-create-btn") as HTMLButtonElement).disabled,
		).toBe(false);
	});
});

describe("Stage 3 · Sub-step 3 — Real ViewStatePort on Zustand & AGENTS.md §5 Per-Seam State-Placement Law", () => {
	it("Seam 1 (Server state -> TanStack Query): server rows live exclusively in TanStack Query via RowSourcePort and are never copied into the Zustand store", async () => {
		setDevToken(DEV_TOKENS.editor);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const isolatedZustandStore =
			createZustandViewStateStore<DataTableViewState>();
		const firstFlowId = seedData().flows[0]?.id ?? "flow_0001";

		render(
			<QueryClientProvider client={queryClient}>
				<FlowsTableContainer
					collabId={CANONICAL_COLLABORATION_ID}
					search={{ page: 0, size: 50 }}
					viewStateStore={isolatedZustandStore}
					onNavigateSearch={vi.fn()}
				/>
			</QueryClientProvider>,
		);

		await waitFor(
			() => {
				expect(
					screen.getByTestId(`datatable-cell-${firstFlowId}-name`),
				).toBeTruthy();
			},
			{ timeout: 2500 },
		);

		// 1. Verify server rows ARE in TanStack Query cache under ['flows', collabId, params]
		const queryKey = buildFlowsRowSourceQueryKey(CANONICAL_COLLABORATION_ID, {
			sorting: [],
			columnFilters: [],
			globalFilter: "",
			pageIndex: 0,
			pageSize: 50,
		});
		const cachedPage =
			queryClient.getQueryData<SpringPageEnvelope<IntegrationFlow>>(queryKey);
		expect(cachedPage).toBeDefined();
		expect(cachedPage?.content).toHaveLength(50);
		expect(cachedPage?.totalElements).toBe(3000);
		expect(cachedPage?.content[0]?.id).toBe(firstFlowId);

		// 2. Select a row so Zustand is populated with view state
		fireEvent.click(screen.getByTestId(`flows-select-row-${firstFlowId}`));

		// 3. Inspect the entire Zustand store snapshot: prove NO server row fields or SpringPage envelopes exist in Zustand
		const zustandState = isolatedZustandStore.getState();
		const serializedZustand = JSON.stringify({
			viewsByKey: zustandState.viewsByKey,
			savedPresetsByKey: zustandState.savedPresetsByKey,
		});

		expect(serializedZustand).not.toContain('"totalElements"');
		expect(serializedZustand).not.toContain('"content"');
		expect(serializedZustand).not.toContain('"middleware"');
		expect(serializedZustand).not.toContain('"avgLatencyMs"');
		expect(serializedZustand).not.toContain('"throughputPerMin"');
		expect(serializedZustand).not.toContain('"lastRunAt"');
		expect(serializedZustand).not.toContain(
			JSON.stringify(seedData().flows[0]?.name),
		);
	});

	it("Seam 2 (URL state -> Router): sort/dir/status/q/page/size live in the URL (surviving cold reload & deep-link) rather than internal useState", async () => {
		setDevToken(DEV_TOKENS.editor);

		// 1. Prove that when URL search props do NOT change (e.g. a no-op router callback),
		// the controlled table does NOT drift via internal useState
		const queryClient1 = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const emittedSearches: FlowsSearch[] = [];

		const { unmount } = render(
			<QueryClientProvider client={queryClient1}>
				<FlowsTableContainer
					collabId={CANONICAL_COLLABORATION_ID}
					search={{ page: 0, size: 50 }}
					onNavigateSearch={(next) => {
						emittedSearches.push(next);
						// Intentionally do NOT update `search` prop here to prove the brick
						// does not mutate its own internal useState when controlled by URL props
					}}
				/>
			</QueryClientProvider>,
		);

		await waitFor(
			() => {
				expect(
					screen.getByTestId("datatable-pagination-summary").textContent,
				).toContain("Page 1 of 60 (3000 total)");
			},
			{ timeout: 2500 },
		);

		// Click "Next page": emits `{ page: 1 }` to the router, but because the URL `search` prop
		// stayed `{ page: 0, size: 50 }`, the table still reflects Page 1 (controlled by URL, not useState)
		fireEvent.click(screen.getByTestId("datatable-page-next"));
		expect(emittedSearches.at(-1)).toEqual({ page: 1 });
		expect(
			screen.getByTestId("datatable-pagination-summary").textContent,
		).toContain("Page 1 of 60 (3000 total)");

		// Click the `avgLatencyMs` column header to sort: numeric column emits `{ sort: 'avgLatencyMs', dir: 'desc' }`
		const latencyHeader = document.querySelector(
			'th[data-column-id="avgLatencyMs"]',
		);
		expect(latencyHeader).toBeTruthy();
		if (latencyHeader) {
			fireEvent.click(latencyHeader);
		}
		expect(emittedSearches.at(-1)).toEqual({
			sort: "avgLatencyMs",
			dir: "desc",
		});

		unmount();

		// 2. Simulate a cold reload from a shared deep-link URL carrying all 6 URL state params:
		// `sort=throughputPerMin&dir=desc&status=active&q=order&page=1&size=100`
		const reloadedSearch = parseFlowsSearch(
			new URLSearchParams(
				"sort=throughputPerMin&dir=desc&status=active&q=order&page=1&size=100",
			),
		);
		const queryClient2 = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		render(
			<QueryClientProvider client={queryClient2}>
				<FlowsTableContainer
					collabId={CANONICAL_COLLABORATION_ID}
					search={reloadedSearch}
					onNavigateSearch={vi.fn()}
				/>
			</QueryClientProvider>,
		);

		// Verify that every URL state slice (`sort`, `dir`, `status`, `q`, `page`, `size`)
		// is reflected directly in the cold-mounted table UI and Query request
		const searchInput = screen.getByTestId(
			"datatable-toolbar-search",
		) as HTMLInputElement;
		expect(searchInput.value).toBe("order");

		const statusSelect = screen.getByTestId(
			"flows-status-select",
		) as HTMLSelectElement;
		expect(statusSelect.value).toBe("active");

		const sizeSelect = screen.getByTestId(
			"flows-size-select",
		) as HTMLSelectElement;
		expect(sizeSelect.value).toBe("100");

		const throughputHeader = document.querySelector(
			'th[data-column-id="throughputPerMin"]',
		);
		expect(throughputHeader?.getAttribute("aria-sort")).toBe("descending");

		await waitFor(
			() => {
				expect(
					screen.getByTestId("datatable-pagination-summary").textContent,
				).toContain("Page 2 of ");
			},
			{ timeout: 2500 },
		);
	});

	it("Seam 3 (App state -> Zustand via ViewStatePort): multi-row selection, bulk-action mode, column visibility, and saved presets live in Zustand and survive unmount/remount without polluting the URL", async () => {
		setDevToken(DEV_TOKENS.editor);
		const isolatedStore = createZustandViewStateStore<DataTableViewState>();
		const realViewStateAdapter = createZustandViewStateAdapter({
			store: isolatedStore,
		});

		// 1. Passes Stage-2 assertViewStatePortContract unchanged
		const sampleViewState: DataTableViewState = {
			rowSelection: { "item-1": true, "item-2": true },
			bulkMode: true,
			columnVisibility: { metric: false },
		};
		const contractRoundTrip = assertViewStatePortContract(
			realViewStateAdapter,
			sampleViewState,
		);
		expect(contractRoundTrip).toEqual(sampleViewState);
		expect(isolatedStore.getState().viewsByKey["sample-view"]).toEqual(
			sampleViewState,
		);

		// Verify named preset round-trip in Zustand
		realViewStateAdapter.savePreset(
			"sample-view",
			"compact-ops",
			sampleViewState,
		);
		expect(
			realViewStateAdapter.loadPreset("sample-view", "compact-ops"),
		).toEqual(sampleViewState);

		isolatedStore.getState().clear();

		// 2. Drive FlowsTableContainer with the real Zustand ViewStatePort adapter
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const onNavigateSearchSpy = vi.fn();
		const flow1Id = seedData().flows[0]?.id ?? "flow_0001";
		const flow2Id = seedData().flows[1]?.id ?? "flow_0002";

		const { unmount } = render(
			<QueryClientProvider client={queryClient}>
				<FlowsTableContainer
					collabId={CANONICAL_COLLABORATION_ID}
					search={{ page: 0, size: 50 }}
					viewStateStore={isolatedStore}
					onNavigateSearch={onNavigateSearchSpy}
				/>
			</QueryClientProvider>,
		);

		await waitFor(
			() => {
				expect(
					screen.getByTestId(`flows-select-row-${flow1Id}`),
				).toBeTruthy();
			},
			{ timeout: 2500 },
		);

		// Select two rows and hide the `throughputPerMin` column
		fireEvent.click(screen.getByTestId(`flows-select-row-${flow1Id}`));
		fireEvent.click(screen.getByTestId(`flows-select-row-${flow2Id}`));
		fireEvent.click(screen.getByTestId("flows-toggle-throughput-col-btn"));

		expect(screen.getByTestId("datatable-selected-count").textContent).toBe(
			"2 selected",
		);
		expect(
			screen
				.getByTestId("flows-view-state-controls")
				.getAttribute("data-bulk-mode"),
		).toBe("true");
		expect(
			document.querySelector('th[data-column-id="throughputPerMin"]'),
		).toBeNull();

		// URL search params were NEVER touched by selection or column visibility changes
		expect(onNavigateSearchSpy).not.toHaveBeenCalled();

		// Zustand store holds the exact persisted view state under `flows-view-col_8f3`
		const persistedInZustand =
			isolatedStore.getState().viewsByKey[
				`flows-view-${CANONICAL_COLLABORATION_ID}`
			];
		expect(persistedInZustand).toEqual({
			rowSelection: { [flow1Id]: true, [flow2Id]: true },
			bulkMode: true,
			columnVisibility: { throughputPerMin: false },
		});

		// Unmount and remount FlowsTableContainer: selection, bulkMode, and hidden column restore from Zustand
		unmount();

		render(
			<QueryClientProvider client={queryClient}>
				<FlowsTableContainer
					collabId={CANONICAL_COLLABORATION_ID}
					search={{ page: 0, size: 50 }}
					viewStateStore={isolatedStore}
					onNavigateSearch={onNavigateSearchSpy}
				/>
			</QueryClientProvider>,
		);

		expect(screen.getByTestId("datatable-selected-count").textContent).toBe(
			"2 selected",
		);
		expect(
			screen
				.getByTestId("flows-view-state-controls")
				.getAttribute("data-bulk-mode"),
		).toBe("true");
		expect(
			document.querySelector('th[data-column-id="throughputPerMin"]'),
		).toBeNull();
	});

	it("Seam 4 (Local UI state -> Component): editing-cell draft, cell focus, and keyboard navigation stay strictly in local component state without leaking into URL, TanStack Query, or Zustand", async () => {
		setDevToken(DEV_TOKENS.editor);
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const isolatedStore = createZustandViewStateStore<DataTableViewState>();
		const onNavigateSearchSpy = vi.fn();
		const targetFlow = seedData().flows[0];
		if (!targetFlow) {
			throw new Error("Expected seedData().flows[0] to exist");
		}

		render(
			<QueryClientProvider client={queryClient}>
				<FlowsTableContainer
					collabId={CANONICAL_COLLABORATION_ID}
					search={{ page: 0, size: 50 }}
					viewStateStore={isolatedStore}
					onNavigateSearch={onNavigateSearchSpy}
				/>
			</QueryClientProvider>,
		);

		await waitFor(
			() => {
				expect(
					screen.getByTestId(`datatable-cell-${targetFlow.id}-name`),
				).toBeTruthy();
			},
			{ timeout: 2500 },
		);

		const queryKey = buildFlowsRowSourceQueryKey(CANONICAL_COLLABORATION_ID, {
			sorting: [],
			columnFilters: [],
			globalFilter: "",
			pageIndex: 0,
			pageSize: 50,
		});
		const cacheBeforeLocalInteractions = JSON.stringify(
			queryClient.getQueryData(queryKey),
		);
		const zustandBeforeLocalInteractions = JSON.stringify(
			isolatedStore.getState().viewsByKey,
		);

		// 1. Focus cell and navigate via keyboard (`ArrowRight` -> `ArrowLeft`)
		const nameCell = screen.getByTestId(
			`datatable-cell-${targetFlow.id}-name`,
		);
		const middlewareCell = screen.getByTestId(
			`datatable-cell-${targetFlow.id}-middleware`,
		);
		const grid = screen.getByTestId("datatable-virtual-body");

		fireEvent.click(nameCell);
		expect(nameCell.getAttribute("data-focused")).toBe("true");

		fireEvent.keyDown(grid, { key: "ArrowRight" });
		expect(middlewareCell.getAttribute("data-focused")).toBe("true");

		fireEvent.keyDown(grid, { key: "ArrowLeft" });
		expect(nameCell.getAttribute("data-focused")).toBe("true");

		// 2. Enter edit mode on `name` and type an uncommitted local draft
		fireEvent.doubleClick(nameCell);
		const editorInput = screen.getByTestId(
			`datatable-cell-editor-${targetFlow.id}-name`,
		) as HTMLInputElement;
		fireEvent.change(editorInput, {
			target: { value: "Uncommitted Local Draft Value" },
		});
		expect(editorInput.value).toBe("Uncommitted Local Draft Value");

		// 3. Assert ZERO leakage into URL, TanStack Query cache, or Zustand while editing draft is active
		expect(onNavigateSearchSpy).not.toHaveBeenCalled();
		expect(JSON.stringify(queryClient.getQueryData(queryKey))).toBe(
			cacheBeforeLocalInteractions,
		);
		expect(JSON.stringify(isolatedStore.getState().viewsByKey)).toBe(
			zustandBeforeLocalInteractions,
		);
		expect(
			JSON.stringify(isolatedStore.getState().viewsByKey),
		).not.toContain("Uncommitted Local Draft Value");

		// 4. Cancel edit with Escape: local draft is discarded cleanly with zero external side effects
		fireEvent.keyDown(editorInput, { key: "Escape" });
		expect(
			screen.queryByTestId(`datatable-cell-editor-${targetFlow.id}-name`),
		).toBeNull();
		expect(
			screen.getByTestId(`datatable-cell-${targetFlow.id}-name`).textContent,
		).toContain(targetFlow.name);
	});
});
