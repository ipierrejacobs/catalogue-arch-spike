Phase 1 Slice Spec — the bake-off instrument

Build this same screen in each finalist (React + TanStack Start, React + Next.js). Everything in this spec is fixed and identical across both builds; only the stack varies. That is what makes the comparison evidence, not opinion.

References: Locked Decisions Register (claude/locked-decisions.md) · Scorecard (artifact). Finalists: TanStack Start · Next.js. Optional control: SvelteKit (only if you want to feel the "leave React" delta). Timebox: 2 engineers. Shared mock + shared spec means most React code ports between the two → realistically ~3–5 days per stack, not a full 2–3 weeks.

1. Why this screen

The screen is a Collaboration Detail view from the Integration Catalogue. One Collaboration links applications through middleware integration flows, so a single screen naturally forces every real pain point at once: server-state fetching, a non-trivial CRUD form, deep nested routing, auth/role gating, a virtualized table of thousands of flows, and a lineage graph of hundreds of nodes. If a stack is going to crack on this product, it cracks here.

This is deliberately not a todo app. The table and the graph are the components the scorecard said a 2-person team can't hand-roll — so they're in the slice on purpose.

2. The screen

Route: /collaborations/:id with four deep-linkable tabs and an edit drawer.

Zone	What it is	Pain point it exercises
Header	Name, status pill, criticality, owner, SLA target, Edit button (role-gated)	Render-time auth capability check; semantic status color
Tab: Overview	Metadata summary + a few KPI tiles (flow count, consumer count, avg latency)	Derived/server state, loading & empty states
Tab: Flows	Virtualized table of integration flows in this collaboration	Large-list perf, server-side sort/filter/paginate, URL-synced table state
Tab: Lineage	Dependency/lineage graph of apps ↔ flows ↔ MCP servers ↔ agents ↔ APIs	Graph render at scale, pan/zoom, node→route navigation
Tab: Consumers	Simple list of downstream consumers (lighter; proves the pattern repeats cheaply)	Reuse of the fetch/list pattern
Edit drawer	Routed drawer /collaborations/:id/edit — the CRUD form	Form validation, optimistic update + rollback, server-error mapping, routed modal

Nested routes (all must be real URLs, shareable, back/forward-correct):

/collaborations/:id/overview        (default)
/collaborations/:id/flows?sort=&dir=&status=&q=&page=&size=
/collaborations/:id/lineage?depth=2
/collaborations/:id/consumers
/collaborations/:id/edit            (drawer over whatever tab is active)

Table state (sort/dir/status/q/page/size) lives in the URL, not component state — it must survive reload and deep-link. This is a direct test of each router's URL-as-state ergonomics.

3. State placement (tests the state-separation principle)
Kind	Example in this slice	Goes in
Server state	collaboration, flows page, lineage graph, session	TanStack Query
URL state	active tab, table sort/filter/page, edit-drawer open	Router / URL
App state	multi-row selection set, bulk-action mode	Zustand or Jotai
UI state	drawer field focus, local form draft, hover	local component state

A build that smears table state into local component state, or server data into Zustand, has failed the slice regardless of how it looks.

4. API contract (framework-agnostic — same for both builds)

Spring Boot 3 / Java 21 backend. Both builds hit these shapes through the shared mock (§6), so the frontend contract is identical whether or not the real API is ready.

Entities (abbreviated):

jsonc
// Collaboration
{ "id":"col_8f3", "name":"Orders → Billing Settlement", "description":"…",
  "status":"active",            // active | draft | deprecated | retired
  "domain":"Finance", "criticality":"high",   // low | medium | high | critical
  "owner":{ "id":"u_12","name":"A. Okafor" },
  "tags":["pci","realtime"], "slaTargetMs":250,
  "sourceApp":{ "id":"app_1","name":"Orders" },
  "targetApps":[{ "id":"app_9","name":"Billing" }],
  "flowCount":1480, "consumerCount":37,
  "createdAt":"2026-02-11T09:00:00Z", "updatedAt":"2026-10-02T14:12:00Z" }

// IntegrationFlow (table row)
{ "id":"flow_23a", "name":"order.created → billing.ingest",
  "middleware":"Kafka",         // Kafka | MuleSoft | Boomi | ApacheCamel | custom
  "direction":"outbound",       // inbound | outbound | bidirectional
  "status":"active", "health":"degraded",   // healthy | degraded | down
  "avgLatencyMs":312, "throughputPerMin":940, "lastRunAt":"2026-10-15T07:41:00Z" }

// Lineage
{ "nodes":[{ "id":"app_1","type":"application","label":"Orders","state":"healthy" },
            { "id":"mcp_4","type":"mcp_server","label":"Pricing MCP","state":"healthy" },
            { "id":"agent_2","type":"ai_agent","label":"Dispute Agent","state":"degraded" }],
  "edges":[{ "from":"app_1","to":"flow_23a","kind":"produces","volume":940 },
            { "from":"flow_23a","to":"app_9","kind":"consumes","volume":940 }] }

Endpoints:

