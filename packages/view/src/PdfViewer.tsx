"use client";

// PDF viewer — view-only preview via the browser's built-in PDF engine in an <iframe>,
// pointed at a URL that serves the bytes with `Content-Disposition: inline` (so browsers
// render rather than download).
//
// Deliberately NOT react-pdf / pdfjs-dist: pdfjs-dist 5's self-contained ESM bundle crashes
// under Next 15's webpack ("Object.defineProperty called on non-object") at module init,
// before any file loads. PDFs here are view-only, and the native viewer already provides
// scroll, zoom, search, and print — the iframe is both more robust and functionally
// equivalent.

export function PdfViewer({
  url,
  name,
  className,
}: {
  url: string;
  name: string;
  className?: string;
}) {
  return <iframe data-aleup-pdf="" src={url} title={name} className={className} />;
}
