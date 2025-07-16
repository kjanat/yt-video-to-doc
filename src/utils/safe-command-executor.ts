import { spawn, type SpawnOptions } from "node:child_process";
import { promisify } from "node:util";
import { exec as execCallback } from "node:child_process";
import logger from "./logger";

const execAsync = promisify(execCallback);

export interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

/**
 * Safe command executor that prevents command injection attacks
 * by using spawn with argument arrays instead of shell execution
 */
export class SafeCommandExecutor {
	/**
	 * Execute a command safely using spawn (no shell interpretation)
	 */
	static async execute(
		command: string,
		args: string[] = [],
		options: SpawnOptions = {},
	): Promise<CommandResult> {
		return new Promise((resolve, reject) => {
			const child = spawn(command, args, {
				...options,
				shell: false, // Never use shell to prevent injection
			});

			let stdout = "";
			let stderr = "";

			if (child.stdout) {
				child.stdout.on("data", (data) => {
					stdout += data.toString();
				});
			}

			if (child.stderr) {
				child.stderr.on("data", (data) => {
					stderr += data.toString();
				});
			}

			child.on("error", (error) => {
				reject(error);
			});

			child.on("close", (code) => {
				resolve({
					stdout: stdout.trim(),
					stderr: stderr.trim(),
					exitCode: code,
				});
			});
		});
	}

	/**
	 * Check if a command exists in the system PATH
	 */
	static async commandExists(command: string): Promise<boolean> {
		try {
			// Use 'command -v' on Unix-like systems, 'where' on Windows
			const checkCommand = process.platform === "win32" ? "where" : "command";
			const checkArgs = process.platform === "win32" ? [command] : ["-v", command];
			
			const result = await this.execute(checkCommand, checkArgs);
			return result.exitCode === 0;
		} catch (error) {
			logger.debug(`Command '${command}' not found: ${error}`);
			return false;
		}
	}

	/**
	 * Get command version safely
	 */
	static async getCommandVersion(command: string): Promise<string | null> {
		try {
			const result = await this.execute(command, ["--version"]);
			if (result.exitCode === 0) {
				return result.stdout.split("\n")[0].trim();
			}
			return null;
		} catch (error) {
			logger.debug(`Failed to get version for '${command}': ${error}`);
			return null;
		}
	}

	/**
	 * Execute a command with real-time output streaming
	 */
	static async executeStreaming(
		command: string,
		args: string[] = [],
		onStdout?: (data: string) => void,
		onStderr?: (data: string) => void,
		options: SpawnOptions = {},
	): Promise<number | null> {
		return new Promise((resolve, reject) => {
			const child = spawn(command, args, {
				...options,
				shell: false,
			});

			if (child.stdout && onStdout) {
				child.stdout.on("data", (data) => {
					onStdout(data.toString());
				});
			}

			if (child.stderr && onStderr) {
				child.stderr.on("data", (data) => {
					onStderr(data.toString());
				});
			}

			child.on("error", (error) => {
				reject(error);
			});

			child.on("close", (code) => {
				resolve(code);
			});
		});
	}

	/**
	 * Sanitize file paths to prevent directory traversal attacks
	 */
	static sanitizePath(filePath: string): string {
		// Remove any directory traversal attempts
		return filePath
			.replace(/\.\./g, "")
			.replace(/~\//g, "")
			.replace(/\\/g, "/")
			.replace(/\/+/g, "/");
	}
}