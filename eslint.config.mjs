import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import reactCompiler from "eslint-plugin-react-compiler";
import { platformArchPlugin } from "./packages/ui-core/eslint-graduated-guard.mjs";

const compilerPkgPath = realpathSync(
	fileURLToPath(
		new URL(
			"./node_modules/babel-plugin-react-compiler/package.json",
			import.meta.url,
		),
	),
);
const requireFromCompiler = createRequire(compilerPkgPath);
const babelParser = requireFromCompiler("@babel/parser");

/**
 * TypeScript 7.0 + JSX ESTree parser powered by @babel/parser (bundled with
 * babel-plugin-react-compiler@1.0.0). Avoids typescript-eslint's TS <7.0 version gate
 * while providing full ESTree AST + token/comment streams for React Compiler and
 * architectural boundary rules.
 */
const tsEstreeParser = {
	meta: {
		name: "babel-ts-estree-parser",
		version: "1.0.0",
	},
	parseForESLint(code, options = {}) {
		const isTsx =
			typeof options.filePath === "string"
				? options.filePath.endsWith(".tsx") || options.filePath.endsWith(".jsx")
				: true;
		const plugins = isTsx
			? ["typescript", "jsx", "estree"]
			: ["typescript", "estree"];
		const file = babelParser.parse(code, {
			sourceType: "module",
			plugins,
			ranges: true,
			tokens: true,
			errorRecovery: true,
			sourceFilename: options.filePath || "file.tsx",
		});
		const program = file.program;
		program.comments = (file.comments || []).map((c) => ({
			...c,
			range: c.range || [c.start, c.end],
		}));
		program.tokens = (file.tokens || [])
			.filter(
				(t) =>
					t.type !== "CommentBlock" &&
					t.type !== "CommentLine" &&
					t.type?.label !== "eof",
			)
			.map((t) => ({
				type: t.type?.label === "name" ? "Identifier" : t.type?.label || t.type,
				value:
					t.value !== undefined ? String(t.value) : code.slice(t.start, t.end),
				range: [t.start, t.end],
				loc: t.loc,
			}));
		return {
			ast: program,
			services: {},
			scopeManager: null,
			visitorKeys: null,
		};
	},
};

export default [
	{
		ignores: [
			"**/node_modules/**",
			"**/.pnpm-store/**",
			"**/.git/**",
			"**/dist/**",
			"**/.output/**",
			"**/src/routeTree.gen.ts",
			"**/src/shared/**",
			"**/public/**",
		],
	},
	{
		files: ["src/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
		languageOptions: {
			parser: tsEstreeParser,
			ecmaVersion: "latest",
			sourceType: "module",
		},
		plugins: {
			"react-compiler": reactCompiler,
			"platform-arch": platformArchPlugin,
		},
		rules: {
			"react-compiler/react-compiler": "error",
			"platform-arch/no-ports-in-leaf-tiers": "error",
			"platform-arch/no-prohibited-apis": "error",
		},
	},
];
