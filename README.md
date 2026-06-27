# Crush

Crush is an offline-first local image compression PWA. It compresses JPEG, PNG, and WebP
images in the browser with a Web Worker and browser-native canvas APIs. Images are never
uploaded to a server.

## MVP Features

- Drag-and-drop image upload
- JPEG, PNG, and WebP input
- WebP output by default, with JPEG output available
- High Quality, Balanced, and Smallest File presets
- Local compression in a Web Worker
- Before and after file size comparison
- Individual downloads and batch ZIP download
- PWA service worker for offline reload after the first successful load
- IndexedDB local history with clear history

## Install

Use the Vite+ workflow for this project:

```sh
vp install
```

## Developing

Start the local dev server:

```sh
vp dev
```

## Build

Create a production build:

```sh
vp build
```

Preview the production build:

```sh
vp preview
```

## Check

```sh
vp check
```

Run tests when a test suite is added:

```sh
vp test
```

## Test PWA Offline Mode

1. Run `vp build`.
2. Run `vp preview`.
3. Open the preview URL in a browser.
4. Wait for the first successful load so the service worker can cache the app shell.
5. In DevTools, use Application > Service Workers or Network > Offline to simulate offline mode.
6. Reload the app while offline and compress a local image.

## Known Limitations

- Compression uses browser-native canvas output only.
- AVIF, lossless PNG optimization, crop, watermark, and custom codec controls are not included.
- Large batches can still be limited by browser memory.
- Local history depends on IndexedDB availability and browser storage limits.
