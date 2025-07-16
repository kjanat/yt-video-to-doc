import fs from "node:fs/promises";
import path from "node:path";
import { Jimp } from "jimp";
import tesseract from "node-tesseract-ocr";
import { OCR_CONFIG } from "../config/defaults";
import type { Frame, OCRResult, Slide } from "../types";
import logger from "../utils/logger";

export class OCRService {
	private config: any;
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
		logger.info(`Running OCR on ${slides.length} slides`);

		for (let i = 0; i < slides.length; i++) {
			const slide = slides[i];
			const representativeFrame = this.getMostRepresentativeFrame(slide);

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
			} catch (error) {
				logger.error(`OCR failed for slide at ${slide.startTime}s: ${error}`);
			} finally {
				// Clean up processed image
				await this.cleanupTempFile(processedImagePath);
			}

			if (onProgress) {
				onProgress(60 + ((i + 1) / slides.length) * 25); // 60-85%
			}
		}

		return slides;
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
		const processedPath = path.join(
			this.tempDir,
			`processed_${path.basename(imagePath)}`,
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
}
