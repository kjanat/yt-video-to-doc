export class AppError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly statusCode: number = 500,
		public readonly isOperational: boolean = true,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class ValidationError extends AppError {
	constructor(message: string) {
		super(message, "VALIDATION_ERROR", 400);
	}
}

export class VideoDownloadError extends AppError {
	constructor(
		message: string,
		public readonly url?: string,
	) {
		super(message, "VIDEO_DOWNLOAD_ERROR", 500);
	}
}

export class FrameExtractionError extends AppError {
	constructor(
		message: string,
		public readonly videoPath?: string,
	) {
		super(message, "FRAME_EXTRACTION_ERROR", 500);
	}
}

export class OCRError extends AppError {
	constructor(
		message: string,
		public readonly imagePath?: string,
	) {
		super(message, "OCR_ERROR", 500);
	}
}

export class FileSystemError extends AppError {
	constructor(
		message: string,
		public readonly path?: string,
	) {
		super(message, "FILE_SYSTEM_ERROR", 500);
	}
}

export class DependencyError extends AppError {
	constructor(
		message: string,
		public readonly dependency: string,
	) {
		super(message, "DEPENDENCY_ERROR", 500);
	}
}

export interface ErrorWithRetry {
	error: Error;
	canRetry: boolean;
	retryAfter?: number;
}

export function isRetryableError(error: Error): boolean {
	// Network errors are typically retryable
	if (
		error.message.includes("ECONNRESET") ||
		error.message.includes("ETIMEDOUT")
	) {
		return true;
	}

	// Specific error codes that are retryable
	if (error instanceof AppError) {
		return error.code === "VIDEO_DOWNLOAD_ERROR" || error.code === "OCR_ERROR";
	}

	return false;
}

export function getRetryDelay(attempt: number, baseDelay = 1000): number {
	// Exponential backoff with jitter
	const exponentialDelay = baseDelay * 2 ** (attempt - 1);
	const jitter = Math.random() * 0.3 * exponentialDelay;
	return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}