GET  /api/session                         → { user, roles[] }           (401 if unauthenticated)
GET  /api/collaborations/:id              → Collaboration
PUT  /api/collaborations/:id              → Collaboration               (requires CATALOGUE_EDITOR)
GET  /api/collaborations/:id/flows        → Spring Page<IntegrationFlow>
       ?sort=avgLatencyMs&dir=desc&status=active&q=billing&page=0&size=50
GET  /api/collaborations/:id/lineage?depth=2 → { nodes[], edges[] }

Paging = Spring Data Page shape (real Spring Boot, not a custom envelope):

jsonc
{ "content":[ /* rows */ ], "totalElements":1480, "number":0, "size":50, "totalPages":30 }

Errors = RFC 7807 application/problem+json (Spring Boot 3 ProblemDetail native):

jsonc
{ "type":"https://catalogue/errors/validation", "title":"Validation failed",
  "status":422, "detail":"slaTargetMs must be ≥ 1",
  "errors":{ "slaTargetMs":"must be ≥ 1" } }     // field map drives form error display

The form must map errors{} back onto fields. This is a real enterprise detail and a common place frameworks get awkward — keep it in.

5. Auth (SPA-first, per locked decisions)
JWT bearer, sent on every call. GET /api/session resolves the current user + roles.
Route guard: unauthenticated load → redirect to /login?return=<path>; after login, return to the deep link intact.
Roles: CATALOGUE_VIEWER (read), CATALOGUE_EDITOR (edit), CATALOGUE_ADMIN. Edit button and PUT are gated to EDITOR+; a viewer sees the button disabled with a reason, and a forged request still 403s at the mock.
401 mid-session (token expiry): one silent refresh attempt; on failure, bounce to login preserving the return path. The slice must not white-screen on expiry.

Both builds guard client-side (SPA). No server components / server actions required — if a stack pushes you toward them here, that friction is itself a finding.

6. Shared mock (identical for both builds)

Run the slice without the real backend, with the same mock wired into both:

MSW (Mock Service Worker) intercepting the §4 endpoints — one handlers.ts shared verbatim across both repos.
Seed: 1 collaboration, ~3,000 flows (so the table must virtualize, not just paginate prettily), ~400 lineage nodes / ~900 edges (so the graph must cope), 3 session fixtures (viewer, editor, expired).
Inject artificial latency (e.g., 150–400ms, jittered) so Query caching/prefetch actually shows its value.
Same seed = same numbers = a fair fight.
7. Acceptance checklist (both builds must pass every item)

Neither build is "done" until all of these are true — this stops one build quietly cutting a corner the other didn't:

 Deep-link to /collaborations/:id/flows?sort=avgLatencyMs&dir=desc&status=degraded&page=3 loads that exact state cold.
 Table scrolls 3,000 rows at 60fps; sort/filter/paginate go through the server (mock), not client-side slicing.
 Row hover prefetches; back/forward restores table state; no full reload between tabs.
 Lineage graph renders ~400 nodes, pans/zooms smoothly, node click routes to that entity.
 Edit drawer: dirty-tracking, optimistic save + rollback on injected 422, field errors mapped from problem+json.
 Viewer role: edit disabled with reason; forged PUT returns 403 and is handled.
 Token-expiry fixture: silent refresh → on failure, redirect to login preserving return path, no white screen.
 Empty + error states exist for every fetch (no raw spinners-forever).
 Keyboard: table and drawer fully operable; visible focus throughout (free a11y bar).
8. Evidence to capture (this closes the gate, not the scorecard)

Record side-by-side for each stack:

DX notes (narrative): scaffold-to-first-screen time; routing ergonomics (URL-as-state); data-fetching ergonomics; auth wiring friction; how the table and graph libraries dropped in; type-safety friction; docs/unblock friction; and — for the AI pipeline (Phase 3) — whether v0 could scaffold a component against this contract.

Numbers (same mock, same machine):

Metric	How
Cold dev-server start	first dev to interactive
HMR latency	save → reflect, on the table component
Prod build time	clean build
Initial JS (gzipped)	the /collaborations/:id route
Route-change latency	tab → tab, warm cache
Table interaction latency	sort/scroll at 3,000 rows
Graph first render	~400 nodes
Web vitals	LCP/INP for the screen

Team reactions (both engineers): confidence to maintain this for 3 years; biggest surprise; biggest pain; would-I-choose-this gut call.

Rule: same mock, same acceptance checklist, same machine → every difference you see is the stack.

9. Per-stack mapping (the only things allowed to differ)
Concern	TanStack Start	Next.js
Routing	File-based TanStack Router, search params typed/validated	App Router; table state via useSearchParams
Data	TanStack Query (+ Start loaders/prefetch)	TanStack Query (client); avoid RSC for the gated data
Auth	Client guard in route beforeLoad	Client guard in layout/middleware (client-side)
Table	TanStack Table + TanStack Virtual	identical
Graph	React Flow (or Sigma for scale)	identical
Build	Vite	Turbopack/Next

Keep the component, token, form and graph code shared between the two where you can — the less that differs, the cleaner the signal.