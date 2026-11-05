import { CANONICAL_COLLABORATION_ID } from "@shared/mocks/seed";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
				<h1 className="text-2xl font-bold text-slate-900">
					Integration Catalogue — Collaboration Slice (TanStack Start)
				</h1>
				<p className="mt-2 text-sm text-slate-600">
					Phase 1 stack bake-off · P1 routing shell + MSW + client-side auth guard.
				</p>
				<div className="mt-6 flex flex-wrap gap-3">
					<Link
						to="/collaborations/$id/overview"
						params={{ id: CANONICAL_COLLABORATION_ID }}
						className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
					>
						Open Collaboration ({CANONICAL_COLLABORATION_ID})
					</Link>
					<Link
						to="/login"
						className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
					>
						Sign In / Switch Role
					</Link>
				</div>
			</div>
		</main>
	);
}
