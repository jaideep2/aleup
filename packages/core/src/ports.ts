// The ports hosts implement. aleup never persists anything, reads env vars, or calls a backend it
// wasn't handed an endpoint for — every host concern arrives through one of these interfaces.

/** Where an upload should be sent. */
export interface UploadTarget {
  /** Absolute or app-relative URL that accepts a multipart POST. */
  endpoint: string;
  headers?: Record<string, string>;
  /** Multipart field name for the file body. Default "file". */
  fieldName?: string;
}

/** A file that finished uploading (shape intentionally minimal; `response` is transport-specific). */
export interface UploadedFile {
  id?: string;
  name: string;
  response?: unknown;
}

/** The subset of an Uppy file the host's S3 callbacks need. Keeps vendor types out of aleup's API. */
export interface UppyFileLike {
  id: string;
  name?: string;
  type?: string;
  size?: number | null;
  meta?: Record<string, unknown>;
}

/** One finished multipart part — `ETag` read from the PUT response header. */
export interface S3PartRef {
  PartNumber: number;
  ETag: string;
}

/**
 * Resumable direct-to-storage upload API (PLAN_UPLOAD Phase 2). The host wires each method to its
 * presign/finalize backend; the methods map 1:1 onto the @uppy/aws-s3 plugin callbacks. Used only
 * when `DestinationPort.localMode === "s3-multipart"`. `listParts` is required for cross-refresh
 * resume. `onObjectUploaded` is the finalize seam: its return value becomes `UploadedFile.response`.
 */
export interface S3MultipartApi {
  /** True → multipart; false → a single presigned PUT (getUploadParameters). Default: size-based. */
  shouldUseMultipart?(file: UppyFileLike): boolean;
  /** Presigned single PUT for small files. Include `key` so the finalize seam can reference it. */
  getUploadParameters(
    file: UppyFileLike,
  ): Promise<{ method: string; url: string; fields?: Record<string, string>; headers?: Record<string, string>; key?: string }>;
  createMultipartUpload(file: UppyFileLike): Promise<{ uploadId: string; key: string }>;
  // The `o` objects carry an extra AbortSignal at runtime (from @uppy/aws-s3); it's omitted here so
  // @aleup/core stays DOM-lib-free — hosts that need it can read it off the passed object.
  signPart(
    file: UppyFileLike,
    o: { uploadId: string; key: string; partNumber: number },
  ): Promise<{ url: string; headers?: Record<string, string> }>;
  listParts(file: UppyFileLike, o: { uploadId: string; key: string }): Promise<S3PartRef[]>;
  completeMultipartUpload(
    file: UppyFileLike,
    o: { uploadId: string; key: string; parts: S3PartRef[] },
  ): Promise<{ location?: string }>;
  abortMultipartUpload(file: UppyFileLike, o: { uploadId: string; key: string }): Promise<void>;
  /** Called once the object has landed; return value is surfaced as UploadedFile.response. */
  onObjectUploaded(file: UppyFileLike, o: { key: string; uploadId?: string }): Promise<unknown>;
}

/**
 * Where finalized bytes go. The host routes this to its own storage policy — e.g. a
 * "drive-as-truth" copy, a signed-token endpoint, or a plain S3 proxy. aleup stays ignorant of why.
 */
export interface DestinationPort {
  /**
   * How LOCAL browser uploads are transported. "xhr" (default) POSTs each file to
   * `localUploadTarget()` (today's behavior). "s3-multipart" uploads resumably straight to object
   * storage via the `s3` API below. Remote (Companion) uploads always use XHR regardless.
   */
  localMode?: "xhr" | "s3-multipart";
  /** Target for LOCAL browser uploads in "xhr" mode (typically session-cookie authed). */
  localUploadTarget(): UploadTarget | Promise<UploadTarget>;
  /**
   * Target for REMOTE companion-streamed uploads (typically token authed). Called once per import
   * batch — this is where the host does its token dance.
   */
  remoteUploadTarget(): Promise<UploadTarget>;
  /** Resumable direct-to-storage API — required when `localMode === "s3-multipart"`. */
  s3?: S3MultipartApi;
  onFileUploaded?(file: UploadedFile): void;
}

/** Client-side gate for what a picker lets the user select. The server stays authoritative. */
export interface AcceptPolicy {
  /** Comma-separated ".ext" list for `<input accept>`. */
  accept?: string;
  isMimeAllowed?(mime: string): boolean;
}

/** Extra multipart fields attached to every upload (e.g. tags). Re-read at upload time. */
export type MetaSupplier = () => Record<string, string>;

/** Cloud-drive providers supported for OAuth save-back. */
export type ConnectProvider = "google-drive" | "onedrive" | "box" | "dropbox";

export const CONNECT_PROVIDERS: readonly ConnectProvider[] = [
  "google-drive",
  "onedrive",
  "box",
  "dropbox",
];

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string | null;
  /** Epoch ms. */
  expiresAt?: number | null;
  scope?: string | null;
}

/** Persistence for a user's provider tokens — the host owns storage and encryption. */
export interface TokenStorePort {
  get(userId: string, provider: ConnectProvider): Promise<ProviderTokens | null>;
  put(userId: string, provider: ConnectProvider, tokens: ProviderTokens): Promise<void>;
}

/** OAuth app credentials per provider; return null for providers the host hasn't configured. */
export type CredentialsPort = (
  provider: ConnectProvider,
) => { clientId: string; clientSecret: string } | null;

export interface TelemetryPort {
  event(name: string, data?: unknown): void;
}
