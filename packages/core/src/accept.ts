/**
 * Filter a file list down to extensions allowed by `accept` (a comma-separated ".ext" list).
 * Folder pickers (`webkitdirectory`) ignore the `accept` attribute entirely, so callers that let
 * the user select a whole folder must filter client-side before upload — the host's server-side
 * check remains the authoritative gate.
 *
 * Structural on `{ name }` so it works on `File`, directory entries, or provider items alike.
 */
export function filterFilesByAccept<T extends { name: string }>(files: T[], accept: string): T[] {
  const exts = accept
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (exts.length === 0) return files;
  return files.filter((f) => {
    const name = f.name.toLowerCase();
    return exts.some((ext) => name.endsWith(ext));
  });
}
