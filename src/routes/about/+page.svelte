<script lang="ts">
	import { absoluteUrl, socialImageUrl } from '$lib/seo';

	const pageUrl = absoluteUrl('/about');
	const pageTitle = 'About Crush - Private Local Image Compression';
	const pageDescription =
		'Learn how Crush compresses JPEG, PNG, and WebP locally in your browser with offline-ready batch compression and AVIF, WebP, JPEG, or PNG exports.';
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<link rel="canonical" href={pageUrl} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:image" content={socialImageUrl} />
	<meta property="og:image:alt" content="Crush local image compressor app icon" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<meta name="twitter:image" content={socialImageUrl} />
	<meta name="twitter:image:alt" content="Crush local image compressor app icon" />
</svelte:head>

<main id="main" class="about-shell" tabindex="-1">
	<header class="about-nav">
		<nav class="about-nav-inner" aria-label="Primary">
			<a class="brand" href="/">
				<img src="/crush-logo.svg" alt="Crush" width="101" height="33" />
			</a>
			<a class="app-link" href="/">Open app</a>
		</nav>
	</header>

	<section class="about-hero" aria-labelledby="about-title">
		<p class="eyebrow">Private local image compression</p>
		<h1 id="about-title">Small image files. No upload step.</h1>
		<p>
			Crush compresses JPEG, PNG, and WebP images in your browser so source files
			stay on your device while you prepare production-ready web assets.
		</p>
	</section>

	<section class="detail-list" aria-label="Crush details">
		<article>
			<h2>Private by default</h2>
			<p>
				Compression runs locally with browser APIs, Web Workers, and WASM encoders
				instead of a server upload flow.
			</p>
		</article>
		<article>
			<h2>Offline-ready</h2>
			<p>
				After the first successful load, the PWA can reload offline so routine image
				prep can continue without a network connection.
			</p>
		</article>
		<article>
			<h2>Batch focused</h2>
			<p>
				Drop multiple images, watch per-file progress, compare savings, and download
				results individually or as a ZIP.
			</p>
		</article>
	</section>

	<section class="format-block" aria-labelledby="formats-title">
		<div>
			<p class="eyebrow">Format support</p>
			<h2 id="formats-title">Output choices for real web delivery.</h2>
		</div>
		<dl>
			<div>
				<dt>Inputs</dt>
				<dd>JPEG, PNG, WebP</dd>
			</div>
			<div>
				<dt>Outputs</dt>
				<dd>AVIF, WebP, JPEG, lossless PNG</dd>
			</div>
			<div>
				<dt>Presets</dt>
				<dd>High Quality, Balanced, Smallest File</dd>
			</div>
		</dl>
	</section>

	<section class="about-cta" aria-label="Start compressing images">
		<a class="primary-link" href="/">Compress images</a>
	</section>
</main>

<style>
	.about-shell {
		--color-muted: color-mix(in srgb, var(--color-ink) 60%, var(--color-neutral));

		display: grid;
		min-height: 100svh;
		gap: clamp(3rem, 8vw, 6rem);
		padding: 16px 16px clamp(3rem, 8vw, 6rem);
	}

	.about-nav,
	.about-hero,
	.detail-list,
	.format-block,
	.about-cta {
		width: min(1120px, 100%);
		margin-inline: auto;
	}

	.about-nav {
		height: 44px;
		padding-inline: 1rem;
	}

	.about-nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		height: 100%;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}

	.brand img {
		display: block;
		width: 100%;
		max-width: 80px;
		height: auto;
		filter: var(--brand-logo-filter);
	}

	.app-link,
	.primary-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		border: 1px solid var(--color-ink);
		border-radius: var(--radius-full);
		padding: 0 16px;
		color: var(--color-ink);
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.35;
		text-decoration: none;
		touch-action: manipulation;
	}

	.about-hero {
		display: grid;
		max-width: 760px;
		gap: 18px;
		text-align: center;
	}

	.eyebrow,
	p,
	dt,
	dd {
		margin: 0;
	}

	.eyebrow {
		color: var(--color-muted);
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.35;
	}

	h1,
	h2 {
		margin: 0;
		letter-spacing: 0;
	}

	h1 {
		font-size: 4.75rem;
		font-weight: 700;
		line-height: 0.98;
	}

	h2 {
		font-size: 1.35rem;
		font-weight: 700;
		line-height: 1.15;
	}

	p,
	dd {
		color: var(--color-muted);
		font-size: 1rem;
		line-height: 1.55;
	}

	.detail-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 24px;
		border-top: 1px solid var(--color-line);
		padding-top: 22px;
	}

	.detail-list article {
		display: grid;
		gap: 10px;
		min-width: 0;
	}

	.format-block {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		gap: 32px;
		align-items: start;
		border-top: 1px solid var(--color-line);
		padding-top: 22px;
	}

	.format-block > div {
		display: grid;
		gap: 10px;
	}

	dl {
		display: grid;
		gap: 14px;
		margin: 0;
	}

	dl div {
		display: grid;
		grid-template-columns: 140px minmax(0, 1fr);
		gap: 16px;
		border-bottom: 1px solid var(--color-line);
		padding-bottom: 14px;
	}

	dt {
		font-size: 0.86rem;
		font-weight: 700;
		line-height: 1.35;
	}

	.about-cta {
		display: flex;
		justify-content: center;
	}

	.primary-link {
		background: var(--color-ink);
		color: var(--color-neutral);
	}

	.app-link:focus-visible,
	.primary-link:focus-visible {
		outline: 2px solid var(--color-ink);
		outline-offset: 3px;
	}

	.brand:focus-visible {
		border-radius: var(--radius-sm);
		outline: 2px solid var(--color-ink);
		outline-offset: 5px;
	}

	@media (hover: hover) and (pointer: fine) {
		.app-link:hover,
		.primary-link:hover {
			background: var(--color-primary-soft);
			color: var(--color-ink);
		}
	}

	@media (max-width: 760px) {
		.about-shell {
			gap: 3rem;
			padding-inline: 10px;
		}

		h1 {
			font-size: 3rem;
		}

		.detail-list,
		.format-block {
			grid-template-columns: 1fr;
		}

		dl div {
			grid-template-columns: 1fr;
			gap: 4px;
		}
	}
</style>
