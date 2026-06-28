<script lang="ts">
	type Props = {
		status: 'reading' | 'waiting' | 'compressing' | 'complete' | 'failed';
		label: string;
	};

	let { status, label }: Props = $props();
</script>

<span class="status-badge {status}">{label}</span>

<style>
	.status-badge {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-full);
		padding: 4px 8px;
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: 0.66rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.status-badge.complete {
		border-color: #166534;
		background: #dcfce7;
		color: #166534;
	}

	.status-badge.failed {
		border-color: var(--color-error);
		background: var(--color-neutral);
		color: var(--color-error);
	}
</style>
