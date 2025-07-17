import { config } from "dotenv";
import { z } from "zod";

// Load environment variables
config();

// Define environment schema
const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),

	// Paths
	TEMP_DIR: z.string().default("./temp"),
	OUTPUT_DIR: z.string().default("./output"),
	LOGS_DIR: z.string().default("./logs"),

	// Processing settings
	DEFAULT_FRAME_INTERVAL: z.coerce.number().default(2),
	DEFAULT_OCR_LANGUAGE: z.string().default("eng"),
	DEFAULT_SLIDE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.15),
	DEFAULT_OUTPUT_FORMAT: z.enum(["markdown", "txt", "pdf"]).default("markdown"),

	// Limits
	MAX_VIDEO_DURATION: z.coerce.number().default(600), // 10 minutes
	MAX_RETRY_ATTEMPTS: z.coerce.number().default(3),
	MAX_CONCURRENT_OCR: z.coerce.number().default(4),

	// External tools
	YTDLP_PATH: z.string().optional(),
	FFMPEG_PATH: z.string().optional(),
	TESSERACT_PATH: z.string().optional(),
});

// Parse and validate environment
const parseEnv = () => {
	try {
		return envSchema.parse(process.env);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorMessage = ["Invalid environment configuration:"];
			for (const err of error.issues) {
				errorMessage.push(`  - ${err.path.join(".")}: ${err.message}`);
			}
			throw new Error(errorMessage.join("\n"));
		}
		throw error;
	}
};

export const env = parseEnv();

// Export typed environment variables
export const isDevelopment = env.NODE_ENV === "development";
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
