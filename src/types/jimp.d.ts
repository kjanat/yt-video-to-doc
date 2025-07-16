// Type definitions for Jimp image processing
// Since Jimp v1.x has incomplete TypeScript definitions, we define what we need

import type { Jimp } from "jimp";

export type JimpInstance = Jimp;

// Extend the Jimp type if needed for specific methods
declare module "jimp" {
	interface Jimp {
		bitmap: {
			data: Buffer;
			width: number;
			height: number;
		};
		scan(
			x: number,
			y: number,
			w: number,
			h: number,
			callback: (x: number, y: number, idx: number) => void
		): void;
		clone(): Jimp;
		greyscale(): Jimp;
	}
}