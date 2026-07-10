---
"@aleup/import": minor
---

Add resumable direct-to-storage local uploads and cross-refresh resume. `DestinationPort` gains `localMode` (`"xhr"` | `"s3-multipart"`) and an `s3` `S3MultipartApi`; in `"s3-multipart"` mode `useUppyImport` uploads local files straight to object storage via a second Uppy instance backed by `@uppy/aws-s3`, with `@uppy/golden-retriever` persisting batch/part state to IndexedDB so an interrupted batch resumes after a reload (an `onRestored` callback reports auto-resumed files and large files needing reselection). The remote/Companion (XHRUpload) path is unchanged, and the default `localMode` stays `"xhr"`, so existing hosts behave exactly as before. `@uppy/aws-s3` and `@uppy/golden-retriever` are added as optional peer dependencies.
