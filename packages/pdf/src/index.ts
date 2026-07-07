// Client-side PDF export: html2pdf.js over a live editor/preview container, so the PDF is
// paginated from the exact DOM the user is looking at — the print CSS *is* the screen CSS.
//
// Import only from client components; html2pdf.js touches `window` at import time (which is
// why it's dynamically imported inside the functions below).

const DEFAULT_MARGIN_PT = 54; // 0.75in — matches @aleup/editor's .doc-page padding ratio

export interface PdfExportOptions {
  /** Download filename (".pdf" appended if missing). */
  filename: string;
  /** Page margin in points. Default 54 (0.75in). */
  marginPt?: number;
  /** jsPDF page format. Default "letter". */
  pageFormat?: "letter" | "a4" | "legal";
}

// html2canvas (bundled by html2pdf.js) can't parse CSS `oklch()`, which Tailwind v4 emits
// for every color utility — so any export throws "attempting to parse an unsupported color".
// In the cloned DOM (html2canvas attaches it to a sandbox, so computed styles resolve),
// rewrite each element's oklch colors to their sRGB equivalent via a canvas 2d context,
// which normalizes any CSS color string to rgb().
//
// CONTRACT (pinned by a test): this shim never throws — a failure here must not abort the
// export (it just falls back to whatever html2canvas can parse). It is tied to html2canvas
// internals + a Tailwind assumption; treat it as a documented, no-throw workaround.
const COLOR_PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
] as const;

export function neutralizeOklchColors(root: HTMLElement | null | undefined): void {
  if (!root) return;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return;
  const toRgb = (value: string): string | null => {
    try {
      ctx.fillStyle = "#000";
      ctx.fillStyle = value; // canvas resolves oklch()/lab()/… to rgb; invalid values are ignored
      return ctx.fillStyle;
    } catch {
      return null;
    }
  };
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]) {
    const cs = getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const cssName = prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      const val = cs.getPropertyValue(cssName);
      if (val && val.includes("oklch")) {
        const rgb = toRgb(val);
        if (rgb) el.style.setProperty(cssName, rgb);
      }
    }
  }
}

async function makeWorker(el: HTMLElement, opts: PdfExportOptions) {
  const { default: html2pdf } = await import("html2pdf.js");
  const options = {
    margin: opts.marginPt ?? DEFAULT_MARGIN_PT,
    filename: opts.filename.toLowerCase().endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`,
    image: { type: "jpeg" as const, quality: 0.96 },
    html2canvas: {
      scale: 2, // crisp text at print DPI
      useCORS: true,
      // Render the full element even when the on-screen container scrolls.
      windowWidth: el.scrollWidth,
      // Convert Tailwind v4's oklch() colors to rgb in the clone before parsing.
      onclone: (_doc: Document, clonedEl: HTMLElement) => {
        try {
          neutralizeOklchColors(clonedEl ?? _doc.body);
        } catch {
          /* export proceeds regardless */
        }
      },
    },
    jsPDF: { unit: "pt", format: opts.pageFormat ?? "letter", orientation: "portrait" as const },
    // Honor CSS break-* rules first (headings/tables set them in @aleup/editor's styles.css),
    // fall back to legacy page-fitting for unstyled content. Supported at runtime but missing
    // from the package's own type.d.ts — hence the cast below.
    pagebreak: { mode: ["css", "legacy"] },
  };
  const worker = html2pdf();
  return worker.set(options as Parameters<typeof worker.set>[0]).from(el);
}

/** Render `el` to a paginated PDF and return the blob (for save-to-drive flows). */
export async function elementToPdfBlob(el: HTMLElement, opts: PdfExportOptions): Promise<Blob> {
  const worker = await makeWorker(el, opts);
  return (await worker.output("blob")) as Blob;
}

/** Render `el` to a paginated PDF and trigger a browser download. */
export async function downloadElementAsPdf(el: HTMLElement, opts: PdfExportOptions): Promise<void> {
  const worker = await makeWorker(el, opts);
  await worker.save();
}
