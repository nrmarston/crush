import { describe, expect, it, vi } from 'vite-plus/test';
import { intakeStaticImage } from './image-metadata';
import { MAX_FILE_SIZE } from './types';

describe('Static Image intake', () => {
	it('accepts supported Static Images with decoded metadata', async () => {
		const image = decodedImage(320, 240);
		const decodeImage = vi.fn(async () => image);
		const file = imageFile('hero.jpg', 'image/jpeg', [1, 2, 3]);

		const result = await intakeStaticImage(file, { decodeImage });

		expect(result).toEqual({
			accepted: true,
			metadata: {
				name: 'hero.jpg',
				type: 'image/jpeg',
				size: 3,
				width: 320,
				height: 240
			}
		});
		expect(decodeImage).toHaveBeenCalledWith(file);
		expect(image.close).toHaveBeenCalledOnce();
	});

	it('rejects unsupported input types before decoding', async () => {
		const decodeImage = vi.fn(async () => decodedImage());
		const file = imageFile('notes.txt', 'text/plain', [1, 2, 3]);

		await expectIntakeFailure(file, decodeImage, {
			code: 'unsupported-type',
			message: 'Unsupported file. Add a JPEG, PNG, or WebP image.'
		});
	});

	it('rejects empty files before decoding', async () => {
		const decodeImage = vi.fn(async () => decodedImage());
		const file = imageFile('empty.webp', 'image/webp', []);

		await expectIntakeFailure(file, decodeImage, {
			code: 'empty-file',
			message: 'This file is empty.'
		});
	});

	it('rejects oversized files before decoding', async () => {
		const decodeImage = vi.fn(async () => decodedImage());
		const file = new File([new Uint8Array(MAX_FILE_SIZE + 1)], 'huge.png', {
			type: 'image/png'
		});

		await expectIntakeFailure(file, decodeImage, {
			code: 'oversized-file',
			message: 'This file is larger than the 25 MB limit.'
		});
	});

	it('rejects corrupt images when decoding fails', async () => {
		const decodeImage = vi.fn(async () => {
			throw new Error('Decode failed.');
		});
		const file = imageFile('broken.jpg', 'image/jpeg', [1, 2, 3]);

		await expect(intakeStaticImage(file, { decodeImage })).resolves.toEqual({
			accepted: false,
			failure: {
				code: 'corrupt-image',
				message: 'This image could not be read. It may be corrupt or unsupported.'
			}
		});
		expect(decodeImage).toHaveBeenCalledWith(file);
	});

	it('rejects animated PNGs before decoding', async () => {
		const decodeImage = vi.fn(async () => decodedImage());
		const file = imageFile('spinner.png', 'image/png', animatedPngBytes());

		await expectIntakeFailure(file, decodeImage, {
			code: 'animated-png',
			message: 'Animated PNG files are not supported.'
		});
	});
});

async function expectIntakeFailure(
	file: File,
	decodeImage: (file: File) => Promise<ReturnType<typeof decodedImage>>,
	failure: { code: string; message: string }
) {
	const result = await intakeStaticImage(file, { decodeImage });

	expect(result).toEqual({
		accepted: false,
		failure
	});
	expect(decodeImage).not.toHaveBeenCalled();
}

function decodedImage(width = 640, height = 480) {
	return {
		width,
		height,
		close: vi.fn()
	};
}

function imageFile(name: string, type: string, bytes: number[] | Uint8Array) {
	return new File([new Uint8Array(bytes)], name, { type });
}

function animatedPngBytes() {
	return [...pngSignature(), ...pngChunk('acTL', []), ...pngChunk('IDAT', [1])];
}

function pngSignature() {
	return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
}

function pngChunk(type: string, data: number[]) {
	const bytes = [
		(data.length >> 24) & 0xff,
		(data.length >> 16) & 0xff,
		(data.length >> 8) & 0xff,
		data.length & 0xff,
		type.charCodeAt(0),
		type.charCodeAt(1),
		type.charCodeAt(2),
		type.charCodeAt(3),
		...data,
		0,
		0,
		0,
		0
	];

	return bytes;
}
