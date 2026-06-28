export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return '0 B';
	}

	const units = ['B', 'KB', 'MB', 'GB'];
	const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** index;
	const precision = value >= 10 || index === 0 ? 0 : 1;

	return `${value.toFixed(precision)} ${units[index]}`;
}

export function formatSavings(value: number): string {
	return `${Math.round(value)}%`;
}

export function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(value));
}
