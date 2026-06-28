# Crush

Crush is an offline-first image compression app for people preparing local image assets for web delivery.

## Language

**Output Format**:
The file format a user chooses for generated images: AVIF, WebP, JPEG, or PNG.
_Avoid_: Export type, target type

**Lossless PNG Optimization**:
A PNG output mode that preserves decoded image pixels and dimensions while producing a smaller PNG when possible.
_Avoid_: PNG compression, PNG conversion

**Already Optimized**:
A result note shown when a PNG input is kept unchanged because optimization could not make it smaller.
_Avoid_: Failed optimization, skipped compression

**Static Image**:
A non-animated image asset with one visual frame.
_Avoid_: Still image

**Visual Comparison**:
The committed completed-result preview that compares original and compressed image appearance at matched display size.
_Avoid_: Pixel diff, dimension comparison, optional preview

**Focused Result**:
The completed result currently shown in the batch's **Visual Comparison**.
_Avoid_: Current file, selected file

**Row Thumbnail**:
A compact image identifier used for scanning batch rows.
_Avoid_: Result preview, Visual Comparison

**Batch Workspace**:
The active batch view shown after at least one image is queued.
_Avoid_: Uploading state, upload workspace

**Compression Progress**:
A per-file progress indicator for local reading and compression work in the browser.
_Avoid_: Upload progress

## Relationships

- A compression job has exactly one **Output Format**
- A compression job validates its file as a **Static Image** when compression runs, even if the **Batch Workspace** already read the file for preview
- **Compression Progress** never means file transfer to a server
- Crush starts with a quiet centered intake surface before there is a **Batch Workspace**
- A **Batch Workspace** uses the available screen space for compact batch controls and one focused **Visual Comparison**
- A **Batch Workspace** keeps the **Visual Comparison** primary without expanding every batch row
- A **Batch Workspace** uses a compact intake control for adding more images instead of the empty-state intake surface
- A completed compression result has one **Visual Comparison**
- A batch compression job may have many **Visual Comparisons**, one for each completed result
- A batch compression job shows one focused **Visual Comparison** at a time
- A batch compression job's **Focused Result** follows the latest completed result until the user chooses a completed result
- A manually chosen **Focused Result** remains focused until the user chooses another completed result or removes it
- Removing the **Focused Result** falls back to the latest remaining completed result
- A batch compression job owns which completed result is the **Focused Result**
- A **Visual Comparison** is the primary image preview for a completed compression result
- A focused **Visual Comparison** identifies its result by file name and status
- A completed focused **Visual Comparison** exposes the single-result download action
- A **Row Thumbnail** helps identify a batch item but is not the completed-result preview
- Completed batch rows can choose the **Focused Result**
- A completed batch row can be selected as a whole while keeping download and remove as separate actions
- Incomplete and failed batch rows do not choose the **Focused Result**
- A **Visual Comparison** opens at an even split whenever the **Focused Result** changes
- A **Visual Comparison** starts with original on the left and compressed on the right
- A **Visual Comparison** uses the image's aspect ratio rather than a square thumbnail frame
- A **Visual Comparison** frame uses the original decoded dimensions when output dimensions differ
- Completed result dimensions describe the generated output dimensions, not the **Visual Comparison** frame
- A result preview keeps the same frame before and after a **Visual Comparison** becomes available
- Before a completed result is available, the result preview may show the active original image and status in the same frame
- A **Visual Comparison** is about visible quality, not whether output dimensions changed
- **Lossless PNG Optimization** can be used for any supported input format
- **Lossless PNG Optimization** is lossless relative to decoded image pixels, not necessarily the original encoded source data
- **Lossless PNG Optimization** preserves original decoded dimensions and does not use size-changing presets
- **Lossless PNG Optimization** works from original PNG bytes for PNG inputs and from decoded pixels for non-PNG inputs
- **Lossless PNG Optimization** returns the original PNG bytes when a PNG input cannot be made smaller
- **Lossless PNG Optimization** may strip non-visual metadata, but must preserve visual and color correctness
- **Lossless PNG Optimization** does not use quality or resizing presets
- AVIF, WebP, and JPEG **Output Formats** may downscale to a preset maximum width while preserving aspect ratio
- AVIF, WebP, and JPEG **Output Formats** never upscale smaller images
- **Already Optimized** applies only to PNG inputs processed with **Lossless PNG Optimization**
- A failed **Lossless PNG Optimization** does not silently fall back to unoptimized PNG output
- Crush supports **Static Image** compression; animated PNGs are outside **Lossless PNG Optimization**
- JPEG **Output Format** flattens transparent pixels onto a white background
- Compression fails when the browser reports an output MIME type that conflicts with the requested **Output Format**

