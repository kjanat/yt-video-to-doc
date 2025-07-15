import { Jimp, diff } from 'jimp';
import { Frame, Slide } from '../types';
import logger from '../utils/logger';

interface SlideCandidate {
  startIndex: number;
  endIndex: number;
  frames: Frame[];
  averageDifference: number;
}

export class AdvancedSlideDetector {
  private threshold: number;
  private minSlideFrames: number;
  private histogramBins: number = 16;

  constructor(threshold: number = 0.15, minSlideFrames: number = 1) {
    this.threshold = threshold;
    this.minSlideFrames = minSlideFrames;
  }

  async detectSlides(frames: Frame[], onProgress?: (percent: number) => void): Promise<Slide[]> {
    if (frames.length === 0) return [];

    logger.info(`Advanced slide detection from ${frames.length} frames`);
    
    // Step 1: Calculate frame differences using multiple methods
    logger.info('Calculating frame differences...');
    const differences = await this.calculateFrameDifferences(frames, (progress) => {
      if (onProgress) onProgress(40 + progress * 0.15); // 40-55%
    });
    
    // Log some statistics about differences
    const avgDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
    const maxDiff = Math.max(...differences);
    logger.info(`Differences - Avg: ${avgDiff.toFixed(3)}, Max: ${maxDiff.toFixed(3)}`);
    
    // Step 2: Find slide boundaries using adaptive thresholding
    const boundaries = this.findSlideBoundaries(differences);
    logger.info(`Found ${boundaries.length} boundaries`);
    if (onProgress) onProgress(56);
    
    // Step 3: Create slides from boundaries
    const slides = this.createSlidesFromBoundaries(frames, boundaries);
    logger.info(`Created ${slides.length} slides before merging`);
    if (onProgress) onProgress(58);
    
    // Step 4: Merge short slides that might be animations
    const mergedSlides = this.mergeShortSlides(slides);
    
    logger.info(`Detected ${mergedSlides.length} slides after merging`);
    if (onProgress) onProgress(60);
    return mergedSlides;
  }

  private async calculateFrameDifferences(frames: Frame[], onProgress?: (percent: number) => void): Promise<number[]> {
    const differences: number[] = [];
    
    for (let i = 1; i < frames.length; i++) {
      if (i % 50 === 0) {
        logger.info(`Processing frame ${i}/${frames.length}...`);
      }
      
      const diff = await this.calculateEnhancedDifference(
        frames[i - 1].imagePath,
        frames[i].imagePath
      );
      differences.push(diff);
      
      if (onProgress && i % 10 === 0) {
        onProgress(i / frames.length);
      }
    }
    
    return differences;
  }

  private async calculateEnhancedDifference(path1: string, path2: string): Promise<number> {
    try {
      const [img1, img2] = await Promise.all([
        Jimp.read(path1),
        Jimp.read(path2)
      ]);
      
      // Resize for faster comparison
      const width = 320;
      const height = 240;
      
      img1.resize({ w: width, h: height });
      img2.resize({ w: width, h: height });
      
      // Method 1: Pixel difference
      const pixelDiff = diff(img1, img2).percent;
      
      // Method 2: Histogram difference
      const histDiff = this.compareHistograms(img1, img2);
      
      // Method 3: Edge detection difference (simplified)
      const edgeDiff = await this.compareEdges(img1, img2);
      
      // Weighted combination
      const weightedDiff = (pixelDiff * 0.4) + (histDiff * 0.3) + (edgeDiff * 0.3);
      
      return weightedDiff;
      
    } catch (error) {
      logger.error(`Error comparing frames: ${error}`);
      return 0;
    }
  }

  private compareHistograms(img1: any, img2: any): number {
    const hist1 = this.calculateHistogram(img1);
    const hist2 = this.calculateHistogram(img2);
    
    // Calculate chi-squared distance
    let distance = 0;
    for (let i = 0; i < hist1.length; i++) {
      if (hist1[i] + hist2[i] > 0) {
        distance += Math.pow(hist1[i] - hist2[i], 2) / (hist1[i] + hist2[i]);
      }
    }
    
    // Normalize to 0-1 range
    return Math.min(distance / 100, 1);
  }

