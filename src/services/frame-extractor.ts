import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { Frame } from '../types';
import logger from '../utils/logger';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export class FrameExtractor {
  private tempDir: string;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
  }

  async extractFrames(
    videoPath: string, 
    interval: number = 2,
    onProgress?: (percent: number) => void
  ): Promise<Frame[]> {
    const framesDir = path.join(this.tempDir, 'frames', path.basename(videoPath, '.mp4'));
    await fs.mkdir(framesDir, { recursive: true });

    logger.info(`Extracting frames from ${videoPath} every ${interval} seconds`);

    return new Promise((resolve, reject) => {
      const frames: Frame[] = [];
      
      // First get video duration to calculate frame count
      ffmpeg.ffprobe(videoPath, async (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const duration = metadata.format.duration || 0;
        const frameCount = Math.floor(duration / interval);
        
        if (frameCount === 0) {
          logger.warn('Video too short for frame extraction');
          resolve([]);
          return;
        }
        
        logger.info(`Video duration: ${duration}s, extracting ${frameCount} frames`);
        
        // Extract frames at specific timestamps
        const timestamps: number[] = [];
        for (let i = 0; i < frameCount; i++) {
          timestamps.push(i * interval);
        }
        
        // Monitor progress by checking file creation
        const progressInterval = setInterval(async () => {
          try {
            const files = await fs.readdir(framesDir);
            const frameFiles = files.filter(f => f.endsWith('.png'));
            const processedFrames = frameFiles.length;
            
            if (onProgress && processedFrames > 0) {
              const percent = Math.min((processedFrames / frameCount) * 100, 100);
              // Map extraction progress from 25% to 40%
              onProgress(25 + (percent / 100) * 15);
            }
          } catch (e) {
            // Directory might not exist yet
          }
        }, 500); // Check every 500ms
        
        ffmpeg(videoPath)
          .on('end', async () => {
            clearInterval(progressInterval);
            
            // Read all extracted frames
            const files = await fs.readdir(framesDir);
            const frameFiles = files
              .filter(f => f.endsWith('.png'))
              .sort((a, b) => {
                const numA = parseInt(a.match(/frame-(\d+)/)?.[1] || '0');
                const numB = parseInt(b.match(/frame-(\d+)/)?.[1] || '0');
                return numA - numB;
              });

            for (let i = 0; i < frameFiles.length; i++) {
              frames.push({
                timestamp: timestamps[i] || i * interval,
                imagePath: path.join(framesDir, frameFiles[i]),
                frameNumber: i
              });
            }

            logger.info(`Extracted ${frames.length} frames`);
            if (onProgress) onProgress(40); // Complete at 40%
            resolve(frames);
          })
          .on('error', (err) => {
            clearInterval(progressInterval);
            logger.error(`Frame extraction error: ${err.message}`);
            reject(err);
          })
          .screenshots({
            timestamps: timestamps,
            filename: 'frame-%i.png',
            folder: framesDir,
            size: '1280x720' // Standardize frame size
          });
      });
    });
  }

  async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  }

  async cleanupFrames(framesDir: string): Promise<void> {
    try {
      await fs.rm(framesDir, { recursive: true, force: true });
      logger.info(`Cleaned up frames directory: ${framesDir}`);
    } catch (error) {
      logger.error(`Failed to cleanup frames: ${error}`);
    }
  }
}