import {
	cleanFlowsSearch,
	FlowsSearchSchema,
	type FlowsSearch,
	parseFlowsSearch,
} from "@shared/flows";
import { createFileRoute } from "@tanstack/react-router";
import { FlowsTableContainer } from "#/features/flows/FlowsTable";
import { useSession } from "#/lib/auth";

export { FlowsSearchSchema, type FlowsSearch };

export const Route = createFileRoute("/collaborations/$id/flows")({
	validateSearch: (search): FlowsSearch => parseFlowsSearch(search),
	component: FlowsTabRoute,
});

function FlowsTabRoute() {
	const { id } = Route.useParams();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { roles, canEdit } = useSession();

	return (
		<div data-testid="tab-panel-flows" className="space-y-4">
			<FlowsTableContainer
				collabId={id}
				search={search}
				sessionRoles={roles}
				canEditFlow={canEdit}
				onNavigateSearch={(nextSearch, opts) => {
					void navigate({
						search: () => cleanFlowsSearch(nextSearch),
						replace: opts?.replace ?? true,
					});
				}}
			/>
		</div>
	);
}
