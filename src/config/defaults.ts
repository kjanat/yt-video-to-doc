import path from "node:path";
import type { ProcessingOptions } from "../types";

export const DEFAULT_OPTIONS: ProcessingOptions = {
	frameInterval: 2, // Extract frame every 2 seconds
	ocrLanguage: "eng",
	outputFormat: "markdown",
	slideDetectionThreshold: 0.3, // 30% difference threshold for slide detection
	tempDir: path.join(process.cwd(), "temp"),
	outputDir: path.join(process.cwd(), "output"),
};

export const VIDEO_CONSTRAINTS = {
	maxDuration: 600, // 10 minutes for PoC
	supportedFormats: ["mp4", "webm", "mkv"],
	maxResolution: "1080p",
};

export const OCR_CONFIG = {
	psm: 3, // Page segmentation mode: Fully automatic page segmentation
	oem: 3, // OCR Engine mode: Default, based on what is available
	dpi: 300,
};
