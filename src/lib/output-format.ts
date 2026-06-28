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
	supportsCompressionPresets: boolean;
};

export type CompressionPlanningPreset = {
	outputType: OutputType;
	quality: number;
	maxWidth: number | null;
};

export type CompressionPlan<T extends CompressionPlanningPreset> = Omit<
	T,
	keyof CompressionPlanningPreset
> &
	CompressionPlanningPreset;

export const OUTPUT_FORMATS = outputFormatDefinitions satisfies readonly OutputFormat[];
export const OUTPUT_TYPES: readonly OutputType[] = OUTPUT_FORMATS.map((format) => format.type);
export const DEFAULT_OUTPUT_TYPE: OutputType = 'image/avif';

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

export function supportsCompressionPresets(outputType: OutputType): boolean {
	return outputFormatFor(outputType).supportsCompressionPresets;
}

export function createCompressionPlan<T extends CompressionPlanningPreset>(
	selectedPreset: T,
	outputType: OutputType
): CompressionPlan<T> {
	const plan = {
		...selectedPreset,
		outputType
	} as CompressionPlan<T>;

	if (!supportsCompressionPresets(outputType)) {
		plan.quality = 1;
		plan.maxWidth = null;
	}

	return plan;
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
