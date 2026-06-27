# PRD: Crush

## 1. Product Name

**Crush**

## 2. One-Line Description

Crush is an offline-first browser app for compressing images locally.

## 3. Product Summary

Crush lets users drag images into the browser, compress them locally, compare file sizes, and download smaller versions.

The app should work without requiring an account, upload, backend, or internet connection after the first load.

## 4. Core Promise

Your images stay on your device.

## 5. Problem

Web images are often too large. Large images make websites slower, hurt user experience, and waste bandwidth.

Existing tools can be too technical, outdated, or dependent on internet access. Users need a simple way to reduce image size while still trusting the visual result.

## 6. Target Users

### Primary Users

- Web developers
- Designers
- Freelancers
- Small agency teams
- People preparing assets for websites

### Secondary Users

- Bloggers
- Content creators
- Small business owners
- Students building portfolio sites

## 7. User Goals

Users want to:

- Make image files smaller
- Avoid uploading private/client images to a server
- Compress multiple images quickly
- See how much space was saved
- Download optimized files
- Use the app even when offline

## 8. MVP Scope

### 8.1 Local Image Upload

Users can drag and drop images into the app.

Supported input formats:

- JPEG
- PNG
- WebP

The app should show:

- File name
- Original file size
- Image dimensions
- File type

### 8.2 Image Compression

Users can compress images locally in the browser.

Supported MVP outputs:

- AVIF
- WebP
- JPEG

Default output should be **AVIF**.

### 8.3 Compression Presets

Users can choose from three simple presets:

#### High Quality

Best visual quality. Smaller reduction.

#### Balanced

Good quality with meaningful savings. Default option.

#### Smallest File

Prioritizes file size reduction.

### 8.4 Results View

For each compressed image, show:

- Original file size
- Compressed file size
- Percentage saved
- Output format
- Output dimensions
- Compression status

Status values:

- Waiting
- Compressing
- Complete
- Failed

### 8.5 Image Preview

Users can preview the compressed result.

MVP preview can be simple:

- Original preview
- Compressed preview

A draggable before/after comparison slider is optional for later.

### 8.6 Download

Users can download:

- A single compressed image
- All compressed images as a ZIP file

Downloaded files should keep readable names.

Example:

```txt
hero.jpg → hero-crushed.avif
product-photo.png → product-photo-crushed.avif
```

### 8.7 Offline Support

The app should be installable as a PWA.

After the first visit, users should be able to:

- Open the app offline
- Compress images offline
- Download results offline

### 8.8 Local History

The app should save recent compression jobs locally.

A job should include:

- Date created
- Number of images
- Total original size
- Total compressed size
- Total savings
- Compressed output files

Users should be able to clear local history.

## 9. Non-Goals for MVP

Do not build these in the MVP:

- User accounts
- Cloud storage
- Server-side compression
- Payments
- Team accounts
- Public image URLs
- CDN delivery
- AI image editing
- Cropping
- Watermarks
- Full image editor
- Folder management
- Advanced codec settings
- Mobile app
- Desktop app

## 10. Core User Flow

```txt
User opens Crush
→ drops images into the app
→ chooses a compression preset
→ clicks Compress
→ sees before/after file sizes
→ downloads compressed images
```

## 11. Technical Direction

### Frontend

Use:

- Vite
- Svelte
- TypeScript

Reason:

Crush is an interactive tool. Svelte fits this better than a mostly static framework.

### Offline App

Use:

- vite-plugin-pwa
- Service worker
- Cache Storage

The app shell should be cached for offline use.

### Compression

Use browser-native compression for WebP and JPEG:

```txt
File
→ createImageBitmap()
→ canvas
→ canvas.toBlob()
→ compressed Blob
```

Use a WASM AVIF encoder when AVIF is selected.

### Background Processing

Use Web Workers.

Main thread:

- Handles UI
- Receives file input
- Shows progress
- Displays results

Worker thread:

- Decodes images
- Compresses images
- Returns compressed blobs
- Reports progress

### Local Storage

Use IndexedDB for:

- Job history
- Compressed output blobs
- Metadata

Use Cache Storage for:

- App files
- PWA assets

### ZIP Downloads

Use `fflate` for browser-side ZIP creation.

## 12. Suggested File Structure

