import { DEFAULT_OUTPUT_TYPE, type CompressionPreset, type PresetId } from './types';

export const presets = [
	{
		id: 'quality',
		label: 'High Quality',
		description: 'Best visual quality with lighter savings.',
		outputType: DEFAULT_OUTPUT_TYPE,
		quality: 0.9,
		maxWidth: null
	},
	{
		id: 'balanced',
		label: 'Balanced',
		description: 'Good quality with useful size reduction.',
		outputType: DEFAULT_OUTPUT_TYPE,
		quality: 0.78,
		maxWidth: 2400
	},
	{
		id: 'smallest',
		label: 'Smallest File',
		description: 'Prioritizes smaller files for web delivery.',
		outputType: DEFAULT_OUTPUT_TYPE,
		quality: 0.62,
		maxWidth: 1600
	}
] satisfies CompressionPreset[];

export const defaultPresetId: PresetId = 'balanced';
