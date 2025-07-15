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
    interval: number = 2
  ): Promise<Frame[]> {
    const framesDir = path.join(this.tempDir, 'frames', path.basename(videoPath, '.mp4'));
    await fs.mkdir(framesDir, { recursive: true });

    logger.info(`Extracting frames from ${videoPath} every ${interval} seconds`);

    return new Promise((resolve, reject) => {
      const frames: Frame[] = [];
      
      ffmpeg(videoPath)
        .on('end', async () => {
          // Read all extracted frames
          const files = await fs.readdir(framesDir);
          const frameFiles = files
            .filter(f => f.endsWith('.png'))
            .sort((a, b) => {
              const numA = parseInt(a.match(/frame-(\d+)/)?.[1] || '0');
              const numB = parseInt(b.match(/frame-(\d+)/)?.[1] || '0');
              return numA - numB;
            });

          for (const file of frameFiles) {
            const frameNumber = parseInt(file.match(/frame-(\d+)/)?.[1] || '0');
            frames.push({
              timestamp: frameNumber * interval,
              imagePath: path.join(framesDir, file),
              frameNumber
            });
          }

          logger.info(`Extracted ${frames.length} frames`);
          resolve(frames);
        })
        .on('error', (err) => {
          logger.error(`Frame extraction error: ${err.message}`);
          reject(err);
        })
        .screenshots({
          count: 999999, // Extract all frames at interval
          filename: 'frame-%i.png',
          folder: framesDir,
          size: '1280x720' // Standardize frame size
        })
        .outputOptions([
          `-vf fps=1/${interval}` // Extract one frame every N seconds
        ]);
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