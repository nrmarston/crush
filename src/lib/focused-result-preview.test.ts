import { describe, expect, it } from 'vite-plus/test';
import { createFocusedResultPreviewFrame } from './focused-result-preview';

describe('focused result preview framing', () => {
	it('uses original decoded dimensions when output dimensions differ', () => {
		expect(
			createFocusedResultPreviewFrame({
				originalWidth: 3200,
				originalHeight: 1800,
				width: 1600,
				height: 900
			})
		).toEqual({
			width: 3200,
			height: 1800,
			aspectRatio: '3200 / 1800',
			maxWidth: '924px',
			style: '--preview-max-width: 924px; aspect-ratio: 3200 / 1800;'
		});
	});

	it('falls back to output dimensions and then a square frame', () => {
		expect(
			createFocusedResultPreviewFrame({
				width: 640,
				height: 480
			})
		).toMatchObject({
			width: 640,
			height: 480,
			aspectRatio: '640 / 480',
			maxWidth: '693px'
		});

		expect(createFocusedResultPreviewFrame({})).toEqual({
			width: undefined,
			height: undefined,
			aspectRatio: '1 / 1',
			maxWidth: '520px',
			style: '--preview-max-width: 520px; aspect-ratio: 1 / 1;'
		});
	});
});
