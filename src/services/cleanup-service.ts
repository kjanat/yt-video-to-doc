import fs from "node:fs/promises";
import path from "node:path";
import { formatBytes } from "../utils/format";
import logger from "../utils/logger";

export interface CleanupOptions {
	maxAgeHours?: number;
	excludePatterns?: string[];
	dryRun?: boolean;
}

export interface CleanupResult {
	filesDeleted: number;
	directoriesDeleted: number;
	bytesFreed: number;
	errors: string[];
}

/**
 * Service for cleaning up temporary files and directories
 */
export class CleanupService {
	private tempDir: string;
	private activeJobs: Set<string> = new Set();

	constructor(tempDir: string) {
		this.tempDir = tempDir;
	}

	/**
	 * Register an active job to prevent its files from being cleaned up
	 */
	registerActiveJob(jobId: string): void {
		this.activeJobs.add(jobId);
		logger.debug(`Registered active job: ${jobId}`);
	}

	/**
	 * Unregister a completed job
	 */
	unregisterJob(jobId: string): void {
		this.activeJobs.delete(jobId);
		logger.debug(`Unregistered job: ${jobId}`);
	}

	/**
	 * Check if item should be processed for cleanup
	 */
	private shouldProcessItem(
		item: { name: string },
		excludePatterns: string[],
		stats: { mtimeMs: number },
		now: number,
		maxAgeMs: number,
	): { skip: boolean; reason?: string } {
		// Skip if item matches exclude patterns
		if (this.shouldExclude(item.name, excludePatterns)) {
			return { skip: true, reason: `Skipping excluded item: ${item.name}` };
		}

		// Skip if item is part of an active job
		if (this.isActiveJobFile(item.name)) {
			return { skip: true, reason: `Skipping active job file: ${item.name}` };
		}

		// Skip if item is not old enough
		const ageMs = now - stats.mtimeMs;
		if (ageMs < maxAgeMs) {
			const ageMinutes = Math.round(ageMs / 1000 / 60);
			return {
				skip: true,
				reason: `Skipping recent item: ${item.name} (age: ${ageMinutes} minutes)`,
			};
		}

		return { skip: false };
	}

	/**
	 * Delete a single item (file or directory)
	 */
	private async deleteItem(
		itemPath: string,
		item: { isDirectory(): boolean },
		stats: { size: number },
		result: CleanupResult,
	): Promise<void> {
		if (item.isDirectory()) {
			await this.cleanDirectory(itemPath, result);
			result.directoriesDeleted++;
		} else {
			result.bytesFreed += stats.size;
			await fs.unlink(itemPath);
			result.filesDeleted++;
			logger.debug(`Deleted file: ${itemPath}`);
		}
	}

	/**
	 * Process a single item for cleanup
	 */
	private async processItem(
		item: { name: string; isDirectory(): boolean },
		options: {
			excludePatterns: string[];
			dryRun: boolean;
			now: number;
			maxAgeMs: number;
		},
		result: CleanupResult,
	): Promise<void> {
		const itemPath = path.join(this.tempDir, item.name);

		try {
			const stats = await fs.stat(itemPath);

			const { skip, reason } = this.shouldProcessItem(
				item,
				options.excludePatterns,
				stats,
				options.now,
				options.maxAgeMs,
			);

			if (skip) {
				if (reason) logger.debug(reason);
				return;
			}

			// Clean up the item
			if (options.dryRun) {
				logger.info(`[DRY RUN] Would delete: ${itemPath}`);
			} else {
				await this.deleteItem(itemPath, item, stats, result);
			}
		} catch (error) {
			const errorMsg = `Failed to clean ${itemPath}: ${error}`;
			logger.error(errorMsg);
			result.errors.push(errorMsg);
		}
	}

	/**
	 * Clean up old files in the temp directory
	 */
	async cleanOldFiles(options: CleanupOptions = {}): Promise<CleanupResult> {
		const { maxAgeHours = 24, excludePatterns = [], dryRun = false } = options;

		const result: CleanupResult = {
			filesDeleted: 0,
			directoriesDeleted: 0,
			bytesFreed: 0,
			errors: [],
		};

		try {
			// Ensure temp directory exists
			await fs.mkdir(this.tempDir, { recursive: true });

			// Get all items in temp directory
			const items = await fs.readdir(this.tempDir, { withFileTypes: true });
			const now = Date.now();
			const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

			// Process each item
			for (const item of items) {
				await this.processItem(
					item,
					{ excludePatterns, dryRun, now, maxAgeMs },
					result,
				);
			}

			logger.info(
				`Cleanup completed: ${result.filesDeleted} files, ${result.directoriesDeleted} directories, ${formatBytes(result.bytesFreed)} freed`,
			);
		} catch (error) {
			const errorMsg = `Cleanup failed: ${error}`;
			logger.error(errorMsg);
			result.errors.push(errorMsg);
		}

		return result;
	}

