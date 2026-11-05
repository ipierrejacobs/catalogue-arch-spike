import {
	createFileRoute,
	isRedirect,
	Link,
	Outlet,
	redirect,
	useRouterState,
} from "@tanstack/react-router";
import { useSession } from "#/lib/auth";

export const Route = createFileRoute("/collaborations/$id")({
	beforeLoad: async ({ context, location }) => {
		try {
			const session = await context.auth.ensureSession();
			if (!session) {
				throw redirect({
					to: "/login",
					search: { redirect: location.href },
				});
			}
			return { session };
		} catch (err) {
			if (isRedirect(err)) {
				throw err;
			}
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
	},
	component: CollaborationLayout,
});

const TABS = [
	{ label: "Overview", to: "/collaborations/$id/overview" },
	{ label: "Flows", to: "/collaborations/$id/flows" },
	{ label: "Lineage", to: "/collaborations/$id/lineage" },
	{ label: "Consumers", to: "/collaborations/$id/consumers" },
] as const;

function CollaborationLayout() {
	const { id } = Route.useParams();
	const { canEdit, user } = useSession();
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});

	return (
		<div className="mx-auto max-w-6xl px-6 py-8" data-testid="collaboration-shell">
			{/* Header placeholder shell */}
			<header
				data-testid="collaboration-header"
				className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
			>
				<div>
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold text-slate-900">
							Collaboration <span className="font-mono text-lg text-slate-600">{id}</span>
						</h1>
						<span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
							Shell
						</span>
					</div>
					<p className="mt-1 text-sm text-slate-600">
						P1 routing shell placeholder · Active user:{" "}
						<span className="font-medium text-slate-800">
							{user?.name ?? "Unknown"}
						</span>
					</p>
				</div>

				<div className="flex items-center gap-3">
					{canEdit ? (
						<Link
							to="/collaborations/$id/edit"
							params={{ id }}
							data-testid="edit-collaboration-button"
							className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
						>
							Edit Collaboration
						</Link>
					) : (
						<div className="flex flex-col items-end">
							<button
								type="button"
								disabled
								aria-disabled="true"
								title="Requires CATALOGUE_EDITOR role"
								data-testid="edit-collaboration-button"
								className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400"
							>
								Edit Collaboration
							</button>
							<span
								data-testid="edit-disabled-reason"
								className="mt-1 text-xs text-slate-500"
							>
								Requires CATALOGUE_EDITOR role
							</span>
						</div>
					)}
				</div>
			</header>

			{/* Tab navigation */}
			<nav
				aria-label="Collaboration tabs"
				className="mt-6 flex gap-2 border-b border-slate-200"
			>
				{TABS.map((tab) => {
					const resolvedPath = tab.to.replace("$id", id);
					const isActive =
						pathname === resolvedPath ||
						(tab.label === "Overview" && pathname === `/collaborations/${id}`);
					return (
						<Link
							key={tab.to}
							to={tab.to}
							params={{ id }}
							data-testid={`tab-${tab.label.toLowerCase()}`}
							className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
								isActive
									? "border-sky-600 text-sky-600"
									: "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
							}`}
						>
							{tab.label}
						</Link>
					);
				})}
			</nav>

			{/* Active tab / drawer outlet */}
			<section className="mt-6">
				<Outlet />
			</section>
		</div>
	);
}
