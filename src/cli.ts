#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { VideoProcessor } from "./core/video-processor";
import type { ProcessingOptions } from "./types";

const program = new Command();

program
	.name("yt-video-to-txt")
	.description("Convert YouTube videos to text documents")
	.version("0.1.0");

program
	.command("convert")
	.description("Convert a YouTube video to text document")
	.argument("<url>", "YouTube video URL")
	.option(
		"-i, --interval <seconds>",
		"Frame extraction interval in seconds",
		"2",
	)
	.option(
		"-f, --format <format>",
		"Output format (markdown|txt|pdf)",
		"markdown",
	)
	.option("-l, --language <lang>", "OCR language code", "eng")
	.option("-t, --threshold <value>", "Slide detection threshold (0-1)", "0.15")
	.option("-o, --output <dir>", "Output directory", "./output")
	.option("--temp <dir>", "Temporary directory", "./temp")
	.action(async (url: string, options: any) => {
		const spinner = ora();

		try {
			console.log(chalk.blue("\n📹 YouTube Video to Text Converter\n"));
			console.log(chalk.gray(`URL: ${url}`));
			console.log(chalk.gray(`Options: ${JSON.stringify(options, null, 2)}\n`));

			// Validate URL
			if (!isValidYouTubeUrl(url)) {
				throw new Error("Invalid YouTube URL");
			}

			// Prepare options
			const processingOptions: Partial<ProcessingOptions> = {
				frameInterval: parseInt(options.interval),
				outputFormat: options.format,
				ocrLanguage: options.language,
				slideDetectionThreshold: parseFloat(options.threshold),
				outputDir: options.output,
				tempDir: options.temp,
			};

			// Create processor
			const processor = new VideoProcessor(processingOptions);

			// Listen to progress events
			processor.on("progress", (event) => {
				spinner.text = `${event.status} (${event.progress}%)`;
				if (!spinner.isSpinning) spinner.start();
			});

			// Process video
			spinner.start("Starting video processing...");
			const result = await processor.processVideo(url);
			spinner.succeed("Processing completed!");

			// Display results
			console.log(chalk.green("\n✅ Processing Results:\n"));
			console.log(chalk.white(`Title: ${result.videoMetadata.title}`));
			console.log(
				chalk.white(
					`Duration: ${formatDuration(result.videoMetadata.duration)}`,
				),
			);
			console.log(chalk.white(`Slides detected: ${result.slides.length}`));
			console.log(
				chalk.white(`Processing time: ${result.processingTime.toFixed(2)}s`),
			);
			console.log(chalk.white(`Output file: ${result.outputPath}`));

			// Display sample of extracted text
			const slidesWithText = result.slides.filter((s) => s.primaryText);
			if (slidesWithText.length > 0) {
				console.log(chalk.yellow("\n📝 Sample extracted text:\n"));
				slidesWithText.slice(0, 3).forEach((slide, index) => {
					console.log(chalk.gray(`Slide ${index + 1}:`));
					console.log(`${slide.primaryText.substring(0, 100)}...\n`);
				});
			}

			process.exit(0);
		} catch (error) {
			spinner.fail("Processing failed");
			console.error(
				chalk.red("\n❌ Error:"),
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

program
	.command("clean")
	.description("Clean up temporary files")
	.action(async () => {
		const spinner = ora("Cleaning up temporary files...").start();

		try {
			const tempDir = path.join(process.cwd(), "temp");
			await fs.rm(tempDir, { recursive: true, force: true });

			const logsDir = path.join(process.cwd(), "logs");
			await fs.rm(logsDir, { recursive: true, force: true });

			spinner.succeed("Cleanup completed");
			process.exit(0);
		} catch (error) {
			spinner.fail("Cleanup failed");
			console.error(chalk.red("Error:"), error);
			process.exit(1);
		}
	});

program
	.command("test")
	.description("Test with a sample video")
	.action(async () => {
		console.log(chalk.blue("\n🧪 Running test with sample video\n"));

		// Use a short public domain video for testing
		const testUrl = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"; // Big Buck Bunny trailer

		const processor = new VideoProcessor({
			frameInterval: 5, // Every 5 seconds for quick test
			outputFormat: "markdown",
		});

		const spinner = ora("Processing test video...").start();

		try {
			const result = await processor.processVideo(testUrl);
			spinner.succeed("Test completed successfully!");
			console.log(chalk.green(`\nOutput saved to: ${result.outputPath}`));
			process.exit(0);
		} catch (error) {
			spinner.fail("Test failed");
			console.error(chalk.red("Error:"), error);
			process.exit(1);
		}
	});

// Helper functions
function isValidYouTubeUrl(url: string): boolean {
	const patterns = [
		/^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
		/^https?:\/\/youtu\.be\/[\w-]+/,
		/^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
	];

	return patterns.some((pattern) => pattern.test(url));
}

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m ${secs}s`;
	} else if (minutes > 0) {
		return `${minutes}m ${secs}s`;
	} else {
		return `${secs}s`;
	}
}

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
	program.outputHelp();
}

// Ensure process exits cleanly
process.on("unhandledRejection", (err) => {
	console.error(chalk.red("Unhandled error:"), err);
	process.exit(1);
});

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
	console.log(chalk.yellow("\n\nInterrupted by user"));
	process.exit(130); // Standard exit code for SIGINT
});

process.on("SIGTERM", () => {
	console.log(chalk.yellow("\n\nTerminated"));
	process.exit(143); // Standard exit code for SIGTERM
});
