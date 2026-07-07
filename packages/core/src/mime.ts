// Central MIME registry — a single source of truth for what a document pipeline can ingest.
//
// This file is deliberately PURE (zero imports) so it can be bundled into clients (a cloud-drive
// picker), API routes, and server-side ingest paths alike. Keeping all three in sync prevents the
// class of bug where "what the picker lets you select" drifts apart from "what the parser can
// actually extract text from" (a folder would import to zero files silently).

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

const NATIVE_DOC_PREFIX = "application/vnd.google-apps";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Non-native binary/text types text can be extracted from (fetched via alt=media). */
export const SUPPORTED_BINARY_MIMES = new Set<string>([
  "application/pdf",
  "application/msword",
  DOCX_MIME,
  "application/vnd.ms-excel", // legacy .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-powerpoint", // legacy .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
]);

/** Raster image types that are OCR-able for text extraction. */
export const IMAGE_MIMES = new Set<string>(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** True for native Google editor files (Docs/Sheets/Slides) — these cannot be fetched via alt=media. */
export function isNativeGoogleDoc(mimeType: string): boolean {
  return mimeType.startsWith(NATIVE_DOC_PREFIX) && mimeType !== DRIVE_FOLDER_MIME;
}

/** A human-readable file type an admin can allow/disallow for import. */
export interface MimeOption {
  mime: string;
  label: string;
  /** File extensions (with leading dot) for this type — feeds the upload picker's `accept` hint. */
  exts: string[];
}

/**
 * The built-in catalog of importable file types, with display labels and extensions — the master
 * list an "allowed file types" admin editor is drawn from. Order is grouped (documents → data →
 * presentations → text → images) to read sensibly in a UI. Hosts can extend it at runtime with
 * custom {mime, ext} entries, so this is the baseline, not the full universe.
 */
export const DEFAULT_MIME_CATALOG: MimeOption[] = [
  { mime: "application/pdf", label: "PDF (.pdf)", exts: [".pdf"] },
  { mime: DOCX_MIME, label: "Word (.docx)", exts: [".docx"] },
  { mime: "application/msword", label: "Word 97–2003 (.doc)", exts: [".doc"] },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel (.xlsx)",
    exts: [".xlsx"],
  },
  { mime: "application/vnd.ms-excel", label: "Excel 97–2003 (.xls)", exts: [".xls"] },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint (.pptx)",
    exts: [".pptx"],
  },
  { mime: "application/vnd.ms-powerpoint", label: "PowerPoint 97–2003 (.ppt)", exts: [".ppt"] },
  { mime: "text/plain", label: "Text (.txt)", exts: [".txt"] },
  { mime: "text/markdown", label: "Markdown (.md)", exts: [".md"] },
  { mime: "text/csv", label: "CSV (.csv)", exts: [".csv"] },
  { mime: "text/html", label: "HTML (.html)", exts: [".html"] },
  { mime: "application/json", label: "JSON (.json)", exts: [".json"] },
  { mime: "image/jpeg", label: "JPEG image", exts: [".jpg", ".jpeg"] },
  { mime: "image/png", label: "PNG image", exts: [".png"] },
  { mime: "image/gif", label: "GIF image", exts: [".gif"] },
  { mime: "image/webp", label: "WebP image", exts: [".webp"] },
];

/** Every mime in the catalog — the default allow-list (everything supported is allowed). */
export const ALL_DEFAULT_MIMES: string[] = DEFAULT_MIME_CATALOG.map((o) => o.mime);

/**
 * Build the upload picker's `accept` string from a set of allowed mimes, drawing extensions from
 * the given catalog (built-in ∪ any host custom types). Only allowed types contribute, so the
 * picker never advertises a type the server-side gate would reject. Order follows the catalog;
 * duplicate extensions are collapsed.
 */
export function acceptExtensionsFor(
  allowed: Iterable<string>,
  catalog: MimeOption[] = DEFAULT_MIME_CATALOG,
): string {
  const allow = allowed instanceof Set ? allowed : new Set(allowed);
  const out: string[] = [];
  for (const o of catalog) {
    if (!allow.has(o.mime)) continue;
    for (const e of o.exts) if (!out.includes(e)) out.push(e);
  }
  return out.join(",");
}

/** Default `accept` hint for the upload picker: every built-in type's extensions. */
export const DEFAULT_ACCEPT_EXTENSIONS: string = acceptExtensionsFor(ALL_DEFAULT_MIMES);

/**
 * Whether a file may be imported given an allow-list. Native Google editor files map to their
 * export target (Doc→DOCX, Sheet→XLSX, Slides→PPTX), so allowing the corresponding Office type
 * also allows importing the equivalent Google file.
 */
export function isMimeAllowed(mimeType: string, allowed: Iterable<string>): boolean {
  const set = allowed instanceof Set ? allowed : new Set(allowed);
  if (isNativeGoogleDoc(mimeType)) {
    const target = nativeGoogleExportTarget(mimeType);
    return target ? set.has(target.mime) : false;
  }
  return set.has(mimeType);
}

/**
 * The editable binary format a native Google editor file is exported to, with the matching file
 * extension. Returns null for non-native types (use alt=media instead).
 *   Docs → DOCX, Sheets → XLSX, Slides → PPTX.
 * These are round-trippable: Google can convert them back to native on upload AND common parsers
 * can extract text from each. XLSX over CSV matters: a CSV export of a multi-tab sheet only
 * contains the FIRST tab.
 */
export function nativeGoogleExportTarget(mimeType: string): { mime: string; ext: string } | null {
  switch (mimeType) {
    case "application/vnd.google-apps.document":
      return { mime: DOCX_MIME, ext: ".docx" };
    case "application/vnd.google-apps.spreadsheet":
      return {
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ext: ".xlsx",
      };
    case "application/vnd.google-apps.presentation":
      return {
        mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ext: ".pptx",
      };
    default:
      return null; // Forms, Drawings, Sites, etc. have no clean text export — not indexable.
  }
}

/**
 * Inverse of nativeGoogleExportTarget: the native Google editor type an Office binary converts to
 * when uploaded to Drive with a target mimeType (DOCX → Doc, XLSX → Sheet, PPTX → Slides). Used
 * when opening a stored Office file for editing — Drive converts on upload so it lands as an
 * editable native Google file. Returns null for types Drive can't cleanly convert (e.g. PDF).
 */
export function nativeGoogleImportTarget(mimeType: string): string | null {
  switch (mimeType) {
    case DOCX_MIME:
    case "application/msword":
      return "application/vnd.google-apps.document";
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.ms-excel":
      return "application/vnd.google-apps.spreadsheet";
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    case "application/vnd.ms-powerpoint":
      return "application/vnd.google-apps.presentation";
    default:
      return null;
  }
}

/** True for files text can be extracted from (after export, for native Google files). */
export function isIndexable(mimeType: string): boolean {
  if (mimeType === DRIVE_FOLDER_MIME) return false;
  if (isNativeGoogleDoc(mimeType)) return nativeGoogleExportTarget(mimeType) !== null;
  return SUPPORTED_BINARY_MIMES.has(mimeType) || IMAGE_MIMES.has(mimeType);
}

/** True for items a drive picker should let the user select (folders, or any indexable file). */
export function isPickable(mimeType: string): boolean {
  return mimeType === DRIVE_FOLDER_MIME || isIndexable(mimeType);
}
