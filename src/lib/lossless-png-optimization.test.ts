import { describe, expect, it, vi } from 'vite-plus/test';
import {
	LOSSLESS_PNG_OPTIMIZE_OPTIONS,
	optimizeLosslessPng,
	type LosslessPngImage,
	type LosslessPngOptimizationDependencies
} from './lossless-png-optimization';

describe('Lossless PNG Optimization', () => {
	it('optimizes original PNG bytes when they get smaller', async () => {
		const file = imageFile('badge.png', 'image/png', staticPngBytes([1, 2, 3, 4]));
		const optimized = arrayBufferFrom([8, 9]);
		const harness = createHarness({
			optimizePng: vi.fn(async () => optimized)
		});

		const result = await optimizeLosslessPng(file, harness.dependencies);

		expect(harness.dependencies.optimizePng).toHaveBeenCalledWith(
			await file.arrayBuffer(),
			LOSSLESS_PNG_OPTIMIZE_OPTIONS
		);
		expect(await blobBytes(result.outputBlob)).toEqual([8, 9]);
		expect(result).toMatchObject({
			outputSize: 2,
			width: 640,
			height: 480,
			note: undefined
		});
		expect(harness.image.close).toHaveBeenCalledOnce();
		expect(harness.dependencies.encodePng).not.toHaveBeenCalled();
	});

	it('keeps original PNG bytes and marks Already Optimized when optimization is not smaller', async () => {
		const original = staticPngBytes([1, 2, 3, 4]);
		const file = imageFile('badge.png', 'image/png', original);
		const harness = createHarness({
			optimizePng: vi.fn(async () => arrayBufferFrom([...original, 5]))
		});

		const result = await optimizeLosslessPng(file, harness.dependencies);

		expect(await blobBytes(result.outputBlob)).toEqual([...original]);
		expect(result.outputBlob.type).toBe('image/png');
		expect(result.outputSize).toBe(original.length);
		expect(result.note).toBe('already-optimized');
		expect(harness.image.close).toHaveBeenCalledOnce();
	});

	it('rejects animated PNGs before decoding them as Static Images', async () => {
		const file = imageFile('spinner.png', 'image/png', animatedPngBytes());
		const harness = createHarness();

		await expect(optimizeLosslessPng(file, harness.dependencies)).rejects.toThrow(
			'Animated PNG files are not supported.'
		);
		expect(harness.dependencies.decodeImage).not.toHaveBeenCalled();
		expect(harness.dependencies.optimizePng).not.toHaveBeenCalled();
	});

	it('fails instead of falling back to unoptimized PNG output when optimization fails', async () => {
		const file = imageFile('photo.jpg', 'image/jpeg', [1, 2, 3]);
		const harness = createHarness({
			encodePng: vi.fn(async () => blobFromBytes([7, 8, 9], 'image/png')),
			optimizePng: vi.fn(async () => {
				throw new Error('WASM optimizer failed.');
			})
		});

		await expect(optimizeLosslessPng(file, harness.dependencies)).rejects.toThrow(
			'This PNG could not be optimized. Try another output format.'
		);
		expect(harness.dependencies.encodePng).toHaveBeenCalledWith(harness.image);
		expect(harness.image.close).toHaveBeenCalledOnce();
	});

	it('decodes non-PNG inputs, encodes PNG output, and optimizes that PNG', async () => {
		const file = imageFile('photo.webp', 'image/webp', [1, 2, 3]);
		const harness = createHarness({
			encodePng: vi.fn(async () => blobFromBytes([7, 8, 9], 'image/png')),
			optimizePng: vi.fn(async () => arrayBufferFrom([4, 5]))
		});

		const result = await optimizeLosslessPng(file, harness.dependencies);

		expect(harness.dependencies.decodeImage).toHaveBeenCalledWith(file);
		expect(harness.dependencies.optimizePng).toHaveBeenCalledWith(
			arrayBufferFrom([7, 8, 9]),
			LOSSLESS_PNG_OPTIMIZE_OPTIONS
		);
		expect(await blobBytes(result.outputBlob)).toEqual([4, 5]);
		expect(result.outputBlob.type).toBe('image/png');
		expect(result).toMatchObject({
			outputSize: 2,
			width: 640,
			height: 480,
			note: undefined
		});
	});
});

function createHarness(overrides: Partial<LosslessPngOptimizationDependencies> = {}) {
	const image = {
		width: 640,
		height: 480,
		close: vi.fn()
	} satisfies LosslessPngImage;

	const dependencies = {
		decodeImage: vi.fn(async () => image),
		encodePng: vi.fn(async () => blobFromBytes([7, 8, 9], 'image/png')),
		optimizePng: vi.fn(async () => arrayBufferFrom([4, 5])),
		...overrides
	} satisfies LosslessPngOptimizationDependencies;

	return {
		image,
		dependencies
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

function animatedPngBytes() {
	return [...pngSignature(), ...pngChunk('acTL', []), ...pngChunk('IDAT', [1])];
}

function pngSignature() {
	return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
}

function pngChunk(type: string, data: number[]) {
	const bytes = [
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

	return bytes;
}

function arrayBufferFrom(bytes: number[] | Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.length);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

async function blobBytes(blob: Blob) {
	return [...new Uint8Array(await blob.arrayBuffer())];
}
