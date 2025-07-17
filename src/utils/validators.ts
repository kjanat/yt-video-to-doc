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
 * Validate basic URL structure
 */
function validateUrlStructure(url: string): string {
	if (!url || typeof url !== "string") {
		throw new ValidationError("URL must be a non-empty string");
	}

	const normalizedUrl = url.trim();

	if (!normalizedUrl.match(/^https?:\/\//i)) {
		throw new ValidationError("URL must start with http:// or https://");
	}

	return normalizedUrl;
}

/**
 * Extract video ID from short YouTube URL (youtu.be)
 */
function extractShortUrlVideoId(url: string): string | null {
	const match = url.match(YOUTUBE_PATTERNS.short);
	return match?.[1] || null;
}

/**
 * Extract video ID from standard YouTube URL
 */
function extractStandardUrlVideoId(url: string): string | null {
	const patterns = [
		YOUTUBE_PATTERNS.watch,
		YOUTUBE_PATTERNS.embed,
		YOUTUBE_PATTERNS.v,
	];

	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match?.[1]) {
			return match[1];
		}
	}

	return null;
}

/**
 * Clean and validate video ID
 */
function cleanAndValidateVideoId(videoId: string | null): string {
	if (!videoId) {
		throw new ValidationError(
			"Invalid YouTube video ID. Could not extract a valid 11-character video ID from the URL.",
		);
	}

	// Remove any trailing parameters
	const cleanedId = videoId.split(/[?&#]/)[0];

	if (!YOUTUBE_VIDEO_ID_PATTERN.test(cleanedId)) {
		throw new ValidationError(
			"Invalid YouTube video ID. Could not extract a valid 11-character video ID from the URL.",
		);
	}

	return cleanedId;
}

/**
 * Validates and normalizes a YouTube URL
 * Returns both the validated URL and extracted video ID for convenience
 */
export function validateYouTubeUrl(url: string): {
	url: string;
	videoId: string;
} {
	try {
		const normalizedUrl = validateUrlStructure(url);
		const urlObj = new URL(normalizedUrl);
		const hostname = urlObj.hostname.toLowerCase();

		// Quick domain check using Set for O(1) lookup
		if (!YOUTUBE_DOMAINS.has(hostname)) {
			throw new ValidationError(
				`Invalid YouTube URL. Domain "${hostname}" is not a valid YouTube domain.`,
			);
		}

		// Extract video ID based on URL format
		const videoId =
			hostname === "youtu.be"
				? extractShortUrlVideoId(normalizedUrl)
				: extractStandardUrlVideoId(normalizedUrl);

		// Clean and validate the video ID
		const cleanVideoId = cleanAndValidateVideoId(videoId);

		return { url: normalizedUrl, videoId: cleanVideoId };
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

// Type for platform-specific path configuration
interface PathConfig {
	maxLength: number;
	invalidChars: Set<string>;
	reservedNames: Set<string>;
}

// Platform-specific path settings
const PATH_CONFIG: Record<"win32" | "posix", PathConfig> = {
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
 * Remove dangerous characters from path
 */
function cleanPath(filePath: string): string {
	return filePath
		.trim()
		.replace(/\0/g, "") // Remove null bytes immediately
		.replace(/[\r\n]/g, ""); // Remove line breaks that could cause issues
}

/**
 * Decode URL encoding in path
 */
function decodePathSafely(filePath: string): string {
	try {
		return decodeURIComponent(filePath);
	} catch {
		throw new ValidationError("File path contains invalid URL encoding");
	}
}

/**
 * Normalize path separators for the current platform
 */
function normalizePathSeparators(filePath: string): string {
	if (process.platform === "win32") {
		return filePath.replace(/\//g, "\\");
	}
	return filePath.replace(/\\/g, "/");
}

/**
 * Validate relative path doesn't escape base directory
 */
function validateRelativePath(sanitized: string, basePath: string): string {
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
	return path.relative(basePath, resolved);
}

/**
 * Validate path length constraints
 */
function validatePathLength(filePath: string, maxLength: number): void {
	if (filePath.length > maxLength) {
		throw new ValidationError(
			`Path exceeds maximum length of ${maxLength} characters`,
		);
	}

	const components = filePath.split(path.sep).filter((comp) => comp.length > 0);

	const longComponent = components.find((comp) => comp.length > 255);
	if (longComponent) {
		throw new ValidationError(
			"Path component exceeds maximum length of 255 characters",
		);
	}
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

	// Clean and normalize the path
	let sanitized = cleanPath(filePath);
	sanitized = decodePathSafely(sanitized);
	sanitized = normalizePathSeparators(sanitized);
	sanitized = path.normalize(sanitized);

	// Handle absolute vs relative paths
	if (path.isAbsolute(sanitized)) {
		if (!allowAbsolute) {
			throw new ValidationError("Absolute paths are not allowed");
		}
	} else {
		sanitized = validateRelativePath(sanitized, basePath);
	}

	// Run validation checks
	validatePathForPlatform(sanitized, allowHidden);
	validatePathLength(sanitized, maxLength);

	return sanitized;
}

/**
 * Check if a path component is a hidden file
 */
function isHiddenComponent(component: string): boolean {
	return component.startsWith(".") && component !== "." && component !== "..";
}

/**
 * Validate hidden files in path
 */
function validateHiddenFiles(filePath: string, allowHidden: boolean): void {
	if (allowHidden) return;

	const components = filePath.split(path.sep);
	const hiddenComponent = components.find(isHiddenComponent);

	if (hiddenComponent) {
		throw new ValidationError("Hidden files are not allowed");
	}
}

/**
 * Check if character is a control character
 */
function isControlCharacter(charCode: number): boolean {
	return charCode >= 0 && charCode <= 31;
}

/**
 * Validate a single character for Windows paths
 */
function validateWindowsCharacter(
	char: string,
	invalidChars: Set<string>,
): void {
	const charCode = char.charCodeAt(0);

	if (isControlCharacter(charCode)) {
		throw new ValidationError(
			`Path contains control character (ASCII ${charCode})`,
		);
	}

	if (invalidChars.has(char)) {
		throw new ValidationError(`Path contains invalid character: "${char}"`);
	}
}

/**
 * Check if component is a Windows drive letter
 */
function isDriveLetter(component: string, index: number): boolean {
	return index === 0 && /^[a-zA-Z]:$/.test(component);
}

/**
 * Validate Windows reserved names
 */
function validateWindowsReservedName(
	component: string,
	reservedNames: Set<string>,
): void {
	const upperComponent = component.toUpperCase();
	const nameWithoutExt = upperComponent.split(".")[0];

	if (reservedNames.has(nameWithoutExt)) {
		throw new ValidationError(
			`Path contains Windows reserved name: ${component}`,
		);
	}
}

/**
 * Validate Windows path component
 */
function validateWindowsComponent(
	component: string,
	index: number,
	config: PathConfig,
): void {
	if (isDriveLetter(component, index)) {
		return;
	}

	// Check each character
	for (const char of component) {
		validateWindowsCharacter(char, config.invalidChars);
	}

	// Check reserved names
	validateWindowsReservedName(component, config.reservedNames);

	// Check for trailing dots or spaces
	if (/[. ]$/.test(component)) {
		throw new ValidationError(
			"Path components cannot end with dots or spaces on Windows",
		);
	}
}

/**
 * Validate Unix path
 */
function validateUnixPath(filePath: string, config: PathConfig): void {
	for (const char of filePath) {
		if (config.invalidChars.has(char)) {
			throw new ValidationError(`Path contains invalid character (null byte)`);
		}
	}
}

/**
 * Validate Windows path
 */
function validateWindowsPath(filePath: string, config: PathConfig): void {
	const components = filePath.split(path.sep);

	components.forEach((component, index) => {
		validateWindowsComponent(component, index, config);
	});
}

/**
 * Platform-specific path validation
 */
function validatePathForPlatform(filePath: string, allowHidden: boolean): void {
	const platform = process.platform === "win32" ? "win32" : "posix";
	const config = PATH_CONFIG[platform];

	// Check for hidden files
	validateHiddenFiles(filePath, allowHidden);

	// Platform-specific validation
	if (platform === "win32") {
		validateWindowsPath(filePath, config);
	} else {
		validateUnixPath(filePath, config);
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
		name: "yt-dlp",
		versionFlag: "--version",
		versionPattern: /(\d{4}\.\d{2}\.\d{2})/,
		minVersion: "2023.01.01",
		message: "yt-dlp 2023.01.01+ is required for YouTube video downloading",
	},
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
 * Check if a tool exists
 */
async function checkToolExists(
	tool: EnvironmentRequirement,
	commandExists?: (cmd: string) => Promise<boolean>,
): Promise<boolean> {
	if (!commandExists) {
		return true; // Assume exists if no checker provided
	}

	const exists = await commandExists(tool.command || tool.name);
	return exists;
}

/**
 * Extract version from command output
 */
function extractVersion(output: string, pattern: RegExp): string | null {
	const match = output.match(pattern);
	return match?.[1] || null;
}

/**
 * Validate tool version
 */
async function validateToolVersion(
	tool: EnvironmentRequirement,
	getCommandVersion: (cmd: string) => Promise<string | null>,
): Promise<string | null> {
	if (!tool.versionPattern || !tool.minVersion) {
		return null;
	}

	const versionOutput = await getCommandVersion(tool.command || tool.name);
	if (!versionOutput) {
		return null;
	}

	const version = extractVersion(versionOutput, tool.versionPattern);
	if (!version) {
		return null;
	}

	if (!compareVersions(version, tool.minVersion)) {
		return `${tool.name} version ${version} is too old. ${tool.message}`;
	}

	return null;
}

/**
 * Validate a single tool
 */
async function validateTool(
	tool: EnvironmentRequirement,
	commandExists?: (cmd: string) => Promise<boolean>,
	getCommandVersion?: (cmd: string) => Promise<string | null>,
): Promise<string | null> {
	try {
		// Check existence
		const exists = await checkToolExists(tool, commandExists);
		if (!exists) {
			return tool.message;
		}

		// Check version if version checker is provided
		if (getCommandVersion) {
			const versionError = await validateToolVersion(tool, getCommandVersion);
			if (versionError) {
				return versionError;
			}
		}

		return null;
	} catch {
		return tool.message;
	}
}

/**
 * Validates that the required environment tools are available
 * This is a more robust version that checks versions and availability
 */
export async function validateEnvironment(
	commandExists?: (cmd: string) => Promise<boolean>,
	getCommandVersion?: (cmd: string) => Promise<string | null>,
): Promise<void> {
	const validationPromises = REQUIRED_TOOLS.map((tool) =>
		validateTool(tool, commandExists, getCommandVersion),
	);

	const results = await Promise.all(validationPromises);
	const errors = results.filter((error): error is string => error !== null);

	if (errors.length > 0) {
		throw new ValidationError(
			`Environment validation failed:\n  - ${errors.join("\n  - ")}`,
		);
	}
}

/**
 * Version Comparison Utilities
 */

/**
 * Parses a version string into major, minor, and optional patch numbers
 * Examples: "4.2.1" -> { major: 4, minor: 2, patch: 1 }
 *           "5.0" -> { major: 5, minor: 0 }
 */
export function parseVersion(
	versionString: string,
): { major: number; minor: number; patch?: number } | null {
	// Extract just the version numbers, ignoring any prefix/suffix
	const versionMatch = versionString.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
	if (!versionMatch) {
		return null;
	}

	const major = parseInt(versionMatch[1], 10);
	const minor = parseInt(versionMatch[2], 10);
	const patch = versionMatch[3] ? parseInt(versionMatch[3], 10) : undefined;

	return { major, minor, patch };
}

/**
 * Compares two version strings to check if version >= minVersion
 * Supports both semantic versioning and date-based versioning (for yt-dlp)
 * Examples:
 *   compareVersions("4.2.1", "4.0") -> true
 *   compareVersions("3.9", "4.0") -> false
 *   compareVersions("4.0.1", "4.0") -> true
 *   compareVersions("2025.06.30", "2023.01.01") -> true
 */
export function compareVersions(version: string, minVersion: string): boolean {
	// Check if it's date-based versioning (YYYY.MM.DD format)
	const datePattern = /^\d{4}\.\d{2}\.\d{2}$/;
	if (datePattern.test(version) && datePattern.test(minVersion)) {
		// For date versions, simple string comparison works due to the format
		return version >= minVersion;
	}

	// Otherwise, use semantic versioning comparison
	const v1 = parseVersion(version);
	const v2 = parseVersion(minVersion);

	if (!v1 || !v2) {
		return false;
	}

	// Compare major version
	if (v1.major > v2.major) return true;
	if (v1.major < v2.major) return false;

	// Major versions are equal, compare minor
	if (v1.minor > v2.minor) return true;
	if (v1.minor < v2.minor) return false;

	// Major and minor are equal, compare patch if both have it
	if (v1.patch !== undefined && v2.patch !== undefined) {
		return v1.patch >= v2.patch;
	}

	// If only one has a patch version, the one with patch is considered newer
	// e.g., "4.0.1" >= "4.0" is true
	return true;
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
