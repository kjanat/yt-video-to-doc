import type {
	Frame,
	OCRResult,
	ProcessingResult,
	Slide,
	VideoMetadata,
} from "../types";

export interface IVideoDownloader {
	downloadVideo(
		url: string,
		onProgress?: (percent: number) => void,
	): Promise<{ videoPath: string; metadata: VideoMetadata }>;
	cleanup(videoPath: string): Promise<void>;
}

export interface IFrameExtractor {
	extractFrames(
		videoPath: string,
		interval: number,
		onProgress?: (percent: number) => void,
	): Promise<Frame[]>;
	cleanupFrames(framesDir: string): Promise<void>;
}

export interface ISlideDetector {
	detectSlides(
		frames: Frame[],
		onProgress?: (percent: number) => void,
	): Promise<Slide[]>;
}

export interface IOCRService {
	processSlides(
		slides: Slide[],
		onProgress?: (percent: number) => void,
	): Promise<Slide[]>;
	processImage(imagePath: string): Promise<OCRResult>;
}

export interface IDocumentGenerator {
	generateMarkdown(metadata: VideoMetadata, slides: Slide[]): Promise<string>;
	generatePDF?(metadata: VideoMetadata, slides: Slide[]): Promise<string>;
	generateText?(metadata: VideoMetadata, slides: Slide[]): Promise<string>;
}

export interface IVideoProcessor {
	processVideo(videoUrl: string): Promise<ProcessingResult>;
}

export interface ILogger {
	info(message: string, meta?: unknown): void;
	error(message: string, meta?: unknown): void;
	warn(message: string, meta?: unknown): void;
	debug(message: string, meta?: unknown): void;
}

export interface ServiceFactory {
	createVideoDownloader(tempDir: string): IVideoDownloader;
	createFrameExtractor(tempDir: string): IFrameExtractor;
	createSlideDetector(threshold: number): ISlideDetector;
	createOCRService(language: string, tempDir: string): IOCRService;
	createDocumentGenerator(outputDir: string): IDocumentGenerator;
}
