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

/**
 * Where finalized bytes go. The host routes this to its own storage policy — e.g. a
 * "drive-as-truth" copy, a signed-token endpoint, or a plain S3 proxy. aleup stays ignorant of why.
 */
export interface DestinationPort {
  /** Target for LOCAL browser uploads (typically session-cookie authed). */
  localUploadTarget(): UploadTarget | Promise<UploadTarget>;
  /**
   * Target for REMOTE companion-streamed uploads (typically token authed). Called once per import
   * batch — this is where the host does its token dance.
   */
  remoteUploadTarget(): Promise<UploadTarget>;
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
