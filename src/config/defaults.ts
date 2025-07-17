import path from "node:path";
import type { ProcessingOptions } from "../types";
import { env } from "./env";

export const DEFAULT_OPTIONS: ProcessingOptions = {
	frameInterval: env.DEFAULT_FRAME_INTERVAL,
	ocrLanguage: env.DEFAULT_OCR_LANGUAGE,
	outputFormat: env.DEFAULT_OUTPUT_FORMAT,
	slideDetectionThreshold: env.DEFAULT_SLIDE_THRESHOLD,
	tempDir: path.resolve(env.TEMP_DIR),
	outputDir: path.resolve(env.OUTPUT_DIR),
};

export const VIDEO_CONSTRAINTS = {
	maxDuration: env.MAX_VIDEO_DURATION,
	supportedFormats: ["mp4", "webm", "mkv"],
	maxResolution: "1080p",
};

export const OCR_CONFIG = {
	psm: 3, // Page segmentation mode: Fully automatic page segmentation
	oem: 3, // OCR Engine mode: Default, based on what is available
	dpi: 300,
	maxConcurrent: env.MAX_CONCURRENT_OCR,
};
