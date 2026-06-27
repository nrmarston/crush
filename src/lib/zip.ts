import { zipSync } from 'fflate';

export type ZipEntry = {
	name: string;
	blob: Blob;
};

export async function createZip(entries: ZipEntry[]): Promise<Blob> {
	const files: Record<string, Uint8Array> = {};
	const usedNames = new Map<string, number>();

	for (const entry of entries) {
		const safeName = uniqueName(entry.name, usedNames);
		files[safeName] = new Uint8Array(await entry.blob.arrayBuffer());
	}

	const zipped = zipSync(files, { level: 6 });

	return new Blob([zipped], { type: 'application/zip' });
}

function uniqueName(name: string, usedNames: Map<string, number>): string {
	const current = usedNames.get(name) ?? 0;
	usedNames.set(name, current + 1);

	if (current === 0) {
		return name;
	}

	const dotIndex = name.lastIndexOf('.');

	if (dotIndex === -1) {
		return `${name}-${current + 1}`;
	}

	return `${name.slice(0, dotIndex)}-${current + 1}${name.slice(dotIndex)}`;
}
