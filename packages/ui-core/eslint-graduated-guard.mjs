/**
 * Architectural ESLint Guard for the Graduated-Capability Component Architecture.
 *
 * Single source of truth for the ports prohibition:
 * 1. `platform-arch/no-ports-in-leaf-tiers`:
 *    Tier 0–2 components in `@platform/ui` (`packages/ui-core/src/<component>/`)
 *    MUST NOT import `@platform/ports` (or relative port modules) and MUST NOT
 *    populate `<component>.ports.ts`.
 *
 *    HOW TIER IS RESOLVED (no path allowlist — location cannot launder tier):
 *    - Priority 1 (file-level declaration): an explicit `@tier <0..4>` annotation
 *      or `tier: <0..4>` metadata property in the file itself ALWAYS wins, even if
 *      the file is placed inside a Tier-4 component folder.
 *    - Priority 2 (component Storybook metadata): if the file has no inline tier
 *      declaration, the guard reads `<component>.stories.tsx` in the same component
 *      folder and extracts its declared `tier: <0..4>`.
 *    - Priority 3 (fail-closed default): defaults to Tier 1 (port-free leaf).
 *
 * 2. `platform-arch/no-prohibited-apis`:
 *    Forbids `asChild` composition (use Base UI `render`/`useRender`/`mergeProps`),
 *    deprecated `@mui/base` or `@base-ui-components/react`, and legacy TanStack Table v8
 *    compatibility helpers (`useReactTable`, `useLegacyTable`, `stockFeatures`, `/legacy`).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function normalizePath(filePath) {
	return filePath.replace(/\\/g, "/");
}

/**
 * Extracts an explicit tier (`0..4`) from source text via either:
 * - `@tier <0..4>` JSDoc/line comment tag
 * - `tier: <0..4>` in a `GraduatedComponentMeta` / story metadata object
 */
export function extractDeclaredTierFromSource(sourceText) {
	if (typeof sourceText !== "string") return null;
	const tagMatch = sourceText.match(/@tier\s+([0-4])\b/);
	if (tagMatch) {
		return Number(tagMatch[1]);
	}
	const metaPropMatch = sourceText.match(/\btier\s*:\s*([0-4])\b/);
	if (metaPropMatch) {
		return Number(metaPropMatch[1]);
	}
	return null;
}

/**
 * Resolves the component's tier for a file in `packages/ui-core/src/<component>/<file>`.
 * No path allowlist exists: a file's own tier tag always overrides its folder's `.stories.tsx`.
 */
function getUiComponentFromPath(filePath, sourceText) {
	const norm = normalizePath(filePath);
	const match = norm.match(/packages\/ui-core\/src\/([^/]+)\/([^/]+)$/);
	if (!match) return null;
	const [, folder, fileName] = match;
	if (folder === "__tests__") return null;

	// Priority 1: explicit tier tag or metadata inside the file itself (prevents location laundering)
	const inlineTier = extractDeclaredTierFromSource(sourceText);
	if (inlineTier !== null) {
		return { componentName: folder, fileName, tier: inlineTier };
	}

	// Priority 2: sibling <component>.stories.tsx in the same component folder
	const componentDir = dirname(filePath);
	const storiesPath = join(componentDir, `${folder}.stories.tsx`);
	if (existsSync(storiesPath)) {
		try {
			const storiesSource = readFileSync(storiesPath, "utf8");
			const storiesTier = extractDeclaredTierFromSource(storiesSource);
			if (storiesTier !== null) {
				return { componentName: folder, fileName, tier: storiesTier };
			}
		} catch {
			// Fall through to fail-closed default
		}
	}

	// Priority 3: fail-closed default (Tier 1 leaf — port-free)
	return { componentName: folder, fileName, tier: 1 };
}

function isPortsImportSource(sourceValue) {
	if (typeof sourceValue !== "string") return false;
	return (
		sourceValue === "@platform/ports" ||
		sourceValue.startsWith("@platform/ports/") ||
		sourceValue.includes("packages/ports") ||
		/\.ports(\.(ts|tsx|js|jsx))?$/.test(sourceValue)
	);
}

