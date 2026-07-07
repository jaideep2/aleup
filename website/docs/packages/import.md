---
title: "@aleup/import"
---

# @aleup/import

Headless Uppy orchestration for local uploads and cloud-provider imports. One Uppy
instance per import surface; Uppy owns all upload networking.

**Peers:** `@uppy/core`, `@uppy/xhr-upload`, `@uppy/companion-client`, `react`. Provider
plugins (`@uppy/google-drive`, `/onedrive`, `/box`, `/dropbox`) are *optional* peers,
imported via subpaths so unused ones stay out of your bundle.

## useUppyImport(options)

```ts
const { uppy, providerClient, uploadLocalFiles, importRemoteFiles, startUpload } =
  useUppyImport({
    destination,            // DestinationPort — where bytes go (your policy)
    companionUrl,           // your Companion origin
    providers: [googleDrive()],
    meta: () => ({ tags }), // extra multipart fields, re-read per upload
    concurrency: 8,
    stallMs: 120_000,
    onProgress, onComplete, onError, onFileUploaded,
  });
```

What it handles for you (all extracted from a production legal-tech app):

- **Local vs remote targets** — local uploads go browser→`localUploadTarget()`; remote
  imports are streamed server-side by Companion into `remoteUploadTarget()` (typically
  token-authenticated, since Companion can't send the browser's session cookie).
- **Progress accounting** — one batch at a time, with an immediate indeterminate
  `"importing"` phase so UI reacts the moment the user confirms, before bytes flow.
- **Stall watchdog** — a remote file that started transferring then goes silent (dead
  source mid-stream) is abandoned and counted as failed; files merely queued behind the
  concurrency limit are never killed.
- **Unmount drain** — if a batch is mid-flight when your component unmounts, the
  instance survives until `complete` so navigation doesn't abort uploads.
- **Native Google files** — renamed/retyped to their Office export target by default
  (override with `transformRemoteItem`).

## useCloudDrivePicker(options)

The picker *state machine* — connection probing, OAuth kickoff (Companion popup),
breadcrumb navigation, pagination, selection with select-all, and capped breadth-first
folder expansion into a flat file list. You bring the dialog; see the
[examples](/docs/examples) for the same picker rendered in three design systems.

```ts
const picker = useCloudDrivePicker({
  open,
  provider: providerClient("drive"),
  rootLabel: "Google Drive",
  isFileSelectable: (mime) => isIndexable(mime),
});
```

`picker.confirmSelection()` expands folders and returns the flat file list (or `null`
with `picker.error` set — keep the dialog open).

## Helpers

`fileLabel(mime)`, `formatSize(bytes)`, and `isFolderShortcut(item)` — the latter works
around Companion's Drive adapter mislabeling *shortcuts to folders* as downloadable
files (their download 404s; the item's icon URL carries the true type).

## Contract tests

This package reaches into three Uppy internals that semver does not protect (the
plugin's `provider` client, `setFileState` xhrUpload overrides, stable-id dedup). Each
is wrapped in an adapter and pinned by a contract test that runs against the installed
Uppy version — an `npm update` that breaks one fails in CI, not in production.
