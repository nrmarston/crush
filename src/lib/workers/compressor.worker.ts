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
import {
	optimizeLosslessPng,
	type LosslessPngOptimizationDependencies
} from '../lossless-png-optimization';
import { intakeStaticImage } from '../image-metadata';

const worker = self as DedicatedWorkerGlobalScope;
const pngOptimizationDependencies = {
	decodeImage: (file: Blob) => createImageBitmap(file),
	encodePng: encodePngFromBitmap,
	optimizePng: (buffer, options) => optimisePng(buffer, options)
} satisfies LosslessPngOptimizationDependencies<ImageBitmap>;

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
	const intakeResult = await intakeStaticImage(file);

	if (!intakeResult.accepted) {
		throw new Error(intakeResult.failure.message);
	}

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
	const result = await optimizeLosslessPng(file, pngOptimizationDependencies);

	return {
		id,
		originalName: file.name,
		originalType: file.type,
		originalSize: file.size,
		outputName: makeOutputName(file.name, preset.outputType),
		outputType: preset.outputType,
		outputSize: result.outputSize,
		width: result.width,
		height: result.height,
		savingsPercent: calculateSavingsPercent(file.size, result.outputSize),
		outputBlob: result.outputBlob,
		note: result.note
	};
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

async function encodePngFromBitmap(bitmap: ImageBitmap): Promise<Blob> {
	if (typeof OffscreenCanvas === 'undefined') {
		throw new Error('Canvas compression is not supported in this browser.');
	}

	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const context = canvas.getContext('2d', { alpha: true });

	if (!context) {
		throw new Error('Canvas compression is not available in this browser.');
	}

	context.drawImage(bitmap, 0, 0);

	return canvas.convertToBlob({ type: 'image/png' });
}

function post(message: CompressorResponse) {
	worker.postMessage(message);
}
