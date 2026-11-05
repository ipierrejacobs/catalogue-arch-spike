import type { Role, Session } from "@shared/mocks/schemas";
import { SessionSchema } from "@shared/mocks/schemas";
import {
	type QueryClient,
	queryOptions,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { ApiError, apiFetch } from "./api-client";
import { getDevToken, useDevTokenStore } from "./token-store";

export interface AuthState {
	/**
	 * Ensure the current session is resolved through the TanStack Query cache.
	 * Returns `null` if unauthenticated or if the token is expired (after one silent-refresh attempt).
	 */
	ensureSession: () => Promise<Session | null>;
	getToken: () => string | null;
}

/**
 * Fetches `GET /api/session`.
 * Per confirmed decision #2 (EVIDENCE.md §0.5) and P1 plan Step 4:
 * If `GET /api/session` returns 401 (e.g. expired token), perform one silent-refresh attempt
 * by re-hitting `GET /api/session` once before failing.
 */
export async function fetchSessionWithSilentRefresh(): Promise<Session> {
	try {
		const raw = await apiFetch<unknown>("/api/session");
		return SessionSchema.parse(raw);
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			// One silent-refresh attempt: re-hit GET /api/session once
			const retryRaw = await apiFetch<unknown>("/api/session");
			return SessionSchema.parse(retryRaw);
		}
		throw err;
	}
}

export function sessionQueryOptions(token: string | null) {
	return queryOptions({
		queryKey: ["session", token ?? "none"] as const,
		queryFn: async (): Promise<Session | null> => {
			if (!token) {
				return null;
			}
			return fetchSessionWithSilentRefresh();
		},
		retry: false,
		staleTime: 30_000,
	});
}

export function createAuthState(queryClient: QueryClient): AuthState {
	return {
		getToken: () => getDevToken(),
		ensureSession: async () => {
			const token = getDevToken();
			if (!token) {
				return null;
			}
			try {
				return await queryClient.ensureQueryData(sessionQueryOptions(token));
			} catch (err) {
				if (err instanceof ApiError && err.status === 401) {
					return null;
				}
				throw err;
			}
		},
	};
}

export function useSession() {
	const token = useDevTokenStore((s) => s.token);
	const queryClient = useQueryClient();

	const query = useQuery(sessionQueryOptions(token));

	const session = query.data ?? null;
	const roles: Role[] = session?.roles ?? [];
	const canEdit =
		roles.includes("CATALOGUE_EDITOR") || roles.includes("CATALOGUE_ADMIN");

	return {
		...query,
		session,
		user: session?.user ?? null,
		roles,
		canEdit,
		token,
		invalidateSession: () =>
			queryClient.invalidateQueries({ queryKey: ["session"] }),
	};
}
