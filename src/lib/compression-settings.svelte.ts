import { browser } from '$app/environment';
import { defaultPresetId, presets } from './presets';
import { DEFAULT_OUTPUT_TYPE, normalizeOutputType, type OutputType } from './output-format';
import type { PresetId } from './types';

const STORAGE_KEY = 'crush:compression-settings:v1';

type CompressionSettings = {
	presetId: PresetId;
	outputType: OutputType;
};

type StoredCompressionSettings = Partial<Record<keyof CompressionSettings, unknown>>;

export const compressionSettings = $state<CompressionSettings>({
	presetId: defaultPresetId,
	outputType: DEFAULT_OUTPUT_TYPE
});

let hasInitialized = false;

export function initializeCompressionSettings() {
	if (!browser) {
		return;
	}

	if (!hasInitialized) {
		const settings = readStoredSettings();
		compressionSettings.presetId = settings.presetId;
		compressionSettings.outputType = settings.outputType;
		hasInitialized = true;
	}

	persistSettings();
}

export function setCompressionPreset(presetId: PresetId) {
	compressionSettings.presetId = normalizePresetId(presetId);
	persistSettings();
}

export function setCompressionOutputType(outputType: OutputType) {
	compressionSettings.outputType = normalizeOutputType(outputType);
	persistSettings();
}

function readStoredSettings(): CompressionSettings {
	try {
		const rawSettings = window.localStorage.getItem(STORAGE_KEY);

		if (!rawSettings) {
			return defaultSettings();
		}

		const parsedSettings = JSON.parse(rawSettings) as StoredCompressionSettings;

		return {
			presetId: normalizePresetId(parsedSettings.presetId),
			outputType: normalizeOutputType(parsedSettings.outputType)
		};
	} catch {
		return defaultSettings();
	}
}

function persistSettings() {
	if (!browser) {
		return;
	}

	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				presetId: compressionSettings.presetId,
				outputType: compressionSettings.outputType
			})
		);
	} catch {
		// Storage can be unavailable in private or restricted browser contexts.
	}
}

function defaultSettings(): CompressionSettings {
	return {
		presetId: defaultPresetId,
		outputType: DEFAULT_OUTPUT_TYPE
	};
}

function normalizePresetId(presetId: unknown): PresetId {
	return presets.some((preset) => preset.id === presetId)
		? (presetId as PresetId)
		: defaultPresetId;
}
