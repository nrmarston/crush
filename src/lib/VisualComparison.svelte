<script lang="ts">
	import { EVEN_VISUAL_COMPARISON_SPLIT } from './visual-comparison';

	type Props = {
		originalUrl: string;
		outputUrl: string;
		imageName: string;
		originalWidth?: number;
		originalHeight?: number;
		outputWidth?: number;
		outputHeight?: number;
	};

	let {
		originalUrl,
		outputUrl,
		imageName,
		originalWidth,
		originalHeight,
		outputWidth,
		outputHeight
	}: Props = $props();

	let position = $state(EVEN_VISUAL_COMPARISON_SPLIT);

	function handleInput(event: Event) {
		position = Number((event.currentTarget as HTMLInputElement).value);
	}
</script>

<div class="visual-comparison" style:--reveal={`${position}%`}>
	<img
		class="comparison-image"
		src={originalUrl}
		alt={`Original preview for ${imageName}`}
		width={originalWidth}
		height={originalHeight}
	/>

	<div class="compressed-layer" aria-hidden="true">
		<img
			class="comparison-image"
			src={outputUrl}
			alt=""
			width={outputWidth}
			height={outputHeight}
		/>
	</div>
	<div class="comparison-labels" aria-hidden="true">
		<span>Original</span>
		<span>Compressed</span>
	</div>
	<div class="comparison-divider" aria-hidden="true"></div>
	<input
		class="comparison-range"
		type="range"
		min="0"
		max="100"
		value={position}
		aria-label={`Comparison position for ${imageName}`}
		aria-valuetext={`${Math.round(position)}% original shown`}
		oninput={handleInput}
	/>
</div>

<style>
	.visual-comparison {
		position: absolute;
		inset: 0;
		min-width: 0;
		overflow: hidden;
	}

	.comparison-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.compressed-layer {
		position: absolute;
		inset: 0;
		clip-path: inset(0 0 0 var(--reveal));
	}

	.comparison-labels {
		position: absolute;
		inset: 10px 10px auto;
		display: flex;
		justify-content: space-between;
		gap: 12px;
		pointer-events: none;
	}

	.comparison-labels span {
		border: 1px solid var(--color-ink);
		border-radius: var(--radius-full);
		padding: 6px 9px;
		background: var(--color-ink);
		color: var(--color-neutral);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		max-width: calc(50% - 6px);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.comparison-divider {
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--reveal) - 1px);
		width: 2px;
		background: var(--color-neutral);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.24);
		pointer-events: none;
	}

	.comparison-divider::after {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 28px;
		height: 28px;
		border: 2px solid var(--color-neutral);
		border-radius: var(--radius-full);
		background: var(--color-primary);
		box-shadow: 0 0 0 1px var(--color-ink);
		content: '';
		transform: translate(-50%, -50%);
	}

	.comparison-range {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		cursor: ew-resize;
		opacity: 0;
	}

	.visual-comparison:focus-within {
		outline: 2px solid var(--color-ink);
		outline-offset: 2px;
	}

	.visual-comparison:focus-within .comparison-divider::after {
		box-shadow:
			0 0 0 3px var(--color-primary-soft),
			0 0 0 1px var(--color-ink);
	}
</style>
