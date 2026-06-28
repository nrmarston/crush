const outputFormatDefinitions = [
	{
		type: 'image/avif',
		label: 'AVIF',
		extension: 'avif',
		supportsCompressionPresets: true
	},
	{
		type: 'image/webp',
		label: 'WebP',
		extension: 'webp',
		supportsCompressionPresets: true
	},
	{
		type: 'image/jpeg',
		label: 'JPEG',
		extension: 'jpg',
		supportsCompressionPresets: true
	},
	{
		type: 'image/png',
		label: 'PNG',
		extension: 'png',
		supportsCompressionPresets: false
	}
] as const;

export type OutputType = (typeof outputFormatDefinitions)[number]['type'];

export type OutputFormat = {
	type: OutputType;
	label: string;
	extension: string;
};

export type CompressionPlanningPreset = {
	outputType: OutputType;
	quality: number;
	maxWidth: number | null;
};

export type PlannedCompressionPreset<T extends CompressionPlanningPreset> = Omit<
	T,
	keyof CompressionPlanningPreset
> &
	CompressionPlanningPreset;

export type CompressionPlan<T extends CompressionPlanningPreset> = {
	outputFormat: OutputFormat;
	compressionPreset: PlannedCompressionPreset<T>;
	supportsCompressionPresets: boolean;
};

type OutputFormatDefinition = OutputFormat & {
	supportsCompressionPresets: boolean;
};

export const OUTPUT_FORMATS: readonly OutputFormat[] = outputFormatDefinitions.map(
	({ type, label, extension }) => ({
		type,
		label,
		extension
	})
);
export const OUTPUT_TYPES: readonly OutputType[] = OUTPUT_FORMATS.map((format) => format.type);
export const DEFAULT_OUTPUT_TYPE: OutputType = 'image/avif';

const outputFormatDefinitionsByType = Object.fromEntries(
	outputFormatDefinitions.map((format) => [format.type, format])
) as Record<OutputType, OutputFormatDefinition>;
const outputFormatsByType = Object.fromEntries(
	OUTPUT_FORMATS.map((format) => [format.type, format])
) as Record<OutputType, OutputFormat>;

export function outputFormatFor(outputType: OutputType): OutputFormat {
	return outputFormatsByType[outputType];
}

export function isOutputType(value: unknown): value is OutputType {
	return typeof value === 'string' && value in outputFormatsByType;
}

export function normalizeOutputType(outputType: unknown): OutputType {
	return isOutputType(outputType) ? outputType : DEFAULT_OUTPUT_TYPE;
}

export function labelForOutputType(outputType: OutputType): string {
	return outputFormatFor(outputType).label;
}

export function labelForImageType(type: string): string {
	return isOutputType(type) ? labelForOutputType(type) : type || 'Unknown';
}

export function extensionForOutputType(outputType: OutputType): string {
	return outputFormatFor(outputType).extension;
}

export function createCompressionPlan<T extends CompressionPlanningPreset>(
	selectedPreset: T,
	outputType: OutputType
): CompressionPlan<T> {
	const outputFormat = outputFormatFor(outputType);
	const supportsCompressionPresets =
		outputFormatDefinitionsByType[outputType].supportsCompressionPresets;
	const compressionPreset = {
		...selectedPreset,
		outputType
	} as PlannedCompressionPreset<T>;

	if (!supportsCompressionPresets) {
		compressionPreset.quality = 1;
		compressionPreset.maxWidth = null;
	}

	return {
		outputFormat,
		compressionPreset,
		supportsCompressionPresets
	};
}

export function makeOutputName(originalName: string, outputType: OutputType): string {
	const baseName =
		originalName
			.replace(/\.[^.]+$/, '')
			.replace(/[^\w.-]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'image';

	return `${baseName}-crushed.${extensionForOutputType(outputType)}`;
}

export function calculateSavingsPercent(originalSize: number, outputSize: number): number {
	if (originalSize <= 0) {
		return 0;
	}

	return Math.round(((originalSize - outputSize) / originalSize) * 1000) / 10;
}
