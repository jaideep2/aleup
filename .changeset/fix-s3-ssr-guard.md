---
"@aleup/import": patch
---

Fix several runtime bugs in the s3-multipart upload path:

- **SSR crash** (`indexedDB.open is not a function` / `localStorage is not defined`): the S3 upload instance + `@uppy/golden-retriever` touch browser globals at construction, which throw during Next.js SSR of the client component. The S3 instance is now built only in the browser; during SSR the local uploader falls back to the SSR-safe XHR instance.
- **`onComplete` fired before the async finalize settled**: the completion summary is now emitted only after every instance has completed AND every pending `onObjectUploaded` finalize has resolved — so counts are correct and a finalize failure no longer surfaces after "done". Progress is tracked in one shared tracker across both instances, so a batch spanning local + remote reports one coherent total and fires `onComplete` exactly once.
- **`startUpload()` fired `complete` on an empty instance**: it now only starts an instance that has files queued, avoiding a premature/duplicate batch summary.
- **Multipart golden-retriever resume** could finalize with an empty key: the finalize seam now falls back to the plugin-persisted `key`/`uploadId` when its in-memory record is gone after a reload.
