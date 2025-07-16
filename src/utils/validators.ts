import { z } from "zod";
import { ValidationError } from "./errors";

// YouTube URL patterns
const YOUTUBE_DOMAINS = [
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"youtu.be",
	"youtube-nocookie.com",
	"www.youtube-nocookie.com",
];

const YOUTUBE_URL_PATTERNS = [
	/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/)?[\w-]+/,
	/^https?:\/\/(www\.)?youtube-nocookie\.com\/(watch\?v=|embed\/|v\/)?[\w-]+/,
];

/**
 * Validates a YouTube URL
 */
export function validateYouTubeUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		
		// Check if it's a YouTube domain
		const hostname = urlObj.hostname.toLowerCase();
		if (!YOUTUBE_DOMAINS.includes(hostname)) {
			throw new ValidationError(
				`Invalid YouTube URL. Domain "${hostname}" is not a valid YouTube domain.`
			);
		}

		// Check if it matches YouTube URL patterns
		const isValidPattern = YOUTUBE_URL_PATTERNS.some((pattern) =>
			pattern.test(url)
		);

		if (!isValidPattern) {
			throw new ValidationError(
				"Invalid YouTube URL format. Please provide a valid YouTube video URL."
			);
		}

		// Extract video ID
		let videoId: string | null = null;
		
		if (hostname === "youtu.be") {
			videoId = urlObj.pathname.slice(1);
		} else {
			videoId = urlObj.searchParams.get("v");
			if (!videoId && urlObj.pathname.includes("/embed/")) {
				videoId = urlObj.pathname.split("/embed/")[1];
			} else if (!videoId && urlObj.pathname.includes("/v/")) {
				videoId = urlObj.pathname.split("/v/")[1];
			}
		}

		if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
			throw new ValidationError(
				"Invalid YouTube video ID. Could not extract a valid video ID from the URL."
			);
		}

		return url;
	} catch (error) {
		if (error instanceof ValidationError) {
			throw error;
		}
		throw new ValidationError(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Sanitizes a file path to prevent directory traversal attacks
 */
export function sanitizeFilePath(filePath: string): string {
	// Remove any directory traversal attempts
	let sanitized = filePath
		.replace(/\.\./g, "") // Remove ..
		.replace(/~\//g, "") // Remove ~/
		.replace(/\\/g, "/") // Normalize backslashes
		.replace(/\/+/g, "/") // Remove multiple slashes
		.trim();

	// Remove leading slashes for relative paths
	if (sanitized.startsWith("/") && !path.isAbsolute(filePath)) {
		sanitized = sanitized.slice(1);
	}

	// Ensure the path doesn't contain null bytes
	if (sanitized.includes("\0")) {
		throw new ValidationError("File path contains invalid null bytes");
	}

	// Ensure the path doesn't contain invalid characters
	const invalidChars = /[<>:"|?*\x00-\x1F]/;
	if (process.platform === "win32" && invalidChars.test(sanitized)) {
		throw new ValidationError("File path contains invalid characters");
	}

	return sanitized;
}

/**
 * Validates command-line options
 */
export const CommandOptionsSchema = z.object({
	interval: z.coerce.number().min(1).max(60).optional(),
	format: z.enum(["markdown", "txt", "pdf"]).optional(),
	language: z.string().min(2).max(10).optional(),
	threshold: z.coerce.number().min(0).max(1).optional(),
	output: z.string().optional(),
	temp: z.string().optional(),
});

export type ValidatedCommandOptions = z.infer<typeof CommandOptionsSchema>;

/**
 * Validates command-line options
 */
export function validateCommandOptions(options: unknown): ValidatedCommandOptions {
	try {
		const validated = CommandOptionsSchema.parse(options);
		
		// Additional validation for paths
		if (validated.output) {
			validated.output = sanitizeFilePath(validated.output);
		}
		if (validated.temp) {
			validated.temp = sanitizeFilePath(validated.temp);
		}
		
		return validated;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues.map(issue => 
				`${issue.path.join(".")}: ${issue.message}`
			).join(", ");
			throw new ValidationError(`Invalid options: ${issues}`);
		}
		throw error;
	}
}

/**
 * Validates environment configuration
 */
export function validateEnvironment(): void {
	// Check required tools
	const requiredTools = [
		{ name: "ffmpeg", message: "FFmpeg is required for video processing" },
		{ name: "tesseract", message: "Tesseract is required for OCR" },
	];

	for (const tool of requiredTools) {
		try {
			// This will be replaced with SafeCommandExecutor.commandExists
			// when we integrate it into the main application
			console.log(`Checking for ${tool.name}...`);
		} catch (error) {
			throw new ValidationError(`${tool.message}. Please install it first.`);
		}
	}
}

// Import path module
import path from "node:path";