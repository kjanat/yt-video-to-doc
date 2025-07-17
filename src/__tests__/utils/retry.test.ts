import { describe, expect, it, vi } from "vitest";
import { withRetry, withTimeout } from "../../utils/retry";

describe("withRetry", () => {
	it("should succeed on first attempt", async () => {
		const fn = vi.fn().mockResolvedValue("success");

		const result = await withRetry(fn);

		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("should retry on failure and eventually succeed", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error("Temporary failure"))
			.mockRejectedValueOnce(new Error("Temporary failure"))
			.mockResolvedValue("success");

		const result = await withRetry(fn, {
			maxRetries: 3,
			retryDelay: 10,
			shouldRetry: () => true, // Always retry for this test
		});

		expect(result).toBe("success");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("should fail after max retries", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("Permanent failure"));

		await expect(
			withRetry(fn, {
				maxRetries: 2,
				retryDelay: 10,
				shouldRetry: () => true, // Always retry for this test
			}),
		).rejects.toThrow("Permanent failure");

		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("should use custom shouldRetry function", async () => {
		const error = new Error("Custom error");
		const fn = vi.fn().mockRejectedValue(error);
		const shouldRetry = vi.fn().mockReturnValue(false);

		await expect(
			withRetry(fn, { shouldRetry, retryDelay: 10 }),
		).rejects.toThrow("Custom error");

		expect(fn).toHaveBeenCalledTimes(1);
		expect(shouldRetry).toHaveBeenCalledWith(error, 1);
	});

	it("should call onRetry callback", async () => {
		const error = new Error("Temporary failure");
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValue("success");
		const onRetry = vi.fn();

		await withRetry(fn, {
			onRetry,
			retryDelay: 10,
			shouldRetry: () => true, // Always retry for this test
		});

		expect(onRetry).toHaveBeenCalledWith(error, 1);
	});
});

describe("withTimeout", () => {
	it("should resolve when operation completes in time", async () => {
		const fn = vi.fn().mockResolvedValue("success");

		const result = await withTimeout(fn, 1000);

		expect(result).toBe("success");
	});

	it("should reject when operation times out", async () => {
		const fn = vi.fn().mockImplementation(
			() =>
				new Promise((resolve) => {
					setTimeout(() => resolve("success"), 2000);
				}),
		);

		await expect(withTimeout(fn, 100, "Custom timeout")).rejects.toThrow(
			"Custom timeout",
		);
	});
});
