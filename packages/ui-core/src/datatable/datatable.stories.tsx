/**
 * DataTable Storybook Stories & Tier-4 Capability-Set Metadata (`@platform/ui`)
 *
 * Declares `tier: 4` (Macro Brick) by capability set, consumed by
 * `platform-arch/no-ports-in-leaf-tiers` as the component's canonical tier.
 *
 * All six stories run in complete isolation using `@platform/ports` in-memory
 * adapters (zero network, zero TanStack Query, zero Router, zero MSW):
 * 1. `HappyPath`              — compound parts + Toolbar actions slot + custom cellRender/editCellRender
 * 2. `Loading`                — loading state from `RowSourcePort`
 * 3. `Empty`                  — empty state from `RowSourcePort`
 * 4. `ErrorState`             — error state from `RowSourcePort`
 * 5. `OptimisticEditSuccess`  — inline edit -> optimistic write (`saving`) -> resolves (`idle`)
 * 6. `OptimisticEditRollback` — inline edit -> optimistic write (`saving`) -> rejects -> rolls back store & transitions edit machine to `error`
 */

import {
	createInMemoryNavigationAdapter,
	createInMemoryPermissionAdapter,
	createInMemoryRowMutationAdapter,
	createInMemoryRowSourceAdapter,
	createInMemoryRowStore,
	createInMemoryViewStateAdapter,
	type InMemoryRowStore,
} from "@platform/ports";
import { createColumnHelper } from "@tanstack/react-table";
import * as React from "react";
import { Button } from "../button";
import type { GraduatedComponentMeta } from "../index";
import {
	DataTable,
	type DataTableColumnMeta,
	type DataTableFeatures,
	NavigationPortProvider,
	PermissionPortProvider,
	RowMutationPortProvider,
	RowSourcePortProvider,
	ViewStatePortProvider,
} from "./index";

export const dataTableStoryMeta: GraduatedComponentMeta<4> & {
	readonly title: "MacroBricks/DataTable";
	readonly capabilityMatrix: {
		readonly presentation: "●";
		readonly tokens: "●";
		readonly a11yBehavior: "●";
		readonly internalUiState: "●";
		readonly routingPort: "●";
		readonly serverDataPort: "●";
		readonly appStatePort: "◐";
		readonly sessionPermissionPort: "●";
	};
} = {
	title: "MacroBricks/DataTable",
	name: "DataTable",
	tier: 4,
	capabilities: [
		"presentation",
		"tokens",
		"a11y-behavior",
		"internal-ui-state",
		"routing-port",
		"server-data-port",
		"app-state-port",
		"session-permission-port",
	],
	layersPopulated: ["behavior", "ports", "parts", "styles"],
	capabilityMatrix: {
		presentation: "●",
		tokens: "●",
		a11yBehavior: "●",
		internalUiState: "●",
		routingPort: "●",
		serverDataPort: "●",
		appStatePort: "◐",
		sessionPermissionPort: "●",
	},
};

export default dataTableStoryMeta;

export interface StoryItemRow {
	readonly id: string;
	readonly label: string;
	readonly category: string;
	readonly metric: number;
}

export const INITIAL_STORY_ROWS: readonly StoryItemRow[] = Array.from(
	{ length: 40 },
	(_, index) => ({
		id: `item-${index + 1}`,
		label: `Record ${index + 1}`,
		category: index % 2 === 0 ? "standard" : "priority",
		metric: (index + 1) * 10,
	}),
);

const columnHelper = createColumnHelper<DataTableFeatures, StoryItemRow>();

export const storyColumns = columnHelper.columns([
	columnHelper.accessor("id", {
		header: "ID",
		meta: {
			editable: false,
		} satisfies DataTableColumnMeta<StoryItemRow, string>,
	}),
	columnHelper.accessor("label", {
		header: "Label",
		meta: {
			editable: true,
			cellRender: (props, state) => (
				<div {...props} data-custom-cell="label">
					{String(state.value)}
				</div>
			),
			editCellRender: (props) => (
				<input {...props} data-custom-editor="label" />
			),
		} satisfies DataTableColumnMeta<StoryItemRow, string>,
	}),
	columnHelper.accessor("category", {
		header: "Category",
		meta: {
			editable: true,
		} satisfies DataTableColumnMeta<StoryItemRow, string>,
	}),
	columnHelper.accessor("metric", {
		header: "Metric",
		meta: {
			editable: true,
			parseValue: (draft) => Number(draft),
		} satisfies DataTableColumnMeta<StoryItemRow, number>,
	}),
]);

