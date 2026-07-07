"use client";

// Format router for read-only document previews: picks the renderer by format. Editing is
// orchestrated by the host panel, which swaps this out for a DocEditor (@aleup/editor).
//
//   .pdf            → native browser PDF viewer in an <iframe> (view-only)
//   native Google   → host-provided PDF-proxy URL in an iframe
//   images          → <img>
//   .txt            → <pre>
//   .md / .docx     → a renderer the HOST registers (import "@aleup/view/markdown" and/or
//                     "@aleup/view/docx" and pass renderers={{ md: MarkdownView, docx: … }})
//                     — registry, not switch, so the base router never drags Tiptap/WASM
//                     into bundles that don't preview those formats.
//   everything else → fallback slot with a download action
//
// Theming: default states are unstyled markup tagged data-aleup-viewer-state; import
// "@aleup/view/styles.css" for a neutral look, or replace them via `slots`.

import type { ComponentType, ReactNode } from "react";
import type { DocFormat } from "@aleup/core";
import { PdfViewer } from "./PdfViewer.js";

/** Everything a format renderer might need. Hosts fetch bytes/text; aleup never does IO here. */
export interface DocSource {
  format: DocFormat;
  name: string;
  /** Streaming URL for the raw bytes (host proxy; also the iframe/img src). */
  fileUrl: string;
  /** Text content for md/text formats (host fetches it — it also feeds the editor). */
  textContent?: string | null;
  textLoading?: boolean;
  textError?: boolean;
  /** Raw bytes for DOCX (host fetches them — they also feed the editing session). */
  docxBytes?: Uint8Array | null;
}

export type DocRenderer = ComponentType<DocSource>;

export interface DocumentViewerSlots {
  loading?: ReactNode;
  error?: ReactNode;
  /** Rendered for formats with no renderer (and the "other" format). */
  fallback?: (source: DocSource) => ReactNode;
}

export interface DocumentViewerProps extends DocSource {
  /** Per-format renderer registry, merged over the built-ins. */
  renderers?: Partial<Record<DocFormat, DocRenderer>>;
  slots?: DocumentViewerSlots;
  classNames?: {
    image?: string;
    text?: string;
    frame?: string;
  };
}

const defaultLoading = (
  <div data-aleup-viewer-state="loading">
    <span data-aleup-spinner="" />
  </div>
);

const defaultError = (
  <div data-aleup-viewer-state="error">
    <p>Failed to load preview</p>
  </div>
);

function DefaultFallback({ source }: { source: DocSource }) {
  return (
    <div data-aleup-viewer-state="fallback">
      <p>Preview not available for this file type.</p>
      <a data-aleup-download="" href={source.fileUrl} download={source.name}>
        Download
      </a>
    </div>
  );
}

export function DocumentViewer(props: DocumentViewerProps) {
  const { renderers, slots, classNames, ...source } = props;
  const { format, name, fileUrl, textContent, textLoading, textError } = source;

  const fallback = slots?.fallback ?? ((s: DocSource) => <DefaultFallback source={s} />);

  const Custom = renderers?.[format];
  if (Custom && format !== "md") return <Custom {...source} />;

  if (format === "pdf") return <PdfViewer url={fileUrl} name={name} className={classNames?.frame} />;

  if (format === "google-native")
    return <iframe data-aleup-frame="" src={fileUrl} title={name} className={classNames?.frame} />;

  if (format === "image")
    return <img data-aleup-image="" src={fileUrl} alt={name} className={classNames?.image} />;

  if (format === "md" || format === "text") {
    // Text arrives from the host asynchronously — loading/error are routed here so every
    // text-ish renderer gets consistent state handling.
    if (textLoading) return <>{slots?.loading ?? defaultLoading}</>;
    if (textError || textContent == null) return <>{slots?.error ?? defaultError}</>;
    if (format === "text")
      return (
        <pre data-aleup-text="" className={classNames?.text}>
          {textContent}
        </pre>
      );
    if (Custom) return <Custom {...source} />;
    return <>{fallback(source)}</>;
  }

  return <>{fallback(source)}</>;
}
