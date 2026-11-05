import { DEV_TOKENS } from "@shared/mocks/seed";
import {
	useHydrated,
	useNavigate,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { useSession } from "#/lib/auth";
import { setDevToken, useDevTokenStore } from "#/lib/token-store";

const ROLE_OPTIONS = [
	{ label: "Viewer", key: "viewer", token: DEV_TOKENS.viewer },
	{ label: "Editor", key: "editor", token: DEV_TOKENS.editor },
	{ label: "Expired", key: "expired", token: DEV_TOKENS.expired },
] as const;

export function RoleSwitcher() {
	const router = useRouter();
	const navigate = useNavigate();
	const isHydrated = useHydrated();
	const locationHref = useRouterState({
		select: (s) => s.location.href,
	});
	const activeToken = useDevTokenStore((s) => s.token);
	const { user, roles, isFetching } = useSession();

	const handleSelectToken = async (nextToken: string | null) => {
		setDevToken(nextToken);
		if (!nextToken) {
			await navigate({
				to: "/login",
				search: { redirect: locationHref },
			});
			return;
		}
		const session = await router.options.context.auth.ensureSession();
		if (!session) {
			await navigate({
				to: "/login",
				search: { redirect: locationHref },
			});
			return;
		}
		await router.invalidate();
	};

	return (
		<div
			data-testid="role-switcher"
			className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 py-2 text-xs text-slate-200"
		>
			<div className="flex items-center gap-2">
				<span className="font-semibold uppercase tracking-wider text-slate-400">
					Dev Role Switcher
				</span>
				<fieldset
					className="flex items-center gap-1 border-0 p-0 m-0"
					aria-label="Switch session fixture"
				>
					{ROLE_OPTIONS.map((opt) => {
						const isActive = activeToken === opt.token;
						return (
							<button
								key={opt.key}
								type="button"
								disabled={!isHydrated}
								data-testid={`role-switch-${opt.key}`}
								aria-pressed={isActive}
								onClick={() => void handleSelectToken(opt.token)}
								className={`rounded px-2.5 py-1 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50 ${
									isActive
										? "bg-sky-500 text-white"
										: "bg-slate-800 text-slate-300 hover:bg-slate-700"
								}`}
							>
								{opt.label}
							</button>
						);
					})}
					<button
						type="button"
						disabled={!isHydrated}
						data-testid="role-switch-clear"
						aria-pressed={activeToken === null}
						onClick={() => void handleSelectToken(null)}
						className="rounded bg-slate-800 px-2.5 py-1 font-medium text-slate-300 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-50"
					>
						Sign Out
					</button>
				</fieldset>
			</div>
			<div className="flex items-center gap-2 text-slate-300" data-testid="session-status">
				{isFetching ? (
					<span className="text-amber-300">Checking session…</span>
				) : user ? (
					<span>
						Signed in as <strong className="text-white">{user.name}</strong>{" "}
						<span className="text-slate-400">({roles.join(", ")})</span>
					</span>
				) : (
					<span className="text-slate-400">Unauthenticated</span>
				)}
			</div>
		</div>
	);
}
