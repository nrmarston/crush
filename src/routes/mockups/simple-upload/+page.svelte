<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		compressionSettings,
		initializeCompressionSettings,
		setCompressionOutputType,
		setCompressionPreset
	} from '$lib/compression-settings.svelte';
	import { compressImage } from '$lib/compress';
	import { calculateSavingsPercent, formatBytes, formatSavings, labelForOutputType } from '$lib/format';
	import { readImageMetadata } from '$lib/image-metadata';
	import { presets } from '$lib/presets';
	import {
		DEFAULT_OUTPUT_TYPE,
		MAX_FILE_SIZE,
		OUTPUT_TYPES,
		SUPPORTED_INPUT_TYPES,
		type CompressionPreset,
		type CompressionResult,
		type OutputType
	} from '$lib/types';

	type Stage = 'empty' | 'reading' | 'compressing' | 'complete' | 'failed';

	let fileInput = $state<HTMLInputElement>();
	let settingsMenu = $state<HTMLElement>();
	let stage = $state<Stage>('empty');
	let isDragging = $state(false);
	let showSettings = $state(false);
	let resultOutputType = $state<OutputType>(DEFAULT_OUTPUT_TYPE);
	let progress = $state(0);
	let error = $state('');
	let sourceUrl = $state('');
	let outputUrl = $state('');
	let imageName = $state('');
	let originalSize = $state(0);
	let outputSize = $state(0);
	let dimensions = $state('');
	let outputName = $state('');

	let dragDepth = 0;
	let progressTimer: number | undefined;

	const presetId = $derived(compressionSettings.presetId);
	const outputType = $derived(compressionSettings.outputType);
	const selectedPreset = $derived(
		presets.find((preset) => preset.id === presetId) ?? presets[1]
	);
	const isPngOutput = $derived(outputType === 'image/png');
	const activePreset = $derived<CompressionPreset>(
		isPngOutput
			? { ...selectedPreset, outputType, quality: 1, maxWidth: null }
			: { ...selectedPreset, outputType }
	);
	const isBusy = $derived(stage === 'reading' || stage === 'compressing');
	const hasResult = $derived(stage === 'complete' && Boolean(outputUrl));
	const savingsPercent = $derived(calculateSavingsPercent(originalSize, outputSize));
	const compressedBytes = $derived(Math.max(originalSize - outputSize, 0));
	const dropTitle = $derived(
		isDragging
			? 'Release to compress'
			: stage === 'reading'
				? 'Reading image'
				: stage === 'compressing'
					? 'Compressing image'
					: stage === 'complete'
						? 'Compressed successfully'
						: stage === 'failed'
							? 'Choose another image'
							: 'Drag image here'
	);
	const dropCopy = $derived(
		isDragging
			? 'Compression starts as soon as you let go.'
			: stage === 'reading'
				? 'Checking the file before compression.'
				: stage === 'compressing'
					? `Creating a ${labelForOutputType(outputType)} file locally.`
					: stage === 'complete'
						? `${formatBytes(originalSize)} to ${formatBytes(outputSize)}.`
						: stage === 'failed'
							? error
							: 'Click to upload or drop a JPEG, PNG, or WebP.'
	);
	const fileMeta = $derived(
		hasResult
			? `${labelForOutputType(resultOutputType)} - ${dimensions}`
			: dimensions || `Output: ${labelForOutputType(outputType)}`
	);

	onMount(() => {
		initializeCompressionSettings();
	});

	onDestroy(() => {
		clearProgress();
		revokeAssetUrls();
	});

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			showSettings = false;
		}
	}

	function handleWindowClick(event: MouseEvent) {
		if (event.target instanceof Node && settingsMenu?.contains(event.target)) {
			return;
		}

		showSettings = false;
	}

	function toggleSettings() {
		showSettings = !showSettings;
	}

	async function handleInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;

		if (input.files?.[0]) {
			await processFile(input.files[0]);
			input.value = '';
		}
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		dragDepth += 1;
		isDragging = true;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}

		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		isDragging = dragDepth > 0;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		isDragging = false;

		if (event.dataTransfer?.files?.[0]) {
			await processFile(event.dataTransfer.files[0]);
		}
	}

	function openFileBrowser() {
		if (!isBusy) {
			fileInput?.click();
		}
	}

	async function processFile(file: File) {
		clearProgress();
		revokeAssetUrls();

		error = '';
		stage = 'reading';
		progress = 12;
		imageName = file.name || 'Untitled image';
		originalSize = file.size;
		outputSize = 0;
		dimensions = '';
		outputName = '';
		resultOutputType = outputType;

		if (!SUPPORTED_INPUT_TYPES.includes(file.type as (typeof SUPPORTED_INPUT_TYPES)[number])) {
			failWith('Unsupported file. Add a JPEG, PNG, or WebP image.');
			return;
		}

		if (file.size === 0) {
			failWith('This file is empty.');
			return;
		}

		if (file.size > MAX_FILE_SIZE) {
			failWith(`This file is larger than the ${formatBytes(MAX_FILE_SIZE)} limit.`);
			return;
		}

		sourceUrl = URL.createObjectURL(file);
		startProgress(18, 42);

		try {
			const metadata = await readImageMetadata(file);
			dimensions = `${metadata.width} x ${metadata.height}`;

			stage = 'compressing';
			startProgress(44, 88);

			const result = await compressImage(crypto.randomUUID(), file, activePreset);
			completeWith(result);
		} catch (caughtError) {
			failWith(messageFromError(caughtError, 'This image could not be compressed.'));
		}
	}

	function completeWith(result: CompressionResult) {
		clearProgress();

		outputUrl = URL.createObjectURL(result.outputBlob);
		outputName = result.outputName;
		outputSize = result.outputSize;
		originalSize = result.originalSize;
		resultOutputType = result.outputType;
		dimensions = `${result.width} x ${result.height}`;
		progress = 100;
		stage = 'complete';
	}

	function failWith(message: string) {
		clearProgress();
		error = message;
		progress = 0;
		stage = 'failed';
	}

	function startProgress(start: number, ceiling: number) {
		clearProgress();
		progress = start;

		progressTimer = window.setInterval(() => {
			const remaining = ceiling - progress;

			if (remaining <= 0) {
				return;
			}

			progress = Math.min(ceiling, progress + Math.max(1, Math.round(remaining * 0.18)));
		}, 180);
	}

	function clearProgress() {
		if (progressTimer) {
			window.clearInterval(progressTimer);
			progressTimer = undefined;
		}
	}

	function revokeAssetUrls() {
		if (sourceUrl) {
			URL.revokeObjectURL(sourceUrl);
			sourceUrl = '';
		}

		if (outputUrl) {
			URL.revokeObjectURL(outputUrl);
			outputUrl = '';
		}
	}

	function messageFromError(caughtError: unknown, fallback: string): string {
		return caughtError instanceof Error && caughtError.message ? caughtError.message : fallback;
	}
