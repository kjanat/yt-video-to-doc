import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  ProcessingJob, 
  ProcessingOptions, 
  ProcessingResult, 
  ProcessingStatus,
  VideoMetadata,
  Slide
} from '../types';
import { YouTubeDownloader } from '../services/youtube-downloader';
import { FrameExtractor } from '../services/frame-extractor';
import { SlideDetector } from '../services/slide-detector';
import { AdvancedSlideDetector } from '../services/slide-detector-advanced';
import { OCRService } from '../services/ocr-service';
import { DocumentGenerator } from '../services/document-generator';
import { DEFAULT_OPTIONS } from '../config/defaults';
import logger from '../utils/logger';

export class VideoProcessor extends EventEmitter {
  private options: ProcessingOptions;
  private downloader: YouTubeDownloader;
  private frameExtractor: FrameExtractor;
  private slideDetector: SlideDetector | AdvancedSlideDetector;
  private ocrService: OCRService;
  private documentGenerator: DocumentGenerator;

  constructor(options: Partial<ProcessingOptions> = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // Initialize services
    this.downloader = new YouTubeDownloader(this.options.tempDir);
    this.frameExtractor = new FrameExtractor(this.options.tempDir);
    // Use advanced slide detector for better detection
    this.slideDetector = new AdvancedSlideDetector(this.options.slideDetectionThreshold);
    this.ocrService = new OCRService(this.options.ocrLanguage, this.options.tempDir);
    this.documentGenerator = new DocumentGenerator(this.options.outputDir);
  }

  async processVideo(videoUrl: string): Promise<ProcessingResult> {
    const job: ProcessingJob = {
      id: uuidv4(),
      videoUrl,
      status: ProcessingStatus.IDLE,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const startTime = Date.now();

    try {
      // Download video
      this.updateJobStatus(job, ProcessingStatus.DOWNLOADING, 0);
      const { videoPath, metadata } = await this.downloader.downloadVideo(videoUrl, (progress) => {
        this.updateJobStatus(job, ProcessingStatus.DOWNLOADING, Math.round(progress));
      });
      
      // Extract frames
      this.updateJobStatus(job, ProcessingStatus.EXTRACTING_FRAMES, 25);
      const frames = await this.frameExtractor.extractFrames(
        videoPath, 
        this.options.frameInterval,
        (progress) => {
          this.updateJobStatus(job, ProcessingStatus.EXTRACTING_FRAMES, Math.round(progress));
        }
      );
      
      // Detect slides
      this.updateJobStatus(job, ProcessingStatus.DETECTING_SLIDES, 40);
      const slides = await this.slideDetector.detectSlides(frames, (progress) => {
        this.updateJobStatus(job, ProcessingStatus.DETECTING_SLIDES, Math.round(progress));
      });
      
      // Run OCR
      this.updateJobStatus(job, ProcessingStatus.RUNNING_OCR, 60);
      const slidesWithText = await this.ocrService.processSlides(slides, (progress) => {
        this.updateJobStatus(job, ProcessingStatus.RUNNING_OCR, Math.round(progress));
      });
      
      // Generate document
      this.updateJobStatus(job, ProcessingStatus.GENERATING_DOCUMENT, 85);
      const outputPath = await this.documentGenerator.generateMarkdown(
        metadata,
        slidesWithText
      );
      
      // Cleanup
      await this.cleanup(videoPath, frames[0]?.imagePath);
      
      const result: ProcessingResult = {
        videoMetadata: metadata,
        slides: slidesWithText,
        outputPath,
        processingTime: (Date.now() - startTime) / 1000
      };
      
      this.updateJobStatus(job, ProcessingStatus.COMPLETED, 100);
      job.result = result;
      
      logger.info(`Processing completed in ${result.processingTime.toFixed(2)}s`);
      return result;
      
    } catch (error) {
      this.updateJobStatus(job, ProcessingStatus.FAILED, job.progress);
      job.error = error instanceof Error ? error.message : String(error);
      logger.error(`Processing failed: ${job.error}`);
      throw error;
    }
  }

  private updateJobStatus(job: ProcessingJob, status: ProcessingStatus, progress: number) {
    job.status = status;
    job.progress = progress;
    job.updatedAt = new Date();
    
    this.emit('progress', {
      jobId: job.id,
      status,
      progress
    });
    
    logger.info(`Job ${job.id}: ${status} (${progress}%)`);
  }

  private async cleanup(videoPath: string, framePath?: string) {
    try {
      // Clean up video file
      await this.downloader.cleanup(videoPath);
      
      // Clean up frames directory
      if (framePath) {
        const framesDir = framePath.substring(0, framePath.lastIndexOf('/'));
        await this.frameExtractor.cleanupFrames(framesDir);
      }
    } catch (error) {
      logger.error(`Cleanup error: ${error}`);
    }
  }
}