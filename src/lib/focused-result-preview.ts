export type FocusedResultPreviewFrame = {
	width?: number;
	height?: number;
	aspectRatio: string;
	maxWidth: string;
	style: string;
};

export type FocusedResultPreviewDimensions = {
	originalWidth?: number;
	originalHeight?: number;
	width?: number;
	height?: number;
};

export function createFocusedResultPreviewFrame(
	dimensions: FocusedResultPreviewDimensions
): FocusedResultPreviewFrame {
	const width = dimensions.originalWidth ?? dimensions.width;
	const height = dimensions.originalHeight ?? dimensions.height;
	const aspectRatio = width && height ? `${width} / ${height}` : '1 / 1';
	const maxWidth = width && height ? `${Math.round((520 * width) / height)}px` : '520px';

	return {
		width,
		height,
		aspectRatio,
		maxWidth,
		style: `--preview-max-width: ${maxWidth}; aspect-ratio: ${aspectRatio};`
	};
}
