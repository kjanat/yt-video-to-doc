import { type SpawnOptions, spawn } from "node:child_process";
import logger from "./logger";

export interface CommandResult {
	stdout: string;
	stderr: string;
	exitCode: number | null;
}

/**
 * Execute a command safely using spawn (no shell interpretation)
 */
export async function execute(
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
export async function commandExists(command: string): Promise<boolean> {
	try {
		// Try to execute the command with --version or --help
		// This is more reliable than 'command -v' which might not exist in all shells
		const result = await execute(command, ["--version"]).catch(() =>
			// If --version fails, try --help
			execute(command, ["--help"]).catch(() =>
				// If both fail, try with no args (some commands might exit with 0)
				execute(command, []).catch(() => ({
					exitCode: -1,
					stdout: "",
					stderr: "",
				})),
			),
		);

		// Command exists if it returned any exit code (even non-zero)
		// except our sentinel value -1 which means the command wasn't found
		return result.exitCode !== -1;
	} catch (error) {
		logger.debug(`Command '${command}' not found: ${error}`);
		return false;
	}
}

/**
 * Get command version safely
 */
export async function getCommandVersion(
	command: string,
): Promise<string | null> {
	try {
		const result = await execute(command, ["--version"]);
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
export async function executeStreaming(
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

// Re-export for backward compatibility with class-based approach
export const SafeCommandExecutor = {
	execute,
	commandExists,
	getCommandVersion,
	executeStreaming,
};
