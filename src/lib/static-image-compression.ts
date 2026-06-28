import { intakeStaticImage } from './image-metadata';
import {
	calculateSavingsPercent,
	labelForOutputType,
	makeOutputName,
	type OutputType
} from './output-format';
import {
	optimizeLosslessPng,
	type LosslessPngOptimizeOptions,
	type LosslessPngOptimizationDependencies
} from './lossless-png-optimization';
import type { CompressionPreset, CompressionResult } from './types';

export type StaticImageCompressionImage = {
	width: number;
	height: number;
	close(): void;
};

export type StaticImageCompressionCanvasOptions = {
	alpha: boolean;
};

export type StaticImageCompressionBlobOptions = {
	type: OutputType;
	quality?: number;
};

export type StaticImageCompressionCanvas<Image extends StaticImageCompressionImage> = {
	fill(color: string, x: number, y: number, width: number, height: number): void;
	drawImage(image: Image, x: number, y: number, width: number, height: number): void;
	getImageData(x: number, y: number, width: number, height: number): ImageData;
	convertToBlob(options: StaticImageCompressionBlobOptions): Promise<Blob>;
};

export type StaticImageCompressionCanvasFailureReason = 'unsupported' | 'unavailable';

export type StaticImageCompressionCanvasCreationResult<Image extends StaticImageCompressionImage> =
	| {
			ok: true;
			canvas: StaticImageCompressionCanvas<Image>;
	  }
	| {
			ok: false;
			reason: StaticImageCompressionCanvasFailureReason;
	  };

export type StaticImageCompressionAvifOptions = {
	bitDepth: 8;
	quality: number;
};

export type StaticImageCompressionDependencies<
	Image extends StaticImageCompressionImage = StaticImageCompressionImage
> = {
	decodeImage(file: Blob): Promise<Image>;
	createCanvas(
		width: number,
		height: number,
		options: StaticImageCompressionCanvasOptions
	): StaticImageCompressionCanvasCreationResult<Image>;
	encodeAvif(
		imageData: ImageData,
		options: StaticImageCompressionAvifOptions
	): Promise<ArrayBuffer>;
	optimizePng(buffer: ArrayBuffer, options: LosslessPngOptimizeOptions): Promise<ArrayBuffer>;
};

export async function compressStaticImage<Image extends StaticImageCompressionImage>(
	id: string,
	file: File,
	preset: CompressionPreset,
	dependencies: StaticImageCompressionDependencies<Image>
): Promise<CompressionResult> {
	const intakeResult = await intakeStaticImage(file, {
		decodeImage: (input) => dependencies.decodeImage(input)
	});

	if (!intakeResult.accepted) {
		throw new Error(intakeResult.failure.message);
	}

	if (preset.outputType === 'image/png') {
		return createPngResult(id, file, preset, dependencies);
	}

	return createLossyResult(id, file, preset, dependencies);
}

async function createLossyResult<Image extends StaticImageCompressionImage>(
	id: string,
	file: File,
	preset: CompressionPreset,
	dependencies: StaticImageCompressionDependencies<Image>
): Promise<CompressionResult> {
	const image = await dependencies.decodeImage(file);

	try {
		const dimensions = getOutputDimensions(image.width, image.height, preset.maxWidth);
		const canvas = getCanvasOrThrow(
			dependencies.createCanvas(dimensions.width, dimensions.height, {
				alpha: preset.outputType !== 'image/jpeg'
			})
		);

		if (preset.outputType === 'image/jpeg') {
			canvas.fill('#ffffff', 0, 0, dimensions.width, dimensions.height);
		}

		canvas.drawImage(image, 0, 0, dimensions.width, dimensions.height);

		const outputBlob = await createLossyOutputBlob(canvas, dimensions, preset, dependencies);

		if (outputBlob.type && outputBlob.type !== preset.outputType) {
			throw new Error(`${labelForOutputType(preset.outputType)} output is not supported here.`);
		}

		return createCompressionResult(id, file, preset, {
			outputBlob,
			outputSize: outputBlob.size,
			width: dimensions.width,
			height: dimensions.height
		});
	} finally {
		image.close();
	}
}

async function createPngResult<Image extends StaticImageCompressionImage>(
	id: string,
	file: File,
	preset: CompressionPreset,
	dependencies: StaticImageCompressionDependencies<Image>
): Promise<CompressionResult> {
	const result = await optimizeLosslessPng(file, {
		decodeImage: (input) => dependencies.decodeImage(input),
		encodePng: (image) => encodePngFromImage(image, dependencies),
		optimizePng: (buffer, options) => dependencies.optimizePng(buffer, options)
	} satisfies LosslessPngOptimizationDependencies<Image>);

	return createCompressionResult(id, file, preset, {
		outputBlob: result.outputBlob,
		outputSize: result.outputSize,
		width: result.width,
		height: result.height,
		note: result.note
	});
}

async function encodePngFromImage<Image extends StaticImageCompressionImage>(
	image: Image,
	dependencies: StaticImageCompressionDependencies<Image>
): Promise<Blob> {
	const canvas = getCanvasOrThrow(
		dependencies.createCanvas(image.width, image.height, {
			alpha: true
		})
	);

	canvas.drawImage(image, 0, 0, image.width, image.height);

	return canvas.convertToBlob({ type: 'image/png' });
}

async function createLossyOutputBlob<Image extends StaticImageCompressionImage>(
	canvas: StaticImageCompressionCanvas<Image>,
	dimensions: { width: number; height: number },
	preset: CompressionPreset,
	dependencies: StaticImageCompressionDependencies<Image>
): Promise<Blob> {
	if (preset.outputType === 'image/avif') {
		const imageData = canvas.getImageData(0, 0, dimensions.width, dimensions.height);
		const buffer = await dependencies.encodeAvif(imageData, {
			bitDepth: 8,
			quality: qualityToPercent(preset.quality)
		});

		return new Blob([new Uint8Array(buffer)], { type: preset.outputType });
	}

	return canvas.convertToBlob({
		type: preset.outputType,
		quality: preset.quality
	});
}

function createCompressionResult(
	id: string,
	file: File,
	preset: CompressionPreset,
	result: Pick<CompressionResult, 'outputBlob' | 'outputSize' | 'width' | 'height' | 'note'>
): CompressionResult {
	const compressionResult: CompressionResult = {
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
		outputBlob: result.outputBlob
	};

	if (result.note) {
		compressionResult.note = result.note;
	}

	return compressionResult;
}

function getCanvasOrThrow<Image extends StaticImageCompressionImage>(
	result: StaticImageCompressionCanvasCreationResult<Image>
): StaticImageCompressionCanvas<Image> {
	if (result.ok) {
		return result.canvas;
	}

	if (result.reason === 'unsupported') {
		throw new Error('Canvas compression is not supported in this browser.');
	}

	throw new Error('Canvas compression is not available in this browser.');
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
