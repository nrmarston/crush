<script lang="ts">
	import '@phosphor-icons/web/regular';
	import { onMount } from 'svelte';
	import { SvelteTheme } from 'svelte-themes';
	import { pwaInfo } from 'virtual:pwa-info';
	import ThemeColor from '$lib/ThemeColor.svelte';

	let { children } = $props();

	const themes = ['light', 'dark', 'system'] as const;

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
</svelte:head>

<SvelteTheme {themes} defaultTheme="system" attribute="data-theme" disableTransitionOnChange>
	<ThemeColor />
	<a class="skip-link" href="#main">Skip to main content</a>
	{@render children()}
</SvelteTheme>

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
		--color-on-primary: #000000;
		--color-line: #e5e7eb;
		--color-neutral: #ffffff;
		--color-surface: #f7f7f7;
		--color-error: #d92d20;
		--color-success: #166534;
		--color-success-soft: #dcfce7;
		--color-checker: rgba(0, 0, 0, 0.04);
		--shadow-card: 0 24px 70px rgba(0, 0, 0, 0.08);
		--shadow-popover: 0 24px 60px rgba(0, 0, 0, 0.12);
		--brand-logo-filter: none;
		--radius-sm: 4px;
		--radius-md: 8px;
		--radius-full: 9999px;
	}

	:global(html[data-theme='dark']) {
		color-scheme: dark;
		--color-primary: #ff8fdd;
		--color-primary-soft: #4a243f;
		--color-ink: #f7f7f7;
		--color-on-primary: #0c0d10;
		--color-line: #34343a;
		--color-neutral: #1a1a1f;
		--color-surface: #101114;
		--color-error: #ff8a80;
		--color-success: #86efac;
		--color-success-soft: #173621;
		--color-checker: rgba(255, 255, 255, 0.06);
		--shadow-card: 0 24px 70px rgba(0, 0, 0, 0.38);
		--shadow-popover: 0 24px 60px rgba(0, 0, 0, 0.42);
		--brand-logo-filter: brightness(0) invert(1);
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
		touch-action: manipulation;
	}

	:global(.skip-link) {
		position: fixed;
		top: 12px;
		left: 12px;
		z-index: 1000;
		border: 1px solid var(--color-ink);
		border-radius: var(--radius-full);
		min-height: 44px;
		padding: 10px 14px;
		background: var(--color-neutral);
		color: var(--color-ink);
		font-size: 0.85rem;
		font-weight: 700;
		line-height: 1.2;
		text-decoration: none;
		transform: translateY(calc(-100% - 24px));
		transition: transform 150ms ease;
	}

	:global(.skip-link:focus-visible) {
		outline: 2px solid var(--color-ink);
		outline-offset: 3px;
		transform: translateY(0);
	}
</style>
