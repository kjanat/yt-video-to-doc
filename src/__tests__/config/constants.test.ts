import { describe, expect, it } from "vitest";
import * as constants from "../../config/constants";

describe("Constants", () => {
	it("should define video duration limits", () => {
		expect(constants.MAX_VIDEO_DURATION_SECONDS).toBe(600);
		expect(constants.MAX_VIDEO_DURATION_MINUTES).toBe(10);
	});

	it("should define progress percentages", () => {
		expect(constants.PROGRESS_METADATA_FETCH).toBe(5);
		expect(constants.PROGRESS_DOWNLOAD_START).toBe(10);
		expect(constants.PROGRESS_DOWNLOAD_END).toBe(25);
		expect(constants.PROGRESS_EXTRACT_START).toBe(25);
		expect(constants.PROGRESS_EXTRACT_END).toBe(40);
		expect(constants.PROGRESS_DETECT_START).toBe(40);
		expect(constants.PROGRESS_DETECT_END).toBe(60);
		expect(constants.PROGRESS_OCR_START).toBe(60);
		expect(constants.PROGRESS_OCR_END).toBe(85);
		expect(constants.PROGRESS_GENERATE_START).toBe(85);
		expect(constants.PROGRESS_GENERATE_END).toBe(100);
	});

	it("should define exit codes", () => {
		expect(constants.EXIT_CODE_SUCCESS).toBe(0);
		expect(constants.EXIT_CODE_ERROR).toBe(1);
		expect(constants.EXIT_CODE_SIGINT).toBe(130);
		expect(constants.EXIT_CODE_SIGTERM).toBe(143);
	});

	it("should define time constants", () => {
		expect(constants.SECONDS_PER_MINUTE).toBe(60);
		expect(constants.SECONDS_PER_HOUR).toBe(3600);
	});

	it("should define test constants", () => {
		expect(constants.TEST_VIDEO_URL).toBe(
			"https://www.youtube.com/watch?v=aqz-KE-bpKQ",
		);
		expect(constants.TEST_FRAME_INTERVAL_SECONDS).toBe(5);
	});

	it("should define display limits", () => {
		expect(constants.MAX_SLIDES_PREVIEW).toBe(3);
		expect(constants.MAX_TEXT_PREVIEW_LENGTH).toBe(100);
	});
});
