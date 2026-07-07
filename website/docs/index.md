---
sidebar_position: 1
slug: /
title: What is aleup?
---

# What is aleup?

**aleup** is a headless, modular document toolkit for React apps. It gives you:

1. **Import** — files from local disk and cloud providers (Google Drive, OneDrive, Box,
   Dropbox) via [Uppy](https://uppy.io) + Companion, streamed server-side so bytes never
   touch the browser.
2. **View** — pdf / docx / markdown / text / images with format-appropriate renderers.
3. **Edit** — markdown and DOCX in-app (headless [Tiptap](https://tiptap.dev)), with
   high-fidelity DOCX round-tripping: only the blocks the user changed are patched, so
   every byte of untouched formatting survives.
4. **Export** — the exact DOM the user is looking at, paginated to PDF.
5. **Save back** — to a user's connected cloud drive.

## The one rule

**aleup never knows about your app.** No auth, no database, no storage opinions. Host
concerns are injected through small interfaces called [ports](/docs/ports) —
`DestinationPort` says where uploaded bytes go, `CredentialsPort` supplies OAuth app
credentials, and so on. That's also what makes `npm update` safe: vendor libraries
(Uppy, Tiptap, docxodus, html2pdf.js) are **peer dependencies** touched only inside
adapters, and the behaviors we rely on are pinned by contract tests that run in CI
against the installed versions.

## Headless first, themeable always

Every capability ships as hooks/logic with zero UI. The optional React components share
one [theming contract](/docs/theming) — per-slot `classNames`, `components` slot
substitution, `data-aleup-*` attributes, and `--aleup-*` CSS variables — so the same
picker renders native in shadcn, MUI, daisyUI, Mantine, or anything else. See the
[examples](/docs/examples).

## Packages

| Package | What it does |
|---|---|
| [`@aleup/core`](/docs/packages/core) | Ports, MIME registry, format detection. Zero runtime deps. |
| [`@aleup/import`](/docs/packages/import) | `useUppyImport` + `useCloudDrivePicker` headless hooks. |
| [`@aleup/companion`](/docs/packages/companion) | Config-mapped factory for the Uppy Companion server. |
| [`@aleup/editor`](/docs/packages/editor) | Headless Tiptap document editor preset + page component. |
| [`@aleup/view`](/docs/packages/view) | Format router; DOCX/markdown renderers behind opt-in subpaths. |
| [`@aleup/docx`](/docs/packages/docx) | DOCX ⇄ HTML/Markdown translation + editing sessions (WASM). |
| [`@aleup/pdf`](/docs/packages/pdf) | DOM → paginated PDF export. |
| [`@aleup/connect`](/docs/packages/connect) | OAuth + save-back write clients, fetch-only. |

Install only what you use — `@aleup/core` is the single shared dependency.
