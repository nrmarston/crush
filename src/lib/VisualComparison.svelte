<script lang="ts">
	import type { CompressionStatus } from '$lib/types';

	type Props = {
		originalUrl?: string;
		outputUrl?: string;
		imageName: string;
		status: CompressionStatus;
		statusLabel: string;
		width?: number;
		height?: number;
	};

	let { originalUrl, outputUrl, imageName, status, statusLabel, width, height } =
		$props<Props>();

	let position = $state(50);
	let previousOutputUrl = $state<string | undefined>();

	const aspectRatio = $derived(width && height ? `${width} / ${height}` : '1 / 1');
	const comparisonMaxWidth = $derived(
		width && height ? `${Math.round((360 * width) / height)}px` : '360px'
	);
	const comparisonStyle = $derived(
		`--reveal: ${position}%; --comparison-max-width: ${comparisonMaxWidth}; aspect-ratio: ${aspectRatio};`
	);

	$effect(() => {
		if (outputUrl === previousOutputUrl) {
			return;
		}

		position = 50;
		previousOutputUrl = outputUrl;
	});

	function handleInput(event: Event) {
		position = Number((event.currentTarget as HTMLInputElement).value);
	}
</script>

<div class="visual-comparison">
	<div class="comparison-frame" style={comparisonStyle}>
		{#if originalUrl}
			<img
				class="comparison-image"
				src={originalUrl}
				alt={`Original preview for ${imageName}`}
			/>
		{:else}
			<div class="preview-fallback">No preview</div>
		{/if}

		{#if outputUrl}
			<div class="compressed-layer" aria-hidden="true">
				<img class="comparison-image" src={outputUrl} alt="" />
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
		{:else if originalUrl}
			<div class="preview-status" class:failed={status === 'failed'}>{statusLabel}</div>
		{/if}
	</div>
</div>

<style>
	.visual-comparison {
		min-width: 0;
	}

	.comparison-frame {
		position: relative;
		display: grid;
		place-items: center;
		width: min(100%, var(--comparison-max-width));
		max-height: 360px;
		margin-inline: auto;
		overflow: hidden;
		border: 1px solid rgba(23, 53, 44, 0.12);
		border-radius: 6px;
		background:
			linear-gradient(45deg, rgba(23, 53, 44, 0.05) 25%, transparent 25%),
			linear-gradient(-45deg, rgba(23, 53, 44, 0.05) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, rgba(23, 53, 44, 0.05) 75%),
			linear-gradient(-45deg, transparent 75%, rgba(23, 53, 44, 0.05) 75%),
			#edf1eb;
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
		background-size: 16px 16px;
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

	.comparison-labels span,
	.preview-status,
	.preview-fallback {
		border: 1px solid rgba(23, 53, 44, 0.16);
		border-radius: 999px;
		padding: 6px 9px;
		background: rgba(255, 255, 255, 0.86);
		color: #17352c;
		font-size: 0.72rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	.comparison-labels span {
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
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 0 0 1px rgba(23, 53, 44, 0.22);
		pointer-events: none;
	}

	.comparison-divider::after {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 28px;
		height: 28px;
		border: 2px solid #ffffff;
		border-radius: 999px;
		background: #2f8f68;
		box-shadow: 0 10px 24px rgba(23, 53, 44, 0.22);
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

	.comparison-frame:focus-within {
		outline: 2px solid #2f8f68;
		outline-offset: 2px;
	}

	.comparison-frame:focus-within .comparison-divider::after {
		box-shadow:
			0 0 0 3px rgba(47, 143, 104, 0.22),
			0 10px 24px rgba(23, 53, 44, 0.22);
	}

	.preview-status {
		position: absolute;
		right: 10px;
		bottom: 10px;
	}

	.preview-status.failed {
		color: #8f352c;
	}

	.preview-fallback {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: #62746d;
		text-align: center;
	}
</style>
