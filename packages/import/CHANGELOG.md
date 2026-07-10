# @aleup/import

## 0.2.0

### Minor Changes

- eb4550e: Add resumable direct-to-storage local uploads and cross-refresh resume. `DestinationPort` gains `localMode` (`"xhr"` | `"s3-multipart"`) and an `s3` `S3MultipartApi`; in `"s3-multipart"` mode `useUppyImport` uploads local files straight to object storage via a second Uppy instance backed by `@uppy/aws-s3`, with `@uppy/golden-retriever` persisting batch/part state to IndexedDB so an interrupted batch resumes after a reload (an `onRestored` callback reports auto-resumed files and large files needing reselection). The remote/Companion (XHRUpload) path is unchanged, and the default `localMode` stays `"xhr"`, so existing hosts behave exactly as before. `@uppy/aws-s3` and `@uppy/golden-retriever` are added as optional peer dependencies.

## 0.1.1

### Patch Changes

- a449245: Fix "Plugin was nullish" crash under React StrictMode. `useUppyImport` destroyed its Uppy instance synchronously in the unmount cleanup, so StrictMode's dev double-mount (setup → cleanup → setup on the same memoized instance) left the live instance destroyed — every `uppy.getPlugin()` then returned null, crashing the Companion OAuth popup callback (and silently masking as "not connected" on the initial probe). Teardown is now deferred a macrotask so a StrictMode re-mount cancels it, while a genuine unmount (or a deps-change instance swap) still tears down.
