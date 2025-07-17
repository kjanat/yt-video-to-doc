import { describe, it, expect, beforeEach } from "vitest";
import { TextPostProcessor } from "../../services/text-post-processor";

describe("TextPostProcessor", () => {
	let processor: TextPostProcessor;

	beforeEach(() => {
		processor = new TextPostProcessor();
	});

	describe("cleanOcrOutput", () => {
		it("should remove excessive whitespace", () => {
			const input = "Hello    World\n\n\nThis   is   a   test";
			const result = processor.cleanOcrOutput(input);
			expect(result).toBe("Hello World\nThis is a test");
		});

		it("should fix common OCR mistakes", () => {
			const input = "He110 W0r1d"; // Common OCR: l->1, o->0
			const result = processor.cleanOcrOutput(input);
			expect(result).toBe("Hello World");
		});

		it("should remove non-printable characters", () => {
			const input = "Hello\x00World\x01Test\x02";
			const result = processor.cleanOcrOutput(input);
			expect(result).toBe("HelloWorldTest");
		});

		it("should preserve intentional line breaks", () => {
			const input = "Title\n\nParagraph 1\n\nParagraph 2";
			const result = processor.cleanOcrOutput(input);
			expect(result).toBe("Title\n\nParagraph 1\n\nParagraph 2");
		});

		it("should handle empty input", () => {
			expect(processor.cleanOcrOutput("")).toBe("");
			expect(processor.cleanOcrOutput("   ")).toBe("");
			expect(processor.cleanOcrOutput("\n\n\n")).toBe("");
		});
	});

	describe("detectAndFixCommonErrors", () => {
		it("should fix common OCR character substitutions", () => {
			const testCases = [
				{ input: "c0mputer", expected: "computer" },
				{ input: "pr0gramming", expected: "programming" },
				{ input: "He11o", expected: "Hello" },
				{ input: "w0r1d", expected: "world" },
			];

			testCases.forEach(({ input, expected }) => {
				expect(processor.detectAndFixCommonErrors(input)).toBe(expected);
			});
		});

		it("should fix spacing around punctuation", () => {
			const input = "Hello , world ! How are you ?";
			const result = processor.detectAndFixCommonErrors(input);
			expect(result).toBe("Hello, world! How are you?");
		});

		it("should fix quotes and apostrophes", () => {
			const input = "It' s a beautiful day";
			const result = processor.detectAndFixCommonErrors(input);
			expect(result).toBe("It's a beautiful day");
		});
	});

	describe("extractConfidentText", () => {
		it("should filter out low-confidence text blocks", () => {
			const blocks = [
				{ text: "Clear text", confidence: 90 },
				{ text: "?????", confidence: 30 },
				{ text: "Good text", confidence: 85 },
				{ text: "###@@@", confidence: 20 },
			];

			const result = processor.extractConfidentText(blocks, 60);
			expect(result).toHaveLength(2);
			expect(result[0].text).toBe("Clear text");
			expect(result[1].text).toBe("Good text");
		});

		it("should use default confidence threshold", () => {
			const blocks = [
				{ text: "High confidence", confidence: 85 },
				{ text: "Low confidence", confidence: 50 },
			];

			const result = processor.extractConfidentText(blocks);
			expect(result).toHaveLength(1);
			expect(result[0].text).toBe("High confidence");
		});

		it("should handle empty input", () => {
			expect(processor.extractConfidentText([])).toEqual([]);
		});
	});

	describe("mergeTextBlocks", () => {
		it("should merge adjacent text blocks intelligently", () => {
			const blocks = [
				{ text: "Hello", position: { x: 0, y: 0 } },
				{ text: "World", position: { x: 50, y: 0 } },
				{ text: "Next line", position: { x: 0, y: 30 } },
			];

			const result = processor.mergeTextBlocks(blocks);
			expect(result).toBe("Hello World\nNext line");
		});

		it("should detect column layouts", () => {
			const blocks = [
				{ text: "Column 1 Line 1", position: { x: 0, y: 0 } },
				{ text: "Column 2 Line 1", position: { x: 200, y: 0 } },
				{ text: "Column 1 Line 2", position: { x: 0, y: 30 } },
				{ text: "Column 2 Line 2", position: { x: 200, y: 30 } },
			];

			const result = processor.mergeTextBlocks(blocks);
			// Should group by columns first
			expect(result).toContain("Column 1 Line 1");
			expect(result).toContain("Column 1 Line 2");
		});
	});
});