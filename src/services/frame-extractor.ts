import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { SafeCommandExecutor } from "../utils/safe-command-executor";
import {
	PROGRESS_EXTRACT_END,
	PROGRESS_EXTRACT_START,
} from "../config/constants";
import type { Frame } from "../types";
import logger from "../utils/logger";

export class FrameExtractor {
	private tempDir: string;
	private ffmpegPath: string;

	constructor(tempDir: string) {
		this.tempDir = tempDir;
		this.ffmpegPath = ffmpegInstaller.path;
	}

	async extractFrames(
		videoPath: string,
		interval: number = 2,
		onProgress?: (percent: number) => void,
	): Promise<Frame[]> {
		const framesDir = path.join(
			this.tempDir,
			"frames",
			path.basename(videoPath, ".mp4"),
		);
		await fs.mkdir(framesDir, { recursive: true });

		logger.info(
			`Extracting frames from ${videoPath} every ${interval} seconds`,
		);

		// Get video duration first
		const duration = await this.getVideoDuration(videoPath);
		const frameCount = Math.floor(duration / interval);

		if (frameCount === 0) {
			logger.warn("Video too short for frame extraction");
			return [];
		}

		logger.info(
			`Video duration: ${duration}s, extracting ${frameCount} frames`,
		);

		// Extract frames using ffmpeg
		await this.extractFramesWithFfmpeg(
			videoPath,
			framesDir,
			interval,
			frameCount,
			onProgress,
		);

		// Read all extracted frames
		const files = await fs.readdir(framesDir);
		const frameFiles = files
			.filter((f) => f.endsWith(".png"))
			.sort((a, b) => {
				const numA = parseInt(a.match(/frame-(\d+)/)?.[1] || "0");
				const numB = parseInt(b.match(/frame-(\d+)/)?.[1] || "0");
				return numA - numB;
			});

		const frames: Frame[] = [];
		for (let i = 0; i < frameFiles.length; i++) {
			frames.push({
				timestamp: i * interval,
				imagePath: path.join(framesDir, frameFiles[i]),
				frameNumber: i,
			});
		}

		logger.info(`Extracted ${frames.length} frames`);
		if (onProgress) onProgress(PROGRESS_EXTRACT_END);
		return frames;
	}

	private async extractFramesWithFfmpeg(
		videoPath: string,
		outputDir: string,
		interval: number,
		expectedFrameCount: number,
		onProgress?: (percent: number) => void,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			// FFmpeg command to extract frames at specified interval
			const args = [
				"-i",
				videoPath,
				"-vf",
				`fps=1/${interval}`,
				"-s",
				"1280x720",
				"-start_number",
				"0",
				path.join(outputDir, "frame-%d.png"),
			];

			const ffmpegProcess = spawn(this.ffmpegPath, args, { shell: false });

			let stderr = "";
			let lastProgress = 0;

			// Monitor progress
			const progressInterval = setInterval(async () => {
				try {
					const files = await fs.readdir(outputDir);
					const frameFiles = files.filter((f) => f.endsWith(".png"));
					const processedFrames = frameFiles.length;

					if (onProgress && processedFrames > 0) {
						const percent = Math.min(
							(processedFrames / expectedFrameCount) * 100,
							100,
						);
						// Map extraction progress from 25% to 40%
						const progress =
							PROGRESS_EXTRACT_START +
							(percent / 100) * (PROGRESS_EXTRACT_END - PROGRESS_EXTRACT_START);
						if (progress > lastProgress) {
							lastProgress = progress;
							onProgress(progress);
						}
					}
				} catch (_e) {
					// Directory might not exist yet
				}
			}, 500);

			ffmpegProcess.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			ffmpegProcess.on("close", (code) => {
				clearInterval(progressInterval);
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
				}
			});

			ffmpegProcess.on("error", (err) => {
				clearInterval(progressInterval);
				reject(err);
			});
		});
	}

	async getVideoDuration(videoPath: string): Promise<number> {
		try {
			// Use ffprobe to get video duration
			const ffprobePath = this.ffmpegPath.replace("ffmpeg", "ffprobe");
			const result = await SafeCommandExecutor.execute(ffprobePath, [
				"-v", "error",
				"-show_entries", "format=duration",
				"-of", "default=noprint_wrappers=1:nokey=1",
				videoPath
			]);

			if (result.exitCode !== 0) {
				throw new Error(`ffprobe failed: ${result.stderr}`);
			}

			const duration = parseFloat(result.stdout.trim());
			if (Number.isNaN(duration)) {
				throw new Error("Failed to parse video duration");
			}

			return duration;
		} catch (error) {
			logger.error(`Failed to get video duration: ${error}`);
			throw error;
		}
	}

	async cleanupFrames(framesDir: string): Promise<void> {
		try {
			await fs.rm(framesDir, { recursive: true, force: true });
			logger.info(`Cleaned up frames directory: ${framesDir}`);
		} catch (error) {
			logger.error(`Failed to cleanup frames: ${error}`);
		}
	}
}
