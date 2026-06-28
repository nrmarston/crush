<script lang="ts">
	import type { BatchCompressionJobPreview } from './batch-compression-job.svelte';
	import CompressionStatusBadge from './CompressionStatusBadge.svelte';
	import VisualComparison from './VisualComparison.svelte';

	type Props = {
		preview: BatchCompressionJobPreview;
	};

	let { preview } = $props<Props>();
</script>

<aside class="preview-panel" aria-label="Focused result preview">
	<div class="preview-head">
		<div class="preview-title">
			<span>Preview</span>
			<h2>{preview.title}</h2>
			<p>{preview.details}</p>
		</div>

		<div class="preview-actions">
			<CompressionStatusBadge status={preview.status} label={preview.statusLabel} />
			{#if preview.download}
				<a
					class="preview-download"
					href={preview.download.url}
					download={preview.download.name}
					aria-label={preview.download.label}
				>
					<i class="ph ph-download-simple" aria-hidden="true"></i>
				</a>
			{/if}
		</div>
	</div>

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
</aside>

<style>
	.preview-panel {
		position: sticky;
		top: 16px;
		display: grid;
		min-width: 0;
		gap: 16px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		padding: 18px;
		background: var(--color-neutral);
	}

	.preview-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 16px;
		border-bottom: 1px solid var(--color-line);
		padding-bottom: 14px;
	}

	.preview-title {
		display: grid;
		min-width: 0;
		gap: 4px;
	}

	.preview-title span {
		color: var(--color-muted);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1.35;
	}

	.preview-title h2,
	.preview-title p {
		margin: 0;
	}

	.preview-title h2 {
		overflow-wrap: anywhere;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.2;
	}

	.preview-title p {
		color: var(--color-muted);
		font-size: 0.82rem;
		line-height: 1.35;
	}

	.preview-actions {
		display: flex;
		flex: 0 0 auto;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
	}

	.preview-download {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		min-height: 40px;
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-full);
		padding: 0;
		background: var(--color-primary);
		color: var(--color-on-primary);
		font: inherit;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1.35;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 150ms var(--ease-out),
			border-color 150ms var(--ease-out),
			color 150ms var(--ease-out),
			transform 150ms var(--ease-out);
	}

	.preview-download:focus-visible {
		outline: 2px solid var(--color-ink);
		outline-offset: 3px;
	}

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

	@media (hover: hover) and (pointer: fine) {
		.preview-download:hover {
			background: var(--color-primary-soft);
			transform: translateY(-1px);
		}
	}

	.preview-download:active {
		transform: scale(0.97);
	}

	@media (max-width: 1180px) {
		.preview-panel {
			position: static;
			order: -1;
		}
	}

	@media (max-width: 720px) {
		.preview-panel {
			padding: 16px;
		}

		.preview-head {
			display: grid;
		}

		.preview-actions {
			justify-content: flex-start;
		}
	}
</style>
