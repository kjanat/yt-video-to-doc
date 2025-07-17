import { describe, expect, it } from "vitest";
import {
	AppError,
	getRetryDelay,
	isRetryableError,
	OCRError,
	ValidationError,
	VideoDownloadError,
} from "../../utils/errors";

describe("AppError", () => {
	it("should create an error with correct properties", () => {
		const error = new AppError("Test error", "TEST_ERROR", 400, true);

		expect(error.message).toBe("Test error");
		expect(error.code).toBe("TEST_ERROR");
		expect(error.statusCode).toBe(400);
		expect(error.isOperational).toBe(true);
		expect(error.name).toBe("AppError");
	});
});

describe("VideoDownloadError", () => {
	it("should create a video download error", () => {
		const error = new VideoDownloadError(
			"Download failed",
			"https://example.com/video",
		);

		expect(error.message).toBe("Download failed");
		expect(error.code).toBe("VIDEO_DOWNLOAD_ERROR");
		expect(error.statusCode).toBe(500);
		expect(error.name).toBe("VideoDownloadError");
		expect(error.url).toBe("https://example.com/video");
	});
});

describe("ValidationError", () => {
	it("should create a validation error", () => {
		const error = new ValidationError("Invalid input");

		expect(error.message).toBe("Invalid input");
		expect(error.code).toBe("VALIDATION_ERROR");
		expect(error.statusCode).toBe(400);
		expect(error.name).toBe("ValidationError");
	});
});

describe("OCRError", () => {
	it("should create an OCR error", () => {
		const error = new OCRError("OCR processing failed");

		expect(error.message).toBe("OCR processing failed");
		expect(error.code).toBe("OCR_ERROR");
		expect(error.statusCode).toBe(500);
		expect(error.name).toBe("OCRError");
	});
});

describe("isRetryableError", () => {
	it("should identify retryable errors", () => {
		const networkError = new Error("ECONNRESET");
		const timeoutError = new Error("ETIMEDOUT");
		const downloadError = new VideoDownloadError("Download failed");
		const ocrError = new OCRError("OCR failed");
		const regularError = new Error("Something went wrong");

		expect(isRetryableError(networkError)).toBe(true);
		expect(isRetryableError(timeoutError)).toBe(true);
		expect(isRetryableError(downloadError)).toBe(true);
		expect(isRetryableError(ocrError)).toBe(true);
		expect(isRetryableError(regularError)).toBe(false);
	});
});

describe("getRetryDelay", () => {
	it("should calculate exponential backoff delays with jitter", () => {
		// Since jitter is random, we check for ranges
		const delay1 = getRetryDelay(1, 1000);
		const delay2 = getRetryDelay(2, 1000);
		const delay3 = getRetryDelay(3, 1000);

		// First attempt: 1000 + jitter (0-300)
		expect(delay1).toBeGreaterThanOrEqual(1000);
		expect(delay1).toBeLessThanOrEqual(1300);

		// Second attempt: 2000 + jitter (0-600)
		expect(delay2).toBeGreaterThanOrEqual(2000);
		expect(delay2).toBeLessThanOrEqual(2600);

		// Third attempt: 4000 + jitter (0-1200)
		expect(delay3).toBeGreaterThanOrEqual(4000);
		expect(delay3).toBeLessThanOrEqual(5200);
	});

	it("should cap delay at maximum", () => {
		expect(getRetryDelay(10, 1000)).toBe(30000); // Max is 30 seconds
	});
});
