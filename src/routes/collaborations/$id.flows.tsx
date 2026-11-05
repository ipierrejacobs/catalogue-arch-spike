import { FLOW_SORT_FIELDS } from "@shared/mocks/schemas";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const FlowsSearchSchema = z.object({
	sort: z.enum(FLOW_SORT_FIELDS).optional(),
	dir: z.enum(["asc", "desc"]).optional(),
	status: z.string().optional(),
	q: z.string().optional(),
	page: z.coerce.number().int().min(0).optional(),
	size: z.coerce.number().int().min(1).max(500).optional(),
});

export type FlowsSearch = z.infer<typeof FlowsSearchSchema>;

export const Route = createFileRoute("/collaborations/$id/flows")({
	validateSearch: (search): FlowsSearch => FlowsSearchSchema.parse(search),
	component: FlowsTabShell,
});

function FlowsTabShell() {
	const { id } = Route.useParams();
	const search = Route.useSearch();

	return (
		<div
			data-testid="tab-panel-flows"
			className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
		>
			<h2 className="text-lg font-semibold text-slate-900">Flows</h2>
			<p className="mt-2 text-sm text-slate-600">
				Flows tab shell for collaboration <code className="font-mono">{id}</code>.
				Virtualized table and server sort/filter/paginate land in P2.
			</p>
			<pre
				data-testid="flows-search-params"
				className="mt-4 rounded bg-slate-100 p-3 font-mono text-xs text-slate-700"
			>
				{JSON.stringify(search)}
			</pre>
		</div>
	);
}
