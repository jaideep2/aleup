---
title: "@aleup/docx"
---

# @aleup/docx

DOCX ⇄ HTML/Markdown translation and **high-fidelity editing round-trips** over
[docxodus](https://www.npmjs.com/package/docxodus) (a WASM port of Open-Xml-PowerTools).

**Peer:** `docxodus ^6.4` — pinned narrowly on purpose; the WASM asset path is
version-coupled and not semver-protected. **Heads-up: the WASM runtime is ~16 MB** and
served as static assets — see [WASM setup](/docs/wasm-setup). Browser-only.

## Why sessions beat conversion

docxodus intentionally has no one-shot HTML→DOCX converter. Instead,
`openDocxForEditing(bytes)` opens a stateful session over the ORIGINAL OpenXML and
projects it to anchor-addressed markdown. On save, aleup LCS-diffs your edited markdown
against the projection and patches **only the blocks that changed** —
`replaceText` / `insertParagraph` / `deleteBlock` — then re-serializes. Every byte of
untouched formatting (styles, numbering, headers/footers, section properties) survives.

```ts
import { openDocxForEditing, DocxPatchError } from "@aleup/docx";

const handle = await openDocxForEditing(bytes);
editor.setContent(handle.markdown);              // → Tiptap
try {
  const docx = await handle.save(getMarkdown(editor)); // patched .docx bytes
} catch (e) {
  if (e instanceof DocxPatchError) {
    // Edits fell outside the patchable subset — offer a lossy regenerate path
    // WITH user consent. Never silently reset formatting.
  }
} finally {
  handle.close(); // WASM sessions aren't GC'd
}
```

## Preview

`docxToHtml(bytes)` converts to semantic HTML with self-contained, prefixed CSS
(`docx-*` classes); `splitDocxHtml(html)` separates the stylesheet from the body for
scoped injection. Used by [`@aleup/view/docx`](/docs/packages/view).

## Configuration

`configureDocx({ assetBase })` — where the WASM assets are served from (default
`/docxodus/`). Must be called before the first document opens.
