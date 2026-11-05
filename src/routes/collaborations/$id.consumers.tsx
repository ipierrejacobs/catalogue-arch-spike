import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/collaborations/$id/consumers")({
	component: ConsumersTabShell,
});

function ConsumersTabShell() {
	const { id } = Route.useParams();

	return (
		<div
			data-testid="tab-panel-consumers"
			className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
		>
			<h2 className="text-lg font-semibold text-slate-900">Consumers</h2>
			<p className="mt-2 text-sm text-slate-600">
				Consumers tab shell for collaboration <code className="font-mono">{id}</code>.
				Downstream consumer list lands in P3.
			</p>
		</div>
	);
}
