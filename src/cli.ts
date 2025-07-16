#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import {
	EXIT_CODE_ERROR,
	EXIT_CODE_SIGINT,
	EXIT_CODE_SIGTERM,
	EXIT_CODE_SUCCESS,
	MAX_SLIDES_PREVIEW,
	MAX_TEXT_PREVIEW_LENGTH,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
	TEST_FRAME_INTERVAL_SECONDS,
	TEST_VIDEO_URL,
} from "./config/constants";
import { VideoProcessor } from "./core/video-processor";
import type { ConvertCommandOptions, ProcessingOptions } from "./types";
import { validateYouTubeUrl, validateCommandOptions } from "./utils/validators";
import { ValidationError } from "./utils/errors";
import { CleanupService } from "./services/cleanup-service";

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
	.action(async (url: string, options: ConvertCommandOptions) => {
		const spinner = ora();

		try {
			console.log(chalk.blue("\n📹 YouTube Video to Text Converter\n"));
			console.log(chalk.gray(`URL: ${url}`));
			console.log(chalk.gray(`Options: ${JSON.stringify(options, null, 2)}\n`));

			// Validate URL
			const validatedUrl = validateYouTubeUrl(url);

			// Validate and prepare options
			const validatedOptions = validateCommandOptions(options);
			const processingOptions: Partial<ProcessingOptions> = {
				frameInterval: validatedOptions.interval || parseInt(options.interval),
				outputFormat: validatedOptions.format || options.format,
				ocrLanguage: validatedOptions.language || options.language,
				slideDetectionThreshold: validatedOptions.threshold || parseFloat(options.threshold),
				outputDir: validatedOptions.output || options.output,
				tempDir: validatedOptions.temp || options.temp,
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
			const result = await processor.processVideo(validatedUrl);
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
				slidesWithText.slice(0, MAX_SLIDES_PREVIEW).forEach((slide, index) => {
					console.log(chalk.gray(`Slide ${index + 1}:`));
					console.log(
						`${slide.primaryText.substring(0, MAX_TEXT_PREVIEW_LENGTH)}...\n`,
					);
				});
			}

			process.exit(EXIT_CODE_SUCCESS);
		} catch (error) {
			spinner.fail("Processing failed");
			
			if (error instanceof ValidationError) {
				console.error(chalk.red("\n❌ Validation Error:"), error.message);
			} else {
				console.error(
					chalk.red("\n❌ Error:"),
					error instanceof Error ? error.message : error,
				);
			}
			process.exit(EXIT_CODE_ERROR);
		}
	});

program
	.command("clean")
	.description("Clean up temporary files")
	.option("-a, --age <hours>", "Maximum age of files to keep (in hours)", "24")
	.option("-d, --dry-run", "Show what would be deleted without actually deleting")
	.action(async (options) => {
		const spinner = ora("Analyzing temporary files...").start();

		try {
			const tempDir = path.join(process.cwd(), "temp");
			const cleanupService = new CleanupService(tempDir);
			
			// Get disk usage before cleanup
			const usageBefore = await cleanupService.getDiskUsage();
			spinner.text = `Found ${usageBefore.fileCount} files using ${formatBytes(usageBefore.totalBytes)}`;
			
			// Run cleanup
			const result = await cleanupService.cleanOldFiles({
				maxAgeHours: parseInt(options.age),
				dryRun: options.dryRun,
			});
			
			if (options.dryRun) {
				spinner.info(`[DRY RUN] Would delete ${result.filesDeleted} files and ${result.directoriesDeleted} directories`);
			} else {
				spinner.succeed(
					`Cleanup completed: ${result.filesDeleted} files, ${result.directoriesDeleted} directories, ${formatBytes(result.bytesFreed)} freed`
				);
			}
			
			if (result.errors.length > 0) {
				console.warn(chalk.yellow(`\n⚠️  ${result.errors.length} errors occurred during cleanup`));
			}

			process.exit(EXIT_CODE_SUCCESS);
		} catch (error) {
			spinner.fail("Cleanup failed");
			console.error(chalk.red("Error:"), error);
			process.exit(EXIT_CODE_ERROR);
		}
	});

program
	.command("test")
	.description("Test with a sample video")
	.action(async () => {
		console.log(chalk.blue("\n🧪 Running test with sample video\n"));

		// Use a short public domain video for testing
		const testUrl = TEST_VIDEO_URL;

		const processor = new VideoProcessor({
			frameInterval: TEST_FRAME_INTERVAL_SECONDS,
			outputFormat: "markdown",
		});

		const spinner = ora("Processing test video...").start();

		try {
			const result = await processor.processVideo(testUrl);
			spinner.succeed("Test completed successfully!");
			console.log(chalk.green(`\nOutput saved to: ${result.outputPath}`));
			process.exit(EXIT_CODE_SUCCESS);
		} catch (error) {
			spinner.fail("Test failed");
			console.error(chalk.red("Error:"), error);
			process.exit(EXIT_CODE_ERROR);
		}
	});

// Helper functions
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 Bytes";
	
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / SECONDS_PER_HOUR);
	const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const secs = Math.floor(seconds % SECONDS_PER_MINUTE);

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
	process.exit(EXIT_CODE_ERROR);
});

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
	console.log(chalk.yellow("\n\nInterrupted by user"));
	process.exit(EXIT_CODE_SIGINT);
});

process.on("SIGTERM", () => {
	console.log(chalk.yellow("\n\nTerminated"));
	process.exit(EXIT_CODE_SIGTERM);
});