export const noPortsInLeafTiersRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Forbid Tier 0–2 components in @platform/ui from importing @platform/ports or populating <name>.ports.ts",
		},
		messages: {
			forbiddenPortImport:
				'Graduated-Capability Violation: Tier {{tier}} component "{{component}}" in @platform/ui cannot import "{{source}}". Capability ports (@platform/ports) are forbidden in Tier 0–2 leaves and molecules.',
			nonEmptyPortsLayer:
				'Graduated-Capability Violation: Tier {{tier}} component "{{component}}" must keep "{{fileName}}" empty or absent.',
		},
		schema: [],
	},
	create(context) {
		const filename = context.filename ?? context.getFilename();
		const sourceCode = context.sourceCode ?? context.getSourceCode();
		const sourceText = sourceCode?.getText ? sourceCode.getText() : "";
		const info = getUiComponentFromPath(filename, sourceText);
		if (!info || info.tier > 2) {
			return {};
		}

		return {
			Program(node) {
				if (
					info.fileName.endsWith(".ports.ts") ||
					info.fileName.endsWith(".ports.tsx")
				) {
					if (node.body.length > 0) {
						context.report({
							node,
							messageId: "nonEmptyPortsLayer",
							data: {
								tier: String(info.tier),
								component: info.componentName,
								fileName: info.fileName,
							},
						});
					}
				}
			},
			ImportDeclaration(node) {
				const src = node.source?.value;
				if (isPortsImportSource(src)) {
					context.report({
						node,
						messageId: "forbiddenPortImport",
						data: {
							tier: String(info.tier),
							component: info.componentName,
							source: String(src),
						},
					});
				}
			},
			ExportNamedDeclaration(node) {
				const src = node.source?.value;
				if (src && isPortsImportSource(src)) {
					context.report({
						node,
						messageId: "forbiddenPortImport",
						data: {
							tier: String(info.tier),
							component: info.componentName,
							source: String(src),
						},
					});
				}
			},
			ExportAllDeclaration(node) {
				const src = node.source?.value;
				if (src && isPortsImportSource(src)) {
					context.report({
						node,
						messageId: "forbiddenPortImport",
						data: {
							tier: String(info.tier),
							component: info.componentName,
							source: String(src),
						},
					});
				}
			},
		};
	},
};

const FORBIDDEN_TABLE_SPECIFIERS = new Set([
	"useReactTable",
	"useLegacyTable",
	"stockFeatures",
]);

export const noProhibitedApisRule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Forbid asChild composition, deprecated Base UI package names, and legacy TanStack Table v8 APIs",
		},
		messages: {
			noAsChild:
				'Composition Violation: "asChild" is forbidden. Standardize on Base UI "render" / "useRender" / "mergeProps".',
			noLegacyTableSource:
				'Table v9 Violation: Importing from "{{source}}" is forbidden. Use @tanstack/react-table v9 native useTable + tableFeatures.',
			noLegacyTableSpecifier:
				'Table v9 Violation: "{{name}}" is forbidden. Use @tanstack/react-table v9 native useTable + explicit tableFeatures({...}).',
			noDeprecatedBaseUi:
				'Primitive Layer Violation: "{{source}}" is deprecated. Use "@base-ui/react".',
		},
		schema: [],
	},
	create(context) {
		const norm = normalizePath(context.filename ?? context.getFilename());
		if (norm.includes("__tests__") || norm.includes("eslint-graduated-guard")) {
			return {};
		}
		return {
			ImportDeclaration(node) {
				const src = String(node.source?.value ?? "");
				if (src === "@tanstack/react-table/legacy") {
					context.report({
						node,
						messageId: "noLegacyTableSource",
						data: { source: src },
					});
				}
				if (
					src === "@mui/base" ||
					src.startsWith("@mui/base/") ||
					src === "@base-ui-components/react" ||
					src.startsWith("@base-ui-components/react/")
				) {
					context.report({
						node,
						messageId: "noDeprecatedBaseUi",
						data: { source: src },
					});
				}
				if (src === "@tanstack/react-table") {
					for (const spec of node.specifiers ?? []) {
						if (
							spec.type === "ImportSpecifier" &&
							spec.imported.type === "Identifier" &&
							FORBIDDEN_TABLE_SPECIFIERS.has(spec.imported.name)
						) {
							context.report({
								node: spec,
								messageId: "noLegacyTableSpecifier",
								data: { name: spec.imported.name },
							});
						}
					}
				}
			},
			JSXAttribute(node) {
				if (
					node.name?.type === "JSXIdentifier" &&
					node.name.name === "asChild"
				) {
					context.report({
						node,
						messageId: "noAsChild",
					});
				}
			},
		};
	},
};

export const platformArchPlugin = {
	meta: {
		name: "eslint-plugin-platform-arch",
		version: "1.0.0",
	},
	rules: {
		"no-ports-in-leaf-tiers": noPortsInLeafTiersRule,
		"no-prohibited-apis": noProhibitedApisRule,
	},
};
