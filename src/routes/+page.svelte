<script lang="ts">
	import { onMount } from 'svelte';
	import { compressImage } from '$lib/compress';
	import { clearHistoryJobs, loadHistoryJobs, saveHistoryJob } from '$lib/db';
	import { readImageMetadata } from '$lib/image-metadata';
	import { defaultPresetId, presets } from '$lib/presets';
	import { createZip } from '$lib/zip';
	import {
		calculateSavingsPercent,
		formatBytes,
		formatDate,
		formatSavings,
		labelForOutputType
	} from '$lib/format';
	import {
		DEFAULT_OUTPUT_TYPE,
		MAX_BATCH_SIZE,
		MAX_FILE_SIZE,
		OUTPUT_TYPES,
		SUPPORTED_INPUT_TYPES,
		type CompressionHistoryJob,
		type CompressionPreset,
		type CompressionResult,
		type CompressionStatus,
		type OutputType,
		type PresetId
	} from '$lib/types';

	type QueueItem = {
		id: string;
		file?: File;
		originalName: string;
		originalType: string;
		originalSize: number;
		width?: number;
		height?: number;
		status: CompressionStatus;
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

	const statusLabels: Record<CompressionStatus, string> = {
		waiting: 'Waiting',
		compressing: 'Compressing',
		complete: 'Complete',
		failed: 'Failed'
	};

	let fileInput = $state<HTMLInputElement>();
	let items = $state<QueueItem[]>([]);
	let history = $state<CompressionHistoryJob[]>([]);
	let presetId = $state<PresetId>(defaultPresetId);
	let outputType = $state<OutputType>(DEFAULT_OUTPUT_TYPE);
	let isDragging = $state(false);
	let isCompressing = $state(false);
	let isZipping = $state(false);
	let queueError = $state('');
	let zipError = $state('');
	let historyError = $state('');

	const selectedPreset = $derived(
		presets.find((preset) => preset.id === presetId) ?? presets[1]
	);
	const activePreset = $derived<CompressionPreset>({ ...selectedPreset, outputType });
	const completedItems = $derived(items.filter(isCompleted));
	const compressibleCount = $derived(items.filter((item) => item.file).length);
	const failedCount = $derived(items.filter((item) => item.status === 'failed').length);
	const totalOriginalSize = $derived(
		completedItems.reduce((total, item) => total + item.result.originalSize, 0)
	);
	const totalOutputSize = $derived(
		completedItems.reduce((total, item) => total + item.result.outputSize, 0)
	);
	const totalSavingsPercent = $derived(
		calculateSavingsPercent(totalOriginalSize, totalOutputSize)
	);

	onMount(() => {
		void refreshHistory();

		return () => {
			revokeQueueUrls(items);
		};
	});

	async function refreshHistory() {
		try {
			history = await loadHistoryJobs();
		} catch (error) {
			historyError = messageFromError(error, 'Local history is not available in this browser.');
		}
	}

	async function handleInputChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;

		if (input.files) {
			await queueFiles(input.files);
			input.value = '';
		}
	}

	function handleDropKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') {
			return;
		}

		event.preventDefault();
		fileInput?.click();
	}

	function handleDragEnter(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.dataTransfer!.dropEffect = 'copy';
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		if (event.currentTarget === event.target) {
			isDragging = false;
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		if (event.dataTransfer?.files) {
			await queueFiles(event.dataTransfer.files);
		}
	}

	async function queueFiles(fileList: FileList | File[]) {
		const incoming = Array.from(fileList);

		if (incoming.length === 0) {
			return;
		}

		queueError = '';
		zipError = '';

		const remainingSlots = MAX_BATCH_SIZE - items.length;

		if (remainingSlots <= 0) {
			queueError = `Crush can handle up to ${MAX_BATCH_SIZE} images in one batch.`;
			return;
		}

		const selectedFiles = incoming.slice(0, remainingSlots);

		if (incoming.length > selectedFiles.length) {
			queueError = `Only the first ${selectedFiles.length} files were added. The batch limit is ${MAX_BATCH_SIZE}.`;
		}

		const nextItems: QueueItem[] = [];

		for (const file of selectedFiles) {
			nextItems.push(await prepareFile(file));
		}

		items = [...items, ...nextItems];
	}

	async function prepareFile(file: File): Promise<QueueItem> {
		const baseItem = {
			id: createId(),
			originalName: file.name || 'Untitled image',
			originalType: file.type || 'Unknown',
			originalSize: file.size,
			status: 'failed' as CompressionStatus
		};

		if (!SUPPORTED_INPUT_TYPES.includes(file.type as (typeof SUPPORTED_INPUT_TYPES)[number])) {
			return {
				...baseItem,
				error: 'Unsupported file. Add a JPEG, PNG, or WebP image.'
			};
		}

		if (file.size === 0) {
			return {
				...baseItem,
				error: 'This file is empty.'
			};
		}

		if (file.size > MAX_FILE_SIZE) {
			return {
				...baseItem,
				error: `This file is larger than the ${formatBytes(MAX_FILE_SIZE)} MVP limit.`
			};
		}

		const originalUrl = URL.createObjectURL(file);

		try {
			const metadata = await readImageMetadata(file);

			return {
				...baseItem,
				file,
				originalType: metadata.type,
				width: metadata.width,
				height: metadata.height,
				status: 'waiting',
				originalUrl
			};
		} catch {
			URL.revokeObjectURL(originalUrl);

			return {
				...baseItem,
				error: 'This image could not be read. It may be corrupt or unsupported.'
			};
		}
	}

	async function compressAll() {
		if (isCompressing) {
			return;
		}

		if (compressibleCount === 0) {
			queueError = 'Add at least one supported image before compressing.';
			return;
		}

		isCompressing = true;
		queueError = '';
		zipError = '';
		historyError = '';

		const startedAt = new Date().toISOString();
		const batchPreset = { ...activePreset };

		for (const item of items) {
			if (!item.file) {
				continue;
			}

			updateItem(item.id, (current) => {
				if (current.outputUrl) {
					URL.revokeObjectURL(current.outputUrl);
				}

				return {
					...current,
					status: 'compressing',
					outputUrl: undefined,
					result: undefined,
					error: undefined
				};
			});

			try {
				const result = await compressImage(item.id, item.file, batchPreset);
				const outputUrl = URL.createObjectURL(result.outputBlob);

				updateItem(item.id, (current) => ({
					...current,
					status: 'complete',
					width: result.width,
					height: result.height,
					result,
					outputUrl
				}));
			} catch (error) {
				updateItem(item.id, (current) => ({
					...current,
					status: 'failed',
					error: messageFromError(
						error,
						'This image could not be compressed. Try a smaller file or a different format.'
					)
				}));
			}
		}

		isCompressing = false;

		if (completedItems.length > 0) {
			await saveCurrentHistory(startedAt, batchPreset);
		}
	}

	async function saveCurrentHistory(createdAt: string, batchPreset: CompressionPreset) {
		try {
			const job: CompressionHistoryJob = {
				id: createId(),
				createdAt,
				presetId: batchPreset.id,
				outputType: batchPreset.outputType,
				imageCount: completedItems.length,
				totalOriginalSize,
				totalOutputSize,
				totalSavingsPercent,
				files: completedItems.map((item) => ({
					outputName: item.result.outputName,
					outputType: item.result.outputType,
					outputSize: item.result.outputSize,
					outputBlob: item.result.outputBlob
				}))
			};

			await saveHistoryJob(job);
			await refreshHistory();
		} catch (error) {
			historyError = messageFromError(error, 'This job could not be saved to local history.');
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
		} catch (error) {
			zipError = messageFromError(error, 'The ZIP file could not be created.');
		} finally {
			isZipping = false;
		}
	}

	async function downloadHistoryZip(job: CompressionHistoryJob) {
		if (isZipping) {
			return;
		}

		isZipping = true;
		historyError = '';

		try {
			const zip = await createZip(
				job.files.map((file) => ({
					name: file.outputName,
					blob: file.outputBlob
				}))
			);

			downloadBlob(zip, `crush-${job.createdAt.slice(0, 10)}.zip`);
		} catch (error) {
			historyError = messageFromError(error, 'This history ZIP could not be created.');
		} finally {
			isZipping = false;
		}
	}

	async function clearHistory() {
		try {
			await clearHistoryJobs();
			history = [];
			historyError = '';
		} catch (error) {
			historyError = messageFromError(error, 'Local history could not be cleared.');
		}
	}

	function clearQueue() {
		if (isCompressing) {
			return;
		}

		revokeQueueUrls(items);
		items = [];
		queueError = '';
		zipError = '';
	}

	function updateItem(id: string, updater: (item: QueueItem) => QueueItem) {
		items = items.map((item) => (item.id === id ? updater(item) : item));
	}

	function isCompleted(item: QueueItem): item is CompletedQueueItem {
		return item.status === 'complete' && Boolean(item.file && item.result && item.outputUrl);
	}

	function isLarger(item: QueueItem): boolean {
		return isCompleted(item) && item.result.outputSize > item.result.originalSize;
	}

	function dimensionsFor(item: QueueItem): string {
		if (!item.width || !item.height) {
			return '-';
		}

		return `${item.width} x ${item.height}`;
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
			if (item.originalUrl) {
				URL.revokeObjectURL(item.originalUrl);
			}

			if (item.outputUrl) {
				URL.revokeObjectURL(item.outputUrl);
			}
		}
	}

	function messageFromError(error: unknown, fallback: string): string {
		return error instanceof Error && error.message ? error.message : fallback;
	}

	function createId(): string {
		return crypto.randomUUID();
	}
