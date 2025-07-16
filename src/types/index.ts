export interface VideoMetadata {
	title: string;
	duration: number;
	resolution: string;
	url: string;
	videoId: string;
}

export interface Frame {
	timestamp: number;
	imagePath: string;
	frameNumber: number;
}

export interface OCRResult {
	text: string;
	confidence: number;
	timestamp: number;
	frameNumber: number;
}

export interface Slide {
	startTime: number;
	endTime: number;
	frames: Frame[];
	ocrResults: OCRResult[];
	primaryText: string;
}

export interface ProcessingOptions {
	frameInterval: number;
	ocrLanguage: string;
	outputFormat: "markdown" | "pdf" | "txt";
	slideDetectionThreshold: number;
	tempDir: string;
	outputDir: string;
}

export interface ProcessingResult {
	videoMetadata: VideoMetadata;
	slides: Slide[];
	outputPath: string;
	processingTime: number;
}

export enum ProcessingStatus {
	IDLE = "idle",
	DOWNLOADING = "downloading",
	EXTRACTING_FRAMES = "extracting_frames",
	DETECTING_SLIDES = "detecting_slides",
	RUNNING_OCR = "running_ocr",
	GENERATING_DOCUMENT = "generating_document",
	COMPLETED = "completed",
	FAILED = "failed",
}

export interface ProcessingJob {
	id: string;
	videoUrl: string;
	status: ProcessingStatus;
	progress: number;
	error?: string;
	result?: ProcessingResult;
	createdAt: Date;
	updatedAt: Date;
}