	/**
	 * Clean up files for a specific job
	 */
	async cleanJobFiles(jobId: string): Promise<void> {
		try {
			const items = await fs.readdir(this.tempDir);

			for (const item of items) {
				if (item.includes(jobId)) {
					const itemPath = path.join(this.tempDir, item);
					const stats = await fs.stat(itemPath);

					if (stats.isDirectory()) {
						await fs.rm(itemPath, { recursive: true, force: true });
						logger.debug(`Deleted job directory: ${itemPath}`);
					} else {
						await fs.unlink(itemPath);
						logger.debug(`Deleted job file: ${itemPath}`);
					}
				}
			}

			logger.info(`Cleaned up files for job: ${jobId}`);
		} catch (error) {
			logger.error(`Failed to clean job files for ${jobId}: ${error}`);
		}
	}

	/**
	 * Run cleanup on startup
	 */
	async runStartupCleanup(): Promise<void> {
		logger.info("Running startup cleanup...");

		// Clean files older than 48 hours on startup
		const result = await this.cleanOldFiles({ maxAgeHours: 48 });

		if (result.errors.length > 0) {
			logger.warn(
				`Startup cleanup completed with ${result.errors.length} errors`,
			);
		}
	}

	/**
	 * Get disk usage statistics for the temp directory
	 */
	async getDiskUsage(): Promise<{ totalBytes: number; fileCount: number }> {
		let totalBytes = 0;
		let fileCount = 0;

		try {
			const items = await fs.readdir(this.tempDir, { withFileTypes: true });

			for (const item of items) {
				const itemPath = path.join(this.tempDir, item.name);
				const stats = await fs.stat(itemPath);

				if (item.isDirectory()) {
					const dirUsage = await this.getDirectorySize(itemPath);
					totalBytes += dirUsage.bytes;
					fileCount += dirUsage.files;
				} else {
					totalBytes += stats.size;
					fileCount++;
				}
			}
		} catch (error) {
			logger.error(`Failed to get disk usage: ${error}`);
		}

		return { totalBytes, fileCount };
	}

	/**
	 * Clean a directory recursively
	 */
	private async cleanDirectory(
		dirPath: string,
		result: CleanupResult,
	): Promise<void> {
		const items = await fs.readdir(dirPath, { withFileTypes: true });

		for (const item of items) {
			const itemPath = path.join(dirPath, item.name);

			if (item.isDirectory()) {
				await this.cleanDirectory(itemPath, result);
				result.directoriesDeleted++;
			} else {
				const stats = await fs.stat(itemPath);
				result.bytesFreed += stats.size;
				result.filesDeleted++;
			}
		}

		await fs.rm(dirPath, { recursive: true, force: true });
		logger.debug(`Deleted directory: ${dirPath}`);
	}

	/**
	 * Get the total size of a directory
	 */
	private async getDirectorySize(
		dirPath: string,
	): Promise<{ bytes: number; files: number }> {
		let bytes = 0;
		let files = 0;

		const items = await fs.readdir(dirPath, { withFileTypes: true });

		for (const item of items) {
			const itemPath = path.join(dirPath, item.name);
			const stats = await fs.stat(itemPath);

			if (item.isDirectory()) {
				const subDirSize = await this.getDirectorySize(itemPath);
				bytes += subDirSize.bytes;
				files += subDirSize.files;
			} else {
				bytes += stats.size;
				files++;
			}
		}

		return { bytes, files };
	}

	/**
	 * Check if a filename should be excluded from cleanup
	 */
	private shouldExclude(filename: string, excludePatterns: string[]): boolean {
		return excludePatterns.some((pattern) => {
			if (pattern.includes("*")) {
				// Simple glob pattern matching
				const regex = new RegExp(
					`^${pattern.replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
				);
				return regex.test(filename);
			}
			return filename === pattern;
		});
	}

	/**
	 * Check if a file belongs to an active job
	 */
	private isActiveJobFile(filename: string): boolean {
		// Check if filename contains any active job ID
		for (const jobId of this.activeJobs) {
			if (filename.includes(jobId)) {
				return true;
			}
		}
		return false;
	}
}