```txt
src/
  App.svelte

  components/
    Dropzone.svelte
    PresetPicker.svelte
    ImageQueue.svelte
    ImageResultCard.svelte
    ImagePreview.svelte
    DownloadButton.svelte
    HistoryPanel.svelte

  workers/
    compressor.worker.ts

  lib/
    compress.ts
    presets.ts
    db.ts
    files.ts
    format.ts
    zip.ts
    image-metadata.ts

  styles/
    app.css
```

## 13. Data Models

### CompressionPreset

```ts
type CompressionPreset = {
	id: 'quality' | 'balanced' | 'smallest';
	label: string;
	outputType: 'image/avif' | 'image/webp' | 'image/jpeg';
	quality: number;
	maxWidth: number | null;
};
```

### ImageJob

```ts
type ImageJob = {
	id: string;
	createdAt: string;
	presetId: 'quality' | 'balanced' | 'smallest';
	status: 'waiting' | 'compressing' | 'complete' | 'failed';
	files: ImageResult[];
};
```

### ImageResult

```ts
type ImageResult = {
	id: string;
	originalName: string;
	originalType: string;
	originalSize: number;
	outputName: string;
	outputType: 'image/avif' | 'image/webp' | 'image/jpeg';
	outputSize: number;
	width: number;
	height: number;
	savingsPercent: number;
	outputBlob: Blob;
	error?: string;
};
```

## 14. MVP Presets

```ts
const presets = {
	quality: {
		id: 'quality',
		label: 'High Quality',
		outputType: 'image/avif',
		quality: 0.9,
		maxWidth: null
	},
	balanced: {
		id: 'balanced',
		label: 'Balanced',
		outputType: 'image/avif',
		quality: 0.78,
		maxWidth: 2400
	},
	smallest: {
		id: 'smallest',
		label: 'Smallest File',
		outputType: 'image/avif',
		quality: 0.62,
		maxWidth: 1600
	}
};
```

## 15. Validation Rules

The app should reject:

- Unsupported file types
- Empty files
- Files above the max file size
- Corrupt images

Recommended MVP limits:

- Max file size: 25 MB per image
- Max batch size: 25 images
- Supported input: JPEG, PNG, WebP

If compression makes the file larger, show a warning:

```txt
The compressed file is larger than the original.
```

In that case, the user should still be able to download it, but the UI should make the result clear.

## 16. Error States

Handle:

- Unsupported file type
- Failed image decode
- Failed compression
- Browser memory issues
- ZIP creation failure
- Offline app cache failure
- IndexedDB unavailable

Errors should be plain and useful.

Example:

```txt
This image could not be compressed. Try a smaller file or a different format.
```

## 17. Success Metrics

The MVP is successful when:

- A user can compress one image locally
- A user can compress multiple images locally
- A user can download one result
- A user can download all results as a ZIP
- The app works offline after first visit
- The UI clearly shows file-size savings
- No backend is required
- No account is required
- Images never leave the device

## 18. Build Order

### Milestone 1: Single Image Compression

- Create Vite + Svelte app
- Add drag-and-drop upload
- Read image metadata
- Compress one image to AVIF
- Show original size
- Show compressed size
- Download compressed image

### Milestone 2: Batch Compression

- Support multiple files
- Add queue state
- Add progress state
- Compress images one by one
- Show result cards
- Handle failures per file

### Milestone 3: ZIP Download

- Add download all
- Generate ZIP in browser
- Use clean output filenames

### Milestone 4: PWA Offline Support

- Add app manifest
- Add service worker
- Cache app shell
- Test offline reload
- Add install prompt where appropriate

### Milestone 5: Local History

- Add IndexedDB
- Save completed jobs
- Show recent jobs
- Allow re-download
- Add clear history button

### Milestone 6: Polish

- Improve empty state
- Improve error states
- Add storage warning
- Add privacy message
- Add keyboard-accessible controls
- Add responsive layout

## 19. Future Features

Add later:

- Lossless PNG optimization
- Before/after comparison slider
- Custom width resizing
- Custom quality slider
- Preset saving
- Desktop wrapper with Tauri
- Cloud sync
- Optional account
- Shareable compression reports

## 20. Positioning

### Main Tagline

Compress images locally. No upload required.

### Alternate Taglines

- Offline image compression in your browser.
- Smaller images. Faster websites.
- Drop images in. Get smaller files out.

## 21. Final MVP Definition

Crush MVP is complete when a user can open the app, drop images, compress them locally, see file-size savings, download the results, and use the app offline after the first visit.
