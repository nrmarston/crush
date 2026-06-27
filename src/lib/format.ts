import type { OutputType } from './types';

export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return '0 B';
	}

	const units = ['B', 'KB', 'MB', 'GB'];
	const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** index;
	const precision = value >= 10 || index === 0 ? 0 : 1;

	return `${value.toFixed(precision)} ${units[index]}`;
}

export function calculateSavingsPercent(originalSize: number, outputSize: number): number {
	if (originalSize <= 0) {
		return 0;
	}

	return Math.round(((originalSize - outputSize) / originalSize) * 1000) / 10;
}

export function formatSavings(value: number): string {
	return `${Math.round(value)}%`;
}

export function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(value));
}

export function extensionForOutputType(outputType: OutputType): string {
	if (outputType === 'image/avif') {
		return 'avif';
	}

	if (outputType === 'image/jpeg') {
		return 'jpg';
	}

	return 'webp';
}

export function labelForOutputType(outputType: OutputType): string {
	if (outputType === 'image/avif') {
		return 'AVIF';
	}

	if (outputType === 'image/jpeg') {
		return 'JPEG';
	}

	return 'WebP';
}

export function makeOutputName(originalName: string, outputType: OutputType): string {
	const baseName =
		originalName
			.replace(/\.[^.]+$/, '')
			.replace(/[^\w.-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'image';

	return `${baseName}-crushed.${extensionForOutputType(outputType)}`;
}
