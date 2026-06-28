export const EVEN_VISUAL_COMPARISON_SPLIT = 50;

export type VisualComparisonResetParts = {
	originalUrl: string;
	outputUrl: string;
	imageName: string;
};

export function createVisualComparisonResetKey(parts: VisualComparisonResetParts): string {
	return `${parts.originalUrl}|${parts.outputUrl}|${parts.imageName}`;
}