export interface StoryTableHarnessProps {
	readonly initialRows?: readonly StoryItemRow[] | undefined;
	readonly status?: "loading" | "success" | "error" | undefined;
	readonly error?: string | undefined;
	readonly mutationDelayMs?: number | undefined;
	readonly validateOrReject?:
		| ((
				id: string,
				patch: Partial<StoryItemRow>,
				currentRow: StoryItemRow,
		  ) => Promise<void> | void)
		| undefined;
	readonly canEditPredicate?:
		| ((
				action: string,
				resource: string | { type: string; id?: string; field?: string },
		  ) => boolean)
		| undefined;
	readonly externalStore?: InMemoryRowStore<StoryItemRow> | undefined;
	readonly onToolbarAction?: (() => void) | undefined;
}

export function StoryTableHarness({
	initialRows = INITIAL_STORY_ROWS,
	status = "success",
	error,
	mutationDelayMs = 20,
	validateOrReject,
	canEditPredicate,
	externalStore,
	onToolbarAction,
}: StoryTableHarnessProps): React.ReactElement {
	const [adapters] = React.useState(() => {
		const store =
			externalStore ?? createInMemoryRowStore<StoryItemRow>(initialRows);
		const rowSource = createInMemoryRowSourceAdapter<StoryItemRow>({
			store,
			status,
			error,
		});
		const rowMutation = createInMemoryRowMutationAdapter<
			StoryItemRow,
			Partial<StoryItemRow>
		>({
			store,
			simulatedDelayMs: mutationDelayMs,
			validateOrReject,
		});
		const navigation = createInMemoryNavigationAdapter({ basePath: "/app" });
		const permission = createInMemoryPermissionAdapter(
			canEditPredicate ?? true,
		);
		const viewState = createInMemoryViewStateAdapter();
		return { store, rowSource, rowMutation, navigation, permission, viewState };
	});

	return (
		<RowSourcePortProvider adapter={adapters.rowSource}>
			<RowMutationPortProvider adapter={adapters.rowMutation}>
				<NavigationPortProvider adapter={adapters.navigation}>
					<PermissionPortProvider adapter={adapters.permission}>
						<ViewStatePortProvider adapter={adapters.viewState}>
							<DataTable.Root<StoryItemRow>
								columns={storyColumns}
								getRowId={(row) => row.id}
								resourceType="item"
								viewStateKey="sample-view"
								getRowHref={(row) => `/items/${row.id}`}
								defaultPagination={{ pageIndex: 0, pageSize: 10 }}
							>
								<DataTable.Toolbar
									actions={
										<Button
											variant="soft"
											size="sm"
											data-testid="toolbar-action-btn"
											onClick={onToolbarAction}
										>
											Export view
										</Button>
									}
								/>
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

/**
 * 1. Happy Path story — 40 rows, server-style paging/sorting/filtering, Toolbar slot.
 */
export function HappyPathStory(): React.ReactElement {
	return <StoryTableHarness />;
}

/**
 * 2. Loading story — RowSourcePort in `"loading"` status.
 */
export function LoadingStory(): React.ReactElement {
	return <StoryTableHarness status="loading" />;
}

/**
 * 3. Empty story — RowSourcePort with zero matching rows.
 */
export function EmptyStory(): React.ReactElement {
	return <StoryTableHarness initialRows={[]} />;
}

/**
 * 4. Error story — RowSourcePort in `"error"` status.
 */
export function ErrorStateStory(): React.ReactElement {
	return (
		<StoryTableHarness
			status="error"
			error="Unable to load items from data source."
		/>
	);
}

/**
 * 5. Optimistic Edit Success story — inline edit writes optimistically (`saving`)
 * and resolves cleanly (`idle`), persisting the updated value in the in-memory store.
 */
export function OptimisticEditSuccessStory(props: {
	readonly store?: InMemoryRowStore<StoryItemRow> | undefined;
	readonly simulatedDelayMs?: number | undefined;
}): React.ReactElement {
	return (
		<StoryTableHarness
			externalStore={props.store}
			mutationDelayMs={props.simulatedDelayMs ?? 25}
		/>
	);
}

/**
 * 6. Optimistic Edit Rollback story — inline edit applies optimistically while in flight (`saving`),
 * then rejects from the in-memory mutation adapter (`validateOrReject`), rolling back the store
 * to the pre-edit snapshot AND transitioning the L1 edit machine to `error`.
 */
export function OptimisticEditRollbackStory(props: {
	readonly store?: InMemoryRowStore<StoryItemRow> | undefined;
	readonly simulatedDelayMs?: number | undefined;
}): React.ReactElement {
	return (
		<StoryTableHarness
			externalStore={props.store}
			mutationDelayMs={props.simulatedDelayMs ?? 25}
			validateOrReject={(_id, patch) => {
				if (patch.label?.trim().toLowerCase().includes("reject")) {
					throw new Error("Validation failed: label was rejected by policy");
				}
				if (
					patch.metric !== undefined &&
					(Number.isNaN(patch.metric) || patch.metric < 1)
				) {
					throw new Error("Validation failed: metric must be >= 1");
				}
			}}
		/>
	);
}
