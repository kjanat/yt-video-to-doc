import fs from "node:fs/promises";
import path from "node:path";
import { Jimp } from "jimp";
import tesseract from "node-tesseract-ocr";
import pLimit from "p-limit";
import { OCR_CONFIG } from "../config/defaults";
import { env } from "../config/env";
import type { Frame, OCRResult, Slide } from "../types";
import logger from "../utils/logger";
import { withRetry } from "../utils/retry";

export class OCRService {
	private config: tesseract.Config;
	private tempDir: string;

	constructor(language: string = "eng", tempDir: string) {
		this.config = {
			lang: language,
			oem: OCR_CONFIG.oem,
			psm: OCR_CONFIG.psm,
		};
		this.tempDir = tempDir;
	}

	async processSlides(
		slides: Slide[],
		onProgress?: (percent: number) => void,
	): Promise<Slide[]> {
		logger.info(
			`Running OCR on ${slides.length} slides with ${env.MAX_CONCURRENT_OCR} concurrent workers`,
		);

		// Create a concurrency limiter
		const limit = pLimit(env.MAX_CONCURRENT_OCR);
		let processedCount = 0;

		// Process all slides in parallel with concurrency limit
		const processingPromises = slides.map((slide) =>
			limit(async () => {
				try {
					await this.processSlide(slide);
					processedCount++;

					// Update progress
					if (onProgress) {
						const progress = 60 + (processedCount / slides.length) * 25; // 60-85%
						onProgress(progress);
					}
				} catch (error) {
					logger.error(`OCR failed for slide at ${slide.startTime}s:`, error);
					// Continue processing other slides even if one fails
				}
			}),
		);

		// Wait for all OCR operations to complete
		await Promise.all(processingPromises);

		logger.info(`OCR processing completed for ${slides.length} slides`);
		return slides;
	}

	private async processSlide(slide: Slide): Promise<void> {
		const representativeFrame = this.getMostRepresentativeFrame(slide);

		// Use retry mechanism for OCR processing
		await withRetry(
			async () => {
				// Preprocess image for better OCR results
				const processedImagePath = await this.preprocessImage(
					representativeFrame.imagePath,
				);

				try {
					const ocrResult = await this.extractText(
						processedImagePath,
						representativeFrame,
					);

					slide.ocrResults.push(ocrResult);
					slide.primaryText = ocrResult.text;

					logger.debug(
						`OCR completed for slide at ${slide.startTime}s: ${ocrResult.text.substring(0, 50)}...`,
					);
				} finally {
					// Clean up processed image
					await this.cleanupTempFile(processedImagePath);
				}
			},
			{
				maxRetries: 2,
				retryDelay: 1000,
				shouldRetry: (error) => {
					// Retry on temporary failures
					const message = error.message.toLowerCase();
					return (
						message.includes("timeout") ||
						message.includes("temporary") ||
						message.includes("enoent")
					);
				},
			},
		);
	}

	private async extractText(
		imagePath: string,
		frame: Frame,
	): Promise<OCRResult> {
		try {
			const text = await tesseract.recognize(imagePath, this.config);

			// Calculate confidence (node-tesseract-ocr doesn't provide this directly)
			// So we'll use text length as a proxy for now
			const confidence = text.trim().length > 0 ? 0.8 : 0.0;

			return {
				text: text.trim(),
				confidence,
				timestamp: frame.timestamp,
				frameNumber: frame.frameNumber,
			};
		} catch (error) {
			logger.error(`Tesseract error: ${error}`);
			return {
				text: "",
				confidence: 0,
				timestamp: frame.timestamp,
				frameNumber: frame.frameNumber,
			};
		}
	}

	private async preprocessImage(imagePath: string): Promise<string> {
		const image = await Jimp.read(imagePath);
		// Add timestamp to prevent filename collisions in parallel processing
		const timestamp = Date.now();
		const randomId = Math.random().toString(36).substring(7);
		const processedPath = path.join(
			this.tempDir,
			`processed_${timestamp}_${randomId}_${path.basename(imagePath)}`,
		);

		// Image preprocessing for better OCR
		await image
			.greyscale() // Convert to grayscale
			.contrast(0.3) // Increase contrast
			.normalize() // Normalize the image
			.write(processedPath as `${string}.${string}`);

		return processedPath;
	}

	private getMostRepresentativeFrame(slide: Slide): Frame {
		// Return the middle frame of the slide
		const middleIndex = Math.floor(slide.frames.length / 2);
		return slide.frames[middleIndex];
	}

	private async cleanupTempFile(filePath: string): Promise<void> {
		try {
			await fs.unlink(filePath);
		} catch (error) {
			logger.error(`Failed to cleanup temp file ${filePath}: ${error}`);
		}
	}

	async processImage(imagePath: string): Promise<OCRResult> {
		const frame: Frame = {
			imagePath,
			timestamp: 0,
			frameNumber: 0,
		};
		return this.extractText(imagePath, frame);
	}
}
