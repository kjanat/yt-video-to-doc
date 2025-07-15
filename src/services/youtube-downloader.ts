import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { VideoMetadata } from '../types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class YouTubeDownloader {
  private tempDir: string;
  private ytDlpPath: string;

  constructor(tempDir: string) {
    this.tempDir = tempDir;
    this.ytDlpPath = this.findYtDlp();
  }

  private findYtDlp(): string {
    // Check for yt-dlp in common locations
    const paths = [
      process.env.HOME ? `${process.env.HOME}/.local/bin/yt-dlp` : '',
      '/usr/local/bin/yt-dlp',
      'yt-dlp'
    ].filter(p => p);

    for (const ytdlp of paths) {
      try {
        execSync(`which ${ytdlp}`, { stdio: 'ignore' });
        const version = execSync(`${ytdlp} --version`, { encoding: 'utf8' }).trim();
        logger.info(`Using yt-dlp at ${ytdlp} (version: ${version})`);
        return ytdlp;
      } catch (e) {
        // Try next path
      }
    }
    
    throw new Error('yt-dlp not found. Please install it using: pip3 install --upgrade yt-dlp');
  }

  async downloadVideo(url: string): Promise<{ videoPath: string; metadata: VideoMetadata }> {
    const jobId = uuidv4();
    const outputPath = path.join(this.tempDir, `${jobId}.mp4`);
    
    // Ensure temp directory exists
    await fs.mkdir(this.tempDir, { recursive: true });

    // First get video metadata
    const metadata = await this.getVideoMetadata(url);
    
    // Check video duration limit (10 minutes for PoC)
    if (metadata.duration > 600) {
      throw new Error(`Video too long: ${Math.floor(metadata.duration / 60)} minutes. This proof of concept supports videos up to 10 minutes.`);
    }
    
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

      const childProcess = spawn(this.ytDlpPath, args);

      // Kill child process if parent exits
      const cleanup = () => {
        if (!childProcess.killed) {
          childProcess.kill('SIGTERM');
        }
      };
      
      process.once('exit', cleanup);
      process.once('SIGINT', cleanup);
      process.once('SIGTERM', cleanup);

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        process.removeListener('exit', cleanup);
        process.removeListener('SIGINT', cleanup);
        process.removeListener('SIGTERM', cleanup);
        
        if (code !== 0) {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      childProcess.on('error', (err) => {
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