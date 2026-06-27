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

## Relationships

- A compression job has exactly one **Output Format**
- **Lossless PNG Optimization** can be used for any supported input format
- **Lossless PNG Optimization** is lossless relative to decoded image pixels, not necessarily the original encoded source data
- **Lossless PNG Optimization** preserves original decoded dimensions and does not use size-changing presets
- **Lossless PNG Optimization** works from original PNG bytes for PNG inputs and from decoded pixels for non-PNG inputs
- **Lossless PNG Optimization** returns the original PNG bytes when a PNG input cannot be made smaller
- **Lossless PNG Optimization** may strip non-visual metadata, but must preserve visual and color correctness
- **Lossless PNG Optimization** does not use quality or resizing presets
- **Already Optimized** applies only to PNG inputs processed with **Lossless PNG Optimization**
- A failed **Lossless PNG Optimization** does not silently fall back to unoptimized PNG output
- Crush supports **Static Image** compression; animated PNGs are outside **Lossless PNG Optimization**

## Example dialogue

> **Dev:** "Should PNG be a special path only for PNG uploads?"
> **Domain expert:** "No — PNG is a fourth **Output Format** alongside AVIF, WebP, and JPEG."
> **Dev:** "Can Smallest File shrink a PNG's dimensions?"
> **Domain expert:** "No — **Lossless PNG Optimization** preserves the decoded dimensions."
> **Dev:** "What if a PNG input is already smaller than the optimized output?"
> **Domain expert:** "Return the original PNG bytes and show **Already Optimized**; optimization should never make a PNG input worse."
> **Dev:** "Should an animated PNG be optimized as a PNG?"
> **Domain expert:** "No — Crush is for **Static Image** assets, so animated PNGs should not be silently changed."
> **Dev:** "If the PNG optimizer errors, should we emit a normal canvas PNG?"
> **Domain expert:** "No — report the file failure instead of silently weakening **Lossless PNG Optimization**."

## Flagged ambiguities

- "lossless" was resolved to mean preserving decoded image pixels for every supported input format.
