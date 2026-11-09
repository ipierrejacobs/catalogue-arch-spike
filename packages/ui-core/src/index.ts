/**
 * @platform/ui — Graduated-Capability UI Component Library.
 *
 * Every component in `src/<name>/` follows the four-layer folder template:
 *   <name>.behavior.ts  // L1: headless hook / primitive wrapper (Base UI / TanStack Table v9). May be empty.
 *   <name>.ports.ts     // L2: typed port interfaces + context hooks. EMPTY/ABSENT for Tier 0–2. Opt-in for Tier 3–4.
 *   <name>.parts.tsx    // L3: compound parts; render/useRender/mergeProps substitution points.
 *   <name>.styles.ts    // L4: token-driven variants (CSS vars / Tailwind @theme inline). No raw values.
 *   index.ts            // public API
 *
 * Stage 0: Scaffold only (nothing renders yet).
 * Stage 1: Button (Tier 1 — negative proof, L2 empty).
 * Stage 2: DataTable (Tier 4 — macro brick, L2 ports + in-memory adapters).
 */

export type ComponentTier = 0 | 1 | 2 | 3 | 4;

export type LeafComponentTier = 0 | 1 | 2;
export type PortCapableComponentTier = 3 | 4;

export const MAX_PORT_FREE_TIER: LeafComponentTier = 2;

export type CapabilityType =
	| "presentation"
	| "tokens"
	| "a11y-behavior"
	| "internal-ui-state"
	| "routing-port"
	| "server-data-port"
	| "app-state-port"
	| "session-permission-port";

export interface GraduatedComponentMeta<TTier extends ComponentTier = ComponentTier> {
	readonly name: string;
	readonly tier: TTier;
	readonly capabilities: readonly CapabilityType[];
	readonly layersPopulated: readonly ("behavior" | "ports" | "parts" | "styles")[];
}

export * from "./button";
export * from "./datatable";

