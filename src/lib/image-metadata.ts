import type { ImageMetadata } from './types';

export async function readImageMetadata(file: File): Promise<ImageMetadata> {
	const bitmap = await createImageBitmap(file);

	try {
		return {
			name: file.name,
			type: file.type,
			size: file.size,
			width: bitmap.width,
			height: bitmap.height
		};
	} finally {
		bitmap.close();
	}
}
