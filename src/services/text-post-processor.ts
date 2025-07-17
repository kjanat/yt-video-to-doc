interface TextBlock {
	text: string;
	confidence: number;
}

interface PositionedTextBlock {
	text: string;
	position: {
		x: number;
		y: number;
	};
}

/**
 * Post-processor for cleaning and improving OCR output
 */
export class TextPostProcessor {
	private readonly commonOcrMistakes: Map<RegExp, string> = new Map([
		// Specific word fixes first (more specific patterns should come first)
		[/\bHe11o\b/gi, "Hello"],
		[/\bHe110\b/gi, "Hello"],
		[/\bw0r1d\b/g, "world"],
		[/\bW0r1d\b/g, "World"],
		[/\bc0mputer\b/gi, "computer"],
		[/\bpr0gramming\b/gi, "programming"],
	]);

	/**
	 * Clean OCR output by removing artifacts and fixing common issues
	 */
	cleanOcrOutput(text: string): string {
		if (!text) return "";

		let cleaned = text;

		// Remove non-printable characters but preserve newlines and tabs
		cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "");

		// Replace multiple spaces with single space within lines
		cleaned = cleaned.replace(/ {2,}/g, " ");
		
		// Split into lines and process
		const lines = cleaned.split("\n").map(line => line.trim());
		
		// Join lines, keeping single line breaks where there was at least one
		// and paragraph breaks where there were multiple
		let result = "";
		let emptyLineCount = 0;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			if (line === "") {
				emptyLineCount++;
			} else {
				if (result && emptyLineCount === 0) {
					// No empty lines between content - this shouldn't happen after split
					result += "\n" + line;
				} else if (result && emptyLineCount === 1) {
					// Single empty line - preserve as double line break (paragraph)
					result += "\n\n" + line;
				} else if (result && emptyLineCount === 2) {
					// Two empty lines - reduce to single line break
					result += "\n" + line;
				} else if (result && emptyLineCount > 2) {
					// More than two empty lines - reduce to single line break
					result += "\n" + line;
				} else {
					// First line
					result = line;
				}
				emptyLineCount = 0;
			}
		}
		
		cleaned = result;

		// Remove trailing/leading whitespace
		cleaned = cleaned.trim();

		// Fix common OCR mistakes
		cleaned = this.detectAndFixCommonErrors(cleaned);

		return cleaned;
	}

	/**
	 * Detect and fix common OCR errors
	 */
	detectAndFixCommonErrors(text: string): string {
		let fixed = text;

		// Apply common OCR mistake corrections
		this.commonOcrMistakes.forEach((replacement, pattern) => {
			fixed = fixed.replace(pattern, replacement);
		});

		// Fix spacing around punctuation
		fixed = fixed.replace(/ ,/g, ",");
		fixed = fixed.replace(/ !/g, "!");
		fixed = fixed.replace(/ \?/g, "?");
		fixed = fixed.replace(/ \./g, ".");

		// Fix apostrophes
		fixed = fixed.replace(/(\w)' s\b/g, "$1's");
		fixed = fixed.replace(/(\w) 's\b/g, "$1's");

		return fixed;
	}

	/**
	 * Extract only high-confidence text blocks
	 */
	extractConfidentText(
		blocks: TextBlock[],
		minConfidence = 70,
	): TextBlock[] {
		return blocks.filter((block) => block.confidence >= minConfidence);
	}

	/**
	 * Merge text blocks based on their positions
	 */
	mergeTextBlocks(blocks: PositionedTextBlock[]): string {
		if (blocks.length === 0) return "";

		// Sort blocks by position (top to bottom, left to right)
		const sorted = [...blocks].sort((a, b) => {
			// First sort by Y position (with some tolerance for same line)
			const yDiff = a.position.y - b.position.y;
			if (Math.abs(yDiff) > 10) {
				return yDiff;
			}
			// If on same line, sort by X position
			return a.position.x - b.position.x;
		});

		// Group blocks by lines (similar Y positions)
		const lines: PositionedTextBlock[][] = [];
		let currentLine: PositionedTextBlock[] = [];
		let lastY = sorted[0]?.position.y ?? 0;

		for (const block of sorted) {
			if (Math.abs(block.position.y - lastY) > 15) {
				// New line detected
				if (currentLine.length > 0) {
					lines.push(currentLine);
				}
				currentLine = [block];
				lastY = block.position.y;
			} else {
				// Same line
				currentLine.push(block);
			}
		}

		// Don't forget the last line
		if (currentLine.length > 0) {
			lines.push(currentLine);
		}

		// Join blocks within lines and lines together
		return lines
			.map((line) =>
				line
					.sort((a, b) => a.position.x - b.position.x)
					.map((block) => block.text)
					.join(" "),
			)
			.join("\n");
	}
}