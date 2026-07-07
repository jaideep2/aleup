/** Renderable document formats a viewer routes on. */
export type DocFormat = "pdf" | "docx" | "md" | "text" | "image" | "google-native" | "other";

/** Classify by MIME with filename fallback. */
export function detectFormat(mimeType: string, name: string): DocFormat {
  const lower = name.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx") ||
    lower.endsWith(".doc")
  )
    return "docx";
  if (mimeType === "text/markdown" || lower.endsWith(".md")) return "md";
  if (mimeType === "text/plain" || lower.endsWith(".txt")) return "text";
  if (mimeType.startsWith("application/vnd.google-apps.")) return "google-native";
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lower))
    return "image";
  return "other";
}
