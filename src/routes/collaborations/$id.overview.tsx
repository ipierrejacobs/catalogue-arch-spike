import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/collaborations/$id/overview")({
	component: OverviewTabShell,
});

function OverviewTabShell() {
	const { id } = Route.useParams();

	return (
		<div
			data-testid="tab-panel-overview"
			className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
		>
			<h2 className="text-lg font-semibold text-slate-900">Overview</h2>
			<p className="mt-2 text-sm text-slate-600">
				Overview tab shell for collaboration <code className="font-mono">{id}</code>.
				Metadata and derived KPI tiles land in P3.
			</p>
		</div>
	);
}
