/**
 * @platform/tokens — Minimal hand-authored token contract for the Phase 2 spike.
 *
 * SEAM (Phase 3): Replace hand-authored CSS variables in `./tokens.css` with
 * DTCG 2025.10 -> Style Dictionary v5 (`css/variables`, `outputReferences: true`)
 * output in CI. Component `.styles.ts` files consume only these token-backed
 * CSS variables / Tailwind `@theme inline` classes, so Phase 3 requires zero
 * component changes.
 */

export const TOKEN_PIPELINE_SEAM =
	"Phase 3 replaces packages/tokens/src/tokens.css with DTCG 2025.10 -> Style Dictionary v5 css/variables output (outputReferences: true)." as const;

export type ThemeMode = "light" | "dark";
export type DensityMode = "compact" | "default" | "comfortable";

export const TOKEN_TIERS = ["primitive", "semantic", "component"] as const;
export type TokenTier = (typeof TOKEN_TIERS)[number];

/**
 * Helper attributes for switching theme or density via pure CSS variables
 * (never a React context).
 */
export function getThemeDataAttr(theme: ThemeMode): { "data-theme": ThemeMode } {
	return { "data-theme": theme };
}

export function getDensityDataAttr(density: DensityMode): {
	"data-density": DensityMode;
} {
	return { "data-density": density };
}
