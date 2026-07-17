/** Companion list-endpoint item (the subset aleup relies on). */
export interface CompanionItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  requestPath: string;
  size?: number;
  modifiedDate?: string;
  /** Provider icon URL — for Drive it encodes the TRUE item type, which is the only
   *  way to spot shortcuts-to-folders that the adapter mislabels as files. */
  icon?: string;
  /**
   * Containing-folder path relative to the selection root, `/`-separated, including the
   * selected folder's own name, no filename (picking folder `Evidence` gives the file at
   * Evidence/2023/a.pdf a relativePath of "Evidence/2023"). Set by folder expansion only —
   * directly-picked files carry none.
   */
  relativePath?: string;
}

/**
 * Input to uploadLocalFiles: a File, or a File with per-file Uppy meta (merged over the
 * host's MetaSupplier) — e.g. relativePath derived from a folder upload's webkitRelativePath.
 */
export type LocalFileEntry = File | { file: File; meta?: Record<string, string> };

export type ImportProgress = {
  /** "importing" = remote setup/streaming not yet producing upload events; "uploading" = live batch. */
  phase: "uploading" | "importing";
  total: number;
  done: number;
  failed: number;
} | null;

/** A file recovered from a prior session by Golden Retriever. */
export interface RestoredFile {
  id: string;
  name: string;
  size?: number | null;
}

export interface ImportCallbacks {
  onProgress?: (state: ImportProgress) => void;
  /**
   * Fires when a batch finishes. `failedFiles` lists the names of every file that failed (upload
   * errors AND stall-watchdog abandonments), so a host can show which files to retry — not just a
   * count. Same population that `onError`'s message summarizes (which truncates to the first few).
   */
  onComplete?: (summary: { ok: number; failed: number; failedFiles: string[] }) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Fires per successful upload with the destination route's response body. */
  onFileUploaded?: (file: { name: string; response: unknown }) => void;
  /**
   * Cross-refresh resume (PLAN_UPLOAD Phase 2, s3-multipart mode). Fires once after a page reload if
   * Golden Retriever recovered an in-flight batch. `autoResumed` files had their bytes/part-state
   * restored and resume automatically; `needsReselection` files (large local files whose blob
   * exceeded the IndexedDB cap) can't be silently re-read — the host must ask the user to re-pick them.
   */
  onRestored?: (info: { autoResumed: RestoredFile[]; needsReselection: RestoredFile[] }) => void;
}

/**
 * A cloud provider registration: which Uppy plugin backs it and how UIs label it.
 * Import one per provider you enable — e.g. `import { googleDrive } from "@aleup/import/google-drive"`
 * — so unused provider plugins never enter your bundle (they're optional peers).
 */
export interface ProviderRegistration {
  /** Host-facing id (e.g. "drive"); referenced by importRemoteFiles/providerClient. */
  id: string;
  /** Uppy plugin id (e.g. "GoogleDrive"). */
  pluginId: string;
  label: string;
  /** The @uppy/* provider plugin class. Typed loosely so vendor types stay out of our API. */
  plugin: unknown;
}
