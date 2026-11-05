import type { ProblemDetail } from "@shared/mocks/schemas";
import { getDevToken } from "./token-store";

export class ApiError extends Error {
	readonly status: number;
	readonly problem: ProblemDetail | null;

	constructor(status: number, message: string, problem: ProblemDetail | null = null) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.problem = problem;
	}
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const headers = new Headers(init?.headers);
	const token = getDevToken();
	if (token && !headers.has("Authorization")) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	if (init?.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const resolvedUrl =
		typeof window === "undefined" && path.startsWith("/")
			? `http://localhost${path}`
			: path;

	const response = await fetch(resolvedUrl, {
		...init,
		headers,
	});

	if (!response.ok) {
		let problem: ProblemDetail | null = null;
		try {
			const data = (await response.json()) as ProblemDetail;
			if (data && typeof data === "object" && "status" in data) {
				problem = data;
			}
		} catch {
			// Ignore JSON parse errors on non-JSON error responses
		}
		throw new ApiError(
			response.status,
			problem?.detail ?? problem?.title ?? `Request failed (${response.status})`,
			problem,
		);
	}

	return (await response.json()) as T;
}
