/// <reference lib="webworker" />

import encodeAvif from '@jsquash/avif/encode.js';
import { optimise as optimisePng } from '@jsquash/oxipng';
import type {
	CompressionPreset,
	CompressionResult,
	CompressorRequest,
	CompressorResponse
} from '../types';
import { calculateSavingsPercent, labelForOutputType, makeOutputName } from '../output-format';

const worker = self as DedicatedWorkerGlobalScope;
const PNG_OPTIMISE_OPTIONS = {
	level: 3,
	interlace: false,
	optimiseAlpha: false
};

worker.addEventListener('message', (event: MessageEvent<CompressorRequest>) => {
	void handleMessage(event.data);
});

async function handleMessage(message: CompressorRequest) {
	if (message.type !== 'compress') {
		return;
	}

	try {
		const result = await compressFile(message.id, message.file, message.preset);
		post({ type: 'complete', result });
	} catch (error) {
		post({
			type: 'failed',
			id: message.id,
			error: error instanceof Error ? error.message : 'This image could not be compressed.'
		});
	}
}

async function compressFile(
	id: string,
	file: File,
	preset: CompressionPreset
): Promise<CompressionResult> {
	if (preset.outputType === 'image/png') {
		return createPngResult(id, file, preset);
	}

	if (typeof OffscreenCanvas === 'undefined') {
		throw new Error('Canvas compression is not supported in this browser.');
	}

	const bitmap = await createImageBitmap(file);

	try {
		const dimensions = getOutputDimensions(bitmap.width, bitmap.height, preset.maxWidth);
		const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
		const context = canvas.getContext('2d', {
			alpha: preset.outputType !== 'image/jpeg'
		});

		if (!context) {
			throw new Error('Canvas compression is not available in this browser.');
		}

		if (preset.outputType === 'image/jpeg') {
			context.fillStyle = '#ffffff';
			context.fillRect(0, 0, dimensions.width, dimensions.height);
		}

		context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);

		const outputBlob = await createOutputBlob(canvas, context, preset);

		if (outputBlob.type && outputBlob.type !== preset.outputType) {
			throw new Error(`${labelForOutputType(preset.outputType)} output is not supported here.`);
		}

		return {
			id,
			originalName: file.name,
			originalType: file.type,
			originalSize: file.size,
			outputName: makeOutputName(file.name, preset.outputType),
			outputType: preset.outputType,
			outputSize: outputBlob.size,
			width: dimensions.width,
			height: dimensions.height,
			savingsPercent: calculateSavingsPercent(file.size, outputBlob.size),
			outputBlob
		};
	} finally {
		bitmap.close();
	}
}

async function createPngResult(
	id: string,
	file: File,
	preset: CompressionPreset
): Promise<CompressionResult> {
	if (file.type === 'image/png') {
		return optimizePngInput(id, file, preset);
	}

	if (typeof OffscreenCanvas === 'undefined') {
		throw new Error('Canvas compression is not supported in this browser.');
	}

	const bitmap = await createImageBitmap(file);

	try {
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const context = canvas.getContext('2d', { alpha: true });

		if (!context) {
			throw new Error('Canvas compression is not available in this browser.');
		}

		context.drawImage(bitmap, 0, 0);

		const encodedPng = await canvas.convertToBlob({ type: 'image/png' });

		if (encodedPng.type && encodedPng.type !== 'image/png') {
			throw new Error('PNG output is not supported here.');
		}

		const optimizedBuffer = await optimizePngBuffer(await encodedPng.arrayBuffer());
		const outputBlob = new Blob([optimizedBuffer], { type: 'image/png' });

		return {
			id,
			originalName: file.name,
			originalType: file.type,
			originalSize: file.size,
			outputName: makeOutputName(file.name, preset.outputType),
			outputType: preset.outputType,
			outputSize: outputBlob.size,
			width: bitmap.width,
			height: bitmap.height,
			savingsPercent: calculateSavingsPercent(file.size, outputBlob.size),
			outputBlob
		};
	} finally {
		bitmap.close();
	}
}

async function optimizePngInput(
	id: string,
	file: File,
	preset: CompressionPreset
): Promise<CompressionResult> {
	const originalBuffer = await file.arrayBuffer();

	if (isAnimatedPng(originalBuffer)) {
		throw new Error('Animated PNG files are not supported.');
	}

	const bitmap = await createImageBitmap(file);

	try {
		const optimizedBuffer = await optimizePngBuffer(originalBuffer);
		const shouldKeepOriginal = optimizedBuffer.byteLength >= originalBuffer.byteLength;
		const outputBuffer = shouldKeepOriginal ? originalBuffer : optimizedBuffer;
		const outputBlob = new Blob([outputBuffer], { type: 'image/png' });

		return {
			id,
			originalName: file.name,
			originalType: file.type,
			originalSize: file.size,
			outputName: makeOutputName(file.name, preset.outputType),
			outputType: preset.outputType,
			outputSize: outputBlob.size,
			width: bitmap.width,
			height: bitmap.height,
			savingsPercent: calculateSavingsPercent(file.size, outputBlob.size),
			outputBlob,
			note: shouldKeepOriginal ? 'already-optimized' : undefined
		};
	} finally {
		bitmap.close();
	}
}

async function optimizePngBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
	try {
		return await optimisePng(buffer, PNG_OPTIMISE_OPTIONS);
	} catch {
		throw new Error('This PNG could not be optimized. Try another output format.');
	}
}

async function createOutputBlob(
	canvas: OffscreenCanvas,
	context: OffscreenCanvasRenderingContext2D,
	preset: CompressionPreset
): Promise<Blob> {
	if (preset.outputType === 'image/avif') {
		const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
		const buffer = await encodeAvif(imageData, {
			bitDepth: 8,
			quality: qualityToPercent(preset.quality)
		});

		return new Blob([buffer], { type: preset.outputType });
	}

	return canvas.convertToBlob({
		type: preset.outputType,
		quality: preset.quality
	});
}

function getOutputDimensions(width: number, height: number, maxWidth: number | null) {
	if (!maxWidth || width <= maxWidth) {
		return { width, height };
	}

	const scale = maxWidth / width;

	return {
		width: Math.round(width * scale),
		height: Math.round(height * scale)
	};
}

function qualityToPercent(quality: number): number {
	return Math.min(Math.max(Math.round(quality * 100), 1), 100);
}

function isAnimatedPng(buffer: ArrayBuffer): boolean {
	const bytes = new Uint8Array(buffer);

	if (!hasPngSignature(bytes)) {
		return false;
	}

	const view = new DataView(buffer);
	let offset = 8;

	while (offset + 12 <= buffer.byteLength) {
		const length = view.getUint32(offset);
		const typeOffset = offset + 4;
		const type = String.fromCharCode(
			bytes[typeOffset],
			bytes[typeOffset + 1],
			bytes[typeOffset + 2],
			bytes[typeOffset + 3]
		);

		if (type === 'acTL') {
			return true;
		}

		if (type === 'IDAT') {
			return false;
		}

		offset += 12 + length;
	}

	return false;
}

function hasPngSignature(bytes: Uint8Array): boolean {
	return (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	);
}

function post(message: CompressorResponse) {
	worker.postMessage(message);
}
