export const SUPPORTED_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_BATCH_SIZE = 25;

export type InputImageType = (typeof SUPPORTED_INPUT_TYPES)[number];
export type OutputType = 'image/webp' | 'image/jpeg';
export type PresetId = 'quality' | 'balanced' | 'smallest';
export type CompressionStatus = 'waiting' | 'compressing' | 'complete' | 'failed';

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

export type CompressionHistoryFile = {
	outputName: string;
	outputType: OutputType;
	outputSize: number;
	outputBlob: Blob;
};

export type CompressionHistoryJob = {
	id: string;
	createdAt: string;
	presetId: PresetId;
	outputType: OutputType;
	imageCount: number;
	totalOriginalSize: number;
	totalOutputSize: number;
	totalSavingsPercent: number;
	files: CompressionHistoryFile[];
};
