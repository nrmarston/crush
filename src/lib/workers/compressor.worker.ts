/// <reference lib="webworker" />

import encodeAvif from '@jsquash/avif/encode.js';
import { optimise as optimisePng } from '@jsquash/oxipng';
import {
	compressStaticImage,
	type StaticImageCompressionCanvas,
	type StaticImageCompressionCanvasCreationResult,
	type StaticImageCompressionCanvasOptions,
	type StaticImageCompressionDependencies
} from '../static-image-compression';
import type { CompressorRequest, CompressorResponse } from '../types';

const worker = self as DedicatedWorkerGlobalScope;
const compressionDependencies = {
	decodeImage: (file: Blob) => createImageBitmap(file),
	createCanvas: createCompressionCanvas,
	encodeAvif: (imageData, options) => encodeAvif(imageData, options),
	optimizePng: (buffer, options) => optimisePng(buffer, options)
} satisfies StaticImageCompressionDependencies<ImageBitmap>;

worker.addEventListener('message', (event: MessageEvent<CompressorRequest>) => {
	void handleMessage(event.data);
});

async function handleMessage(message: CompressorRequest) {
	if (message.type !== 'compress') {
		return;
	}

	try {
		const result = await compressStaticImage(
			message.id,
			message.file,
			message.preset,
			compressionDependencies
		);
		post({ type: 'complete', result });
	} catch (error) {
		post({
			type: 'failed',
			id: message.id,
			error: error instanceof Error ? error.message : 'This image could not be compressed.'
		});
	}
}

function createCompressionCanvas(
	width: number,
	height: number,
	options: StaticImageCompressionCanvasOptions
): StaticImageCompressionCanvasCreationResult<ImageBitmap> {
	if (typeof OffscreenCanvas === 'undefined') {
		return { ok: false, reason: 'unsupported' };
	}

	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext('2d', {
		alpha: options.alpha
	});

	if (!context) {
		return { ok: false, reason: 'unavailable' };
	}

	return {
		ok: true,
		canvas: createCompressionCanvasAdapter(canvas, context)
	};
}

function createCompressionCanvasAdapter(
	canvas: OffscreenCanvas,
	context: OffscreenCanvasRenderingContext2D
): StaticImageCompressionCanvas<ImageBitmap> {
	return {
		fill: (color, x, y, width, height) => {
			context.fillStyle = color;
			context.fillRect(x, y, width, height);
		},
		drawImage: (image, x, y, width, height) => {
			context.drawImage(image, x, y, width, height);
		},
		getImageData: (x, y, width, height) => context.getImageData(x, y, width, height),
		convertToBlob: (options) => canvas.convertToBlob(options)
	};
}

function post(message: CompressorResponse) {
	worker.postMessage(message);
}
