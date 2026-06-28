import type { OutputType } from './output-format';

export const SUPPORTED_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export { DEFAULT_OUTPUT_TYPE, OUTPUT_TYPES } from './output-format';
export type { OutputType };
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_BATCH_SIZE = 25;

export type InputImageType = (typeof SUPPORTED_INPUT_TYPES)[number];
export type PresetId = 'quality' | 'balanced' | 'smallest';
export type CompressionStatus = 'waiting' | 'compressing' | 'complete' | 'failed';
export type CompressionResultNote = 'already-optimized';

export type CompressionPreset = {
	id: PresetId;
	label: string;
	description: string;
	outputType: OutputType;
	quality: number;
	maxWidth: number | null;
};

export type ImageMetadata = {
	name: string;
	type: string;
	size: number;
	width: number;
	height: number;
};

export type StaticImageIntakeFailureCode =
	| 'unsupported-type'
	| 'empty-file'
	| 'oversized-file'
	| 'corrupt-image'
	| 'animated-png';

export type StaticImageIntakeFailure = {
	code: StaticImageIntakeFailureCode;
	message: string;
};

export type StaticImageIntakeResult =
	| {
			accepted: true;
			metadata: ImageMetadata;
	  }
	| {
			accepted: false;
			failure: StaticImageIntakeFailure;
	  };

export type CompressionResult = {
	id: string;
	originalName: string;
	originalType: string;
	originalSize: number;
	outputName: string;
	outputType: OutputType;
	outputSize: number;
	width: number;
	height: number;
	savingsPercent: number;
	outputBlob: Blob;
	note?: CompressionResultNote;
};

export type CompressorRequest = {
	type: 'compress';
	id: string;
	file: File;
	preset: CompressionPreset;
};

export type CompressorResponse =
	| {
			type: 'complete';
			result: CompressionResult;
	  }
	| {
			type: 'failed';
			id: string;
			error: string;
	  };
