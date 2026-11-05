import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const LineageSearchSchema = z.object({
	depth: z.coerce.number().int().min(1).max(5).optional(),
});

export type LineageSearch = z.infer<typeof LineageSearchSchema>;

export const Route = createFileRoute("/collaborations/$id/lineage")({
	validateSearch: (search): LineageSearch => LineageSearchSchema.parse(search),
	component: LineageTabShell,
});

function LineageTabShell() {
	const { id } = Route.useParams();
	const search = Route.useSearch();

	return (
		<div
			data-testid="tab-panel-lineage"
			className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
		>
			<h2 className="text-lg font-semibold text-slate-900">Lineage</h2>
			<p className="mt-2 text-sm text-slate-600">
				Lineage tab shell for collaboration <code className="font-mono">{id}</code>
				{search.depth ? ` (depth=${search.depth})` : ""}. Dependency graph lands in P3.
			</p>
		</div>
	);
}
