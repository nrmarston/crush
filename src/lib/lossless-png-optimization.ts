import type { CompressionResultNote } from './types';

export const LOSSLESS_PNG_OPTIMIZE_OPTIONS = {
	level: 3,
	interlace: false,
	optimiseAlpha: false
} satisfies LosslessPngOptimizeOptions;

export type LosslessPngOptimizeOptions = {
	level: number;
	interlace: boolean;
	optimiseAlpha: boolean;
};

export type LosslessPngImage = {
	width: number;
	height: number;
	close(): void;
};

export type LosslessPngOptimizationDependencies<Image extends LosslessPngImage = LosslessPngImage> =
	{
		decodeImage(file: Blob): Promise<Image>;
		encodePng(image: Image): Promise<Blob>;
		optimizePng(buffer: ArrayBuffer, options: LosslessPngOptimizeOptions): Promise<ArrayBuffer>;
	};

export type LosslessPngOptimizationResult = {
	outputBlob: Blob;
	outputSize: number;
	width: number;
	height: number;
	note?: CompressionResultNote;
};

export async function optimizeLosslessPng<Image extends LosslessPngImage>(
	file: File,
	dependencies: LosslessPngOptimizationDependencies<Image>
): Promise<LosslessPngOptimizationResult> {
	if (file.type === 'image/png') {
		return optimizePngInput(file, dependencies);
	}

	return optimizeDecodedImageAsPng(file, dependencies);
}

async function optimizePngInput<Image extends LosslessPngImage>(
	file: File,
	dependencies: LosslessPngOptimizationDependencies<Image>
): Promise<LosslessPngOptimizationResult> {
	const originalBuffer = await file.arrayBuffer();
	const image = await dependencies.decodeImage(file);

	try {
		const optimizedBuffer = await optimizePngBuffer(originalBuffer, dependencies);
		const shouldKeepOriginal = optimizedBuffer.byteLength >= originalBuffer.byteLength;
		const outputBuffer = shouldKeepOriginal ? originalBuffer : optimizedBuffer;

		return createResult(outputBuffer, image, shouldKeepOriginal ? 'already-optimized' : undefined);
	} finally {
		image.close();
	}
}

async function optimizeDecodedImageAsPng<Image extends LosslessPngImage>(
	file: File,
	dependencies: LosslessPngOptimizationDependencies<Image>
): Promise<LosslessPngOptimizationResult> {
	const image = await dependencies.decodeImage(file);

	try {
		const encodedPng = await dependencies.encodePng(image);

		if (encodedPng.type && encodedPng.type !== 'image/png') {
			throw new Error('PNG output is not supported here.');
		}

		const optimizedBuffer = await optimizePngBuffer(await encodedPng.arrayBuffer(), dependencies);

		return createResult(optimizedBuffer, image);
	} finally {
		image.close();
	}
}

async function optimizePngBuffer<Image extends LosslessPngImage>(
	buffer: ArrayBuffer,
	dependencies: LosslessPngOptimizationDependencies<Image>
): Promise<ArrayBuffer> {
	try {
		return await dependencies.optimizePng(buffer, LOSSLESS_PNG_OPTIMIZE_OPTIONS);
	} catch {
		throw new Error('This PNG could not be optimized. Try another output format.');
	}
}

function createResult(
	outputBuffer: ArrayBuffer,
	image: LosslessPngImage,
	note?: CompressionResultNote
): LosslessPngOptimizationResult {
	const outputBlob = new Blob([outputBuffer], { type: 'image/png' });

	return {
		outputBlob,
		outputSize: outputBlob.size,
		width: image.width,
		height: image.height,
		note
	};
}