</script>

<svelte:head>
	<title>Crush - Simple Upload Mockup</title>
	<meta
		name="description"
		content="A simplified Crush upload and compression mockup with drag-and-drop, progressive settings, and download state."
	/>
</svelte:head>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<main class="mockup-shell">
	<header class="topline" aria-label="Mockup navigation">
		<a class="brand" href="/">
			<span class="brand-mark" aria-hidden="true">C</span>
			<span>Crush</span>
		</a>

		<div class="settings-menu" bind:this={settingsMenu}>
			<button
				type="button"
				class="icon-button"
				aria-label="Compression settings"
				aria-expanded={showSettings}
				onclick={toggleSettings}
			>
				<i class="ph ph-sliders-horizontal settings-icon" aria-hidden="true"></i>
			</button>

			{#if showSettings}
				<section class="settings-popover" aria-label="Compression settings">
					<div class="popover-head">
						<h2>Settings</h2>
						<p>{labelForOutputType(outputType)} output, {selectedPreset.label.toLowerCase()} preset.</p>
					</div>

					<div class="setting-block">
						<h3>Output</h3>
						<div class="segmented" aria-label="Output format">
							{#each OUTPUT_TYPES as type}
								<button
									type="button"
									class:selected={outputType === type}
									aria-pressed={outputType === type}
									disabled={isBusy}
									onclick={() => setCompressionOutputType(type)}
								>
									{labelForOutputType(type)}
								</button>
							{/each}
						</div>
					</div>

					<div class="setting-block">
						<h3>Compression</h3>
						<div class="preset-list" aria-label="Compression preset">
							{#each presets as preset}
								<button
									type="button"
									class:selected={presetId === preset.id}
									aria-pressed={presetId === preset.id}
									disabled={isBusy || isPngOutput}
									onclick={() => setCompressionPreset(preset.id)}
								>
									<span>{preset.label}</span>
									<small>{preset.description}</small>
								</button>
							{/each}
						</div>
					</div>
				</section>
			{/if}
		</div>
	</header>

	<section class="stage" aria-labelledby="mockup-title">
		<div class="intro">
			<h1 id="mockup-title">Compress an image</h1>
			<p>Big image in. Small image out.</p>
		</div>

		<div class="flow-card">
			<input
				bind:this={fileInput}
				class="file-input"
				type="file"
				hidden
				accept="image/jpeg,image/png,image/webp"
				onchange={handleInputChange}
			/>

			<button
				type="button"
				class="drop-zone"
				class:dragging={isDragging}
				class:busy={isBusy}
				class:complete={hasResult}
				class:failed={stage === 'failed'}
				aria-busy={isBusy}
				onclick={openFileBrowser}
				ondragenter={handleDragEnter}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
			>
				<span class="drop-media" aria-hidden="true">
					{#if sourceUrl}
						<img src={sourceUrl} alt="" />
					{:else}
						<i class="ph ph-upload-simple upload-icon"></i>
					{/if}
				</span>
				<span class="drop-title">{dropTitle}</span>
				<span class="drop-copy">{dropCopy}</span>
				{#if isBusy}
					<span class="progress-track" aria-hidden="true">
						<span style={`width: ${progress}%`}></span>
					</span>
				{/if}
			</button>

			<div class="file-line">
				{#if hasResult}
					<i class="ph ph-check-circle file-mark complete" aria-hidden="true"></i>
				{:else}
					<i class="ph ph-file-image file-mark" aria-hidden="true"></i>
				{/if}
				<span class="file-details">
					<strong>{imageName || 'No image added'}</strong>
					<span>{fileMeta}</span>
				</span>
				<span class="file-size">
					{originalSize ? formatBytes(originalSize) : `${formatBytes(MAX_FILE_SIZE)} max`}
				</span>
			</div>

			{#if hasResult}
				<div class="result-line" aria-live="polite">
					<div>
						<span>Before</span>
						<strong>{formatBytes(originalSize)}</strong>
					</div>
					<div>
						<span>After</span>
						<strong>{formatBytes(outputSize)}</strong>
					</div>
					<div>
						<span>Savings</span>
						<strong>{formatSavings(savingsPercent)}</strong>
					</div>
					<div>
						<span>Compressed</span>
						<strong>{formatBytes(compressedBytes)}</strong>
					</div>
				</div>

				<a class="download-button" href={outputUrl} download={outputName}>Download image</a>
			{/if}
		</div>
	</section>
</main>

<style>
	.mockup-shell {
		--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
		--color-muted: color-mix(in srgb, var(--color-ink) 60%, var(--color-neutral));

		position: relative;
		display: grid;
		min-height: 100svh;
		padding: 30px;
	}

	.topline {
		position: relative;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		height: 40px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--color-ink);
		font-size: 0.88rem;
		font-weight: 700;
		letter-spacing: 0;
		text-decoration: none;
	}

	.brand-mark {
		display: grid;
		width: 30px;
		height: 30px;
		place-items: center;
		border-radius: var(--radius-full);
		background: var(--color-ink);
		color: var(--color-primary);
		font-size: 0.8rem;
	}

	.settings-menu {
		position: relative;
	}

	.icon-button {
		width: 40px;
		min-height: 40px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-full);
		padding: 0;
		background: var(--color-neutral);
		color: var(--color-ink);
	}

	.settings-icon {
		font-size: 1.18rem;
		line-height: 1;
	}

	.settings-popover {
		position: absolute;
		top: calc(100% + 12px);
		right: 0;
		display: grid;
		width: 340px;
		gap: 20px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		padding: 18px;
		background: var(--color-neutral);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.12);
		transform-origin: top right;
	}

	.settings-popover::before {
		position: absolute;
		top: -6px;
		right: 15px;
		width: 12px;
		height: 12px;
		border-top: 1px solid var(--color-line);
		border-left: 1px solid var(--color-line);
		background: var(--color-neutral);
		content: '';
		transform: rotate(45deg);
	}

	.popover-head,
	.setting-block {
		display: grid;
		gap: 10px;
	}

	.stage {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 34px;
		padding: 28px 0 70px;
	}

	.intro {
		display: grid;
		justify-items: center;
		gap: 12px;
		text-align: center;
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	h1 {
		max-width: 560px;
		margin-bottom: 0;
		font-size: 2.65rem;
		font-weight: 700;
		line-height: 1.05;
		letter-spacing: 0;
	}

	h2 {
		margin-bottom: 0;
		font-size: 1.1rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0;
	}

	h3 {
		margin-bottom: 0;
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.35;
		letter-spacing: 0.02em;
	}

	p {
		margin-bottom: 0;
		color: var(--color-ink);
		font-size: 1rem;
		line-height: 1.5;
		letter-spacing: 0.01em;
	}

	.intro p {
		color: var(--color-muted);
	}

	.popover-head p {
		font-size: 0.85rem;
		line-height: 1.45;
	}

	button,
	.download-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 40px;
		border: 1px solid var(--color-ink);
		border-radius: var(--radius-full);
		padding: 0 16px;
		background: var(--color-neutral);
		color: var(--color-ink);
		font: inherit;
		font-size: 0.75rem;
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

	button:focus-visible,
	.download-button:focus-visible {
		outline: 2px solid var(--color-ink);
		outline-offset: 3px;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.52;
	}

	.flow-card {
		display: grid;
		width: min(680px, 100%);
		gap: 18px;
		border-radius: var(--radius-md);
		padding: 28px;
		background: var(--color-neutral);
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.08);
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.drop-zone {
		position: relative;
		display: grid;
		justify-items: center;
		min-height: 230px;
		overflow: hidden;
		border: 1px dashed var(--color-line);
		border-radius: var(--radius-md);
		padding: 34px 28px;
		background: var(--color-neutral);
		text-align: center;
		transition:
			background 150ms var(--ease-out),
			border-color 150ms var(--ease-out),
			transform 150ms var(--ease-out);
		transform-origin: center;
	}

	.drop-zone.dragging {
		border-color: var(--color-ink);
		background: var(--color-primary-soft);
		transform: translateY(-2px) scale(1.005);
	}

	.drop-zone.complete {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 15%, var(--color-neutral));
	}

	.drop-zone.failed {
		border-color: var(--color-error);
		background: var(--color-neutral);
	}

	.drop-media {
		display: grid;
		width: 64px;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border-radius: var(--radius-md);
		margin-bottom: 18px;
		background: color-mix(in srgb, var(--color-primary) 30%, var(--color-neutral));
		transition: transform 180ms var(--ease-out);
		transform-origin: center;
	}

	.drop-media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.92);
	}

	.upload-icon {
		color: var(--color-ink);
		font-size: 2rem;
		line-height: 1;
	}

	.drop-title {
		display: block;
		max-width: 430px;
		color: var(--color-ink);
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1.35;
		letter-spacing: 0;
	}

	.drop-copy {
		display: block;
		max-width: 420px;
		margin-top: 6px;
		color: var(--color-ink);
		font-size: 0.9rem;
		font-weight: 400;
		line-height: 1.45;
		letter-spacing: 0.01em;
	}

	.progress-track {
		position: absolute;
		right: 28px;
		bottom: 24px;
		left: 28px;
		height: 5px;
		overflow: hidden;
		border-radius: var(--radius-full);
		background: var(--color-line);
	}

	.progress-track span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--color-ink);
		transition: width 180ms var(--ease-out);
	}

	.file-line {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 12px;
		align-items: center;
	}

	.file-mark {
		display: grid;
		width: 22px;
		height: 22px;
		place-items: center;
		color: var(--color-ink);
		font-size: 1.38rem;
		line-height: 1;
	}

	.file-mark.complete {
		color: var(--color-primary);
	}

	.file-details {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.file-details strong,
	.file-details span,
	.file-size {
		overflow-wrap: anywhere;
	}

	.file-details strong {
		font-size: 0.95rem;
		line-height: 1.35;
	}

	.file-details span,
	.file-size {
		color: var(--color-muted);
		font-size: 0.83rem;
		line-height: 1.35;
	}

	.file-size {
		justify-self: end;
		white-space: nowrap;
	}

	.result-line {
		display: grid;
		grid-template-columns: repeat(4, minmax(max-content, 1fr));
		gap: 8px;
		border-top: 1px solid var(--color-line);
		padding-top: 18px;
	}

	.result-line div {
		display: grid;
		min-width: 0;
		gap: 4px;
	}

	.result-line span {
		color: var(--color-muted);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1.35;
	}

	.result-line strong {
		overflow-wrap: anywhere;
		font-size: 0.95rem;
		line-height: 1.25;
	}

	.download-button {
		justify-self: center;
		min-width: 180px;
		background: var(--color-primary);
	}

	.segmented {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}

	.segmented button {
		padding: 0 10px;
	}

	.segmented button.selected,
	.preset-list button.selected {
		border-color: var(--color-ink);
		background: var(--color-ink);
		color: var(--color-neutral);
	}

	.preset-list {
		display: grid;
		gap: 8px;
	}

	.preset-list button {
		display: grid;
		justify-items: start;
		min-height: 0;
		border-color: var(--color-line);
		border-radius: var(--radius-md);
		padding: 12px;
		text-align: left;
	}

	.preset-list small {
		margin-top: 4px;
		color: var(--color-ink);
		font-weight: 400;
		line-height: 1.35;
	}

	.preset-list button.selected small {
		color: var(--color-neutral);
		opacity: 0.72;
	}

	@media (prefers-reduced-motion: no-preference) {
		.topline,
		.intro,
		.flow-card {
			animation: rise-in 240ms var(--ease-out) both;
		}

		.intro {
			animation-delay: 40ms;
		}

		.flow-card {
			animation-delay: 80ms;
		}

		.settings-popover {
			animation: popover-in 160ms var(--ease-out) both;
		}

		@keyframes rise-in {
			from {
				opacity: 0;
				transform: translateY(8px);
			}

			to {
				opacity: 1;
				transform: translateY(0);
			}
		}

		@keyframes popover-in {
			from {
				opacity: 0;
				transform: translateY(-4px) scale(0.98);
			}

			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}
	}

	@media (hover: hover) and (pointer: fine) {
		button:hover:not(:disabled):not(.drop-zone),
		.download-button:hover {
			background: var(--color-primary-soft);
			transform: translateY(-1px);
		}
	}

	button:active:not(:disabled):not(.drop-zone),
	.download-button:active {
		transform: scale(0.97);
	}

	.drop-zone:active:not(:disabled) {
		transform: scale(0.995);
	}

	@media (prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) {
		.drop-zone:hover:not(:disabled) .drop-media {
			transform: translateY(-4px) scale(1.02);
		}
	}

	@media (max-width: 720px) {
		.mockup-shell {
			padding: 20px 10px 34px;
		}

		.stage {
			gap: 26px;
			padding-top: 22px;
		}

		.settings-popover {
			right: 0;
			width: min(340px, calc(100vw - 20px));
		}

		h1 {
			font-size: 2.25rem;
		}

		.flow-card {
			padding: 20px;
		}

		.drop-zone {
			min-height: 230px;
			padding: 30px 20px;
		}

		.file-line {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.file-size {
			grid-column: 2;
			justify-self: start;
		}

		.segmented {
			grid-template-columns: 1fr;
		}

		.result-line {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
