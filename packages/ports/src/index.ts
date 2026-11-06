/**
 * @platform/ports — Narrow, per-concern capability port interfaces + in-memory test adapters.
 *
 * ARCHITECTURAL LAW:
 * - Only Tier 3–4 components in `@platform/ui` may import from `@platform/ports`.
 * - Tier 0–2 leaf/molecule components are structurally forbidden by lint (`platform-arch/no-ports-in-leaf-tiers`
 *   and Biome `noRestrictedImports`) from importing `@platform/ports`.
 * - Stage 0 stands up the package boundary; Stage 2 populates `RowSourcePort`, `RowMutationPort`,
 *   `NavigationPort`, `PermissionPort`, and `ViewStatePort` + their in-memory adapters.
 */

export const PORTS_MINIMUM_TIER = 3 as const;

export type PortConcern =
	| "row-source"
	| "row-mutation"
	| "navigation"
	| "permission"
	| "view-state";

export interface PortContractDescriptor<TConcern extends PortConcern = PortConcern> {
	readonly concern: TConcern;
	readonly minTier: typeof PORTS_MINIMUM_TIER;
}
