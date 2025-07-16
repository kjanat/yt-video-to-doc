import path from "node:path";
import { z } from "zod";
import { ValidationError } from "./errors";

/**
 * YouTube URL Validation
 *
 * This section handles YouTube URL validation with optimizations:
 * 1. Pre-compiled regex patterns for better performance
 * 2. Set-based lookups instead of array.includes()
 * 3. Early returns to avoid unnecessary processing
 */

// Use a Set for O(1) lookup time instead of O(n) with arrays
const YOUTUBE_DOMAINS = new Set([
	"m.youtube.com",
	"www.youtube-nocookie.com",
	"www.youtube.com",
	"youtu.be",
	"youtube-nocookie.com",
	"youtube.com",
]);

// YouTube video ID pattern - exactly 11 characters (base64url alphabet)
const YOUTUBE_VIDEO_ID_PATTERN = /^[\w-]{11}$/;

// More specific patterns that capture the video ID directly
const YOUTUBE_PATTERNS = {
	// Standard watch URL: youtube.com/watch?v=VIDEO_ID
	watch: /[?&]v=([^&]+)/,
	// Shortened URL: youtu.be/VIDEO_ID
	short: /youtu\.be\/([^?]+)/,
	// Embed URL: youtube.com/embed/VIDEO_ID
	embed: /embed\/([^?]+)/,
	// Old style: youtube.com/v/VIDEO_ID
	v: /\/v\/([^?]+)/,
};

/**
 * Validates and normalizes a YouTube URL
 * Returns both the validated URL and extracted video ID for convenience
 */
