import type {
	CompressionPreset,
	CompressionResult,
	CompressorRequest,
	CompressorResponse
} from './types';

export function compressImage(
	id: string,
	file: File,
	preset: CompressionPreset
): Promise<CompressionResult> {
	const worker = new Worker(new URL('./workers/compressor.worker.ts', import.meta.url), {
		type: 'module'
	});

	return new Promise((resolve, reject) => {
		const finish = () => {
			worker.terminate();
		};

		worker.onmessage = (event: MessageEvent<CompressorResponse>) => {
			const message = event.data;

			if (message.type === 'complete') {
				finish();
				resolve(message.result);
				return;
			}

			finish();
			reject(new Error(message.error));
		};

		worker.onerror = (event) => {
			finish();
			reject(new Error(event.message || 'The compression worker failed.'));
		};

		const request: CompressorRequest = {
			type: 'compress',
			id,
			file,
			preset
		};

		worker.postMessage(request);
	});
}
