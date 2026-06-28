import { formatBytes } from './format';
import {
	MAX_FILE_SIZE,
	SUPPORTED_INPUT_TYPES,
	type ImageMetadata,
	type StaticImageIntakeFailureCode,
	type StaticImageIntakeResult
} from './types';

type StaticImageBitmap = {
	width: number;
	height: number;
	close(): void;
};

export type StaticImageIntakeDependencies<Image extends StaticImageBitmap = ImageBitmap> = {
	decodeImage?: (file: File) => Promise<Image>;
};

export async function intakeStaticImage<Image extends StaticImageBitmap = ImageBitmap>(
	file: File,
	dependencies: StaticImageIntakeDependencies<Image> = {}
): Promise<StaticImageIntakeResult> {
	if (!SUPPORTED_INPUT_TYPES.includes(file.type as (typeof SUPPORTED_INPUT_TYPES)[number])) {
		return rejectStaticImage('unsupported-type');
	}

	if (file.size === 0) {
		return rejectStaticImage('empty-file');
	}

	if (file.size > MAX_FILE_SIZE) {
		return rejectStaticImage('oversized-file');
	}

	if (file.type === 'image/png') {
		try {
			if (isAnimatedPng(await file.arrayBuffer())) {
				return rejectStaticImage('animated-png');
			}
		} catch {
			return rejectStaticImage('corrupt-image');
		}
	}

	const decodeImage = dependencies.decodeImage ?? ((input: File) => createImageBitmap(input));

	try {
		const image = await decodeImage(file);

		try {
			return {
				accepted: true,
				metadata: {
					name: file.name,
					type: file.type,
					size: file.size,
					width: image.width,
					height: image.height
				}
			};
		} finally {
			image.close();
		}
	} catch {
		return rejectStaticImage('corrupt-image');
	}
}

export async function readImageMetadata(file: File): Promise<ImageMetadata> {
	const result = await intakeStaticImage(file);

	if (result.accepted) {
		return result.metadata;
	}

	throw new Error(result.failure.message);
}

export function isAnimatedPng(buffer: ArrayBuffer): boolean {
	const bytes = new Uint8Array(buffer);

	if (!hasPngSignature(bytes)) {
		return false;
	}

	const view = new DataView(buffer);
	let offset = 8;

	while (offset + 12 <= buffer.byteLength) {
		const length = view.getUint32(offset);
		const typeOffset = offset + 4;
		const type = String.fromCharCode(
			bytes[typeOffset],
			bytes[typeOffset + 1],
			bytes[typeOffset + 2],
			bytes[typeOffset + 3]
		);

		if (type === 'acTL') {
			return true;
		}

		if (type === 'IDAT') {
			return false;
		}

		offset += 12 + length;
	}

	return false;
}

function rejectStaticImage(code: StaticImageIntakeFailureCode): StaticImageIntakeResult {
	return {
		accepted: false,
		failure: {
			code,
			message: staticImageIntakeFailureMessage(code)
		}
	};
}

function staticImageIntakeFailureMessage(code: StaticImageIntakeFailureCode): string {
	if (code === 'unsupported-type') {
		return 'Unsupported file. Add a JPEG, PNG, or WebP image.';
	}

	if (code === 'empty-file') {
		return 'This file is empty.';
	}

	if (code === 'oversized-file') {
		return `This file is larger than the ${formatBytes(MAX_FILE_SIZE)} limit.`;
	}

	if (code === 'animated-png') {
		return 'Animated PNG files are not supported.';
	}

	return 'This image could not be read. It may be corrupt or unsupported.';
}

function hasPngSignature(bytes: Uint8Array): boolean {
	return (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	);
}
