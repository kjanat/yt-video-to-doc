import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html", "lcov"],
			exclude: [
				"node_modules/**",
				"dist/**",
				"**/*.config.ts",
				"**/*.d.ts",
				"src/cli.ts",
				"**/__tests__/**",
				"**/__mocks__/**",
			],
			thresholds: {
				statements: 80,
				branches: 75,
				functions: 90,
				lines: 80,
			},
		},
		include: ["src/**/*.{test,spec}.{js,ts}"],
		// TDD optimizations
		watch: {
			// Re-run only tests related to changed files
			mode: "related",
		},
		// Fail fast in watch mode for quicker feedback
		bail: 1,
		// Show full error stacks
		outputTruncateLength: 1000,
		// Reporter for better test output
		reporters: ["verbose"],
	},
	resolve: {
		alias: {
			"@": "/src",
		},
	},
});