  private calculateHistogram(img: any): number[] {
    const histogram = new Array(this.histogramBins * 3).fill(0);
    const binSize = 256 / this.histogramBins;
    
    img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x: number, y: number, idx: number) => {
      const r = img.bitmap.data[idx];
      const g = img.bitmap.data[idx + 1];
      const b = img.bitmap.data[idx + 2];
      
      const rBin = Math.floor(r / binSize);
      const gBin = Math.floor(g / binSize);
      const bBin = Math.floor(b / binSize);
      
      histogram[rBin]++;
      histogram[this.histogramBins + gBin]++;
      histogram[this.histogramBins * 2 + bBin]++;
    });
    
    // Normalize
    const totalPixels = img.bitmap.width * img.bitmap.height;
    return histogram.map(count => count / totalPixels);
  }

  private async compareEdges(img1: any, img2: any): Promise<number> {
    // Simplified edge detection using grayscale gradient
    const gray1 = img1.clone().greyscale();
    const gray2 = img2.clone().greyscale();
    
    let edgeDiff = 0;
    let pixelCount = 0;
    
    // Sample every 4th pixel for speed
    for (let y = 1; y < gray1.bitmap.height - 1; y += 4) {
      for (let x = 1; x < gray1.bitmap.width - 1; x += 4) {
        const edge1 = this.getEdgeStrength(gray1, x, y);
        const edge2 = this.getEdgeStrength(gray2, x, y);
        edgeDiff += Math.abs(edge1 - edge2);
        pixelCount++;
      }
    }
    
    return Math.min(edgeDiff / pixelCount / 255, 1);
  }

  private getEdgeStrength(img: any, x: number, y: number): number {
    const getPixel = (px: number, py: number) => {
      const idx = (py * img.bitmap.width + px) * 4;
      return img.bitmap.data[idx];
    };
    
    // Sobel operator (simplified)
    const gx = getPixel(x + 1, y) - getPixel(x - 1, y);
    const gy = getPixel(x, y + 1) - getPixel(x, y - 1);
    
    return Math.sqrt(gx * gx + gy * gy);
  }

  private findSlideBoundaries(differences: number[]): number[] {
    const boundaries: number[] = [0]; // First frame is always a boundary
    
    // Calculate statistics
    const sortedDiffs = [...differences].sort((a, b) => a - b);
    const percentile25 = sortedDiffs[Math.floor(sortedDiffs.length * 0.25)];
    const percentile50 = sortedDiffs[Math.floor(sortedDiffs.length * 0.50)];
    const percentile75 = sortedDiffs[Math.floor(sortedDiffs.length * 0.75)];
    const percentile90 = sortedDiffs[Math.floor(sortedDiffs.length * 0.90)];
    
    // Calculate mean and standard deviation
    const mean = differences.reduce((a, b) => a + b, 0) / differences.length;
    const variance = differences.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / differences.length;
    const stdDev = Math.sqrt(variance);
    
    // Use multiple thresholds for different detection strategies
    const thresholds = {
      conservative: Math.max(this.threshold, percentile75),
      moderate: Math.max(this.threshold * 0.8, percentile50 * 1.5),
      aggressive: Math.max(this.threshold * 0.6, mean + stdDev),
      veryAggressive: Math.max(this.threshold * 0.4, percentile25 * 2)
    };
    
    logger.info(`Thresholds - Conservative: ${thresholds.conservative.toFixed(3)}, Moderate: ${thresholds.moderate.toFixed(3)}, Aggressive: ${thresholds.aggressive.toFixed(3)}, Very Aggressive: ${thresholds.veryAggressive.toFixed(3)}`);
    
    // Use the very aggressive threshold for presentations with many slides
    const activeThreshold = thresholds.veryAggressive;
    
    // Find peaks using sliding window
    const windowSize = 3;
    for (let i = windowSize; i < differences.length - windowSize; i++) {
      const window = differences.slice(i - windowSize, i + windowSize + 1);
      const centerValue = differences[i];
      const windowMax = Math.max(...window);
      
      // Check if this is a local peak
      if (centerValue === windowMax && centerValue > activeThreshold) {
        const lastBoundary = boundaries[boundaries.length - 1];
        // Ensure minimum distance between slides (at least 1 frame)
        if (i + 1 - lastBoundary >= 1) {
          boundaries.push(i + 1);
        }
      }
    }
    
    // Also check for sustained high differences (scene changes)
    let highDiffStart = -1;
    for (let i = 0; i < differences.length; i++) {
      if (differences[i] > activeThreshold) {
        if (highDiffStart === -1) {
          highDiffStart = i;
        }
      } else if (highDiffStart !== -1) {
        // End of high difference region
        const midPoint = Math.floor((highDiffStart + i) / 2);
        const lastBoundary = boundaries[boundaries.length - 1];
        if (midPoint + 1 - lastBoundary >= 2 && !boundaries.includes(midPoint + 1)) {
          boundaries.push(midPoint + 1);
        }
        highDiffStart = -1;
      }
    }
    
    // Sort boundaries and remove duplicates
    boundaries.sort((a, b) => a - b);
    const uniqueBoundaries = [...new Set(boundaries)];
    
    // Add last frame as boundary if not already there
    if (uniqueBoundaries[uniqueBoundaries.length - 1] !== differences.length) {
      uniqueBoundaries.push(differences.length);
    }
    
    logger.info(`Active threshold: ${activeThreshold.toFixed(3)}, Found ${uniqueBoundaries.length} boundaries`);
    
    return uniqueBoundaries;
  }

  private createSlidesFromBoundaries(frames: Frame[], boundaries: number[]): Slide[] {
    const slides: Slide[] = [];
    
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      const slideFrames = frames.slice(start, end);
      
      if (slideFrames.length >= this.minSlideFrames) {
        slides.push({
          startTime: slideFrames[0].timestamp,
          endTime: slideFrames[slideFrames.length - 1].timestamp,
          frames: slideFrames,
          ocrResults: [],
          primaryText: ''
        });
      }
    }
    
    return slides;
  }

  private mergeShortSlides(slides: Slide[]): Slide[] {
    const merged: Slide[] = [];
    let i = 0;
    
    while (i < slides.length) {
      const current = slides[i];
      const duration = current.endTime - current.startTime;
      
      // If slide is extremely short (less than 1 second), try to merge
      if (duration < 1 && i < slides.length - 1) {
        const next = slides[i + 1];
        const nextDuration = next.endTime - next.startTime;
        
        // Only merge if next slide is also very short and likely a transition
        if (nextDuration < 1) {
          merged.push({
            startTime: current.startTime,
            endTime: next.endTime,
            frames: [...current.frames, ...next.frames],
            ocrResults: [],
            primaryText: ''
          });
          i += 2;
          continue;
        }
      }
      
      merged.push(current);
      i++;
    }
    
    return merged;
  }

  async getMostRepresentativeFrame(slide: Slide): Promise<Frame> {
    // Return the middle frame of the slide
    const middleIndex = Math.floor(slide.frames.length / 2);
    return slide.frames[middleIndex];
  }
}