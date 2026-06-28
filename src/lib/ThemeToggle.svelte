<script lang="ts">
	import { useTheme } from 'svelte-themes';

	const theme = useTheme();
	const themeOptions = [
		{ value: 'light', label: 'Use light theme', name: 'Light', icon: 'ph-sun' },
		{ value: 'system', label: 'Use system theme', name: 'System', icon: 'ph-desktop' },
		{ value: 'dark', label: 'Use dark theme', name: 'Dark', icon: 'ph-moon' }
	] as const;
	const selectedTheme = $derived(theme.theme ?? 'system');

	function setTheme(value: (typeof themeOptions)[number]['value']) {
		theme.theme = value;
	}
</script>

<div class="theme-toggle" aria-label="Appearance">
	{#each themeOptions as option (option.value)}
		<button
			type="button"
			class={{ selected: selectedTheme === option.value }}
			aria-label={option.label}
			aria-pressed={selectedTheme === option.value}
			title={option.label}
			onclick={() => setTheme(option.value)}
		>
			<i class={`ph ${option.icon}`} aria-hidden="true"></i>
			<span>{option.name}</span>
		</button>
	{/each}
</div>

<style>
	.theme-toggle {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
		width: 100%;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		padding: 4px;
		background: var(--color-neutral);
	}

	button {
		display: inline-flex;
		min-width: 0;
		min-height: 40px;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: 0;
		border-radius: var(--radius-sm);
		padding: 0 8px;
		background: transparent;
		color: var(--color-muted);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1.2;
		cursor: pointer;
		transition:
			background 150ms cubic-bezier(0.23, 1, 0.32, 1),
			color 150ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	button.selected {
		background: var(--settings-control-selected-background, var(--color-ink));
		color: var(--settings-control-selected-color, var(--color-neutral));
	}

	i {
		flex: 0 0 auto;
		font-size: 1rem;
		line-height: 1;
	}

	span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button:focus-visible {
		outline: 2px solid var(--color-ink);
		outline-offset: 3px;
	}

	@media (hover: hover) and (pointer: fine) {
		button:hover {
			background: var(--settings-control-hover-background, var(--color-primary-soft));
			color: var(--color-ink);
			transform: translateY(-1px);
		}

		button.selected:hover {
			background: var(--settings-control-selected-background, var(--color-ink));
			color: var(--settings-control-selected-color, var(--color-neutral));
		}
	}

	button:active {
		transform: scale(0.96);
	}
</style>
