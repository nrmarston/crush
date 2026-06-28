import { compressImage } from './compress';
import {
	createFocusedResultPreviewFrame,
	type FocusedResultPreviewFrame
} from './focused-result-preview';
import { intakeStaticImage } from './image-metadata';
import { calculateSavingsPercent, labelForImageType, labelForOutputType } from './output-format';
import {
	MAX_BATCH_SIZE,
	MAX_FILE_SIZE,
	type CompressionPreset,
	type CompressionResult,
	type StaticImageIntakeResult
} from './types';
import { createZip, type ZipEntry } from './zip';

export type BatchCompressionJobItemStatus =
	| 'reading'
	| 'waiting'
	| 'compressing'
	| 'complete'
	| 'failed';

export type BatchCompressionJobDownload = {
	url: string;
	name: string;
	label: string;
};

export type BatchCompressionJobItemNotice = {
	tone: 'error' | 'warn' | 'neutral';
	message: string;
};

export type BatchCompressionJobRow = {
	id: string;
	title: string;
	status: BatchCompressionJobItemStatus;
	statusLabel: string;
	details: string;
	thumbnailUrl?: string;
	progress: number;
	showProgress: boolean;
	progressLabel: string;
	canFocus: boolean;
	isFocused: boolean;
	focusLabel: string;
	canRemove: boolean;
	removeLabel: string;
	download?: BatchCompressionJobDownload;
	hasWarning: boolean;
	notices: BatchCompressionJobItemNotice[];
};

export type BatchCompressionJobPreview = {
	id: string;
	title: string;
	status: BatchCompressionJobItemStatus;
	statusLabel: string;
	details: string;
	originalUrl?: string;
	frame: FocusedResultPreviewFrame;
	comparison?: {
		originalUrl: string;
		outputUrl: string;
		imageName: string;
	};
	download?: BatchCompressionJobDownload;
};

export type BatchCompressionJobItem = {
	id: string;
	file?: File;
	originalName: string;
	originalType: string;
	originalSize: number;
	originalWidth?: number;
	originalHeight?: number;
	width?: number;
	height?: number;
	status: BatchCompressionJobItemStatus;
	progress: number;
	preset: CompressionPreset;
	originalUrl?: string;
	outputUrl?: string;
	result?: CompressionResult;
	error?: string;
};

export type CompletedBatchCompressionJobItem = BatchCompressionJobItem & {
	file: File;
	outputUrl: string;
	result: CompressionResult;
};

type ProgressTimer = unknown;

export type BatchCompressionJobDependencies = {
	createId?: () => string;
	intakeStaticImage?: (file: File) => Promise<StaticImageIntakeResult>;
	compress?: (id: string, file: File, preset: CompressionPreset) => Promise<CompressionResult>;
	createObjectUrl?: (value: Blob) => string;
	revokeObjectUrl?: (url: string) => void;
	createZip?: (entries: ZipEntry[]) => Promise<Blob>;
	setProgressInterval?: (callback: () => void, milliseconds: number) => ProgressTimer;
	clearProgressInterval?: (timer: ProgressTimer) => void;
};

