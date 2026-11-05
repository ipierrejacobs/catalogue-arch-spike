import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: ["e2e/**", "node_modules/**", "src/shared/**"],
	},
});
