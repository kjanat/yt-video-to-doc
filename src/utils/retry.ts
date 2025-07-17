import { getRetryDelay, isRetryableError } from "./errors";
import logger from "./logger";

export interface RetryOptions {
	maxRetries?: number;
	retryDelay?: number;
	shouldRetry?: (error: Error, attempt: number) => boolean;
	onRetry?: (error: Error, attempt: number) => void;
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		maxRetries = 3,
		retryDelay = 1000,
		shouldRetry = isRetryableError,
		onRetry,
	} = options;

	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === maxRetries || !shouldRetry(lastError, attempt)) {
				throw lastError;
			}

			const delay = getRetryDelay(attempt, retryDelay);
			logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, {
				error: lastError.message,
				attempt,
				delay,
			});

			if (onRetry) {
				onRetry(lastError, attempt);
			}

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw lastError || new Error("Retry failed with unknown error");
}

export async function withTimeout<T>(
	fn: () => Promise<T>,
	timeoutMs: number,
	errorMessage = "Operation timed out",
): Promise<T> {
	let timeoutId: NodeJS.Timeout | undefined;

	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(errorMessage));
		}, timeoutMs);
	});

	const promise = Promise.race([fn(), timeoutPromise]);

	try {
		const result = await promise;
		if (timeoutId) clearTimeout(timeoutId);
		return result;
	} catch (error) {
		if (timeoutId) clearTimeout(timeoutId);
		throw error;
	}
}

export async function withCleanup<T>(
	fn: () => Promise<T>,
	cleanupFn: () => Promise<void>,
): Promise<T> {
	try {
		return await fn();
	} finally {
		try {
			await cleanupFn();
		} catch (error) {
			logger.error("Cleanup failed", error);
		}
	}
}
