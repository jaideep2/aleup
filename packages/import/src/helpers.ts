import type { CompanionItem } from "./types.js";

/**
 * Companion's Drive adapter misclassifies SHORTCUTS TO FOLDERS: `isFolder` checks the
 * raw shortcut mime, while `mimeType` maps the target's folder mime through the GSuite
 * export table, whose fallback is `application/pdf` — so a folder shortcut lists as a
 * selectable "PDF" whose download follows the shortcut and 404s (you can't alt=media a
 * folder). The adapted item's `icon` URL still carries the true target type, so use it
 * to exclude these; Companion can't list a shortcut's children either, so navigation
 * can't be offered — users should open the real folder (e.g. under "Shared with me").
 */
export function isFolderShortcut(item: CompanionItem): boolean {
  return (
    !item.isFolder &&
    typeof item.icon === "string" &&
    item.icon.includes("vnd.google-apps.folder")
  );
}

/** Short human label for a file's type, for picker rows. */
export function fileLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("wordprocessingml") || mimeType === "application/msword") return "Word";
  if (mimeType === "application/vnd.google-apps.document") return "Google Doc";
  if (mimeType.includes("spreadsheetml") || mimeType === "application/vnd.ms-excel")
    return "Excel";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "Google Sheet";
  if (mimeType.includes("presentationml") || mimeType === "application/vnd.ms-powerpoint")
    return "PowerPoint";
  if (mimeType === "application/vnd.google-apps.presentation") return "Google Slides";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "text/csv") return "CSV";
  if (mimeType.startsWith("text/") || mimeType === "application/json") return "Text";
  return "File";
}

/** "1.4 MB"-style size label for picker rows. */
export function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
