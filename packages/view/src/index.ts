export { DocumentViewer } from "./DocumentViewer.js";
export type {
  DocumentViewerProps,
  DocumentViewerSlots,
  DocRenderer,
  DocSource,
} from "./DocumentViewer.js";
export { PdfViewer } from "./PdfViewer.js";
// Convenience re-exports so view-only hosts don't need a direct @aleup/core import.
export { detectFormat } from "@aleup/core";
export type { DocFormat } from "@aleup/core";
