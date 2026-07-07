---
title: "@aleup/core"
---

# @aleup/core

Zero-dependency, platform-neutral foundation. Everything else depends on it; nothing in
it depends on the DOM, React, or any vendor.

## Ports

The interfaces hosts implement — see [Ports](/docs/ports) for the full reference:
`DestinationPort`, `UploadTarget`, `AcceptPolicy`, `MetaSupplier`, `TokenStorePort`,
`CredentialsPort`, `TelemetryPort`, `ConnectProvider`.

## MIME registry

A single source of truth for what a document pipeline can ingest, kept deliberately pure
so the same rules run in pickers, API routes, and server ingest paths:

- `DEFAULT_MIME_CATALOG` / `ALL_DEFAULT_MIMES` / `DEFAULT_ACCEPT_EXTENSIONS` — the
  built-in catalog with labels + extensions (extend at runtime with your own entries).
- `isMimeAllowed(mime, allowed)` — allow-list check; native Google editor files map
  through their Office export target (allowing DOCX also allows Google Docs).
- `nativeGoogleExportTarget(mime)` / `nativeGoogleImportTarget(mime)` — Docs↔DOCX,
  Sheets↔XLSX, Slides↔PPTX. XLSX over CSV matters: a CSV export of a multi-tab sheet
  only contains the first tab.
- `isIndexable(mime)` / `isPickable(mime)` — text-extractable / picker-selectable.
- `acceptExtensionsFor(allowed, catalog?)` — build an `<input accept>` string.

## Format detection

```ts
import { detectFormat, type DocFormat } from "@aleup/core";
detectFormat("application/pdf", "brief.pdf"); // "pdf"
// DocFormat = "pdf" | "docx" | "md" | "text" | "image" | "google-native" | "other"
```

## Accept filtering

`filterFilesByAccept(files, accept)` — folder pickers (`webkitdirectory`) ignore the
`accept` attribute entirely, so filter client-side before upload. Structural on
`{ name }`, works on `File` or provider items alike.
