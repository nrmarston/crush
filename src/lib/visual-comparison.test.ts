import { describe, expect, it } from 'vite-plus/test';
import {
	EVEN_VISUAL_COMPARISON_SPLIT,
	createVisualComparisonResetKey,
	shouldResetVisualComparisonPosition
} from './visual-comparison';

describe('visual comparison slider state', () => {
	it('opens completed Visual Comparisons at an even split when the result changes', () => {
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
		expect(shouldResetVisualComparisonPosition('', heroKey)).toBe(true);
		expect(shouldResetVisualComparisonPosition(heroKey, heroKey)).toBe(false);
		expect(shouldResetVisualComparisonPosition(heroKey, badgeKey)).toBe(true);
	});
});
