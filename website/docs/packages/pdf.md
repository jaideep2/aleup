---
title: "@aleup/pdf"
---

# @aleup/pdf

DOM → paginated PDF export over `html2pdf.js` (which bundles jsPDF + html2canvas).
Browser-only; the vendor lib is dynamically imported at call time because it touches
`window` at import.

The philosophy: **the print CSS is the screen CSS.** You export the exact element the
user is looking at, so `@aleup/editor`'s page styles (break-after on headings,
break-inside on tables/blockquotes) make the editor a live print preview.

```ts
import { elementToPdfBlob, downloadElementAsPdf } from "@aleup/pdf";

await downloadElementAsPdf(pageEl, { filename: "engagement-letter" });
const blob = await elementToPdfBlob(pageEl, { filename: "x.pdf", pageFormat: "a4" });
```

## The oklch() shim

Tailwind v4 emits `oklch()` for every color utility, which html2canvas cannot parse —
without intervention every export throws. aleup rewrites oklch colors to sRGB in the
**cloned** DOM (html2canvas's sandbox) via a canvas 2d context. The shim's contract,
pinned by a test: it **never throws** — a shim failure degrades colors, never aborts the
export. It's a documented workaround tied to html2canvas internals; if you don't use
Tailwind v4 it simply never activates.
