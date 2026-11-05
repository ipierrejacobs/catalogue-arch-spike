import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/collaborations/$id/edit")({
	component: EditDrawerShell,
});

function EditDrawerShell() {
	const { id } = Route.useParams();

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-drawer-title"
			data-testid="edit-drawer-shell"
			className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
		>
			<div className="flex h-full w-full max-w-lg flex-col justify-between bg-white p-6 shadow-xl">
				<div>
					<div className="flex items-center justify-between border-b border-slate-200 pb-4">
						<h2
							id="edit-drawer-title"
							className="text-lg font-semibold text-slate-900"
						>
							Edit Collaboration ({id})
						</h2>
						<Link
							to="/collaborations/$id/overview"
							params={{ id }}
							data-testid="close-edit-drawer"
							className="rounded-md px-2.5 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
						>
							Close
						</Link>
					</div>
					<p className="mt-4 text-sm text-slate-600">
						Routed edit drawer shell. Form validation, optimistic save + rollback, and
						RFC 7807 <code className="font-mono">problem+json</code> field mapping land
						in P4.
					</p>
				</div>
			</div>
		</div>
	);
}
