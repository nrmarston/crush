<script lang="ts">
	import '@phosphor-icons/web/regular';
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children } = $props();

	onMount(async () => {
		if (!pwaInfo) {
			return;
		}

		const { registerSW } = await import('virtual:pwa-register');
		registerSW({ immediate: true });
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="shortcut icon" href="/favicon.ico" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-title" content="Crush" />
	<link rel="manifest" href="/site.webmanifest" />
	<meta name="theme-color" content="#f7f7f7" />
</svelte:head>

{@render children()}

<style>
	@font-face {
		font-family: 'Soehne';
		src: url('/fonts/soehne.woff2') format('woff2');
		font-weight: 400 900;
		font-style: normal;
		font-display: swap;
	}

	:global(:root) {
		--color-primary: #ff83da;
		--color-primary-soft: #ffc5ee;
		--color-ink: #000000;
		--color-line: #e5e7eb;
		--color-neutral: #ffffff;
		--color-surface: #f7f7f7;
		--color-error: #d92d20;
		--radius-sm: 4px;
		--radius-md: 8px;
		--radius-full: 9999px;
	}

	:global(*) {
		box-sizing: border-box;
	}

	:global(html) {
		color-scheme: light;
		background: var(--color-surface);
	}

	:global(body) {
		min-width: 320px;
		margin: 0;
		background: var(--color-surface);
		color: var(--color-ink);
		font-family:
			'Soehne', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
			sans-serif;
	}

	:global(::selection) {
		background: var(--color-primary-soft);
		color: var(--color-ink);
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
