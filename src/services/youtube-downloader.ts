import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { VideoMetadata } from '../types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class YouTubeDownloader {
  private tempDir: string;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
  }

  async downloadVideo(url: string): Promise<{ videoPath: string; metadata: VideoMetadata }> {
    const jobId = uuidv4();
    const outputPath = path.join(this.tempDir, `${jobId}.mp4`);
    
    // Ensure temp directory exists
    await fs.mkdir(this.tempDir, { recursive: true });

    // First get video metadata
    const metadata = await this.getVideoMetadata(url);
    
    // Download video
    await this.executeYtDlp([
      url,
      '-f', 'best[ext=mp4]/best',
      '-o', outputPath,
      '--no-playlist',
      '--quiet',
      '--no-warnings'
    ]);

    logger.info(`Video downloaded successfully: ${outputPath}`);
    
    return {
      videoPath: outputPath,
      metadata
    };
  }

  private async getVideoMetadata(url: string): Promise<VideoMetadata> {
    const output = await this.executeYtDlp([
      url,
      '--dump-json',
      '--no-playlist'
    ]);

    const data = JSON.parse(output);
    
    return {
      title: data.title,
      duration: data.duration,
      resolution: `${data.width}x${data.height}`,
      url: url,
      videoId: data.id
    };
  }

  private executeYtDlp(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const process = spawn('yt-dlp', args);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      process.on('error', (err) => {
        reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
      });
    });
  }

  async cleanup(videoPath: string): Promise<void> {
    try {
      await fs.unlink(videoPath);
      logger.info(`Cleaned up video file: ${videoPath}`);
    } catch (error) {
      logger.error(`Failed to cleanup video file: ${error}`);
    }
  }
}