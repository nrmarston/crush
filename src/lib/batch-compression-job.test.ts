import { describe, expect, it, vi } from 'vite-plus/test';
import {
	createBatchCompressionJob,
	type BatchCompressionJobDependencies
} from './batch-compression-job.svelte';
import type { CompressionPreset, CompressionResult, StaticImageIntakeResult } from './types';

const preset: CompressionPreset = {
	id: 'balanced',
	label: 'Balanced',
	description: 'Balanced output',
	outputType: 'image/webp',
	quality: 0.82,
	maxWidth: 1800
};

function createHarness(overrides: BatchCompressionJobDependencies = {}, outputSize = 400) {
	let idIndex = 0;
	let urlIndex = 0;
	let timerIndex = 0;

	const progressTimers = new Map<number, () => void>();
	const createdUrls: string[] = [];
	const revokedUrls: string[] = [];
	const outputBlob = new Blob([new Uint8Array(outputSize)], { type: preset.outputType });
	const intakeStaticImage = vi.fn(async (file: File): Promise<StaticImageIntakeResult> => {
		return {
			accepted: true,
			metadata: {
				name: file.name,
				type: file.type,
				size: file.size,
				width: 640,
				height: 480
			}
		};
	});
	const compress = vi.fn(async (id: string, file: File, compressionPreset: CompressionPreset) => {
		return compressionResult(id, file, compressionPreset, outputBlob);
	});
	const createZip = vi.fn(async () => {
		return new Blob([new Uint8Array(24)], { type: 'application/zip' });
	});

	const dependencies: BatchCompressionJobDependencies = {
		createId: () => {
			idIndex += 1;
			return `item-${idIndex}`;
		},
		intakeStaticImage,
		compress,
		createObjectUrl: () => {
			urlIndex += 1;
			const url = `blob:fake-${urlIndex}`;
			createdUrls.push(url);
			return url;
		},
		revokeObjectUrl: (url) => {
			revokedUrls.push(url);
		},
		createZip,
		setProgressInterval: (callback) => {
			timerIndex += 1;
			progressTimers.set(timerIndex, callback);
			return timerIndex;
		},
		clearProgressInterval: (timer) => {
			progressTimers.delete(timer as number);
		},
		...overrides
	};

	return {
		job: createBatchCompressionJob(dependencies),
		intakeStaticImage,
		compress,
		createZip,
		createdUrls,
		revokedUrls,
		progressTimers,
		runProgressTimers: () => {
			for (const callback of progressTimers.values()) {
				callback();
			}
		}
	};
}

