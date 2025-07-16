import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_OPTIONS } from "../config/defaults";
import { DocumentGenerator } from "../services/document-generator";
import { FrameExtractor } from "../services/frame-extractor";
import { OCRService } from "../services/ocr-service";
import { SlideDetector } from "../services/slide-detector";
import { YouTubeDownloader } from "../services/youtube-downloader";
import {
	type ProcessingJob,
	type ProcessingOptions,
	type ProcessingResult,
	ProcessingStatus,
} from "../types";
import {
	AppError,
	FrameExtractionError,
	OCRError,
	VideoDownloadError,
} from "../utils/errors";
import logger from "../utils/logger";
import { withCleanup, withRetry } from "../utils/retry";

export class VideoProcessor extends EventEmitter {
	private options: ProcessingOptions;
	private downloader: YouTubeDownloader;
	private frameExtractor: FrameExtractor;
	private slideDetector: SlideDetector;
	private ocrService: OCRService;
	private documentGenerator: DocumentGenerator;

	constructor(options: Partial<ProcessingOptions> = {}) {
		super();
		this.options = { ...DEFAULT_OPTIONS, ...options };

		// Initialize services
		this.downloader = new YouTubeDownloader(this.options.tempDir);
		this.frameExtractor = new FrameExtractor(this.options.tempDir);
		this.slideDetector = new SlideDetector(
			this.options.slideDetectionThreshold,
		);
		this.ocrService = new OCRService(
			this.options.ocrLanguage,
			this.options.tempDir,
		);
		this.documentGenerator = new DocumentGenerator(this.options.outputDir);
	}

	async processVideo(videoUrl: string): Promise<ProcessingResult> {
		const job: ProcessingJob = {
			id: uuidv4(),
			videoUrl,
			status: ProcessingStatus.IDLE,
			progress: 0,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const startTime = Date.now();

		try {
			// Download video with retry
			this.updateJobStatus(job, ProcessingStatus.DOWNLOADING, 0);
			const { videoPath, metadata } = await withRetry(
				async () => {
					try {
						return await this.downloader.downloadVideo(videoUrl, (progress) => {
							this.updateJobStatus(
								job,
								ProcessingStatus.DOWNLOADING,
								Math.round(progress),
							);
						});
					} catch (error) {
						throw new VideoDownloadError(
							error instanceof Error ? error.message : String(error),
							videoUrl,
						);
					}
				},
				{
					maxRetries: 3,
					onRetry: (error, attempt) => {
						logger.warn(`Video download retry attempt ${attempt}`, {
							url: videoUrl,
							error: error.message,
						});
					},
				},
			);

			// Extract frames with cleanup on failure
			this.updateJobStatus(job, ProcessingStatus.EXTRACTING_FRAMES, 25);
			const frames = await withCleanup(
				async () => {
					try {
						return await this.frameExtractor.extractFrames(
							videoPath,
							this.options.frameInterval,
							(progress) => {
								this.updateJobStatus(
									job,
									ProcessingStatus.EXTRACTING_FRAMES,
									Math.round(progress),
								);
							},
						);
					} catch (error) {
						throw new FrameExtractionError(
							error instanceof Error ? error.message : String(error),
							videoPath,
						);
					}
				},
				async () => {
					// Cleanup video on frame extraction failure
					if (videoPath) {
						await this.downloader.cleanup(videoPath).catch(() => {});
					}
				},
			);

			// Detect slides
			this.updateJobStatus(job, ProcessingStatus.DETECTING_SLIDES, 40);
			const slides = await this.slideDetector.detectSlides(
				frames,
				(progress) => {
					this.updateJobStatus(
						job,
						ProcessingStatus.DETECTING_SLIDES,
						Math.round(progress),
					);
				},
			);

			// Run OCR with retry for individual failures
			this.updateJobStatus(job, ProcessingStatus.RUNNING_OCR, 60);
			const slidesWithText = await withRetry(
				async () => {
					try {
						return await this.ocrService.processSlides(slides, (progress) => {
							this.updateJobStatus(
								job,
								ProcessingStatus.RUNNING_OCR,
								Math.round(progress),
							);
						});
					} catch (error) {
						throw new OCRError(
							error instanceof Error ? error.message : String(error),
						);
					}
				},
				{
					maxRetries: 2,
					shouldRetry: (error) => error instanceof OCRError,
				},
			);

			// Generate document
			this.updateJobStatus(job, ProcessingStatus.GENERATING_DOCUMENT, 85);
			const outputPath = await this.documentGenerator.generateMarkdown(
				metadata,
				slidesWithText,
			);

			// Cleanup
			await this.cleanup(videoPath, frames[0]?.imagePath);

			const result: ProcessingResult = {
				videoMetadata: metadata,
				slides: slidesWithText,
				outputPath,
				processingTime: (Date.now() - startTime) / 1000,
			};

			this.updateJobStatus(job, ProcessingStatus.COMPLETED, 100);
			job.result = result;

			logger.info(
				`Processing completed in ${result.processingTime.toFixed(2)}s`,
			);
			return result;
		} catch (error) {
			this.updateJobStatus(job, ProcessingStatus.FAILED, job.progress);
			job.error = error instanceof Error ? error.message : String(error);
			logger.error(`Processing failed: ${job.error}`, {
				jobId: job.id,
				status: job.status,
				error:
					error instanceof AppError
						? {
								code: error.code,
								message: error.message,
								stack: error.stack,
							}
						: error,
			});

			// Ensure cleanup happens even on failure
			if (
				job.status === ProcessingStatus.EXTRACTING_FRAMES ||
				job.status === ProcessingStatus.DETECTING_SLIDES ||
				job.status === ProcessingStatus.RUNNING_OCR
			) {
				// Try to find and clean up any temporary files
				try {
					const tempVideoPath = `${this.options.tempDir}/${job.id}.mp4`;
					const tempFramesPath = `${this.options.tempDir}/frames/${job.id}`;
					await this.cleanup(tempVideoPath, `${tempFramesPath}/frame-1.png`);
				} catch (cleanupError) {
					logger.error("Failed to cleanup after error", cleanupError);
				}
			}

			throw error;
		}
	}

	private updateJobStatus(
		job: ProcessingJob,
		status: ProcessingStatus,
		progress: number,
	) {
		job.status = status;
		job.progress = progress;
		job.updatedAt = new Date();

		this.emit("progress", {
			jobId: job.id,
			status,
			progress,
		});

		logger.info(`Job ${job.id}: ${status} (${progress}%)`);
	}

	private async cleanup(videoPath: string, framePath?: string) {
		try {
			// Clean up video file
			await this.downloader.cleanup(videoPath);

			// Clean up frames directory
			if (framePath) {
				const framesDir = framePath.substring(0, framePath.lastIndexOf("/"));
				await this.frameExtractor.cleanupFrames(framesDir);
			}
		} catch (error) {
			logger.error(`Cleanup error: ${error}`);
		}
	}
}
