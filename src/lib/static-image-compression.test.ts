import { describe, expect, it, vi } from 'vite-plus/test';
import { LOSSLESS_PNG_OPTIMIZE_OPTIONS } from './lossless-png-optimization';
import {
	compressStaticImage,
	type StaticImageCompressionCanvas,
	type StaticImageCompressionDependencies
} from './static-image-compression';
import type { CompressionPreset } from './types';

type HarnessImage = {
	width: number;
	height: number;
	close: () => void;
};

type CanvasOperation =
	| {
			type: 'fill';
			color: string;
			x: number;
			y: number;
			width: number;
			height: number;
	  }
	| {
			type: 'drawImage';
			image: HarnessImage;
			x: number;
			y: number;
			width: number;
			height: number;
	  }
	| {
			type: 'getImageData';
			x: number;
			y: number;
			width: number;
			height: number;
	  }
	| {
			type: 'convertToBlob';
			options: { type: string; quality?: number };
	  };

type HarnessCanvas = StaticImageCompressionCanvas<HarnessImage> & {
	operations: CanvasOperation[];
};

type HarnessOverrides = Partial<StaticImageCompressionDependencies<HarnessImage>> & {
	images?: HarnessImage[];
	canvasBlob?: Blob;
};

describe('Static Image compression execution', () => {
	it('rejects Static Image intake failures before encoding', async () => {
		const harness = createHarness();
		const file = imageFile('notes.txt', 'text/plain', [1, 2, 3]);

		await expect(
			compressStaticImage('item-1', file, compressionPreset(), harness.dependencies)
		).rejects.toThrow('Unsupported file. Add a JPEG, PNG, or WebP image.');

		expect(harness.dependencies.decodeImage).not.toHaveBeenCalled();
		expect(harness.dependencies.createCanvas).not.toHaveBeenCalled();
		expect(harness.dependencies.encodeAvif).not.toHaveBeenCalled();
		expect(harness.dependencies.optimizePng).not.toHaveBeenCalled();
	});

	it('downscales WebP output, preserves aspect ratio, and assembles the result', async () => {
		const intakeImage = decodedImage(4000, 2000);
		const outputImage = decodedImage(4000, 2000);
		const outputBlob = blobFromBytes([7, 8, 9, 10], 'image/webp');
		const harness = createHarness({
			images: [intakeImage, outputImage],
			canvasBlob: outputBlob
		});
		const file = imageFile('Hero Image.Final.png', 'image/webp', new Uint8Array(10));

		const result = await compressStaticImage(
			'item-2',
			file,
			compressionPreset({
				outputType: 'image/webp',
				quality: 0.78,
				maxWidth: 1000
			}),
			harness.dependencies
		);

		expect(harness.dependencies.decodeImage).toHaveBeenCalledTimes(2);
		expect(intakeImage.close).toHaveBeenCalledOnce();
		expect(outputImage.close).toHaveBeenCalledOnce();
		expect(harness.dependencies.createCanvas).toHaveBeenCalledWith(1000, 500, {
			alpha: true
		});
		expect(harness.canvases[0].operations).toEqual([
			{
				type: 'drawImage',
				image: outputImage,
				x: 0,
				y: 0,
				width: 1000,
				height: 500
			},
			{
				type: 'convertToBlob',
				options: {
					type: 'image/webp',
					quality: 0.78
				}
			}
		]);
		expect(result).toEqual({
			id: 'item-2',
			originalName: 'Hero Image.Final.png',
			originalType: 'image/webp',
			originalSize: 10,
			outputName: 'Hero-Image.Final-crushed.webp',
			outputType: 'image/webp',
			outputSize: 4,
			width: 1000,
			height: 500,
			savingsPercent: 60,
			outputBlob
		});
	});

	it('does not upscale JPEG output and fills transparent pixels with white before drawing', async () => {
		const outputImage = decodedImage(800, 600);
		const harness = createHarness({
			images: [decodedImage(800, 600), outputImage],
			canvasBlob: blobFromBytes([1, 2, 3], 'image/jpeg')
		});

		const result = await compressStaticImage(
			'item-3',
			imageFile('badge.png', 'image/png', staticPngBytes([1, 2, 3, 4])),
			compressionPreset({
				outputType: 'image/jpeg',
				quality: 0.82,
				maxWidth: 1600
			}),
			harness.dependencies
		);

		expect(harness.dependencies.createCanvas).toHaveBeenCalledWith(800, 600, {
			alpha: false
		});
		expect(harness.canvases[0].operations).toEqual([
			{
				type: 'fill',
				color: '#ffffff',
				x: 0,
				y: 0,
				width: 800,
				height: 600
			},
			{
				type: 'drawImage',
				image: outputImage,
				x: 0,
				y: 0,
				width: 800,
				height: 600
			},
			{
				type: 'convertToBlob',
				options: {
					type: 'image/jpeg',
					quality: 0.82
				}
			}
		]);
		expect(result).toMatchObject({
			outputName: 'badge-crushed.jpg',
			outputType: 'image/jpeg',
			outputSize: 3,
			width: 800,
			height: 600
		});
	});

	it('encodes AVIF from image data with converted quality', async () => {
		const outputImage = decodedImage(640, 480);
		const harness = createHarness({
			images: [decodedImage(640, 480), outputImage],
			canvasBlob: blobFromBytes([9], 'image/png'),
			encodeAvif: vi.fn(async () => arrayBufferFrom([4, 5, 6]))
		});

		const result = await compressStaticImage(
			'item-4',
			imageFile('photo.jpg', 'image/jpeg', new Uint8Array(12)),
			compressionPreset({
				outputType: 'image/avif',
				quality: 0.004,
				maxWidth: null
			}),
			harness.dependencies
		);

		expect(harness.dependencies.createCanvas).toHaveBeenCalledWith(640, 480, {
			alpha: true
		});
		expect(harness.canvases[0].operations).toEqual([
			{
				type: 'drawImage',
				image: outputImage,
				x: 0,
				y: 0,
				width: 640,
				height: 480
			},
			{
				type: 'getImageData',
				x: 0,
				y: 0,
				width: 640,
				height: 480
			}
		]);
		expect(harness.dependencies.encodeAvif).toHaveBeenCalledWith(
			expect.objectContaining({ width: 640, height: 480 }),
			{
				bitDepth: 8,
				quality: 1
			}
		);
		expect(result).toMatchObject({
			outputName: 'photo-crushed.avif',
			outputType: 'image/avif',
			outputSize: 3,
			width: 640,
			height: 480,
			savingsPercent: 75
		});
		expect(result.outputBlob.type).toBe('image/avif');
	});

	it('fails when encoded MIME type conflicts with the requested Output Format', async () => {
		const outputImage = decodedImage(320, 240);
		const harness = createHarness({
			images: [decodedImage(320, 240), outputImage],
			canvasBlob: blobFromBytes([1, 2], 'image/webp')
		});

		await expect(
			compressStaticImage(
				'item-5',
				imageFile('portrait.jpg', 'image/jpeg', [1, 2, 3, 4]),
				compressionPreset({
					outputType: 'image/jpeg'
				}),
				harness.dependencies
			)
		).rejects.toThrow('JPEG output is not supported here.');

		expect(outputImage.close).toHaveBeenCalledOnce();
	});

	it('reports canvas capability failures from the execution module', async () => {
		const scenarios = [
			{
				reason: 'unsupported' as const,
				message: 'Canvas compression is not supported in this browser.'
			},
			{
				reason: 'unavailable' as const,
				message: 'Canvas compression is not available in this browser.'
			}
		];

		for (const scenario of scenarios) {
			const harness = createHarness({
				images: [decodedImage(320, 240), decodedImage(320, 240)],
				createCanvas: vi.fn(() => ({ ok: false, reason: scenario.reason }) as const)
			});

			await expect(
				compressStaticImage(
					'item-6',
					imageFile('photo.jpg', 'image/jpeg', [1, 2, 3]),
					compressionPreset(),
					harness.dependencies
				)
			).rejects.toThrow(scenario.message);
		}
	});

	it('propagates Already Optimized from PNG optimization into the result', async () => {
		const original = staticPngBytes([1, 2, 3, 4]);
		const outputImage = decodedImage(320, 180);
		const optimizePng = vi.fn(async () => arrayBufferFrom([...original, 9]));
		const harness = createHarness({
			images: [decodedImage(320, 180), outputImage],
			optimizePng
		});
		const file = imageFile('logo.png', 'image/png', original);

		const result = await compressStaticImage(
			'item-7',
			file,
			compressionPreset({
				outputType: 'image/png',
				quality: 1,
				maxWidth: null
			}),
			harness.dependencies
		);

		expect(harness.dependencies.decodeImage).toHaveBeenCalledTimes(2);
		expect(harness.dependencies.createCanvas).not.toHaveBeenCalled();
		expect(optimizePng).toHaveBeenCalledWith(
			await file.arrayBuffer(),
			LOSSLESS_PNG_OPTIMIZE_OPTIONS
		);
		expect(outputImage.close).toHaveBeenCalledOnce();
		expect(await blobBytes(result.outputBlob)).toEqual([...original]);
		expect(result).toMatchObject({
			outputName: 'logo-crushed.png',
			outputType: 'image/png',
			outputSize: original.length,
			width: 320,
			height: 180,
			savingsPercent: 0,
			note: 'already-optimized'
		});
	});

	it('encodes non-PNG input as PNG before optimizing PNG output', async () => {
		const outputImage = decodedImage(640, 480);
		const optimizePng = vi.fn(async () => arrayBufferFrom([4, 5]));
		const harness = createHarness({
			images: [decodedImage(640, 480), outputImage],
			canvasBlob: blobFromBytes([7, 8, 9], 'image/png'),
			optimizePng
		});

		const result = await compressStaticImage(
			'item-8',
			imageFile('photo.webp', 'image/webp', [1, 2, 3]),
			compressionPreset({
				outputType: 'image/png',
				quality: 1,
				maxWidth: null
			}),
			harness.dependencies
		);

		expect(harness.dependencies.createCanvas).toHaveBeenCalledWith(640, 480, {
			alpha: true
		});
		expect(harness.canvases[0].operations).toEqual([
			{
				type: 'drawImage',
				image: outputImage,
				x: 0,
				y: 0,
				width: 640,
				height: 480
			},
			{
				type: 'convertToBlob',
				options: {
					type: 'image/png'
				}
			}
		]);
		expect(optimizePng).toHaveBeenCalledWith(
			arrayBufferFrom([7, 8, 9]),
			LOSSLESS_PNG_OPTIMIZE_OPTIONS
		);
		expect(result).toMatchObject({
			outputName: 'photo-crushed.png',
			outputType: 'image/png',
			outputSize: 2,
			width: 640,
			height: 480,
			savingsPercent: 33.3
		});
	});
});

