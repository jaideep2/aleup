---
"@aleup/import": minor
---

Folder imports preserve structure: `expandSelection` tags each folder-expanded file with `relativePath` (containing-folder path relative to the selection, including the picked folder's name); `importRemoteFiles` forwards it as per-file Uppy meta (and `allowedMetaFields` includes it, so XHR/Companion pass it through); `uploadLocalFiles` now accepts `Array<File | { file, meta }>` so hosts can attach per-file meta such as a `webkitRelativePath`-derived path. New exported type `LocalFileEntry`. Directly-picked files carry no `relativePath` and land at the host's root as before.
