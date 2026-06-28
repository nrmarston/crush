<script lang="ts">
	import type { BatchCompressionJobPreview } from './batch-compression-job.svelte';
	import VisualComparison from './VisualComparison.svelte';

	type Props = {
		preview: BatchCompressionJobPreview;
	};

	let { preview } = $props<Props>();
</script>

<div class="focused-result-preview">
	<div class="preview-frame" style={preview.frame.style}>
		{#if preview.comparison}
			<VisualComparison
				originalUrl={preview.comparison.originalUrl}
				outputUrl={preview.comparison.outputUrl}
				imageName={preview.comparison.imageName}
			/>
		{:else if preview.originalUrl}
			<img
				class="preview-image"
				src={preview.originalUrl}
				alt={`Original preview for ${preview.title}`}
			/>
			<div class="preview-status" class:failed={preview.status === 'failed'}>
				{preview.statusLabel}
			</div>
		{:else}
			<div class="preview-fallback">No preview</div>
		{/if}
	</div>
</div>

<style>
	.focused-result-preview {
		min-width: 0;
	}

	.preview-frame {
		position: relative;
		display: grid;
		width: min(100%, var(--preview-max-width));
		max-height: 520px;
		margin-inline: auto;
		overflow: hidden;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		background:
			linear-gradient(45deg, var(--color-checker) 25%, transparent 25%),
			linear-gradient(-45deg, var(--color-checker) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--color-checker) 75%),
			linear-gradient(-45deg, transparent 75%, var(--color-checker) 75%),
			var(--color-neutral);
		background-position:
			0 0,
			0 8px,
			8px -8px,
			-8px 0;
		background-size: 16px 16px;
	}

	.preview-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.preview-frame:focus-within {
		outline: 2px solid var(--color-ink);
		outline-offset: 2px;
	}

	.preview-status,
	.preview-fallback {
		border: 1px solid var(--color-ink);
		border-radius: var(--radius-full);
		padding: 6px 9px;
		background: var(--color-ink);
		color: var(--color-neutral);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
	}

	.preview-status {
		position: absolute;
		right: 10px;
		bottom: 10px;
	}

	.preview-status.failed {
		background: var(--color-neutral);
		color: var(--color-error);
	}

	.preview-fallback {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--color-ink);
		text-align: center;
	}
</style>
