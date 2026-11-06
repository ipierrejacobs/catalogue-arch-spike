/**
 * Architectural ESLint Guard for the Graduated-Capability Component Architecture.
 *
 * Structural guarantees enforced:
 * 1. `platform-arch/no-ports-in-leaf-tiers`:
 *    Tier 0–2 components in `@platform/ui` (`packages/ui-core/src/<component>/`)
 *    MUST NOT import `@platform/ports` (or relative port modules) and MUST NOT
 *    populate `<component>.ports.ts`.
 * 2. `platform-arch/no-prohibited-apis`:
 *    Forbids `asChild` composition (use Base UI `render`/`useRender`/`mergeProps`),
 *    deprecated `@mui/base` or `@base-ui-components/react`, and legacy TanStack Table v8
 *    compatibility helpers (`useReactTable`, `useLegacyTable`, `stockFeatures`, `/legacy`).
 */

/**
 * Component tier classification registry for `@platform/ui`.
 * Any component not listed as Tier 3 or Tier 4 defaults to Tier 1 (leaf, port-free).
 */
export const COMPONENT_TIER_REGISTRY = {
	button: 1,
	"data-table": 4,
};

function normalizePath(filePath) {
	return filePath.replace(/\\/g, "/");
}

function getUiComponentFromPath(filePath) {
	const norm = normalizePath(filePath);
	const match = norm.match(/packages\/ui-core\/src\/([^/]+)\/([^/]+)$/);
	if (!match) return null;
	const [, folder, fileName] = match;
	if (folder === "__tests__") return null;
	const tier = COMPONENT_TIER_REGISTRY[folder] ?? 1;
	return { componentName: folder, fileName, tier };
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
		const info = getUiComponentFromPath(context.filename ?? context.getFilename());
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
