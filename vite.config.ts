import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite-plus';

export default defineConfig({
	staged: {
		'*': 'vp check --fix'
	},
	lint: {
		jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
		rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
		options: { typeAware: true, typeCheck: true }
	},
	fmt: {
		useTabs: true,
		singleQuote: true,
		trailingComma: 'none',
		printWidth: 100,
		sortPackageJson: false,
		ignorePatterns: [
			'package-lock.json',
			'pnpm-lock.yaml',
			'yarn.lock',
			'bun.lock',
			'bun.lockb',
			'/static/'
		]
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter({
				pages: 'build',
				assets: 'build',
				precompress: false,
				strict: true
			})
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			includeAssets: ['robots.txt', 'crush-icon.svg'],
			manifest: {
				name: 'Crush',
				short_name: 'Crush',
				description: 'Compress images locally. No upload required.',
				theme_color: '#f7f7f7',
				background_color: '#f7f7f7',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: '/crush-icon.svg',
						sizes: '192x192',
						type: 'image/svg+xml',
						purpose: 'any maskable'
					},
					{
						src: '/crush-icon.svg',
						sizes: '512x512',
						type: 'image/svg+xml',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				cleanupOutdatedCaches: true,
				globPatterns: ['**/*.{js,css,html,svg,png,avif,webp,ico,txt,woff2,wasm}'],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
			}
		})
	]
});