describe('batch compression job', () => {
	it('reads, compresses, and aggregates queued Static Images', async () => {
		const harness = createHarness();
		const file = imageFile('hero.jpg', 'image/jpeg', 1000);

		await harness.job.queueFiles([file], preset);
		await flushAsyncWork();

		expect(harness.intakeStaticImage).toHaveBeenCalledWith(file);
		expect(harness.compress).toHaveBeenCalledWith('item-1', file, preset);
		expect(harness.job.items).toHaveLength(1);
		expect(harness.job.items[0]).toMatchObject({
			id: 'item-1',
			status: 'complete',
			progress: 100,
			originalUrl: 'blob:fake-1',
			outputUrl: 'blob:fake-2',
			width: 640,
			height: 480
		});
		expect(harness.job.completedItems).toHaveLength(1);
		expect(harness.job.totalOriginalSize).toBe(1000);
		expect(harness.job.totalOutputSize).toBe(400);
		expect(harness.job.totalSavingsPercent).toBe(60);
		expect(harness.job.compressedBytes).toBe(600);
		expect(harness.job.isBusy).toBe(false);
	});

	it('fails invalid files before creating previews or worker calls', async () => {
		const harness = createHarness();
		const file = imageFile('notes.txt', 'text/plain', 12);
		harness.intakeStaticImage.mockResolvedValueOnce({
			accepted: false,
			failure: {
				code: 'unsupported-type',
				message: 'Unsupported file. Add a JPEG, PNG, or WebP image.'
			}
		});

		await harness.job.queueFiles([file], preset);
		await flushAsyncWork();

		expect(harness.job.items).toHaveLength(1);
		expect(harness.job.items[0]).toMatchObject({
			status: 'failed',
			progress: 0,
			error: 'Unsupported file. Add a JPEG, PNG, or WebP image.'
		});
		expect(harness.intakeStaticImage).toHaveBeenCalledWith(file);
		expect(harness.compress).not.toHaveBeenCalled();
		expect(harness.createdUrls).toEqual([]);
		expect(harness.job.failedCount).toBe(1);
	});

	it('keeps active items in the queue and revokes URLs when complete items are removed', async () => {
		let resolveCompression: (result: CompressionResult) => void = () => {};
		const pendingCompression = new Promise<CompressionResult>((resolve) => {
			resolveCompression = resolve;
		});
		const harness = createHarness({
			compress: vi.fn(() => pendingCompression)
		});
		const file = imageFile('hero.jpg', 'image/jpeg', 1000);

		await harness.job.queueFiles([file], preset);

		expect(harness.job.items[0].status).toBe('compressing');
		expect(harness.job.removeItem('item-1')).toBe(false);
		expect(harness.job.items).toHaveLength(1);

		resolveCompression(compressionResult('item-1', file, preset));
		await flushAsyncWork();

		expect(harness.job.items[0].status).toBe('complete');
		expect(harness.job.removeItem('item-1')).toBe(true);
		expect(harness.job.items).toEqual([]);
		expect(harness.revokedUrls).toEqual(['blob:fake-1', 'blob:fake-2']);
	});

	it('creates ZIP files from completed results and reports ZIP failures locally', async () => {
		const harness = createHarness();
		const file = imageFile('hero.jpg', 'image/jpeg', 1000);

		await harness.job.queueFiles([file], preset);
		await flushAsyncWork();

		const zip = await harness.job.createResultZip();

		expect(zip?.type).toBe('application/zip');
		expect(harness.createZip).toHaveBeenCalledWith([
			{
				name: 'hero-crushed.webp',
				blob: harness.job.completedItems[0].result.outputBlob
			}
		]);

		const failingHarness = createHarness({
			createZip: vi.fn(async () => {
				throw new Error('No ZIP today.');
			})
		});

		await failingHarness.job.queueFiles([file], preset);
		await flushAsyncWork();

		await expect(failingHarness.job.createResultZip()).resolves.toBeUndefined();
		expect(failingHarness.job.zipError).toBe('No ZIP today.');
		expect(failingHarness.job.isZipping).toBe(false);
	});

	it('disposes progress timers and object URLs', async () => {
		const harness = createHarness();
		const file = imageFile('hero.jpg', 'image/jpeg', 1000);

		await harness.job.queueFiles([file], preset);
		await flushAsyncWork();

		expect(harness.progressTimers.size).toBe(0);
		expect(harness.revokedUrls).toEqual([]);

		harness.job.dispose();

		expect(harness.job.items).toEqual([]);
		expect(harness.revokedUrls).toEqual(['blob:fake-1', 'blob:fake-2']);
	});
});

function imageFile(name: string, type: string, size: number) {
	return new File([new Uint8Array(size)], name, { type });
}

function compressionResult(
	id: string,
	file: File,
	compressionPreset: CompressionPreset,
	outputBlob = new Blob([new Uint8Array(400)], { type: compressionPreset.outputType })
): CompressionResult {
	return {
		id,
		originalName: file.name,
		originalType: file.type,
		originalSize: file.size,
		outputName: `${file.name.replace(/\.[^.]+$/, '')}-crushed.webp`,
		outputType: compressionPreset.outputType,
		outputSize: outputBlob.size,
		width: 640,
		height: 480,
		savingsPercent: Math.round(((file.size - outputBlob.size) / file.size) * 1000) / 10,
		outputBlob
	};
}

async function flushAsyncWork() {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}
