# @aleup/import

## 0.3.1

### Patch Changes

- befa197: Fix several runtime bugs in the s3-multipart upload path:

  - **SSR crash** (`indexedDB.open is not a function` / `localStorage is not defined`): the S3 upload instance + `@uppy/golden-retriever` touch browser globals at construction, which throw during Next.js SSR of the client component. The S3 instance is now built only in the browser; during SSR the local uploader falls back to the SSR-safe XHR instance.
  - **`onComplete` fired before the async finalize settled**: the completion summary is now emitted only after every instance has completed AND every pending `onObjectUploaded` finalize has resolved — so counts are correct and a finalize failure no longer surfaces after "done". Progress is tracked in one shared tracker across both instances, so a batch spanning local + remote reports one coherent total and fires `onComplete` exactly once.
  - **`startUpload()` fired `complete` on an empty instance**: it now only starts an instance that has files queued, avoiding a premature/duplicate batch summary.
  - **Multipart golden-retriever resume** could finalize with an empty key: the finalize seam now falls back to the plugin-persisted `key`/`uploadId` when its in-memory record is gone after a reload.

## 0.3.0

### Minor Changes

- fa8d421: `useUppyImport`'s `onComplete` summary now includes `failedFiles: string[]` — the names of every file that failed in the batch (upload errors and stall-watchdog abandonments), so hosts can show a list of which files to retry instead of only a count. The `onError` message (truncated to the first few names) is unchanged.

## 0.2.0

### Minor Changes

- eb4550e: Add resumable direct-to-storage local uploads and cross-refresh resume. `DestinationPort` gains `localMode` (`"xhr"` | `"s3-multipart"`) and an `s3` `S3MultipartApi`; in `"s3-multipart"` mode `useUppyImport` uploads local files straight to object storage via a second Uppy instance backed by `@uppy/aws-s3`, with `@uppy/golden-retriever` persisting batch/part state to IndexedDB so an interrupted batch resumes after a reload (an `onRestored` callback reports auto-resumed files and large files needing reselection). The remote/Companion (XHRUpload) path is unchanged, and the default `localMode` stays `"xhr"`, so existing hosts behave exactly as before. `@uppy/aws-s3` and `@uppy/golden-retriever` are added as optional peer dependencies.

## 0.1.1

### Patch Changes

- a449245: Fix "Plugin was nullish" crash under React StrictMode. `useUppyImport` destroyed its Uppy instance synchronously in the unmount cleanup, so StrictMode's dev double-mount (setup → cleanup → setup on the same memoized instance) left the live instance destroyed — every `uppy.getPlugin()` then returned null, crashing the Companion OAuth popup callback (and silently masking as "not connected" on the initial probe). Teardown is now deferred a macrotask so a StrictMode re-mount cancels it, while a genuine unmount (or a deps-change instance swap) still tears down.