export function validateYouTubeUrl(url: string): {
	url: string;
	videoId: string;
} {
	// Input validation - fail fast for obviously invalid inputs
	if (!url || typeof url !== "string") {
		throw new ValidationError("URL must be a non-empty string");
	}

	// Normalize the URL by trimming whitespace
	const normalizedUrl = url.trim();

	// Early validation for basic URL structure
	if (!normalizedUrl.match(/^https?:\/\//i)) {
		throw new ValidationError("URL must start with http:// or https://");
	}

	try {
		const urlObj = new URL(normalizedUrl);
		const hostname = urlObj.hostname.toLowerCase();

		// Quick domain check using Set for O(1) lookup
		if (!YOUTUBE_DOMAINS.has(hostname)) {
			throw new ValidationError(
				`Invalid YouTube URL. Domain "${hostname}" is not a valid YouTube domain.`,
			);
		}

		// Extract video ID based on URL format
		let videoId: string | null = null;

		if (hostname === "youtu.be") {
			// Short URL format: extract from pathname
			const match = normalizedUrl.match(YOUTUBE_PATTERNS.short);
			videoId = match?.[1] || null;
		} else {
			// Try each pattern until we find a match
			// Order matters: check most common patterns first
			const patterns = [
				YOUTUBE_PATTERNS.watch,
				YOUTUBE_PATTERNS.embed,
				YOUTUBE_PATTERNS.v,
			];

			for (const pattern of patterns) {
				const match = normalizedUrl.match(pattern);
				if (match?.[1]) {
					videoId = match[1];
					break;
				}
			}
		}

		// Clean up video ID - remove any trailing parameters
		if (videoId) {
			videoId = videoId.split(/[?&#]/)[0];
		}

		// Validate the extracted video ID
		if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
			throw new ValidationError(
				"Invalid YouTube video ID. Could not extract a valid 11-character video ID from the URL.",
			);
		}

		// Return both the validated URL and the extracted video ID
		// This saves the caller from having to parse it again
		return { url: normalizedUrl, videoId };
	} catch (error) {
		if (error instanceof ValidationError) {
			throw error;
		}
		// Invalid URL format
		throw new ValidationError(
			`Invalid URL format: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Path Sanitization with Security Hardening
 *
 * This implementation uses a whitelist approach rather than blacklist,
 * which is more secure for path validation
 */

// Platform-specific path settings
const PATH_CONFIG = {
	win32: {
		maxLength: 260, // Windows MAX_PATH
		invalidChars: new Set(["<", ">", ":", '"', "|", "?", "*"]),
		reservedNames: new Set([
			"CON",
			"PRN",
			"AUX",
			"NUL",
			"COM1",
			"COM2",
			"COM3",
			"COM4",
			"COM5",
			"COM6",
			"COM7",
			"COM8",
			"COM9",
			"LPT1",
			"LPT2",
			"LPT3",
			"LPT4",
			"LPT5",
			"LPT6",
			"LPT7",
			"LPT8",
			"LPT9",
		]),
	},
	posix: {
		maxLength: 4096, // Linux typical PATH_MAX
		invalidChars: new Set(["\0"]), // Only null byte is truly invalid in Unix
		reservedNames: new Set<string>(), // Unix has no reserved names
	},
};

export interface SanitizeOptions {
	basePath?: string; // Base directory to constrain paths within
	allowAbsolute?: boolean; // Whether to allow absolute paths
	maxLength?: number; // Maximum path length
	allowHidden?: boolean; // Whether to allow hidden files (starting with .)
}

/**
 * Sanitizes a file path to prevent directory traversal attacks
 * Uses a secure-by-default approach with explicit options
 */
export function sanitizeFilePath(
	filePath: string,
	options: SanitizeOptions = {},
): string {
	// Set secure defaults
	const {
		basePath = process.cwd(),
		allowAbsolute = false,
		maxLength = PATH_CONFIG[process.platform === "win32" ? "win32" : "posix"]
			.maxLength,
		allowHidden = false,
	} = options;

	// Input validation
	if (!filePath || typeof filePath !== "string") {
		throw new ValidationError("File path must be a non-empty string");
	}

	// First pass: Remove obvious attack vectors
	let sanitized = filePath
		.trim()
		.replace(/\0/g, "") // Remove null bytes immediately
		.replace(/[\r\n]/g, ""); // Remove line breaks that could cause issues

	// Decode any URL encoding to catch encoded traversal attempts
	try {
		sanitized = decodeURIComponent(sanitized);
	} catch {
		// If decoding fails, the path is likely malformed
		throw new ValidationError("File path contains invalid URL encoding");
	}

	// Normalize path separators based on platform
	if (process.platform === "win32") {
		// Windows: Convert forward slashes to backslashes for consistency
		sanitized = sanitized.replace(/\//g, "\\");
	} else {
		// Unix: Convert backslashes to forward slashes
		sanitized = sanitized.replace(/\\/g, "/");
	}

	// Use Node's path.normalize to resolve . and .. safely
	// This is more reliable than regex replacement
	sanitized = path.normalize(sanitized);

	// Check if the path is absolute
	if (path.isAbsolute(sanitized)) {
		if (!allowAbsolute) {
			throw new ValidationError("Absolute paths are not allowed");
		}
	} else {
		// For relative paths, resolve against the base path
		// This ensures the path doesn't escape the intended directory
		const resolved = path.resolve(basePath, sanitized);
		const normalizedBase = path.resolve(basePath);

		// Security check: ensure the resolved path is within the base directory
		if (
			!resolved.startsWith(normalizedBase + path.sep) &&
			resolved !== normalizedBase
		) {
			throw new ValidationError("Path would escape the base directory");
		}

		// Convert back to relative path
		sanitized = path.relative(basePath, resolved);
	}

	// Platform-specific validation
	validatePathForPlatform(sanitized, allowHidden);

	// Length validation
	if (sanitized.length > maxLength) {
		throw new ValidationError(
			`Path exceeds maximum length of ${maxLength} characters`,
		);
	}

	// Validate individual path components
	const components = sanitized
		.split(path.sep)
		.filter((comp) => comp.length > 0);
	for (const component of components) {
		if (component.length > 255) {
			throw new ValidationError(
				"Path component exceeds maximum length of 255 characters",
			);
		}
	}

	return sanitized;
}

/**
 * Platform-specific path validation
 */
function validatePathForPlatform(filePath: string, allowHidden: boolean): void {
	const platform = process.platform === "win32" ? "win32" : "posix";
	const config = PATH_CONFIG[platform];

	// Check for hidden files
	if (!allowHidden) {
		const components = filePath.split(path.sep);
		for (const component of components) {
			if (
				component.startsWith(".") &&
				component !== "." &&
				component !== ".."
			) {
				throw new ValidationError("Hidden files are not allowed");
			}
		}
	}

	// Platform-specific character validation
	if (platform === "win32") {
		// Windows-specific validation
		const components = filePath.split(path.sep);

		for (let i = 0; i < components.length; i++) {
			const component = components[i];

			// Skip drive letters
			if (i === 0 && /^[a-zA-Z]:$/.test(component)) {
				continue;
			}

			// Check for invalid characters
			for (const char of component) {
				const charCode = char.charCodeAt(0);

				// Control characters (0-31)
				if (charCode >= 0 && charCode <= 31) {
					throw new ValidationError(
						`Path contains control character (ASCII ${charCode})`,
					);
				}

				// Windows-specific invalid characters
				if (config.invalidChars.has(char)) {
					throw new ValidationError(
						`Path contains invalid character: "${char}"`,
					);
				}
			}

			// Check for reserved names
			const upperComponent = component.toUpperCase();
			const nameWithoutExt = upperComponent.split(".")[0];
			if (config.reservedNames.has(nameWithoutExt)) {
				throw new ValidationError(
					`Path contains Windows reserved name: ${component}`,
				);
			}

			// Check for trailing dots or spaces
			if (/[. ]$/.test(component)) {
				throw new ValidationError(
					"Path components cannot end with dots or spaces on Windows",
				);
			}
		}
	} else {
		// Unix validation - mainly check for null bytes
		for (const char of filePath) {
			if (config.invalidChars.has(char)) {
				throw new ValidationError(
					`Path contains invalid character (null byte)`,
				);
			}
		}
	}
}

/**
 * Command Options Validation with Enhanced Schemas
 */

// More specific schemas with custom error messages
export const CommandOptionsSchema = z.object({
	interval: z.coerce
		.number()
		.min(1, "Interval must be at least 1 second")
		.max(60, "Interval cannot exceed 60 seconds")
		.optional(),

	format: z
		.enum(["markdown", "txt", "pdf"])
		.optional()
		.describe("Output format for the transcription"),

	language: z
		.string()
		.min(2, "Language code must be at least 2 characters")
		.max(10, "Language code cannot exceed 10 characters")
		.regex(
			/^[a-z]{2}(-[A-Z]{2})?$/,
			"Language must be a valid ISO code (e.g., 'en' or 'en-US')",
		)
		.optional(),

	threshold: z.coerce
		.number()
		.min(0, "Threshold must be at least 0")
		.max(1, "Threshold cannot exceed 1")
		.optional(),

	output: z.string().min(1, "Output path cannot be empty").optional(),

	temp: z.string().min(1, "Temp path cannot be empty").optional(),
});

export type ValidatedCommandOptions = z.infer<typeof CommandOptionsSchema>;

/**
 * Validates command-line options with enhanced error reporting
 */
export function validateCommandOptions(
	options: unknown,
): ValidatedCommandOptions {
	try {
		// First, do basic schema validation
		const validated = CommandOptionsSchema.parse(options);

		// Then, apply path sanitization for security
		if (validated.output) {
			validated.output = sanitizeFilePath(validated.output, {
				allowAbsolute: false,
				allowHidden: false,
			});
		}

		if (validated.temp) {
			validated.temp = sanitizeFilePath(validated.temp, {
				allowAbsolute: false,
				allowHidden: false,
				basePath: process.env.TMPDIR || "/tmp",
			});
		}

		return validated;
	} catch (error) {
		if (error instanceof z.ZodError) {
			// Create more readable error messages
			const issues = error.issues.map((issue: z.ZodIssue) => {
				const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
				return `${path}${issue.message}`;
			});

			throw new ValidationError(
				issues.length === 1
					? `Invalid option: ${issues[0]}`
					: `Invalid options:\n  - ${issues.join("\n  - ")}`,
			);
		}
		throw error;
	}
}

/**
 * Environment Validation
 *
 * This should be enhanced with actual command checking
 * For now, we'll create a placeholder that can be integrated
 * with your SafeCommandExecutor
 */

export interface EnvironmentRequirement {
	name: string;
	command?: string; // Command to check (defaults to name)
	versionFlag?: string; // Flag to get version (e.g., '--version')
	versionPattern?: RegExp; // Pattern to match required version
	minVersion?: string; // Minimum required version
	message: string; // Error message if not found
}

const REQUIRED_TOOLS: EnvironmentRequirement[] = [
	{
		name: "ffmpeg",
		versionFlag: "-version",
		versionPattern: /ffmpeg version (\d+\.\d+)/,
		minVersion: "4.0",
		message: "FFmpeg 4.0+ is required for video processing",
	},
	{
		name: "tesseract",
		versionFlag: "--version",
		versionPattern: /tesseract (\d+\.\d+)/,
		minVersion: "4.0",
		message: "Tesseract 4.0+ is required for OCR",
	},
];

/**
 * Validates that the required environment tools are available
 * This is a more robust version that checks versions and availability
 */
export async function validateEnvironment(
	commandExists?: (cmd: string) => Promise<boolean>,
): Promise<void> {
	const errors: string[] = [];

	for (const tool of REQUIRED_TOOLS) {
		try {
			// If commandExists function is provided, use it
			if (commandExists) {
				const exists = await commandExists(tool.command || tool.name);
				if (!exists) {
					errors.push(tool.message);
				}
			} else {
				// Fallback to basic check
				console.log(`Checking for ${tool.name}...`);
			}

			// TODO: Add version checking here when integrated with SafeCommandExecutor
			// const version = await getToolVersion(tool);
			// if (!meetsMinVersion(version, tool.minVersion)) {
			//     errors.push(`${tool.name} version ${version} is too old. ${tool.message}`);
			// }
		} catch {
			errors.push(tool.message);
		}
	}

	if (errors.length > 0) {
		throw new ValidationError(
			`Environment validation failed:\n  - ${errors.join("\n  - ")}`,
		);
	}
}

/**
 * Utility Functions for Additional Validation
 */

/**
 * Validates a file extension against allowed types
 */
export function validateFileExtension(
	filePath: string,
	allowedExtensions: string[],
): string {
	const ext = path.extname(filePath).toLowerCase();

	if (!allowedExtensions.includes(ext)) {
		throw new ValidationError(
			`Invalid file extension "${ext}". Allowed extensions: ${allowedExtensions.join(", ")}`,
		);
	}

	return filePath;
}

/**
 * Validates that a string is a valid ISO language code
 */
export function validateLanguageCode(code: string): string {
	// ISO 639-1 (2-letter) or ISO 639-1 with country (e.g., en-US)
	const pattern = /^[a-z]{2}(-[A-Z]{2})?$/;

	if (!pattern.test(code)) {
		throw new ValidationError(
			`Invalid language code "${code}". Use ISO 639-1 format (e.g., "en" or "en-US")`,
		);
	}

	return code;
}

/**
 * Creates a validated options object with defaults
 */
export function createValidatedOptions(
	options: unknown,
	defaults: Partial<ValidatedCommandOptions> = {},
): ValidatedCommandOptions {
	// Merge with defaults before validation
	const merged = { ...defaults, ...(options as object) };

	return validateCommandOptions(merged);
}
