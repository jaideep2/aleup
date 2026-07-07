export { configureDocx, getDocxodus, docxToHtml, splitDocxHtml } from "./client.js";
export {
  openDocxForEditing,
  DocxPatchError,
  splitProjection,
  splitEditedMarkdown,
  diffBlocks,
} from "./roundtrip.js";
export type { DocxEditingHandle, AnchoredBlock, DiffOp } from "./roundtrip.js";