</script>

<svelte:head>
	<title>Crush - Local Image Compression</title>
	<meta
		name="description"
		content="Compress JPEG, PNG, and WebP images locally into AVIF, WebP, or JPEG. No upload required."
	/>
</svelte:head>

<main class="shell">
	<header class="topbar">
		<div>
			<p class="eyebrow">Local image compressor</p>
			<h1>Crush</h1>
			<p class="intro">
				Drop images in, compress them locally, and download smaller AVIF, WebP, or JPEG
				files.
			</p>
		</div>
		<div class="privacy">
			<span>No uploads</span>
			<span>Offline-ready</span>
		</div>
	</header>

	<div class="workspace">
		<section class="primary">
			<section
				class:dragging={isDragging}
				class="dropzone"
				role="button"
				tabindex="0"
				ondragenter={handleDragEnter}
				ondragover={handleDragOver}
				ondragleave={handleDragLeave}
				ondrop={handleDrop}
				onkeydown={handleDropKeydown}
			>
				<input
					bind:this={fileInput}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					multiple
					onchange={handleInputChange}
				/>
				<div>
					<p class="drop-title">Drop JPEG, PNG, or WebP images</p>
					<p class="drop-copy">
						Up to {MAX_BATCH_SIZE} images, {formatBytes(MAX_FILE_SIZE)} each. Compression runs in
						this browser.
					</p>
				</div>
				<button type="button" onclick={() => fileInput?.click()}>Choose images</button>
			</section>

			<section class="settings" aria-label="Compression settings">
				<div class="setting-group">
					<div>
						<h2>Preset</h2>
						<p>Balanced is the default for web assets.</p>
					</div>
					<div class="preset-grid">
						{#each presets as preset}
							<button
								type="button"
								class:selected={presetId === preset.id}
								aria-pressed={presetId === preset.id}
								disabled={isCompressing}
								onclick={() => (presetId = preset.id)}
							>
								<span>{preset.label}</span>
								<small>{preset.description}</small>
							</button>
						{/each}
					</div>
				</div>

				<div class="setting-group output-row">
					<div>
						<h2>Output</h2>
						<p>AVIF is the default for compact web images. WebP and JPEG are available.</p>
					</div>
					<div class="format-toggle" aria-label="Output format">
						{#each OUTPUT_TYPES as type}
							<button
								type="button"
								class:selected={outputType === type}
								aria-pressed={outputType === type}
								disabled={isCompressing}
								onclick={() => (outputType = type)}
							>
								{labelForOutputType(type)}
							</button>
						{/each}
					</div>
				</div>
			</section>

			<section class="actions" aria-label="Batch actions">
				<div>
					<strong>{items.length} queued</strong>
					<span>{completedItems.length} complete</span>
					{#if failedCount > 0}
						<span>{failedCount} failed</span>
					{/if}
				</div>
				<div class="button-row">
					<button
						type="button"
						class="primary-button"
						disabled={isCompressing || compressibleCount === 0}
						onclick={compressAll}
					>
						{isCompressing ? 'Compressing...' : 'Compress images'}
					</button>
					<button
						type="button"
						disabled={completedItems.length === 0 || isZipping}
						onclick={downloadZip}
					>
						{isZipping ? 'Preparing ZIP...' : 'Download ZIP'}
					</button>
					<button type="button" disabled={items.length === 0 || isCompressing} onclick={clearQueue}>
						Clear
					</button>
				</div>
			</section>

			{#if queueError}
				<p class="notice error">{queueError}</p>
			{/if}

			{#if zipError}
				<p class="notice error">{zipError}</p>
			{/if}

			{#if completedItems.length > 0}
				<section class="summary" aria-label="Batch summary">
					<div>
						<span>Original</span>
						<strong>{formatBytes(totalOriginalSize)}</strong>
					</div>
					<div>
						<span>Compressed</span>
						<strong>{formatBytes(totalOutputSize)}</strong>
					</div>
					<div>
						<span>Savings</span>
						<strong>{formatSavings(totalSavingsPercent)}</strong>
					</div>
				</section>
			{/if}

			<section class="results" aria-live="polite">
				<div class="section-heading">
					<div>
						<h2>Results</h2>
						<p>Each file moves independently through waiting, compressing, complete, or failed.</p>
					</div>
				</div>

				{#if items.length === 0}
					<div class="empty-state">
						<p>No images queued.</p>
					</div>
				{:else}
					<div class="result-list">
						{#each items as item (item.id)}
							<article class="result-card {item.status}" class:warning={isLarger(item)}>
								<div class="preview-grid">
									<div>
										<span>Original</span>
										{#if item.originalUrl}
											<img src={item.originalUrl} alt={`Original preview for ${item.originalName}`} />
										{:else}
											<div class="preview-fallback">No preview</div>
										{/if}
									</div>
									<div>
										<span>Compressed</span>
										{#if item.outputUrl}
											<img src={item.outputUrl} alt={`Compressed preview for ${item.originalName}`} />
										{:else}
											<div class="preview-fallback">{statusLabels[item.status]}</div>
										{/if}
									</div>
								</div>

								<div class="result-body">
									<div class="result-title">
										<div>
											<h3>{item.originalName}</h3>
											<p>{typeLabel(item.originalType)} input</p>
										</div>
										<span class="status-badge">{statusLabels[item.status]}</span>
									</div>

									<dl class="metrics">
										<div>
											<dt>Original</dt>
											<dd>{formatBytes(item.originalSize)}</dd>
										</div>
										<div>
											<dt>Compressed</dt>
											<dd>{isCompleted(item) ? formatBytes(item.result.outputSize) : '-'}</dd>
										</div>
										<div>
											<dt>Savings</dt>
											<dd>{isCompleted(item) ? formatSavings(item.result.savingsPercent) : '-'}</dd>
										</div>
										<div>
											<dt>Output</dt>
											<dd>{isCompleted(item) ? labelForOutputType(item.result.outputType) : '-'}</dd>
										</div>
										<div>
											<dt>Dimensions</dt>
											<dd>{dimensionsFor(item)}</dd>
										</div>
									</dl>

									{#if item.error}
										<p class="notice error">{item.error}</p>
									{/if}

									{#if isLarger(item)}
										<p class="notice warn">The compressed file is larger than the original.</p>
									{/if}

									{#if isCompleted(item)}
										<a class="download-link" href={item.outputUrl} download={item.result.outputName}>
											Download {item.result.outputName}
										</a>
									{/if}
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</section>
		</section>

		<aside class="history-panel">
			<div class="history-head">
				<div>
					<p class="eyebrow">IndexedDB</p>
					<h2>Local history</h2>
				</div>
				<button type="button" disabled={history.length === 0} onclick={clearHistory}>Clear</button>
			</div>

			{#if historyError}
				<p class="notice error">{historyError}</p>
			{/if}

			{#if history.length === 0}
				<p class="muted">Completed jobs will appear here for offline re-download.</p>
			{:else}
				<div class="history-list">
					{#each history as job (job.id)}
						<article class="history-item">
							<div>
								<strong>{formatDate(job.createdAt)}</strong>
								<span>
									{job.imageCount} image{job.imageCount === 1 ? '' : 's'} to {labelForOutputType(
										job.outputType
									)}
								</span>
							</div>
							<dl>
								<div>
									<dt>Original</dt>
									<dd>{formatBytes(job.totalOriginalSize)}</dd>
								</div>
								<div>
									<dt>Compressed</dt>
									<dd>{formatBytes(job.totalOutputSize)}</dd>
								</div>
								<div>
									<dt>Savings</dt>
									<dd>{formatSavings(job.totalSavingsPercent)}</dd>
								</div>
							</dl>
							<button type="button" disabled={isZipping} onclick={() => downloadHistoryZip(job)}>
								Download ZIP
							</button>
						</article>
					{/each}
				</div>
			{/if}
		</aside>
	</div>
</main>

<style>
	.shell {
		width: min(1180px, calc(100vw - 32px));
		margin: 0 auto;
		padding: 32px 0 48px;
	}

	.topbar {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 28px;
	}

	.eyebrow {
		margin: 0 0 8px;
		color: #2f8f68;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 10px;
		font-size: clamp(3rem, 9vw, 7rem);
		line-height: 0.86;
		letter-spacing: 0;
	}

	h2 {
		margin-bottom: 6px;
		font-size: 1rem;
	}

	h3 {
		margin-bottom: 4px;
		font-size: 1rem;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.intro {
		max-width: 540px;
		margin-bottom: 0;
		color: #4f625b;
		font-size: 1.05rem;
		line-height: 1.6;
	}

	.privacy {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
		min-width: 210px;
	}

	.privacy span {
		border: 1px solid rgba(23, 53, 44, 0.18);
		border-radius: 999px;
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.62);
		font-size: 0.84rem;
		font-weight: 700;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 24px;
		align-items: start;
	}

	.primary {
		display: grid;
		gap: 18px;
	}

	.dropzone,
	.settings,
	.actions,
	.summary,
	.result-card,
	.history-panel,
	.empty-state {
		border: 1px solid rgba(23, 53, 44, 0.14);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.72);
		box-shadow: 0 18px 44px rgba(23, 53, 44, 0.08);
	}

	.dropzone {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		min-height: 174px;
		padding: 28px;
		outline: 2px solid transparent;
		outline-offset: 2px;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			transform 150ms ease;
	}

	.dropzone.dragging,
	.dropzone:focus-visible {
		border-color: #2f8f68;
		background: #eef8f1;
		transform: translateY(-1px);
	}

	.dropzone input {
		position: absolute;
		inset: 0;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.drop-title {
		margin-bottom: 8px;
		font-size: 1.35rem;
		font-weight: 800;
	}

	.drop-copy,
	.settings p,
	.section-heading p,
	.result-title p,
	.muted {
		margin-bottom: 0;
		color: #62746d;
		line-height: 1.55;
	}

	button,
	.download-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 42px;
		border: 1px solid rgba(23, 53, 44, 0.18);
		border-radius: 8px;
		padding: 10px 14px;
		background: #ffffff;
		color: #17352c;
		font-weight: 800;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease,
			color 140ms ease,
			transform 140ms ease;
	}

	button:hover:not(:disabled),
	.download-link:hover {
		border-color: #2f8f68;
		transform: translateY(-1px);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.52;
	}

	.primary-button,
	.format-toggle button.selected,
	.preset-grid button.selected {
		border-color: #2f8f68;
		background: #2f8f68;
		color: #ffffff;
	}

	.settings {
		display: grid;
		gap: 1px;
		overflow: hidden;
		padding: 0;
		background: rgba(23, 53, 44, 0.1);
	}

	.setting-group {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 20px;
		padding: 20px;
		background: rgba(255, 255, 255, 0.78);
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.preset-grid button {
		display: grid;
		justify-items: start;
		min-height: 88px;
		text-align: left;
	}

	.preset-grid small {
		margin-top: 6px;
		font-weight: 600;
		line-height: 1.35;
		opacity: 0.82;
	}

	.output-row {
		align-items: center;
	}

	.format-toggle {
		display: inline-grid;
		grid-template-columns: repeat(2, minmax(94px, 1fr));
		gap: 8px;
		justify-self: start;
	}

	.actions,
	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 16px;
	}

	.actions > div:first-child,
	.button-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.actions span {
		color: #62746d;
	}

	.summary {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.summary div {
		display: grid;
		gap: 6px;
	}

	.summary span,
	dt {
		color: #62746d;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.summary strong {
		font-size: 1.2rem;
	}

	.notice {
		border-radius: 8px;
		margin-bottom: 0;
		padding: 12px 14px;
		font-weight: 700;
		line-height: 1.45;
	}

	.notice.error {
		background: #fff0ed;
		color: #8f352c;
	}

	.notice.warn {
		background: #fff8e8;
		color: #7a5317;
	}

	.section-heading {
		margin-bottom: 12px;
	}

	.empty-state {
		padding: 30px;
		color: #62746d;
	}

	.empty-state p {
		margin-bottom: 0;
	}

	.result-list {
		display: grid;
		gap: 14px;
	}

	.result-card {
		display: grid;
		grid-template-columns: 260px minmax(0, 1fr);
		gap: 18px;
		padding: 14px;
	}

	.result-card.warning {
		border-color: #d99b48;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.preview-grid > div {
		display: grid;
		gap: 8px;
		align-content: start;
	}

	.preview-grid span {
		color: #62746d;
		font-size: 0.74rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.preview-grid img,
	.preview-fallback {
		width: 100%;
		aspect-ratio: 1;
		border: 1px solid rgba(23, 53, 44, 0.12);
		border-radius: 6px;
		background: #edf1eb;
		object-fit: contain;
	}

	.preview-fallback {
		display: grid;
		place-items: center;
		padding: 10px;
		color: #62746d;
		font-size: 0.82rem;
		font-weight: 800;
		text-align: center;
	}

	.result-body {
		display: grid;
		gap: 14px;
		align-content: start;
	}

	.result-title {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 12px;
	}

	.status-badge {
		border-radius: 999px;
		padding: 6px 10px;
		background: #edf1eb;
		color: #17352c;
		font-size: 0.78rem;
		font-weight: 900;
		white-space: nowrap;
	}

	.compressing .status-badge {
		background: #e9f4ff;
		color: #1f5f95;
	}

	.complete .status-badge {
		background: #e7f6eb;
		color: #216b4c;
	}

	.failed .status-badge {
		background: #fff0ed;
		color: #8f352c;
	}

	.metrics,
	.history-item dl {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 10px;
		margin: 0;
	}

	.metrics div,
	.history-item dl div {
		min-width: 0;
	}

	dd {
		margin: 4px 0 0;
		font-weight: 800;
		overflow-wrap: anywhere;
	}

	.download-link {
		justify-self: start;
	}

	.history-panel {
		position: sticky;
		top: 18px;
		display: grid;
		gap: 14px;
		padding: 18px;
	}

	.history-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 14px;
	}

	.history-list {
		display: grid;
		gap: 12px;
	}

	.history-item {
		display: grid;
		gap: 12px;
		border-top: 1px solid rgba(23, 53, 44, 0.12);
		padding-top: 12px;
	}

	.history-item strong,
	.history-item span {
		display: block;
	}

	.history-item span {
		margin-top: 4px;
		color: #62746d;
	}

	.history-item dl {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	@media (max-width: 980px) {
		.workspace {
			grid-template-columns: 1fr;
		}

		.history-panel {
			position: static;
		}
	}

	@media (max-width: 760px) {
		.shell {
			width: min(100vw - 20px, 1180px);
			padding-top: 18px;
		}

		.topbar,
		.dropzone,
		.actions {
			align-items: stretch;
			flex-direction: column;
		}

		.privacy {
			justify-content: flex-start;
		}

		.setting-group,
		.result-card {
			grid-template-columns: 1fr;
		}

		.preset-grid,
		.summary,
		.metrics {
			grid-template-columns: 1fr;
		}

		.button-row,
		.button-row button {
			width: 100%;
		}
	}
</style>
