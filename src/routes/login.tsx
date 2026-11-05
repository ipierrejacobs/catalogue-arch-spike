import { CANONICAL_COLLABORATION_ID, DEV_TOKENS } from "@shared/mocks/seed";
import { createFileRoute, useHydrated, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { setDevToken } from "#/lib/token-store";

const LoginSearchSchema = z.object({
	redirect: z.string().optional(),
	return: z.string().optional(),
});

export const Route = createFileRoute("/login")({
	validateSearch: (search) => LoginSearchSchema.parse(search),
	component: LoginRoute,
});

function LoginRoute() {
	const router = useRouter();
	const isHydrated = useHydrated();
	const search = Route.useSearch();
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	const targetRedirect =
		search.redirect ??
		search.return ??
		`/collaborations/${CANONICAL_COLLABORATION_ID}/overview`;

	const handleSelectFixture = async (
		fixture: "viewer" | "editor" | "expired",
	) => {
		setIsPending(true);
		setStatusMessage(null);
		const token = DEV_TOKENS[fixture];
		setDevToken(token);

		const session = await router.options.context.auth.ensureSession();
		if (!session) {
			setIsPending(false);
			setStatusMessage(
				"Session expired (401 after silent refresh attempt). Redirected back to login with return path preserved.",
			);
			router.history.push(
				`/login?redirect=${encodeURIComponent(targetRedirect)}`,
			);
			return;
		}

		setIsPending(false);
		router.history.push(targetRedirect);
	};

	return (
		<main
			data-testid="login-screen"
			className="mx-auto max-w-md px-6 py-16"
		>
			<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<h1 className="text-xl font-bold text-slate-900">
					Sign in (Dev Fixture Harness)
				</h1>
				<p className="mt-2 text-sm text-slate-600">
					Select a session fixture to authenticate against the MSW mock.
				</p>

				<div className="mt-4 rounded-md bg-slate-100 p-3 text-xs text-slate-700">
					<span className="font-semibold text-slate-500">Return target: </span>
					<code data-testid="login-redirect-target" className="break-all">
						{targetRedirect}
					</code>
				</div>

				{statusMessage ? (
					<div
						role="alert"
						data-testid="login-status-message"
						className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
					>
						{statusMessage}
					</div>
				) : null}

				<div className="mt-6 flex flex-col gap-3">
					<button
						type="button"
						disabled={!isHydrated || isPending}
						data-testid="login-as-viewer"
						onClick={() => void handleSelectFixture("viewer")}
						className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50"
					>
						<span>Continue as Viewer</span>
						<span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
							CATALOGUE_VIEWER
						</span>
					</button>

					<button
						type="button"
						disabled={!isHydrated || isPending}
						data-testid="login-as-editor"
						onClick={() => void handleSelectFixture("editor")}
						className="flex items-center justify-between rounded-lg border border-sky-600 bg-sky-600 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50"
					>
						<span>Continue as Editor</span>
						<span className="rounded bg-sky-700 px-2 py-0.5 font-mono text-xs text-sky-100">
							CATALOGUE_EDITOR
						</span>
					</button>

					<button
						type="button"
						disabled={!isHydrated || isPending}
						data-testid="login-as-expired"
						onClick={() => void handleSelectFixture("expired")}
						className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm font-medium text-amber-900 transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50"
					>
						<span>Simulate Expired Token</span>
						<span className="rounded bg-amber-200/70 px-2 py-0.5 font-mono text-xs text-amber-900">
							401 → silent refresh → login
						</span>
					</button>
				</div>
			</div>
		</main>
	);
}
