import { execSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import {
	MAX_VIDEO_DURATION_MINUTES,
	MAX_VIDEO_DURATION_SECONDS,
	PROGRESS_DOWNLOAD_END,
	PROGRESS_DOWNLOAD_START,
	PROGRESS_METADATA_FETCH,
} from "../config/constants";
import type { VideoMetadata } from "../types";
import logger from "../utils/logger";

export class YouTubeDownloader {
	private tempDir: string;
	private ytDlpPath: string;

	constructor(tempDir: string) {
		this.tempDir = tempDir;
		this.ytDlpPath = this.findYtDlp();
	}

	private findYtDlp(): string {
		// Check for yt-dlp in common locations
		const paths = [
			process.env.HOME ? `${process.env.HOME}/.local/bin/yt-dlp` : "",
			"/usr/local/bin/yt-dlp",
			"yt-dlp",
		].filter((p) => p);

		for (const ytdlp of paths) {
			try {
				execSync(`which ${ytdlp}`, { stdio: "ignore" });
				const version = execSync(`${ytdlp} --version`, {
					encoding: "utf8",
				}).trim();
				logger.info(`Using yt-dlp at ${ytdlp} (version: ${version})`);
				return ytdlp;
			} catch (_e) {
				// Try next path
			}
		}

		throw new Error(
			"yt-dlp not found. Please install it using: pip3 install --upgrade yt-dlp",
		);
	}

	async downloadVideo(
		url: string,
		onProgress?: (percent: number) => void,
	): Promise<{ videoPath: string; metadata: VideoMetadata }> {
		const jobId = uuidv4();
		const outputPath = path.join(this.tempDir, `${jobId}.mp4`);

		// Ensure temp directory exists
		await fs.mkdir(this.tempDir, { recursive: true });

		// First get video metadata
		if (onProgress) onProgress(PROGRESS_METADATA_FETCH);
		const metadata = await this.getVideoMetadata(url);

		// Check video duration limit
		if (metadata.duration > MAX_VIDEO_DURATION_SECONDS) {
			throw new Error(
				`Video too long: ${Math.floor(metadata.duration / 60)} minutes. This proof of concept supports videos up to ${MAX_VIDEO_DURATION_MINUTES} minutes.`,
			);
		}

		// Download video with progress
		if (onProgress) onProgress(PROGRESS_DOWNLOAD_START);
		await this.executeYtDlpWithProgress(
			[
				url,
				"-f",
				"best[ext=mp4]/best",
				"-o",
				outputPath,
				"--no-playlist",
				"--progress",
				"--newline",
			],
			onProgress,
		);

		logger.info(`Video downloaded successfully: ${outputPath}`);

		return {
			videoPath: outputPath,
			metadata,
		};
	}

	private async getVideoMetadata(url: string): Promise<VideoMetadata> {
		const output = await this.executeYtDlp([
			url,
			"--dump-json",
			"--no-playlist",
		]);

		const data = JSON.parse(output);

		return {
			title: data.title,
			duration: data.duration,
			resolution: `${data.width}x${data.height}`,
			url: url,
			videoId: data.id,
		};
	}

	private executeYtDlp(args: string[]): Promise<string> {
		return this.executeYtDlpInternal(args);
	}

	private executeYtDlpWithProgress(
		args: string[],
		onProgress?: (percent: number) => void,
	): Promise<string> {
		return this.executeYtDlpInternal(args, (line) => {
			// Parse download progress from yt-dlp output - handle all stages
			const progressMatch = line.match(/\[(\w+)\]\s+(\d+\.?\d*)%/);
			if (progressMatch && onProgress) {
				const stage = progressMatch[1];
				const percent = parseFloat(progressMatch[2]);

				// For now, only track download stage to avoid confusion
				if (stage === "download") {
					// Map download progress from start to end
					const progressRange = PROGRESS_DOWNLOAD_END - PROGRESS_DOWNLOAD_START;
					onProgress(PROGRESS_DOWNLOAD_START + (percent / 100) * progressRange);
				}
			}

			// Also check for completion messages
			if (
				line.includes("[download] 100%") ||
				line.includes("has already been downloaded")
			) {
				if (onProgress) onProgress(PROGRESS_DOWNLOAD_END);
			}
		});
	}

	private executeYtDlpInternal(
		args: string[],
		onLine?: (line: string) => void,
	): Promise<string> {
		return new Promise((resolve, reject) => {
			let stdout = "";
			let stderr = "";

			const childProcess = spawn(this.ytDlpPath, args);

			// Kill child process if parent exits
			const cleanup = () => {
				if (!childProcess.killed) {
					childProcess.kill("SIGTERM");
				}
			};

			process.once("exit", cleanup);
			process.once("SIGINT", cleanup);
			process.once("SIGTERM", cleanup);

			childProcess.stdout.on("data", (data) => {
				if (onLine) {
					const lines = data.toString().split("\n");
					for (const line of lines) {
						stdout += `${line}\n`;
						onLine(line);
					}
				} else {
					stdout += data.toString();
				}
			});

			childProcess.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			childProcess.on("close", (code) => {
				process.removeListener("exit", cleanup);
				process.removeListener("SIGINT", cleanup);
				process.removeListener("SIGTERM", cleanup);

				if (code !== 0) {
					reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
				} else {
					resolve(stdout);
				}
			});

			childProcess.on("error", (err) => {
				reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
			});
		});
	}

	async cleanup(videoPath: string): Promise<void> {
		try {
			await fs.unlink(videoPath);
			logger.info(`Cleaned up video file: ${videoPath}`);
		} catch (error) {
			logger.error(`Failed to cleanup video file: ${error}`);
		}
	}
}