function createHarness(overrides: HarnessOverrides = {}) {
	const images = [...(overrides.images ?? [decodedImage(), decodedImage()])];
	const canvasBlob = overrides.canvasBlob ?? blobFromBytes([7, 8, 9, 10], 'image/webp');
	const canvases: HarnessCanvas[] = [];
	const decodeImage =
		overrides.decodeImage ??
		vi.fn(async () => {
			const image = images.shift();

			if (!image) {
				throw new Error('No decoded image was configured.');
			}

			return image;
		});
	const createCanvas =
		overrides.createCanvas ??
		vi.fn((width, height) => {
			const canvas = createCanvasHarness(width, height, canvasBlob);
			canvases.push(canvas);

			return { ok: true, canvas } as const;
		});
	const encodeAvif = overrides.encodeAvif ?? vi.fn(async () => arrayBufferFrom([4, 5, 6]));
	const optimizePng = overrides.optimizePng ?? vi.fn(async () => arrayBufferFrom([4, 5]));
	const dependencies = {
		decodeImage,
		createCanvas,
		encodeAvif,
		optimizePng
	} satisfies StaticImageCompressionDependencies<HarnessImage>;

	return {
		canvases,
		dependencies
	};
}

function createCanvasHarness(width: number, height: number, outputBlob: Blob) {
	const operations: CanvasOperation[] = [];

	return {
		operations,
		fill: vi.fn((color, x, y, fillWidth, fillHeight) => {
			operations.push({
				type: 'fill',
				color,
				x,
				y,
				width: fillWidth,
				height: fillHeight
			});
		}),
		drawImage: vi.fn((image, x, y, drawWidth, drawHeight) => {
			operations.push({
				type: 'drawImage',
				image,
				x,
				y,
				width: drawWidth,
				height: drawHeight
			});
		}),
		getImageData: vi.fn((x, y, readWidth, readHeight) => {
			operations.push({
				type: 'getImageData',
				x,
				y,
				width: readWidth,
				height: readHeight
			});

			return { width: readWidth, height: readHeight } as ImageData;
		}),
		convertToBlob: vi.fn(async (options) => {
			operations.push({
				type: 'convertToBlob',
				options
			});

			return outputBlob;
		})
	} satisfies HarnessCanvas;
}