export function createBatchCompressionJob(dependencies: BatchCompressionJobDependencies = {}) {
	const createId = dependencies.createId ?? (() => crypto.randomUUID());
	const intakeImage = dependencies.intakeStaticImage ?? intakeStaticImage;
	const compress = dependencies.compress ?? compressImage;
	const createObjectUrl =
		dependencies.createObjectUrl ?? ((value: Blob) => URL.createObjectURL(value));
	const revokeObjectUrl =
		dependencies.revokeObjectUrl ?? ((url: string) => URL.revokeObjectURL(url));
	const zipResults = dependencies.createZip ?? createZip;
	const setProgressInterval =
		dependencies.setProgressInterval ??
		((callback: () => void, milliseconds: number) => window.setInterval(callback, milliseconds));
	const clearProgressInterval =
		dependencies.clearProgressInterval ??
		((timer: ProgressTimer) => window.clearInterval(timer as number));

	let items = $state<BatchCompressionJobItem[]>([]);
	let isProcessing = $state(false);
	let isZipping = $state(false);
	let queueError = $state('');
	let zipError = $state('');
	let focusedResultId = $state<string | undefined>();
	let isFocusedResultManual = $state(false);
	let isDisposed = false;

	const progressTimers = new Map<string, ProgressTimer>();
	const completedItems = $derived(items.filter(isCompletedBatchCompressionJobItem));
	const focusedItem = $derived(resolveFocusedItem());
	const rows = $derived(items.map((item) => createBatchCompressionJobRow(item, focusedItem?.id)));
	const failedCount = $derived(items.filter((item) => item.status === 'failed').length);
	const isBusy = $derived(
		isProcessing ||
			items.some(
				(item) =>
					item.status === 'reading' || item.status === 'waiting' || item.status === 'compressing'
			)
	);
	const remainingSlots = $derived(Math.max(MAX_BATCH_SIZE - items.length, 0));
	const totalOriginalSize = $derived(
		completedItems.reduce((total, item) => total + item.result.originalSize, 0)
	);
	const totalOutputSize = $derived(
		completedItems.reduce((total, item) => total + item.result.outputSize, 0)
	);
	const totalSavingsPercent = $derived(calculateSavingsPercent(totalOriginalSize, totalOutputSize));
	const compressedBytes = $derived(Math.max(totalOriginalSize - totalOutputSize, 0));
	const featuredItem = $derived(
		items.find((item) => item.status === 'compressing') ??
			items.find((item) => item.status === 'reading') ??
			[...items].reverse().find((item) => item.originalUrl) ??
			items[0]
	);
	const previewItem = $derived(focusedItem ?? featuredItem);
	const preview = $derived(previewItem ? createBatchCompressionJobPreview(previewItem) : undefined);

	async function queueFiles(fileList: FileList | File[], preset: CompressionPreset) {
		if (isDisposed) {
			return;
		}

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

		const queuedItems = selectedFiles.map((file) => createQueuedItem(file, preset));
		items = [...items, ...queuedItems];

		for (let index = 0; index < selectedFiles.length; index += 1) {
			await prepareQueuedFile(queuedItems[index].id, selectedFiles[index]);
		}

		void processQueue();
	}

	async function createResultZip(): Promise<Blob | undefined> {
		if (completedItems.length === 0 || isZipping || isDisposed) {
			return undefined;
		}

		isZipping = true;
		zipError = '';

		try {
			return await zipResults(
				completedItems.map((item) => ({
					name: item.result.outputName,
					blob: item.result.outputBlob
				}))
			);
		} catch (caughtError) {
			zipError = messageFromError(caughtError, 'The ZIP file could not be created.');
			return undefined;
		} finally {
			isZipping = false;
		}
	}

	function removeItem(id: string): boolean {
		const item = items.find((candidate) => candidate.id === id);

		if (!item || !canRemoveBatchCompressionJobItem(item)) {
			return false;
		}

		clearItemProgress(id);
		revokeItemUrls(item);
		items = items.filter((candidate) => candidate.id !== id);
		if (focusedResultId === id) {
			isFocusedResultManual = false;
			focusedResultId = latestCompletedItem()?.id;
		}
		queueError = '';
		zipError = '';

		return true;
	}

	function clear(): boolean {
		if (isBusy) {
			return false;
		}

		clearAllProgress();
		revokeQueueUrls(items);
		items = [];
		focusedResultId = undefined;
		isFocusedResultManual = false;
		queueError = '';
		zipError = '';

		return true;
	}

	function dispose() {
		isDisposed = true;
		clearAllProgress();
		revokeQueueUrls(items);
		items = [];
		focusedResultId = undefined;
		isFocusedResultManual = false;
	}

	function focusItem(id: string): boolean {
		const item = items.find((candidate) => candidate.id === id);

		if (!item || !isCompletedBatchCompressionJobItem(item) || isDisposed) {
			return false;
		}

		focusedResultId = id;
		isFocusedResultManual = true;

		return true;
	}

	function createQueuedItem(file: File, preset: CompressionPreset): BatchCompressionJobItem {
		return {
			id: createId(),
			originalName: file.name || 'Untitled image',
			originalType: file.type || 'Unknown',
			originalSize: file.size,
			status: 'reading',
			progress: 12,
			preset: clonePreset(preset)
		};
	}

	async function prepareQueuedFile(id: string, file: File) {
		startItemProgress(id, 12, 42);
		let originalUrl = '';

		try {
			const result = await intakeImage(file);

			if (!result.accepted) {
				failQueuedFile(id, result.failure.message);
				return;
			}

			const { metadata } = result;
			originalUrl = createObjectUrl(file);

			clearItemProgress(id);

			if (isDisposed || !items.some((item) => item.id === id)) {
				revokeObjectUrl(originalUrl);
				return;
			}

			updateItem(id, (item) => ({
				...item,
				file,
				originalType: metadata.type,
				originalWidth: metadata.width,
				originalHeight: metadata.height,
				width: metadata.width,
				height: metadata.height,
				status: 'waiting',
				progress: 44,
				originalUrl
			}));
		} catch {
			if (originalUrl) {
				revokeObjectUrl(originalUrl);
			}

			failQueuedFile(id, 'This image could not be read. It may be corrupt or unsupported.');
		}
	}

	async function processQueue() {
		if (isProcessing || isDisposed) {
			return;
		}

		isProcessing = true;

		try {
			while (!isDisposed) {
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
				revokeObjectUrl(item.outputUrl);
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
			const result = await compress(id, file, preset);
			const outputUrl = createObjectUrl(result.outputBlob);

			clearItemProgress(id);

			if (isDisposed || !items.some((item) => item.id === id)) {
				revokeObjectUrl(outputUrl);
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

			if (!isFocusedResultManual) {
				focusedResultId = id;
			}
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

	function failQueuedFile(id: string, message: string) {
		if (isDisposed) {
			return;
		}

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

		const timer = setProgressInterval(() => {
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

		clearProgressInterval(timer);
		progressTimers.delete(id);
	}

	function clearAllProgress() {
		for (const timer of progressTimers.values()) {
			clearProgressInterval(timer);
		}

		progressTimers.clear();
	}

	function updateItem(
		id: string,
		updater: (item: BatchCompressionJobItem) => BatchCompressionJobItem
	) {
		items = items.map((item) => (item.id === id ? updater(item) : item));
	}

	function revokeQueueUrls(queueItems: BatchCompressionJobItem[]) {
		for (const item of queueItems) {
			revokeItemUrls(item);
		}
	}

	function revokeItemUrls(item: BatchCompressionJobItem) {
		if (item.originalUrl) {
			revokeObjectUrl(item.originalUrl);
		}

		if (item.outputUrl) {
			revokeObjectUrl(item.outputUrl);
		}
	}

	function resolveFocusedItem(): CompletedBatchCompressionJobItem | undefined {
		const focusedItem = completedItems.find((item) => item.id === focusedResultId);

		return focusedItem ?? latestCompletedItem();
	}

	function latestCompletedItem(): CompletedBatchCompressionJobItem | undefined {
		return items.filter(isCompletedBatchCompressionJobItem).at(-1);
	}

	return {
		get items() {
			return items;
		},
		get completedItems() {
			return completedItems;
		},
		get rows() {
			return rows;
		},
		get focusedItem() {
			return focusedItem;
		},
		get previewItem() {
			return previewItem;
		},
		get preview() {
			return preview;
		},
		get failedCount() {
			return failedCount;
		},
		get isProcessing() {
			return isProcessing;
		},
		get isZipping() {
			return isZipping;
		},
		get isBusy() {
			return isBusy;
		},
		get queueError() {
			return queueError;
		},
		get zipError() {
			return zipError;
		},
		get remainingSlots() {
			return remainingSlots;
		},
		get totalOriginalSize() {
			return totalOriginalSize;
		},
		get totalOutputSize() {
			return totalOutputSize;
		},
		get totalSavingsPercent() {
			return totalSavingsPercent;
		},
		get compressedBytes() {
			return compressedBytes;
		},
		get featuredItem() {
			return featuredItem;
		},
		maxBatchSize: MAX_BATCH_SIZE,
		maxFileSize: MAX_FILE_SIZE,
		queueFiles,
		createResultZip,
		focusItem,
		removeItem,
		clear,
		dispose
	};
}

function createBatchCompressionJobRow(
	item: BatchCompressionJobItem,
	focusedResultId: string | undefined
): BatchCompressionJobRow {
	const download = downloadForBatchCompressionJobItem(item);
	const notices = noticesForBatchCompressionJobItem(item);
	const canFocus = isCompletedBatchCompressionJobItem(item);

	return {
		id: item.id,
		title: item.originalName,
		status: item.status,
		statusLabel: labelForBatchCompressionJobItemStatus(item.status),
		details: detailsForBatchCompressionJobItem(item),
		thumbnailUrl: item.originalUrl,
		progress: item.progress,
		showProgress: item.status !== 'failed' && item.status !== 'complete',
		progressLabel: `Compression progress for ${item.originalName}`,
		canFocus,
		isFocused: canFocus && item.id === focusedResultId,
		focusLabel: `Show ${item.originalName} in preview`,
		canRemove: canRemoveBatchCompressionJobItem(item),
		removeLabel: `Remove ${item.originalName}`,
		download,
		hasWarning: notices.some((notice) => notice.tone === 'warn'),
		notices
	};
}

function createBatchCompressionJobPreview(
	item: BatchCompressionJobItem
): BatchCompressionJobPreview {
	const comparison =
		isCompletedBatchCompressionJobItem(item) && item.originalUrl
			? {
					originalUrl: item.originalUrl,
					outputUrl: item.outputUrl,
					imageName: item.originalName
				}
			: undefined;

	return {
		id: item.id,
		title: item.originalName,
		status: item.status,
		statusLabel: labelForBatchCompressionJobItemStatus(item.status),
		details: detailsForBatchCompressionJobItem(item),
		originalUrl: item.originalUrl,
		frame: createFocusedResultPreviewFrame({
			originalWidth: item.originalWidth,
			originalHeight: item.originalHeight,
			width: item.width,
			height: item.height
		}),
		comparison,
		download: downloadForBatchCompressionJobItem(item)
	};
}

function canRemoveBatchCompressionJobItem(item: BatchCompressionJobItem): boolean {
	return item.status !== 'reading' && item.status !== 'compressing';
}

function isCompletedBatchCompressionJobItem(
	item: BatchCompressionJobItem
): item is CompletedBatchCompressionJobItem {
	return item.status === 'complete' && Boolean(item.file && item.outputUrl && item.result);
}

function isLargerBatchCompressionJobItem(item: BatchCompressionJobItem): boolean {
	return (
		isCompletedBatchCompressionJobItem(item) && item.result.outputSize > item.result.originalSize
	);
}

function isAlreadyOptimizedBatchCompressionJobItem(item: BatchCompressionJobItem): boolean {
	return isCompletedBatchCompressionJobItem(item) && item.result.note === 'already-optimized';
}

function detailsForBatchCompressionJobItem(item: BatchCompressionJobItem): string {
	if (isCompletedBatchCompressionJobItem(item)) {
		return `${labelForOutputType(item.result.outputType)} - ${dimensionsForBatchCompressionJobItem(
			item
		)}`;
	}

	if (item.status === 'compressing') {
		return `Creating a ${labelForOutputType(item.preset.outputType)} file locally.`;
	}

	if (item.status === 'waiting') {
		return `${labelForImageType(item.originalType)} input - queued for ${labelForOutputType(
			item.preset.outputType
		)}`;
	}

	if (item.status === 'reading') {
		return `Reading ${labelForImageType(item.originalType)} input.`;
	}

	return labelForImageType(item.originalType);
}

function dimensionsForBatchCompressionJobItem(item: BatchCompressionJobItem): string {
	if (!item.width || !item.height) {
		return '-';
	}

	return `${item.width} x ${item.height}`;
}

function downloadForBatchCompressionJobItem(
	item: BatchCompressionJobItem
): BatchCompressionJobDownload | undefined {
	if (!isCompletedBatchCompressionJobItem(item)) {
		return undefined;
	}

	return {
		url: item.outputUrl,
		name: item.result.outputName,
		label: `Download ${item.result.outputName}`
	};
}

function noticesForBatchCompressionJobItem(
	item: BatchCompressionJobItem
): BatchCompressionJobItemNotice[] {
	const notices: BatchCompressionJobItemNotice[] = [];

	if (item.error) {
		notices.push({
			tone: 'error',
			message: item.error
		});
	}

	if (isLargerBatchCompressionJobItem(item)) {
		notices.push({
			tone: 'warn',
			message: 'The compressed file is larger than the original.'
		});
	}

	if (isAlreadyOptimizedBatchCompressionJobItem(item)) {
		notices.push({
			tone: 'neutral',
			message: 'Already optimized; original PNG kept.'
		});
	}

	return notices;
}

function labelForBatchCompressionJobItemStatus(status: BatchCompressionJobItemStatus): string {
	if (status === 'reading') {
		return 'Reading';
	}

	if (status === 'waiting') {
		return 'Waiting';
	}

	if (status === 'compressing') {
		return 'Compressing';
	}

	if (status === 'complete') {
		return 'Complete';
	}

	return 'Failed';
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

function messageFromError(caughtError: unknown, fallback: string): string {
	return caughtError instanceof Error && caughtError.message ? caughtError.message : fallback;
}
