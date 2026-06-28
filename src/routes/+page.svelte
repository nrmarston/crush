<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import {
		compressionSettings,
		initializeCompressionSettings,
		setCompressionOutputType,
		setCompressionPreset
	} from '$lib/compression-settings.svelte';
	import { createBatchCompressionJob } from '$lib/batch-compression-job.svelte';
	import { OUTPUT_FORMATS, createCompressionPlan } from '$lib/output-format';
	import { presets } from '$lib/presets';
	import CompressionStatusBadge from '$lib/CompressionStatusBadge.svelte';
	import FocusedResultPreview from '$lib/FocusedResultPreview.svelte';
	import ThemeToggle from '$lib/ThemeToggle.svelte';
	import type { CompressionPreset, PresetId } from '$lib/types';

	const presetIcons: Record<PresetId, string> = {
		quality: 'ph-sparkle',
		balanced: 'ph-scales',
		smallest: 'ph-file-archive'
	};

	let fileInput = $state<HTMLInputElement>();
	let fileList = $state<HTMLElement>();
	let settingsMenu = $state<HTMLElement>();
	let isDragging = $state(false);
	let showSettings = $state(false);
	let canScrollFileListUp = $state(false);
	let canScrollFileListDown = $state(false);

	let dragDepth = 0;
	const batchJob = createBatchCompressionJob();

	const presetId = $derived(compressionSettings.presetId);
	const outputType = $derived(compressionSettings.outputType);
	const selectedPreset = $derived(
		presets.find((preset) => preset.id === presetId) ?? presets[1]
	);
	const compressionPlan = $derived(createCompressionPlan(selectedPreset, outputType));
	const arePresetsEnabled = $derived(compressionPlan.supportsCompressionPresets);
	const activePreset = $derived<CompressionPreset>(
		compressionPlan.compressionPreset
	);
	const workspace = $derived(batchJob.workspaceFor({ isDragging }));

	onMount(() => {
		initializeCompressionSettings();
	});

	onDestroy(() => {
		batchJob.dispose();
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

	function updateFileListEdges() {
		if (!fileList) {
			canScrollFileListUp = false;
			canScrollFileListDown = false;
			return;
		}

		const maxScrollTop = Math.max(0, fileList.scrollHeight - fileList.clientHeight);
		const scrollTop = Math.min(fileList.scrollTop, maxScrollTop);
		const edgeTolerance = 1;

		canScrollFileListUp = scrollTop > edgeTolerance;
		canScrollFileListDown = scrollTop < maxScrollTop - edgeTolerance;
	}

	function scheduleFileListEdgeUpdate() {
		void tick().then(updateFileListEdges);
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
		await batchJob.queueFiles(fileList, activePreset);
		scheduleFileListEdgeUpdate();
	}

	function removeItem(id: string) {
		if (batchJob.removeItem(id)) {
			scheduleFileListEdgeUpdate();
		}
	}

	function clearQueue() {
		if (batchJob.clear()) {
			scheduleFileListEdgeUpdate();
		}
	}
</script>

<svelte:head>
	<title>Crush - Local Image Compression</title>
	<meta
		name="description"
		content="Compress JPEG, PNG, and WebP images locally with drag-and-drop, per-file progress, and batch download state."
	/>
</svelte:head>

<svelte:window
	onclick={handleWindowClick}
	onkeydown={handleWindowKeydown}
	onresize={updateFileListEdges}
/>

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
							<p>
								{compressionPlan.outputFormat.label} output, {selectedPreset.label.toLowerCase()}
								preset.
							</p>
						</div>
						<div class="setting-block">
							<h3>Appearance</h3>
							<ThemeToggle />
						</div>
						<div class="setting-block">
							<h3>Output</h3>
							<div class="segmented" aria-label="Output format">
								{#each OUTPUT_FORMATS as format (format.type)}
									<button
										type="button"
										class={{ selected: outputType === format.type }}
										aria-pressed={outputType === format.type}
										disabled={workspace.isBusy}
										onclick={() => setCompressionOutputType(format.type)}
									>
										{format.label}
									</button>
								{/each}
							</div>
						</div>
						<div class="setting-block">
							<h3>Compression</h3>
							<div class="preset-list" aria-label="Compression preset">
								{#each presets as preset (preset.id)}
									<button
										type="button"
										class={{ selected: presetId === preset.id }}
										aria-pressed={presetId === preset.id}
										disabled={workspace.isBusy || !arePresetsEnabled}
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

	<section class={['stage', { active: workspace.hasItems }]} aria-labelledby="app-title">
		<div class="intro">
			<h1 id="app-title">Compress images</h1>
			<p>Big images in. Small files out.</p>
		</div>

		<div class={['workspace', { active: workspace.hasItems }]}>
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
					class={[
						'drop-zone',
						{
							dragging: isDragging,
							busy: workspace.intake.showProgress,
							complete: workspace.intake.isComplete,
							failed: workspace.intake.isFailed,
							compact: workspace.intake.isCompact
						}
					]}
					aria-busy={workspace.isBusy}
					onclick={openFileBrowser}
					ondragenter={handleDragEnter}
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
				>
					<span class="drop-media" aria-hidden="true">
						{#if workspace.intake.thumbnailUrl}
							<img src={workspace.intake.thumbnailUrl} alt="" />
						{:else}
							<i class="ph ph-images-square drop-icon"></i>
						{/if}
					</span>
					<span class="drop-title">{workspace.intake.title}</span>
					<span class="drop-copy">{workspace.intake.copy}</span>
					{#if workspace.intake.showProgress}
						<span class="progress-track" aria-hidden="true">
							<span style:width={`${workspace.intake.progress}%`}></span>
						</span>
					{/if}
				</button>

				{#if workspace.hasItems}
					<div class="queue-head">
						<div class="file-line">
							<i class="ph ph-stack file-mark" aria-hidden="true"></i>
							<span class="file-details">
								<strong>{workspace.summary.title}</strong>
								<span>{workspace.summary.status}</span>
							</span>
							<span class="file-size">{workspace.summary.fileSizeLimit}</span>
						</div>

						<div class="queue-actions">
							<button
								type="button"
								disabled={!workspace.summary.canDownloadZip}
								onclick={() => void batchJob.downloadResultZip()}
							>
								{workspace.summary.downloadZipLabel}
							</button>
							<button
								type="button"
								disabled={!workspace.summary.canClear}
								onclick={clearQueue}
							>
								{workspace.summary.clearLabel}
							</button>
						</div>
					</div>
				{/if}

				{#each workspace.notices as notice (notice.id)}
					<p class={`notice ${notice.tone}`}>{notice.message}</p>
				{/each}

				{#if workspace.metrics.length > 0}
					<div class="result-line" aria-live="polite">
						{#each workspace.metrics as metric (metric.id)}
							<div>
								<span>{metric.label}</span>
								<strong>{metric.value}</strong>
							</div>
						{/each}
					</div>
				{/if}

				{#if workspace.hasItems}
					<section
						bind:this={fileList}
						class={[
							'file-list',
							{
								'fade-top': canScrollFileListUp,
								'fade-bottom': canScrollFileListDown
							}
						]}
						aria-label="Compression progress"
						aria-live="polite"
						onscroll={updateFileListEdges}
					>
						{#each workspace.rows as row (row.id)}
							<article
								class={[
									'file-row',
									row.status,
									{
										warning: row.hasWarning,
										selectable: row.canFocus,
										selected: row.isFocused
									}
								]}
							>
								{#if row.canFocus}
									<button
										type="button"
										class="row-select-hit"
										aria-label={row.focusLabel}
										aria-pressed={row.isFocused}
										onclick={() => batchJob.focusItem(row.id)}
									></button>
								{/if}

								<span class="file-thumb" aria-hidden="true">
									{#if row.thumbnailUrl}
										<img src={row.thumbnailUrl} alt="" />
									{:else}
										<i class="ph ph-file-image"></i>
									{/if}
								</span>

								<div class="row-main">
									<div class="row-title">
										<strong>{row.title}</strong>
										<CompressionStatusBadge
											status={row.status}
											label={row.statusLabel}
										/>
									</div>
									<span class="row-meta">{row.details}</span>

									{#if row.showProgress}
										<span class="row-progress" aria-label={row.progressLabel}>
											<span style:width={`${row.progress}%`}></span>
										</span>
									{/if}

									{#each row.notices as notice (notice.id)}
										<span class={`row-notice ${notice.tone}`}>{notice.message}</span>
									{/each}
								</div>

								<div class="row-actions">
									{#if row.download}
										<a
											class="row-download"
											href={row.download.url}
											download={row.download.name}
											aria-label={row.download.label}
										>
											<i class="ph ph-download-simple" aria-hidden="true"></i>
										</a>
									{/if}
									<button
										type="button"
										class="row-remove"
										disabled={!row.canRemove}
										aria-label={row.removeLabel}
										onclick={() => removeItem(row.id)}
									>
										<i class="ph ph-x" aria-hidden="true"></i>
									</button>
								</div>
							</article>
						{/each}
					</section>
				{/if}
			</div>

			{#if workspace.hasItems && workspace.preview}
				<FocusedResultPreview preview={workspace.preview} />
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
		max-width: 80px;
		height: auto;
		filter: var(--brand-logo-filter);
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
		--settings-control-hover-background: color-mix(
			in srgb,
			var(--color-primary-soft) 62%,
			var(--color-neutral)
		);
		--settings-control-selected-background: var(--color-ink);
		--settings-control-selected-border: var(--color-ink);
		--settings-control-selected-color: var(--color-neutral);
		--settings-icon-tile-background: color-mix(
			in srgb,
			var(--color-primary) 22%,
			var(--color-neutral)
		);

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
		box-shadow: var(--shadow-popover);
		transform-origin: top right;
	}

	:global(html[data-theme='dark']) .settings-popover {
		--settings-control-hover-background: rgb(255 255 255 / 0.1);
		--settings-control-selected-background: rgb(255 255 255 / 0.15);
		--settings-control-selected-border: rgb(255 255 255 / 0.24);
		--settings-control-selected-color: var(--color-ink);
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
		padding-block: 5rem;
		padding-inline: 1rem;
	}

	.stage.active {
		align-content: start;
	}

	.workspace {
		display: grid;
		width: min(760px, 100%);
		gap: 22px;
		align-items: start;
	}

	.workspace.active {
		width: min(120rem, 100%);
		grid-template-columns: minmax(360px, 760px) minmax(360px, 1fr);
		gap: 24px;
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
		width: 100%;
		gap: 18px;
		border-radius: var(--radius-md);
		padding: 28px;
		background: var(--color-neutral);
		box-shadow: var(--shadow-card);
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

	.drop-zone.compact {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 96px;
		padding: 14px 16px;
		text-align: center;
	}

	.drop-zone.compact.busy {
		min-height: 118px;
		padding-bottom: 34px;
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

	.drop-zone.compact.complete {
		border-color: var(--color-line);
		background: var(--color-neutral);
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
		margin-bottom: 24px;
		background: color-mix(in srgb, var(--color-primary) 30%, var(--color-neutral));
		transition: transform 180ms var(--ease-out);
		transform-origin: center;
	}

	.drop-zone.compact .drop-media {
		width: 44px;
		border-radius: var(--radius-sm);
		margin-bottom: 8px;
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
		margin-top: 8px;
		color: var(--color-muted);
		font-size: 0.9rem;
		font-weight: 400;
		line-height: 1.45;
		letter-spacing: 0.01em;
	}

	.drop-zone.compact .drop-title,
	.drop-zone.compact .drop-copy {
		max-width: none;
	}

	.drop-zone.compact .drop-copy {
		margin-top: 2px;
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

	.drop-zone.compact .progress-track {
		right: 16px;
		bottom: 16px;
		left: 16px;
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
		opacity: 1;
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
		font-weight: 700;
		line-height: 1.25;
	}

	.file-list {
		--file-list-fade-size: 24px;
		--file-list-mask: linear-gradient(#000, #000);

		display: grid;
		max-height: min(430px, 42svh);
		gap: 10px;
		overflow-y: auto;
		padding-right: 4px;
		-webkit-mask-image: var(--file-list-mask);
		mask-image: var(--file-list-mask);
		scrollbar-width: thin;
	}

	.file-list.fade-top {
		--file-list-mask: linear-gradient(
			to bottom,
			transparent,
			#000 var(--file-list-fade-size),
			#000 100%
		);
	}

	.file-list.fade-bottom {
		--file-list-mask: linear-gradient(
			to bottom,
			#000 0,
			#000 calc(100% - var(--file-list-fade-size)),
			transparent
		);
	}

	.file-list.fade-top.fade-bottom {
		--file-list-mask: linear-gradient(
			to bottom,
			transparent,
			#000 var(--file-list-fade-size),
			#000 calc(100% - var(--file-list-fade-size)),
			transparent
		);
	}

	.file-row {
		position: relative;
		display: grid;
		grid-template-columns: 46px minmax(0, 1fr) auto;
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

	.file-row.selectable {
		cursor: pointer;
	}

	.file-row.selected {
		border-color: var(--color-ink);
		box-shadow: inset 0 0 0 1px var(--color-ink);
	}

	.row-select-hit {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		min-height: 0;
		border: 0;
		border-radius: inherit;
		padding: 0;
		background: transparent;
	}

	.row-select-hit:focus-visible {
		outline: 2px solid var(--color-ink);
		outline-offset: 3px;
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

	.row-actions {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: flex-end;
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
		color: var(--color-on-primary);
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
		border-color: var(--settings-control-selected-border);
		background: var(--settings-control-selected-background);
		color: var(--settings-control-selected-color);
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
		background: var(--settings-icon-tile-background);
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

	.preset-list button.selected small {
		color: var(--settings-control-selected-color);
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

		.queue-head {
			transform: translateY(0);
			transition:
				opacity 180ms var(--ease-out),
				transform 180ms var(--ease-out);
		}

		@starting-style {
			.queue-head {
				opacity: 0;
				transform: translateY(-6px);
			}
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
		button:hover:not(:disabled):not(.drop-zone):not(.row-select-hit),
		.row-download:hover {
			background: var(--color-primary-soft);
			transform: translateY(-1px);
		}

		.settings-popover button:hover:not(:disabled) {
			background: var(--settings-control-hover-background);
		}

		.settings-popover .segmented button.selected:hover:not(:disabled),
		.settings-popover .preset-list button.selected:hover:not(:disabled) {
			border-color: var(--settings-control-selected-border);
			background: var(--settings-control-selected-background);
			color: var(--settings-control-selected-color);
		}

		.file-row:hover {
			border-color: var(--color-ink);
			transform: translateY(-1px);
		}
	}

	button:active:not(:disabled):not(.drop-zone):not(.row-select-hit),
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

	@media (max-width: 1180px) {
		.workspace.active {
			width: min(760px, 100%);
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 820px) {
		.file-row {
			grid-template-columns: 46px minmax(0, 1fr) auto;
		}
	}

	@media (max-width: 720px) {
		.app-shell {
			padding: 20px 10px 34px;
		}

		.stage {
			gap: 26px;
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
			--file-list-mask: linear-gradient(#000, #000);

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
	}

	@media (max-width: 767px) {
		.stage {
			padding-block: 3rem;
		}
	}

	@media (max-width: 479px) {
		.stage {
			padding-block: 2.5rem;
		}
	}
</style>
