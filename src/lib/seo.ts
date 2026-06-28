export const siteOrigin = 'https://crush.apical.workers.dev';
export const homeUrl = `${siteOrigin}/`;
export const socialImageUrl = `${siteOrigin}/web-app-manifest-512x512.png`;

export function absoluteUrl(path: string) {
	return new URL(path, homeUrl).toString();
}

export function jsonLdScript(data: unknown) {
	const json = JSON.stringify(data).replace(/</g, '\\u003c');

	return `<script type="application/ld+json">${json}</script>`;
}
