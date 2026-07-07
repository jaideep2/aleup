---
title: "@aleup/view"
---

# @aleup/view

Format-routing document viewer. The base router ships only trivial renderers (pdf/
google-native iframes, images, `<pre>` text); heavy formats are **registered by the
host** from opt-in subpaths, so Tiptap and the DOCX WASM runtime never enter bundles
that don't preview those formats.

```tsx
import { DocumentViewer, detectFormat } from "@aleup/view";
import { MarkdownView } from "@aleup/view/markdown";
import { DocxHtmlView } from "@aleup/view/docx";
import "@aleup/view/styles.css";

<DocumentViewer
  format={detectFormat(mime, name)}
  name={name}
  fileUrl={proxyUrl}          // host serves bytes with Content-Disposition: inline
  textContent={text}          // host fetches text for md/text
  docxBytes={bytes}           // host fetches bytes for docx
  renderers={{ md: MarkdownView, docx: (s) => <DocxHtmlView bytes={s.docxBytes ?? null} /> }}
  slots={{ loading, error, fallback }}
/>;
```

The host does all IO — aleup renders. `textLoading`/`textError` route through the
`loading`/`error` slots so every text-ish renderer gets consistent state handling;
unknown formats hit the `fallback` slot (default: a download link).

## `<DocxHtmlView>` (`@aleup/view/docx`)

Read-only DOCX preview: bytes → Docxodus HTML, rendered 1:1 with the converter's own
stylesheet scoped to the subtree. If the HTML converter chokes on a document the
session engine still reads, it falls back to a read-only markdown render of the editing
projection — so preview works whenever editing does. Requires the
[WASM setup](/docs/wasm-setup).

## `<PdfViewer>`

Deliberately an `<iframe>` on the browser's native PDF engine (scroll/zoom/search/print
included). We tried pdfjs-dist; its v5 ESM bundle crashes under Next 15's webpack at
module init. View-only PDF is exactly what the native viewer is best at.
