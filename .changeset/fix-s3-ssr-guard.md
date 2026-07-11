---
"@aleup/import": patch
---

Fix SSR crash (`indexedDB.open is not a function` / `localStorage is not defined`) when `localMode: "s3-multipart"` is used in a Next.js client component. The S3 upload instance and `@uppy/golden-retriever` touch `indexedDB`/`localStorage` at construction, which don't exist during server rendering. The S3 instance is now built only in the browser; during SSR the local uploader falls back to the (SSR-safe) XHR instance, and the real S3 instance is created on the client where local uploads actually run.
