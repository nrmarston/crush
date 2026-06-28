import { describe, expect, it } from 'vite-plus/test';
import { EVEN_VISUAL_COMPARISON_SPLIT, createVisualComparisonResetKey } from './visual-comparison';

describe('visual comparison slider state', () => {
	it('creates stable Visual Comparison keys for result changes', () => {
		const heroKey = createVisualComparisonResetKey({
			originalUrl: 'blob:hero-original',
			outputUrl: 'blob:hero-output',
			imageName: 'hero.jpg'
		});
		const badgeKey = createVisualComparisonResetKey({
			originalUrl: 'blob:badge-original',
			outputUrl: 'blob:badge-output',
			imageName: 'badge.png'
		});

		expect(EVEN_VISUAL_COMPARISON_SPLIT).toBe(50);
		expect(heroKey).toBe('blob:hero-original|blob:hero-output|hero.jpg');
		expect(
			createVisualComparisonResetKey({
				originalUrl: 'blob:hero-original',
				outputUrl: 'blob:hero-output',
				imageName: 'hero.jpg'
			})
		).toBe(heroKey);
		expect(badgeKey).not.toBe(heroKey);
	});
});
