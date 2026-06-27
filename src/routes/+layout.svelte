<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children } = $props();

	const webManifest = pwaInfo?.webManifest?.linkTag ?? '';

	onMount(async () => {
		if (!pwaInfo) {
			return;
		}

		const { registerSW } = await import('virtual:pwa-register');
		registerSW({ immediate: true });
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#f5f0e8" />
	{@html webManifest}
</svelte:head>

{@render children()}

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html) {
		color-scheme: light;
		background: #f5f0e8;
	}

	:global(body) {
		min-width: 320px;
		margin: 0;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(245, 240, 232, 0.68)),
			#f5f0e8;
		color: #17352c;
		font-family:
			Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	:global(button),
	:global(input) {
		font: inherit;
	}

	:global(button),
	:global(a) {
		-webkit-tap-highlight-color: transparent;
	}
</style>
