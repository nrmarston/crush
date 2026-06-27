# Use a local WASM PNG optimizer for PNG output

Crush will support PNG as a fourth output format through a local WASM PNG optimizer rather than relying on browser canvas PNG encoding alone. PNG inputs are optimized from their original bytes so **Lossless PNG Optimization** can preserve decoded pixels and dimensions without making PNG inputs larger; JPEG and WebP inputs are decoded, encoded as PNG, then optimized. PNG output uses one fixed conservative optimizer effort instead of mapping the existing quality presets to optimizer effort. This keeps Crush's no-upload/offline promise while making PNG output a real optimizer path instead of a format-conversion label.

## Considered Options

- Browser `canvas.convertToBlob({ type: 'image/png' })`: simpler, but does not satisfy the product promise of PNG optimization.
- Local WASM PNG optimizer: adds dependency size and worker cost, but matches the lossless optimization behavior users expect.
