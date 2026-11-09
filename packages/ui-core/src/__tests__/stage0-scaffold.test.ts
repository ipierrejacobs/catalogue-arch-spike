import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { ADAPTERS_LAYER } from "@platform/adapters";
import { PORTS_MINIMUM_TIER } from "@platform/ports";
import {
	getDensityDataAttr,
	getThemeDataAttr,
	TOKEN_PIPELINE_SEAM,
	TOKEN_TIERS,
} from "@platform/tokens";
import { MAX_PORT_FREE_TIER } from "@platform/ui";

describe("Stage 0 — Four-layer workspace scaffold, token tiers, and lint guard", () => {
	it("resolves all four @platform/* workspace packages and their boundary constants", () => {
		expect(TOKEN_TIERS).toEqual(["primitive", "semantic", "component"]);
		expect(TOKEN_PIPELINE_SEAM).toContain("Style Dictionary v5");
		expect(PORTS_MINIMUM_TIER).toBe(3);
		expect(MAX_PORT_FREE_TIER).toBe(2);
		expect(ADAPTERS_LAYER).toBe("@platform/adapters");
		expect(getThemeDataAttr("dark")).toEqual({ "data-theme": "dark" });
		expect(getDensityDataAttr("compact")).toEqual({
			"data-density": "compact",
		});
	});

	it("defines primitive, semantic, component tiers + Tailwind v4 @theme inline in tokens.css", () => {
		const cssPath = resolve(
			process.cwd(),
			"packages/tokens/src/tokens.css",
		);
		const css = readFileSync(cssPath, "utf8");

		// Phase 3 seam comment
		expect(css).toContain("SEAM (Phase 3):");

		// Three token tiers
		expect(css).toContain("--prim-color-blue-600");
		expect(css).toContain("--sem-color-accent-default: var(--prim-color-blue-600)");
		expect(css).toContain("--cmp-button-primary-bg: var(--sem-color-accent-default)");
		expect(css).toContain("--cmp-table-row-height: var(--sem-density-row-height)");

		// Theme & density CSS-variable swaps (zero React context)
		expect(css).toContain('[data-theme="dark"]');
		expect(css).toContain('[data-density="compact"]');
		expect(css).toContain('[data-density="comfortable"]');

		// Tailwind v4 @theme inline mapping
		expect(css).toContain("@theme inline");
		expect(css).toContain("--color-btn-primary: var(--cmp-button-primary-bg)");
		expect(css).toContain("--color-table-bg: var(--cmp-table-bg)");
	});

	it("bites when a Tier 0–2 leaf component imports @platform/ports or populates <name>.ports.ts", async () => {
		const eslint = new ESLint({
			cwd: process.cwd(),
		});

		// 1. Leaf (Tier 1 Button) importing @platform/ports MUST FAIL
		const [violatingImportResult] = await eslint.lintText(
			'import { PORTS_MINIMUM_TIER } from "@platform/ports";\nexport const leaked = PORTS_MINIMUM_TIER;\n',
			{
				filePath: resolve(
					process.cwd(),
					"packages/ui-core/src/button/button.parts.tsx",
				),
			},
		);
		expect(violatingImportResult.errorCount).toBeGreaterThan(0);
		expect(violatingImportResult.messages[0]?.ruleId).toBe(
			"platform-arch/no-ports-in-leaf-tiers",
		);
		expect(violatingImportResult.messages[0]?.message).toContain(
			"Graduated-Capability Violation",
		);

		// 2. Non-empty button.ports.ts in Tier 1 Button MUST FAIL
		const [violatingPortsFileResult] = await eslint.lintText(
			"export interface IllegalButtonPort { canClick(): boolean }\n",
			{
				filePath: resolve(
					process.cwd(),
					"packages/ui-core/src/button/button.ports.ts",
				),
			},
		);
		expect(violatingPortsFileResult.errorCount).toBeGreaterThan(0);
		expect(violatingPortsFileResult.messages[0]?.ruleId).toBe(
			"platform-arch/no-ports-in-leaf-tiers",
		);

		// 3. Clean Tier 1 Button (no port imports) MUST PASS
		const [cleanLeafResult] = await eslint.lintText(
			'export const BUTTON_TIER = 1 as const;\n',
			{
				filePath: resolve(
					process.cwd(),
					"packages/ui-core/src/button/button.parts.tsx",
				),
			},
		);
		expect(cleanLeafResult.errorCount).toBe(0);

		// 4. (a) A Tier-1-tagged file placed UNDER the datatable folder MUST STILL FAIL — location cannot launder tier
		const [launderedTier1InDataTableResult] = await eslint.lintText(
			'// @tier 1\nimport { PORTS_MINIMUM_TIER } from "@platform/ports";\nexport const laundered = PORTS_MINIMUM_TIER;\n',
			{
				filePath: resolve(
					process.cwd(),
					"packages/ui-core/src/datatable/sneaky-tier1-leaf.tsx",
				),
			},
		);
		expect(launderedTier1InDataTableResult.errorCount).toBeGreaterThan(0);
		expect(launderedTier1InDataTableResult.messages[0]?.ruleId).toBe(
			"platform-arch/no-ports-in-leaf-tiers",
		);
		expect(launderedTier1InDataTableResult.messages[0]?.message).toContain(
			"Graduated-Capability Violation",
		);

		// 5. (b) Real Tier-4 DataTable importing @platform/ports MUST PASS
		const [tier4Result] = await eslint.lintText(
			'import { PORTS_MINIMUM_TIER } from "@platform/ports";\nexport const allowed = PORTS_MINIMUM_TIER;\n',
			{
				filePath: resolve(
					process.cwd(),
					"packages/ui-core/src/datatable/datatable.ports.ts",
				),
			},
		);
		expect(tier4Result.errorCount).toBe(0);
	});
});
