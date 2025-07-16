#!/usr/bin/env node

// Quick test to verify yt-dlp is working
const { execSync } = require("node:child_process");

const ytdlpPaths = [
	`${process.env.HOME}/.local/bin/yt-dlp`,
	"/usr/local/bin/yt-dlp",
	"yt-dlp",
];

console.log("Testing yt-dlp...\n");

for (const path of ytdlpPaths) {
	try {
		const version = execSync(`${path} --version`, { encoding: "utf8" }).trim();
		console.log(`✅ Found ${path} - version: ${version}`);

		// Test getting video info
		console.log("\nTesting video info extraction...");
		const info = execSync(
			`${path} --dump-json "https://www.youtube.com/watch?v=jNQXAC9IVRw" | jq -r '.title'`,
			{
				// Me at the zoo - jawedf
				encoding: "utf8",
				shell: true,
			},
		).trim();
		console.log(`✅ Video title: ${info}`);
		break;
	} catch (_e) {
		console.log(`❌ ${path} - not found or error`);
	}
}

console.log("\nTest complete!");
