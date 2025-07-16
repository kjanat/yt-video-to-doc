import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/**",
				"dist/**",
				"**/*.config.ts",
				"**/*.d.ts",
				"src/cli.ts",
			],
		},
		include: ["src/**/*.{test,spec}.{js,ts}"],
	},
	resolve: {
		alias: {
			"@": "/src",
		},
	},
});