## Example dialogue

> **Dev:** "Should PNG be a special path only for PNG inputs?"
> **Domain expert:** "No — PNG is a fourth **Output Format** alongside AVIF, WebP, and JPEG."
> **Dev:** "Can Smallest File shrink a PNG's dimensions?"
> **Domain expert:** "No — **Lossless PNG Optimization** preserves the decoded dimensions."
> **Dev:** "Can Smallest File shrink AVIF, WebP, or JPEG dimensions?"
> **Domain expert:** "Yes — those **Output Formats** may downscale to the preset maximum width, but they never upscale smaller images."
> **Dev:** "What if a PNG input is already smaller than the optimized output?"
> **Domain expert:** "Return the original PNG bytes and show **Already Optimized**; optimization should never make a PNG input worse."
> **Dev:** "Should an animated PNG be optimized as a PNG?"
> **Domain expert:** "No — Crush is for **Static Image** assets, so animated PNGs should not be silently changed."
> **Dev:** "If the batch preview already accepted the file, can compression skip **Static Image** checks?"
> **Domain expert:** "No — compression must still verify the file is a **Static Image** before producing output."
> **Dev:** "If the PNG optimizer errors, should we emit a normal canvas PNG?"
> **Domain expert:** "No — report the file failure instead of silently weakening **Lossless PNG Optimization**."
> **Dev:** "What should happen to transparent pixels when the **Output Format** is JPEG?"
> **Domain expert:** "JPEG output uses a white background because JPEG cannot preserve transparency."
> **Dev:** "If the browser gives us WebP bytes after the user selected AVIF, should we keep them?"
> **Domain expert:** "No — fail compression rather than producing a file whose contents conflict with the selected **Output Format**."
> **Dev:** "Should the before/after slider reveal dimension changes?"
> **Domain expert:** "No — a **Visual Comparison** compares appearance at matched display size; dimensions stay in the result metrics."
> **Dev:** "When an output is resized, do result dimensions show the original image size?"
> **Domain expert:** "No — completed result dimensions describe the generated output; the **Visual Comparison** frame can still use original dimensions."
> **Dev:** "Which side is before?"
> **Domain expert:** "Original is left, compressed is right, and the comparison opens at an even split."
> **Dev:** "When a batch has many completed images, do they all show full comparisons?"
> **Domain expert:** "No — the batch has one **Focused Result** in the **Visual Comparison**, while the list stays compact."
> **Dev:** "Is the small image in a row also a result preview?"
> **Domain expert:** "No — that is a **Row Thumbnail** for recognition; the **Visual Comparison** is where users inspect output quality."

## Flagged ambiguities

- "lossless" was resolved to mean preserving decoded image pixels for every supported input format.
- "before/after comparison" was resolved to mean **Visual Comparison**, not dimension comparison.
- "comparison slider" can sound single-image-only, but **Visual Comparison** applies per completed result in a batch.
- "optional preview" was resolved to mean stale planning language; **Visual Comparison** is committed completed-result behavior.
- "primary preview" does not mean every batch row expands into a comparison; batch results use one focused **Visual Comparison** with compact rows for scanning.
- "current file" was resolved to mean **Focused Result** when discussing the completed result shown in the batch comparison.
- "thumbnail" was resolved to mean **Row Thumbnail**, not a completed-result preview.
- "reset behavior" was resolved to mean opening each newly **Focused Result** at an even **Visual Comparison** split, not remembering slider position per result.
- "matched display size" was resolved to mean framing both sides with the original decoded dimensions even when compressed output dimensions differ.
- "reserved frame" was resolved to mean the result preview stays present for the active original image before compressed output is available.
- "uploading state" was corrected to **Compression Progress** or **Batch Workspace** state because Crush does not transfer files to a server.
- "add more images" was resolved as compact **Batch Workspace** intake, not the large empty-state intake surface.
- "select preview" was resolved as selecting a completed batch row, not adding a separate preview button to each row.
- "focused preview state" was resolved as batch job state, not route-only UI state.
