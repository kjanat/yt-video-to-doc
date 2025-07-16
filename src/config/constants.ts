// Time limits
export const MAX_VIDEO_DURATION_SECONDS = 600; // 10 minutes
export const MAX_VIDEO_DURATION_MINUTES = 10;

// Progress percentages
export const PROGRESS_METADATA_FETCH = 5;
export const PROGRESS_DOWNLOAD_START = 10;
export const PROGRESS_DOWNLOAD_END = 25;
export const PROGRESS_EXTRACT_START = 25;
export const PROGRESS_EXTRACT_END = 40;
export const PROGRESS_DETECT_START = 40;
export const PROGRESS_DETECT_END = 60;
export const PROGRESS_OCR_START = 60;
export const PROGRESS_OCR_END = 85;
export const PROGRESS_GENERATE_START = 85;
export const PROGRESS_GENERATE_END = 100;
export const PROGRESS_FRAME_EXTRACTION_START = 25;
export const PROGRESS_SLIDE_DETECTION_START = 40;
export const PROGRESS_DOCUMENT_GENERATION_START = 85;
export const PROGRESS_COMPLETED = 100;

// Test video settings
export const TEST_FRAME_INTERVAL_SECONDS = 5;
export const TEST_VIDEO_URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"; // Big Buck Bunny trailer - Blender

// Process exit codes
export const EXIT_CODE_SUCCESS = 0;
export const EXIT_CODE_ERROR = 1;
export const EXIT_CODE_SIGINT = 130; // Standard exit code for SIGINT
export const EXIT_CODE_SIGTERM = 143; // Standard exit code for SIGTERM

// Text preview settings
export const MAX_TEXT_PREVIEW_LENGTH = 100;
export const MAX_SLIDES_PREVIEW = 3;

// Time formatting thresholds
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;

// File size limits
export const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

// OCR settings
export const DEFAULT_OCR_CONFIDENCE_THRESHOLD = 60;
