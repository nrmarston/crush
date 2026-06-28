# Use dependency-driven Static Image compression execution

Crush will concentrate deterministic Static Image compression execution in an importable module instead of trapping Output Format behavior inside the worker. The module owns Static Image intake, Output Format branching, output dimensions, JPEG background fill, AVIF quality conversion, MIME mismatch checks, result assembly, and compression failure behavior, while browser and codec capabilities such as image decoding, canvas drawing and output, AVIF encoding, and PNG optimization are provided by the worker adapter. This adds an explicit low-level adapter boundary, but keeps AVIF, WebP, JPEG, and PNG behavior testable without standing up worker-specific runtime machinery.

The extraction preserves the current decoded-image lifecycle: intake may decode and close an image for validation, then each Output Format path decodes and closes the image it needs for encoding. Sharing a decoded image across intake and encoding would save work, but it would make ownership and cleanup part of this boundary change instead of a separate performance optimization.

The app-facing compression seam remains `compressImage(id, file, preset)`, which stays worker-backed so UI code does not need to wire browser and codec dependencies or run heavy encoding on the main thread. The new execution module is the worker's implementation seam and the direct test seam for Output Format behavior.

The execution module remains exception-based for failures so it matches the existing `compressImage` promise contract. The module owns user-facing messages for deterministic compression failures, while the worker adapter only serializes `Error.message` into a failed worker response and supplies a generic fallback for non-`Error` throwables.

`optimizeLosslessPng` remains a specialized helper because it already owns the tested Lossless PNG Optimization rules. The execution module calls it for PNG output, passes in the injected PNG dependencies, and owns the final CompressionResult assembly and Already Optimized propagation.

AVIF output continues to use the bundled `@jsquash/avif` encoder instead of browser canvas blob encoding. The execution module owns the AVIF branch and quality conversion from the app's `0..1` preset scale to the encoder's `1..100` scale, while the adapter supplies the actual encoder function.

The execution module exports its main compression operation and dependency types, not its internal helper functions. Output dimensions, JPEG fill ordering, MIME checks, and AVIF quality conversion should be verified through the observable behavior of the execution operation so the module does not become a general-purpose image utility surface.

The module lives at `src/lib/static-image-compression.ts` and exports `compressStaticImage` plus its dependency types. It is imported directly by the worker and tests, but it is not exported from the `$lib` barrel because `compressImage` remains the app-facing compression API.

The execution module depends on a small project-owned canvas abstraction rather than raw `OffscreenCanvas` and rendering-context types. The abstraction exposes only the operations compression needs, such as filling, drawing, reading image data, and converting to a blob; the worker adapter wraps real `OffscreenCanvas`, while tests provide fakes.

The execution module decides the canvas alpha requirement because it is part of Output Format behavior. JPEG output requests a non-alpha canvas and fills it white before drawing, while AVIF and WebP request alpha-preserving canvas output.

The execution module uses one injected image-decoding capability for intake, lossy output, and PNG optimization, but calls it separately for each step that needs a decoded image. This keeps the dependency surface small while preserving the separate decoded-image lifecycle.

The execution module owns user-facing canvas capability errors even though the worker adapter wraps `OffscreenCanvas`. Canvas dependencies should report unavailable canvas or context capability in a structured way, and the execution module should translate that into the existing messages: `Canvas compression is not supported in this browser.` or `Canvas compression is not available in this browser.`

After the extraction, the worker is only a transport and production-dependency adapter. It receives compression messages, ignores unrelated messages, constructs browser and codec dependencies, calls the execution module, posts complete or failed responses, and translates unknown throwables to the generic worker failure message. It does not branch on Output Format, calculate output dimensions, fill JPEG backgrounds, check MIME mismatch, assemble CompressionResult values, or call `optimizeLosslessPng` directly.

Verification should focus on direct execution-module tests with fake low-level dependencies. These tests should cover Static Image intake failures, AVIF/WebP/JPEG resizing rules, JPEG fill ordering, AVIF quality conversion, MIME mismatch failure messages, PNG orchestration with Already Optimized propagation, and CompressionResult assembly.
