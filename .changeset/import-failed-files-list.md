---
"@aleup/import": minor
---

`useUppyImport`'s `onComplete` summary now includes `failedFiles: string[]` — the names of every file that failed in the batch (upload errors and stall-watchdog abandonments), so hosts can show a list of which files to retry instead of only a count. The `onError` message (truncated to the first few names) is unchanged.
