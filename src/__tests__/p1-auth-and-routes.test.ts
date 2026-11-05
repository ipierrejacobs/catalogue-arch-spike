import { handlers } from "@shared/mocks/handlers";
import { DEV_TOKENS } from "@shared/mocks/seed";
import { QueryClient } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAuthState } from "#/lib/auth";
import { setDevToken } from "#/lib/token-store";
import { FlowsSearchSchema } from "#/routes/collaborations/$id.flows";

const server = setupServer(...handlers);

beforeAll(() => {
	Object.assign(globalThis, {
		location: new URL("http://localhost/"),
	});
	server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
	server.resetHandlers();
	setDevToken(null);
});

afterAll(() => {
	server.close();
});

describe("P1 Auth plumbing & session resolution against MSW", () => {
	it("returns null when no dev token is selected", async () => {
		const queryClient = new QueryClient();
		const auth = createAuthState(queryClient);

		setDevToken(null);
		const session = await auth.ensureSession();
		expect(session).toBeNull();
	});

	it("resolves viewer session from GET /api/session into Query cache", async () => {
		const queryClient = new QueryClient();
		const auth = createAuthState(queryClient);

		setDevToken(DEV_TOKENS.viewer);
		const session = await auth.ensureSession();
		expect(session).not.toBeNull();
		expect(session?.user.name).toBe("V. Reader");
		expect(session?.roles).toEqual(["CATALOGUE_VIEWER"]);
	});

	it("resolves editor session from GET /api/session into Query cache", async () => {
		const queryClient = new QueryClient();
		const auth = createAuthState(queryClient);

		setDevToken(DEV_TOKENS.editor);
		const session = await auth.ensureSession();
		expect(session).not.toBeNull();
		expect(session?.user.name).toBe("A. Okafor");
		expect(session?.roles).toContain("CATALOGUE_EDITOR");
	});

	it("performs one silent-refresh attempt on expired token (2x GET /api/session) and returns null on repeat 401", async () => {
		const queryClient = new QueryClient();
		const auth = createAuthState(queryClient);

		let sessionCallCount = 0;
		server.events.on("request:start", ({ request }) => {
			if (new URL(request.url).pathname === "/api/session") {
				sessionCallCount += 1;
			}
		});

		setDevToken(DEV_TOKENS.expired);
		const session = await auth.ensureSession();

		expect(session).toBeNull();
		expect(sessionCallCount).toBe(2);
	});
});

describe("P1 Flows route search param validation", () => {
	it("validates and coerces the acceptance deep-link search params", () => {
		const parsed = FlowsSearchSchema.parse({
			sort: "avgLatencyMs",
			dir: "desc",
			status: "degraded",
			page: "3",
			size: "50",
		});

		expect(parsed).toEqual({
			sort: "avgLatencyMs",
			dir: "desc",
			status: "degraded",
			page: 3,
			size: 50,
		});
	});
});
