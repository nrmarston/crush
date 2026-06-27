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
		MAX_BATCH_SIZE,
		MAX_FILE_SIZE,
		OUTPUT_TYPES,
		SUPPORTED_INPUT_TYPES,
		type CompressionPreset,
		type CompressionResult,
		type PresetId
	} from '$lib/types';
	import { createZip } from '$lib/zip';

	type QueueItemStatus = 'reading' | 'waiting' | 'compressing' | 'complete' | 'failed';

	type QueueItem = {
		id: string;
		file?: File;
		originalName: string;
		originalType: string;
		originalSize: number;
		width?: number;
		height?: number;
		status: QueueItemStatus;
		progress: number;
		preset: CompressionPreset;
		originalUrl?: string;
		outputUrl?: string;
		result?: CompressionResult;
		error?: string;
	};

	type CompletedQueueItem = QueueItem & {
		file: File;
		outputUrl: string;
		result: CompressionResult;
	};

	const statusLabels: Record<QueueItemStatus, string> = {
		reading: 'Reading',
		waiting: 'Waiting',
		compressing: 'Compressing',
		complete: 'Complete',
		failed: 'Failed'
	};

	const presetIcons: Record<PresetId, string> = {
		quality: 'ph-sparkle',
		balanced: 'ph-scales',
		smallest: 'ph-file-archive'
	};

	let fileInput = $state<HTMLInputElement>();
	let settingsMenu = $state<HTMLElement>();
	let items = $state<QueueItem[]>([]);
	let isDragging = $state(false);
	let showSettings = $state(false);
	let isProcessing = $state(false);
	let isZipping = $state(false);
	let queueError = $state('');
	let zipError = $state('');

	let dragDepth = 0;
	const progressTimers = new Map<string, number>();

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
	const completedItems = $derived(items.filter(isCompleted));
	const failedCount = $derived(items.filter((item) => item.status === 'failed').length);
	const isBusy = $derived(
		isProcessing ||
			items.some(
				(item) =>
					item.status === 'reading' ||
					item.status === 'waiting' ||
					item.status === 'compressing'
			)
	);
	const remainingSlots = $derived(Math.max(MAX_BATCH_SIZE - items.length, 0));
	const totalOriginalSize = $derived(
		completedItems.reduce((total, item) => total + item.result.originalSize, 0)
	);
	const totalOutputSize = $derived(
		completedItems.reduce((total, item) => total + item.result.outputSize, 0)
	);
	const totalSavingsPercent = $derived(
		calculateSavingsPercent(totalOriginalSize, totalOutputSize)
	);
	const compressedBytes = $derived(Math.max(totalOriginalSize - totalOutputSize, 0));
	const featuredItem = $derived(
		items.find((item) => item.status === 'compressing') ??
			items.find((item) => item.status === 'reading') ??
			[...items].reverse().find((item) => item.originalUrl) ??
			items[0]
	);
	const featuredProgress = $derived(featuredItem?.progress ?? 0);
	const dropTitle = $derived(
		isDragging
			? 'Release to compress'
			: isBusy
				? 'Compression in progress'
				: completedItems.length > 0
					? 'Add more images'
					: items.length > 0
						? 'Review image list'
						: 'Drag images here'
	);
	const dropCopy = $derived(
		isDragging
			? `Add up to ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}.`
			: isBusy && featuredItem
				? `${statusLabels[featuredItem.status]} ${featuredItem.originalName}.`
				: remainingSlots === 0
					? `Batch limit reached: ${MAX_BATCH_SIZE} images.`
					: items.length > 0
						? `${completedItems.length} complete, ${failedCount} failed, ${remainingSlots} slots open.`
						: `Click to choose or drop JPEG, PNG, or WebP files. ${formatBytes(MAX_FILE_SIZE)} each.`
	);
	const batchStatus = $derived(
		items.length === 0
			? `${MAX_BATCH_SIZE} image batch limit`
			: `${completedItems.length} complete / ${items.length} total`
	);

	onMount(() => {
		initializeCompressionSettings();
	});

	onDestroy(() => {
		clearAllProgress();
		revokeQueueUrls(items);
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

		if (input.files) {
			await queueFiles(input.files);
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

		if (event.dataTransfer?.files) {
			await queueFiles(event.dataTransfer.files);
		}
	}

	function openFileBrowser() {
		fileInput?.click();
	}

	async function queueFiles(fileList: FileList | File[]) {
		const incoming = Array.from(fileList);

		if (incoming.length === 0) {
			return;
		}

		queueError = '';
		zipError = '';

		const slotsAvailable = MAX_BATCH_SIZE - items.length;

		if (slotsAvailable <= 0) {
			queueError = `Crush can handle up to ${MAX_BATCH_SIZE} images in one batch.`;
			return;
		}

		const selectedFiles = incoming.slice(0, slotsAvailable);

		if (incoming.length > selectedFiles.length) {
			queueError = `Only the first ${selectedFiles.length} files were added. The batch limit is ${MAX_BATCH_SIZE}.`;
		}

		const queuedItems = selectedFiles.map((file) => createQueuedItem(file, activePreset));
		items = [...items, ...queuedItems];

		for (let index = 0; index < selectedFiles.length; index += 1) {
			await prepareQueuedFile(queuedItems[index].id, selectedFiles[index]);
		}

		void processQueue();
	}

	function createQueuedItem(file: File, preset: CompressionPreset): QueueItem {
		return {
			id: crypto.randomUUID(),
			originalName: file.name || 'Untitled image',
			originalType: file.type || 'Unknown',
			originalSize: file.size,
			status: 'reading',
			progress: 12,
			preset: clonePreset(preset)
		};
	}

	function clonePreset(preset: CompressionPreset): CompressionPreset {
		return {
			id: preset.id,
			label: preset.label,
			description: preset.description,
			outputType: preset.outputType,
			quality: preset.quality,
			maxWidth: preset.maxWidth
		};
	}

	async function prepareQueuedFile(id: string, file: File) {
		startItemProgress(id, 12, 42);

		if (!SUPPORTED_INPUT_TYPES.includes(file.type as (typeof SUPPORTED_INPUT_TYPES)[number])) {
			failQueuedFile(id, 'Unsupported file. Add a JPEG, PNG, or WebP image.');
			return;
		}

		if (file.size === 0) {
			failQueuedFile(id, 'This file is empty.');
			return;
		}

		if (file.size > MAX_FILE_SIZE) {
			failQueuedFile(id, `This file is larger than the ${formatBytes(MAX_FILE_SIZE)} limit.`);
			return;
		}

		const originalUrl = URL.createObjectURL(file);

		try {
			const metadata = await readImageMetadata(file);

			clearItemProgress(id);
			updateItem(id, (item) => ({
				...item,
				file,
				originalType: metadata.type,
				width: metadata.width,
				height: metadata.height,
				status: 'waiting',
				progress: 44,
				originalUrl
			}));
		} catch {
			URL.revokeObjectURL(originalUrl);
			failQueuedFile(id, 'This image could not be read. It may be corrupt or unsupported.');
		}
	}

	async function processQueue() {
		if (isProcessing) {
			return;
		}

		isProcessing = true;

		try {
			while (true) {
				const nextItem = items.find((item) => item.status === 'waiting' && item.file);

				if (!nextItem?.file) {
					break;
				}

				await compressQueuedItem(nextItem.id, nextItem.file, clonePreset(nextItem.preset));
			}
		} finally {
			isProcessing = false;
		}
	}

	async function compressQueuedItem(id: string, file: File, preset: CompressionPreset) {
		updateItem(id, (item) => {
			if (item.outputUrl) {
				URL.revokeObjectURL(item.outputUrl);
			}

			return {
				...item,
				status: 'compressing',
				progress: 48,
				outputUrl: undefined,
				result: undefined,
				error: undefined
			};
		});
		startItemProgress(id, 48, 88);

		try {
			const result = await compressImage(id, file, preset);
			const outputUrl = URL.createObjectURL(result.outputBlob);

			clearItemProgress(id);

			if (!items.some((item) => item.id === id)) {
				URL.revokeObjectURL(outputUrl);
				return;
			}

			updateItem(id, (item) => ({
				...item,
				status: 'complete',
				progress: 100,
				width: result.width,
				height: result.height,
				outputUrl,
				result
			}));
		} catch (caughtError) {
			failQueuedFile(
				id,
				messageFromError(
					caughtError,
					'This image could not be compressed. Try a smaller file or a different format.'
				)
			);
		}
	}

	async function downloadZip() {
		if (completedItems.length === 0 || isZipping) {
			return;
		}

		isZipping = true;
		zipError = '';

		try {
			const zip = await createZip(
				completedItems.map((item) => ({
					name: item.result.outputName,
					blob: item.result.outputBlob
				}))
			);

			downloadBlob(zip, 'crush-results.zip');
		} catch (caughtError) {
			zipError = messageFromError(caughtError, 'The ZIP file could not be created.');
		} finally {
			isZipping = false;
		}
	}

	function removeItem(id: string) {
		const item = items.find((candidate) => candidate.id === id);

		if (!item || item.status === 'reading' || item.status === 'compressing') {
			return;
		}

		clearItemProgress(id);
		revokeItemUrls(item);
		items = items.filter((candidate) => candidate.id !== id);
		queueError = '';
		zipError = '';
	}

	function clearQueue() {
		if (isBusy) {
			return;
		}

		clearAllProgress();
		revokeQueueUrls(items);
		items = [];
		queueError = '';
		zipError = '';
	}

	function failQueuedFile(id: string, message: string) {
		clearItemProgress(id);
		updateItem(id, (item) => ({
			...item,
			status: 'failed',
			progress: 0,
			error: message
		}));
	}

	function startItemProgress(id: string, start: number, ceiling: number) {
		clearItemProgress(id);
		updateItem(id, (item) => ({
			...item,
			progress: start
		}));

		const timer = window.setInterval(() => {
			updateItem(id, (item) => {
				const remaining = ceiling - item.progress;

				if (remaining <= 0) {
					return item;
				}

				return {
					...item,
					progress: Math.min(ceiling, item.progress + Math.max(1, Math.round(remaining * 0.18)))
				};
			});
		}, 180);

		progressTimers.set(id, timer);
	}

	function clearItemProgress(id: string) {
		const timer = progressTimers.get(id);

		if (!timer) {
			return;
		}

		window.clearInterval(timer);
		progressTimers.delete(id);
	}

	function clearAllProgress() {
		for (const timer of progressTimers.values()) {
			window.clearInterval(timer);
		}

		progressTimers.clear();
	}

	function updateItem(id: string, updater: (item: QueueItem) => QueueItem) {
		items = items.map((item) => (item.id === id ? updater(item) : item));
	}

	function isCompleted(item: QueueItem): item is CompletedQueueItem {
		return item.status === 'complete' && Boolean(item.file && item.outputUrl && item.result);
	}

	function isActive(item: QueueItem): boolean {
		return item.status === 'reading' || item.status === 'compressing';
	}

	function isLarger(item: QueueItem): boolean {
		return isCompleted(item) && item.result.outputSize > item.result.originalSize;
	}

	function isAlreadyOptimized(item: QueueItem): boolean {
		return isCompleted(item) && item.result.note === 'already-optimized';
	}

	function dimensionsFor(item: QueueItem): string {
		if (!item.width || !item.height) {
			return '-';
		}

		return `${item.width} x ${item.height}`;
	}

	function detailsFor(item: QueueItem): string {
		if (isCompleted(item)) {
			return `${labelForOutputType(item.result.outputType)} - ${dimensionsFor(item)}`;
		}

		if (item.status === 'compressing') {
			return `Creating a ${labelForOutputType(item.preset.outputType)} file locally.`;
		}

		if (item.status === 'waiting') {
			return `${typeLabel(item.originalType)} input - queued for ${labelForOutputType(
				item.preset.outputType
			)}`;
		}

		if (item.status === 'reading') {
			return `Reading ${typeLabel(item.originalType)} input.`;
		}

		return typeLabel(item.originalType);
	}

	function typeLabel(type: string): string {
		if (type === 'image/jpeg') {
			return 'JPEG';
		}

		if (type === 'image/png') {
			return 'PNG';
		}

		if (type === 'image/avif') {
			return 'AVIF';
		}

		if (type === 'image/webp') {
			return 'WebP';
		}

		return type || 'Unknown';
	}

	function downloadBlob(blob: Blob, fileName: string) {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');

		anchor.href = url;
		anchor.download = fileName;
		anchor.rel = 'noopener';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();

		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	function revokeQueueUrls(queueItems: QueueItem[]) {
		for (const item of queueItems) {
			revokeItemUrls(item);
		}
	}

	function revokeItemUrls(item: QueueItem) {
		if (item.originalUrl) {
			URL.revokeObjectURL(item.originalUrl);
		}

		if (item.outputUrl) {
			URL.revokeObjectURL(item.outputUrl);
		}
	}

	function messageFromError(caughtError: unknown, fallback: string): string {
		return caughtError instanceof Error && caughtError.message ? caughtError.message : fallback;
	}
</script>

<svelte:head>
	<title>Crush - Local Image Compression</title>
	<meta
		name="description"
		content="Compress JPEG, PNG, and WebP images locally with drag-and-drop, per-file progress, and batch download state."
	/>
</svelte:head>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<main class="app-shell">
	<header class="topline" aria-label="Primary navigation">
		<div class="nav-container">
			<a class="brand" href="/">
				<img src="/crush-logo.svg" alt="Crush" />
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
										<span class="preset-icon" aria-hidden="true">
											<i class={`ph ${presetIcons[preset.id]}`}></i>
										</span>
										<span class="preset-copy">
											<span>{preset.label}</span>
											<small>{preset.description}</small>
										</span>
									</button>
								{/each}
							</div>
						</div>
					</section>
				{/if}
			</div>
		</div>
	</header>

	<section class="stage" aria-labelledby="app-title">
		<div class="intro">
			<h1 id="app-title">Compress images</h1>
			<p>Big images in. Small files out.</p>
		</div>

		<div class="flow-card">
			<input
				bind:this={fileInput}
				class="file-input"
				type="file"
				hidden
				multiple
				accept="image/jpeg,image/png,image/webp"
				onchange={handleInputChange}
			/>

			<button
				type="button"
				class="drop-zone"
				class:dragging={isDragging}
				class:busy={isBusy}
				class:complete={completedItems.length > 0 && !isBusy}
				class:failed={items.length > 0 && failedCount === items.length}
				aria-busy={isBusy}
				onclick={openFileBrowser}
				ondragenter={handleDragEnter}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
			>
				<span class="drop-media" aria-hidden="true">
					{#if featuredItem?.originalUrl}
						<img src={featuredItem.originalUrl} alt="" />
					{:else}
						<i class="ph ph-images-square drop-icon"></i>
					{/if}
				</span>
				<span class="drop-title">{dropTitle}</span>
				<span class="drop-copy">{dropCopy}</span>
				{#if isBusy}
					<span class="progress-track" aria-hidden="true">
						<span style={`width: ${featuredProgress}%`}></span>
					</span>
				{/if}
			</button>

			<div class="queue-head">
				<div class="file-line">
					<i class="ph ph-stack file-mark" aria-hidden="true"></i>
					<span class="file-details">
						<strong>{items.length ? `${items.length} image${items.length === 1 ? '' : 's'}` : 'No images added'}</strong>
						<span>{batchStatus}</span>
					</span>
					<span class="file-size">{formatBytes(MAX_FILE_SIZE)} max</span>
				</div>

				<div class="queue-actions">
					<button
						type="button"
						disabled={completedItems.length === 0 || isZipping}
						onclick={downloadZip}
					>
						{isZipping ? 'Preparing ZIP' : 'Download ZIP'}
					</button>
					<button type="button" disabled={items.length === 0 || isBusy} onclick={clearQueue}>
						Clear
					</button>
				</div>
			</div>

			{#if queueError}
				<p class="notice error">{queueError}</p>
			{/if}

			{#if zipError}
				<p class="notice error">{zipError}</p>
			{/if}

			{#if completedItems.length > 0}
				<div class="result-line" aria-live="polite">
					<div>
						<span>Files</span>
						<strong>{completedItems.length}</strong>
					</div>
					<div>
						<span>Before</span>
						<strong>{formatBytes(totalOriginalSize)}</strong>
					</div>
					<div>
						<span>After</span>
						<strong>{formatBytes(totalOutputSize)}</strong>
					</div>
					<div>
						<span>Savings</span>
						<strong>{formatSavings(totalSavingsPercent)}</strong>
					</div>
					<div>
						<span>Compressed</span>
						<strong>{formatBytes(compressedBytes)}</strong>
					</div>
				</div>
			{/if}

			{#if items.length > 0}
				<section class="file-list" aria-label="Compression progress" aria-live="polite">
					{#each items as item (item.id)}
						<article class="file-row {item.status}" class:warning={isLarger(item)}>
							<span class="file-thumb" aria-hidden="true">
								{#if item.originalUrl}
									<img src={item.originalUrl} alt="" />
								{:else}
									<i class="ph ph-file-image"></i>
								{/if}
							</span>

							<div class="row-main">
								<div class="row-title">
									<strong>{item.originalName}</strong>
									<span class="status-badge">{statusLabels[item.status]}</span>
								</div>
								<span class="row-meta">{detailsFor(item)}</span>

								{#if item.status !== 'failed' && item.status !== 'complete'}
									<span
										class="row-progress"
										aria-label={`Compression progress for ${item.originalName}`}
									>
										<span style={`width: ${item.progress}%`}></span>
									</span>
								{/if}

								{#if item.error}
									<span class="row-notice error">{item.error}</span>
								{/if}

								{#if isLarger(item)}
									<span class="row-notice warn">The compressed file is larger than the original.</span>
								{/if}

								{#if isAlreadyOptimized(item)}
									<span class="row-notice neutral">Already optimized; original PNG kept.</span>
								{/if}
							</div>

							<dl class="row-metrics">
								<div>
									<dt>Before</dt>
									<dd>{formatBytes(item.originalSize)}</dd>
								</div>
								<div>
									<dt>After</dt>
									<dd>{isCompleted(item) ? formatBytes(item.result.outputSize) : '-'}</dd>
								</div>
								<div>
									<dt>Savings</dt>
									<dd>{isCompleted(item) ? formatSavings(item.result.savingsPercent) : '-'}</dd>
								</div>
							</dl>

							<div class="row-actions">
								{#if isCompleted(item)}
									<a
										class="row-download"
										href={item.outputUrl}
										download={item.result.outputName}
										aria-label={`Download ${item.result.outputName}`}
									>
										<i class="ph ph-download-simple" aria-hidden="true"></i>
									</a>
								{/if}
								<button
									type="button"
									class="row-remove"
									disabled={isActive(item)}
									aria-label={`Remove ${item.originalName}`}
									onclick={() => removeItem(item.id)}
								>
									<i class="ph ph-x" aria-hidden="true"></i>
								</button>
							</div>
						</article>
					{/each}
				</section>
			{/if}
		</div>
	</section>
</main>

<style>
	.app-shell {
		--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
		--color-muted: color-mix(in srgb, var(--color-ink) 60%, var(--color-neutral));

		position: relative;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 100svh;
		padding: 16px;
	}

	.nav-container {
		width: 100%;
		max-width: 120rem;
		margin-inline: auto;
		padding-inline: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;

		/* I want the padding inline to  */
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
		color: var(--color-ink);
		font-size: 0.88rem;
		font-weight: 700;
		letter-spacing: 0;
		text-decoration: none;
	}

	.brand img {
		display: block;
		width: 100%;
		max-width: 100px;
		height: auto;
	}

	.settings-menu {
		position: relative;
	}

	.icon-button,
	.row-download,
	.row-remove {
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
		padding: 28px 1rem 70px 1rem;
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
	.row-download {
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
	.row-download:focus-visible {
		outline: 2px solid var(--color-ink);
		outline-offset: 3px;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.52;
	}

	.flow-card {
		display: grid;
		width: min(760px, 100%);
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
		min-height: 220px;
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

	.drop-media img,
	.file-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.92);
	}

	.drop-icon {
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
		max-width: 430px;
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

	.progress-track span,
	.row-progress span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--color-ink);
		transition: width 180ms var(--ease-out);
	}

	.queue-head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 14px;
		align-items: center;
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

	.queue-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
	}

	.notice {
		border-radius: var(--radius-md);
		margin-bottom: 0;
		padding: 12px 14px;
		font-weight: 700;
		line-height: 1.45;
	}

	.notice.error {
		background: color-mix(in srgb, var(--color-error) 9%, var(--color-neutral));
		color: var(--color-error);
	}

	.result-line {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
		border-top: 1px solid var(--color-line);
		padding-top: 18px;
	}

	.result-line div {
		display: grid;
		min-width: 0;
		gap: 4px;
	}

	.result-line span,
	.row-metrics dt {
		color: var(--color-muted);
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1.35;
	}

	.result-line strong,
	.row-metrics dd {
		overflow-wrap: anywhere;
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.file-list {
		display: grid;
		max-height: min(430px, 42svh);
		gap: 10px;
		overflow-y: auto;
		padding-right: 4px;
		scrollbar-width: thin;
	}

	.file-row {
		display: grid;
		grid-template-columns: 46px minmax(0, 1fr) minmax(190px, auto) auto;
		gap: 12px;
		align-items: center;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		padding: 12px;
		background: var(--color-neutral);
		transition:
			border-color 150ms var(--ease-out),
			transform 150ms var(--ease-out);
	}

	.file-row.compressing {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 9%, var(--color-neutral));
	}

	.file-row.complete {
		border-color: color-mix(in srgb, var(--color-primary) 42%, var(--color-line));
	}

	.file-row.failed {
		border-color: var(--color-error);
	}

	.file-row.warning {
		border-color: var(--color-primary);
	}

	.file-thumb {
		display: grid;
		width: 46px;
		aspect-ratio: 1;
		place-items: center;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: 1.35rem;
	}

	.row-main {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.row-title {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.row-title strong {
		min-width: 0;
		overflow: hidden;
		font-size: 0.92rem;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status-badge {
		flex: 0 0 auto;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-full);
		padding: 4px 8px;
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: 0.66rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.complete .status-badge {
		border-color: var(--color-ink);
		background: var(--color-ink);
		color: var(--color-neutral);
	}

	.failed .status-badge {
		border-color: var(--color-error);
		background: var(--color-neutral);
		color: var(--color-error);
	}

	.row-meta,
	.row-notice {
		color: var(--color-muted);
		font-size: 0.8rem;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.row-progress {
		display: block;
		width: 100%;
		height: 4px;
		overflow: hidden;
		border-radius: var(--radius-full);
		background: var(--color-line);
	}

	.row-notice {
		font-weight: 700;
	}

	.row-notice.error {
		color: var(--color-error);
	}

	.row-notice.warn,
	.row-notice.neutral {
		color: var(--color-ink);
	}

	.row-metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		min-width: 190px;
		margin: 0;
	}

	.row-metrics div {
		min-width: 0;
	}

	.row-metrics dd {
		margin: 3px 0 0;
		font-size: 0.82rem;
	}

	.row-actions {
		display: grid;
		gap: 8px;
		justify-items: end;
	}

	.row-download,
	.row-remove {
		width: 34px;
		min-height: 34px;
		padding: 0;
		font-size: 0.95rem;
	}

	.row-download {
		border-color: var(--color-primary);
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
		grid-template-columns: 34px minmax(0, 1fr);
		align-items: center;
		gap: 10px;
		justify-items: start;
		min-height: 64px;
		border-color: var(--color-line);
		border-radius: var(--radius-md);
		padding: 12px;
		text-align: left;
	}

	.preset-icon {
		display: grid;
		width: 34px;
		height: 34px;
		place-items: center;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-primary) 22%, var(--color-neutral));
		color: var(--color-ink);
		font-size: 1.08rem;
		line-height: 1;
	}

	.preset-icon i {
		line-height: 1;
	}

	.preset-copy {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.preset-copy span,
	.preset-copy small {
		overflow-wrap: anywhere;
	}

	.preset-list small {
		margin-top: 0;
		color: var(--color-ink);
		font-weight: 400;
		line-height: 1.35;
	}

	.preset-list button.selected .preset-icon {
		background: var(--color-primary);
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
		.row-download:hover {
			background: var(--color-primary-soft);
			transform: translateY(-1px);
		}

		.file-row:hover {
			border-color: var(--color-ink);
			transform: translateY(-1px);
		}
	}

	button:active:not(:disabled):not(.drop-zone),
	.row-download:active {
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

	@media (max-width: 820px) {
		.file-row {
			grid-template-columns: 46px minmax(0, 1fr) auto;
		}

		.row-metrics {
			grid-column: 2 / -1;
			width: 100%;
		}
	}

	@media (max-width: 720px) {
		.app-shell {
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
			min-height: 220px;
			padding: 30px 20px;
		}

		.queue-head {
			grid-template-columns: 1fr;
		}

		.file-line {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.file-size {
			grid-column: 2;
			justify-self: start;
		}

		.queue-actions {
			justify-content: stretch;
		}

		.queue-actions button {
			flex: 1 1 150px;
		}

		.segmented {
			grid-template-columns: 1fr;
		}

		.result-line {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.file-list {
			max-height: none;
			overflow: visible;
			padding-right: 0;
		}
	}

	@media (max-width: 540px) {
		.file-row {
			grid-template-columns: 40px minmax(0, 1fr);
		}

		.file-thumb {
			width: 40px;
		}

		.row-actions {
			grid-column: 2;
			display: flex;
			justify-content: flex-start;
		}

		.row-metrics {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