function compressionPreset(overrides: Partial<CompressionPreset> = {}): CompressionPreset {
	return {
		id: 'balanced',
		label: 'Balanced',
		description: 'Good quality with useful size reduction.',
		outputType: 'image/webp',
		quality: 0.78,
		maxWidth: 2400,
		...overrides
	};
}

function decodedImage(width = 640, height = 480): HarnessImage {
	return {
		width,
		height,
		close: vi.fn()
	};
}

function imageFile(name: string, type: string, bytes: number[] | Uint8Array) {
	return new File([new Uint8Array(bytes)], name, { type });
}

function blobFromBytes(bytes: number[], type: string) {
	return new Blob([new Uint8Array(bytes)], { type });
}

function staticPngBytes(data: number[]) {
	return [...pngSignature(), ...pngChunk('IDAT', data)];
}

function pngSignature() {
	return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
}

function pngChunk(type: string, data: number[]) {
	return [
		(data.length >> 24) & 0xff,
		(data.length >> 16) & 0xff,
		(data.length >> 8) & 0xff,
		data.length & 0xff,
		type.charCodeAt(0),
		type.charCodeAt(1),
		type.charCodeAt(2),
		type.charCodeAt(3),
		...data,
		0,
		0,
		0,
		0
	];
}

function arrayBufferFrom(bytes: number[] | Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.length);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

async function blobBytes(blob: Blob) {
	return [...new Uint8Array(await blob.arrayBuffer())];
}
