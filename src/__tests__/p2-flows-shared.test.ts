import {
	buildFlowsApiPath,
	cleanFlowsSearch,
	FlowsSearchSchema,
	fetchFlowsPage,
	flowsQueryKey,
	parseFlowsSearch,
	prefetchAdjacentFlowsPages,
	resolveFlowsSearch,
	setFlowsTokenGetter,
} from "@shared/flows";
import { handlers } from "@shared/mocks/handlers";
import { CANONICAL_COLLABORATION_ID, DEV_TOKENS } from "@shared/mocks/seed";
import { QueryClient } from "@tanstack/react-query";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getDevToken, setDevToken } from "#/lib/token-store";

const server = setupServer(...handlers);

beforeAll(() => {
	Object.assign(globalThis, {
		location: new URL("http://localhost/"),
	});
	setFlowsTokenGetter(getDevToken);
	server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
	server.resetHandlers();
	setDevToken(null);
});

afterAll(() => {
	setFlowsTokenGetter(null);
	server.close();
});

describe("P2 Step 1 — Shared Flows layer (schema, query hook helpers)", () => {
	it("parses and resolves the gate deep-link search params identically from object and URLSearchParams", () => {
		const fromObject = parseFlowsSearch({
			sort: "avgLatencyMs",
			dir: "desc",
			status: "degraded",
			page: "3",
		});
		const fromUrlSearchParams = parseFlowsSearch(
			new URLSearchParams("sort=avgLatencyMs&dir=desc&status=degraded&page=3"),
		);

		expect(fromObject).toEqual({
			sort: "avgLatencyMs",
			dir: "desc",
			status: "degraded",
			page: 3,
		});
		expect(fromUrlSearchParams).toEqual(fromObject);

		const resolved = resolveFlowsSearch(fromObject);
		expect(resolved).toEqual({
			sort: "avgLatencyMs",
			dir: "desc",
			status: "degraded",
			q: "",
			page: 3,
			size: 50,
		});
	});

	it("discards invalid sort/page fields without losing valid sibling search params", () => {
		const parsed = parseFlowsSearch({
			sort: "not_a_column",
			dir: "desc",
			status: "degraded",
			page: "-4",
			size: "100",
		});

		expect(parsed).toEqual({
			dir: "desc",
			status: "degraded",
			size: 100,
		});
		expect(() => FlowsSearchSchema.parse(parsed)).not.toThrow();
	});

	it("builds a queryKey carrying all six URL parameters", () => {
		const key = flowsQueryKey(CANONICAL_COLLABORATION_ID, {
			sort: "avgLatencyMs",
			dir: "desc",
			status: "degraded",
			page: 3,
		});

		expect(key).toEqual([
			"collaborations",
			"col_8f3",
			"flows",
			{
				sort: "avgLatencyMs",
				dir: "desc",
				status: "degraded",
				q: "",
				page: 3,
				size: 50,
			},
		]);
		expect(
			buildFlowsApiPath(CANONICAL_COLLABORATION_ID, {
				sort: "avgLatencyMs",
				dir: "desc",
				status: "degraded",
				page: 3,
			}),
		).toBe(
			"/api/collaborations/col_8f3/flows?sort=avgLatencyMs&dir=desc&status=degraded&page=3&size=50",
		);
		expect(
			cleanFlowsSearch({
				sort: "avgLatencyMs",
				dir: "desc",
				status: "degraded",
				q: "",
				page: 0,
				size: 50,
			}),
		).toEqual({
			sort: "avgLatencyMs",
			dir: "desc",
			status: "degraded",
		});
	});

	it("fetches the gate deep-link page from MSW and prefetches adjacent pages into Query cache", async () => {
		setDevToken(DEV_TOKENS.viewer);
		const queryClient = new QueryClient();
		const gateParams = {
			sort: "avgLatencyMs" as const,
			dir: "desc" as const,
			status: "degraded",
			page: 3,
		};

		const pageData = await fetchFlowsPage(
			CANONICAL_COLLABORATION_ID,
			gateParams,
		);

		expect(pageData.number).toBe(3);
		expect(pageData.size).toBe(50);
		expect(pageData.totalElements).toBe(665);
		expect(pageData.content).toHaveLength(50);
		// Verify descending avgLatencyMs order and union status=degraded filter (resolving via health)
		for (let i = 0; i < pageData.content.length; i++) {
			const row = pageData.content[i];
			expect(row.health).toBe("degraded");
			if (i > 0) {
				expect(pageData.content[i - 1].avgLatencyMs).toBeGreaterThanOrEqual(
					row.avgLatencyMs,
				);
			}
		}

		// Adjacent-page prefetch populates page 2 and page 4 in Query cache
		await prefetchAdjacentFlowsPages(
			queryClient,
			CANONICAL_COLLABORATION_ID,
			gateParams,
			pageData.totalPages,
		);

		const prevCached = queryClient.getQueryData(
			flowsQueryKey(CANONICAL_COLLABORATION_ID, { ...gateParams, page: 2 }),
		);
		const nextCached = queryClient.getQueryData(
			flowsQueryKey(CANONICAL_COLLABORATION_ID, { ...gateParams, page: 4 }),
		);
		expect(prevCached).toBeDefined();
		expect(nextCached).toBeDefined();
	});
});
