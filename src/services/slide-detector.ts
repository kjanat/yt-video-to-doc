import { diff, Jimp } from "jimp";
import type { Frame, Slide } from "../types";
import logger from "../utils/logger";

export class SlideDetector {
	private threshold: number;

	constructor(threshold: number = 0.3) {
		this.threshold = threshold;
	}

	async detectSlides(frames: Frame[]): Promise<Slide[]> {
		if (frames.length === 0) return [];

		logger.info(`Detecting slides from ${frames.length} frames`);

		const slides: Slide[] = [];
		let currentSlideFrames: Frame[] = [frames[0]];

		for (let i = 1; i < frames.length; i++) {
			const previousFrame = frames[i - 1];
			const currentFrame = frames[i];

			const difference = await this.compareFrames(
				previousFrame.imagePath,
				currentFrame.imagePath,
			);

			if (difference > this.threshold) {
				// New slide detected
				slides.push(this.createSlide(currentSlideFrames));
				currentSlideFrames = [currentFrame];
				logger.debug(
					`New slide detected at frame ${i}, difference: ${difference.toFixed(3)}`,
				);
			} else {
				// Same slide, add frame
				currentSlideFrames.push(currentFrame);
			}
		}

		// Don't forget the last slide
		if (currentSlideFrames.length > 0) {
			slides.push(this.createSlide(currentSlideFrames));
		}

		logger.info(`Detected ${slides.length} slides`);
		return slides;
	}

	private async compareFrames(path1: string, path2: string): Promise<number> {
		try {
			const [img1, img2] = await Promise.all([
				Jimp.read(path1),
				Jimp.read(path2),
			]);

			// Resize to same dimensions for comparison
			const width = 320;
			const height = 240;

			img1.resize({ w: width, h: height });
			img2.resize({ w: width, h: height });

			// Calculate pixel difference
			const diffResult = diff(img1, img2);
			return diffResult.percent;
		} catch (error) {
			logger.error(`Error comparing frames: ${error}`);
			return 0;
		}
	}

	private createSlide(frames: Frame[]): Slide {
		const startTime = frames[0].timestamp;
		const endTime = frames[frames.length - 1].timestamp;

		return {
			startTime,
			endTime,
			frames,
			ocrResults: [],
			primaryText: "",
		};
	}

	async getMostRepresentativeFrame(slide: Slide): Promise<Frame> {
		// For now, return the middle frame
		// In a more sophisticated implementation, we could compare all frames
		// and find the one with the most text or clearest image
		const middleIndex = Math.floor(slide.frames.length / 2);
		return slide.frames[middleIndex];
	}
}
