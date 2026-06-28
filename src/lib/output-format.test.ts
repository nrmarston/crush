import { describe, expect, it } from 'vite-plus/test';
import {
	DEFAULT_OUTPUT_TYPE,
	OUTPUT_FORMATS,
	calculateSavingsPercent,
	createCompressionPlan,
	labelForImageType,
	makeOutputName,
	normalizeOutputType,
	type OutputType
} from './output-format';
import type { CompressionPreset } from './types';

const selectedPreset = {
	id: 'balanced',
	label: 'Balanced',
	description: 'Good quality with useful size reduction.',
	outputType: DEFAULT_OUTPUT_TYPE,
	quality: 0.78,
	maxWidth: 2400
} satisfies CompressionPreset;

describe('output format planning', () => {
	it('describes every selectable output format in UI order', () => {
		expect(
			OUTPUT_FORMATS.map((format) => ({
				type: format.type,
				label: format.label,
				extension: format.extension
			}))
		).toEqual([
			{
				type: 'image/avif',
				label: 'AVIF',
				extension: 'avif'
			},
			{
				type: 'image/webp',
				label: 'WebP',
				extension: 'webp'
			},
			{
				type: 'image/jpeg',
				label: 'JPEG',
				extension: 'jpg'
			},
			{
				type: 'image/png',
				label: 'PNG',
				extension: 'png'
			}
		]);
	});

	it('keeps selected preset quality and width for AVIF, WebP, and JPEG plans', () => {
		const presetBackedFormats = ['image/avif', 'image/webp', 'image/jpeg'] satisfies OutputType[];

		for (const outputType of presetBackedFormats) {
			const plan = createCompressionPlan(selectedPreset, outputType);

			expect(plan.compressionPreset).toEqual({
				...selectedPreset,
				outputType
			});
			expect(plan.outputFormat.type).toBe(outputType);
			expect(plan.supportsCompressionPresets).toBe(true);
		}
	});

	it('plans PNG as lossless output without selected preset compression', () => {
		const plan = createCompressionPlan(selectedPreset, 'image/png');

		expect(plan.compressionPreset).toEqual({
			...selectedPreset,
			outputType: 'image/png',
			quality: 1,
			maxWidth: null
		});
		expect(plan.outputFormat).toEqual({
			type: 'image/png',
			label: 'PNG',
			extension: 'png'
		});
		expect(plan.supportsCompressionPresets).toBe(false);
	});

	it('normalizes stored output values through the output format catalog', () => {
		expect(normalizeOutputType('image/webp')).toBe('image/webp');
		expect(normalizeOutputType('text/plain')).toBe(DEFAULT_OUTPUT_TYPE);
		expect(labelForImageType('image/jpeg')).toBe('JPEG');
		expect(labelForImageType('application/octet-stream')).toBe('application/octet-stream');
		expect(labelForImageType('')).toBe('Unknown');
	});

	it('creates output names from the selected output format extension', () => {
		expect(makeOutputName('Hero Image.Final.PNG', 'image/webp')).toBe(
			'Hero-Image.Final-crushed.webp'
		);
		expect(makeOutputName('###.jpg', 'image/jpeg')).toBe('image-crushed.jpg');
		expect(makeOutputName('banner', 'image/avif')).toBe('banner-crushed.avif');
	});

	it('calculates output savings consistently across batch and worker code', () => {
		expect(calculateSavingsPercent(1000, 333)).toBe(66.7);
		expect(calculateSavingsPercent(0, 333)).toBe(0);
		expect(calculateSavingsPercent(1000, 1200)).toBe(-20);
	});
});
