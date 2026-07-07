// Uppy Companion — standalone service handling 3-legged OAuth + server-side streaming
// for remote imports (Google Drive, OneDrive/SharePoint, Box, Dropbox) into the host app.
//
// Architecture: the browser never sees remote file bytes. The Uppy client asks Companion
// to fetch a provider file; Companion streams it as a multipart POST to the host's upload
// route, authenticated however the host chooses (typically a short-lived signed token the
// client passes via headers — see DestinationPort.remoteUploadTarget in @aleup/core).
//
// Companion itself is entirely env-driven (COMPANION_* vars). This factory maps a typed
// config onto those names — WITHOUT overriding any COMPANION_* var already set in the
// environment — then hands off to the official standalone server (which wires helmet,
// session, redis (optional), the provider routes, and the websocket progress channel).
//
// This package can only ship the factory + a Dockerfile template (templates/Dockerfile);
// Companion is a server and the HOST still owns the process and its ops surface.

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

export interface CompanionProviderKeys {
  key: string | undefined;
  secret: string | undefined;
}

export interface StandaloneCompanionConfig {
  /** The host app's public origin — becomes the allowed client origin. */
  appUrl?: string;
  /** Port to listen on. Default 3020. */
  port?: string | number;
  /** Companion's own public URL (scheme+host), for OAuth redirect URIs. */
  selfUrl?: string;
  /** Where Companion stores in-flight download data. Default /tmp/companion-data. */
  dataDir?: string;
  /** Required in production (session/token signing). Ephemeral in dev when omitted. */
  secret?: string;
  preauthSecret?: string;
  /**
   * Upload destinations Companion may POST to (SSRF guard; required in prod).
   * Default: [`${appUrl}/api/`].
   */
  uploadUrls?: string[];
  clientOrigins?: string[];
  /**
   * Per remote file, Companion issues an upload token then waits this long for the
   * browser to open that file's progress websocket before aborting the download. The
   * stock default is 60s, which assumes the socket connects almost immediately. It
   * doesn't for LARGE batch imports: the Uppy client opens websockets through a
   * rate-limited queue (concurrency 8) whose slots are held for entire, throttled
   * transfers, so a tokened file's socket connect can sit queued for minutes behind
   * other uploads and get falsely killed. Default here: 30 min.
   */
  socketConnectTimeoutMs?: number;
  providers?: {
    /** Google Drive OAuth client (add `${selfUrl}/drive/redirect` to its redirect URIs). */
    google?: CompanionProviderKeys;
    /** Microsoft Graph app (redirect `${selfUrl}/onedrive/redirect`). */
    onedrive?: CompanionProviderKeys;
    box?: CompanionProviderKeys;
    dropbox?: CompanionProviderKeys;
  };
  /** Extra COMPANION_* vars applied last (still without clobbering pre-set env). */
  extraEnv?: Record<string, string | undefined>;
}

/**
 * Map config onto COMPANION_* env vars and start the official standalone server.
 * Call once from your service entry (it takes over the process's HTTP lifecycle).
 */
export function startStandaloneCompanion(config: StandaloneCompanionConfig = {}): void {
  const env = process.env;
  /** Set a COMPANION_* var unless the operator already set it explicitly. */
  const map = (companionKey: string, value: string | undefined) => {
    if (!env[companionKey] && value) env[companionKey] = value;
  };

  const appUrl = config.appUrl ?? "http://localhost:3000";
  const port = String(config.port ?? env.COMPANION_PORT ?? "3020");
  const selfUrl = new URL(config.selfUrl ?? `http://localhost:${port}`);

  // ── Core ───────────────────────────────────────────────────────────────────
  map("COMPANION_PORT", port);
  map("COMPANION_DOMAIN", selfUrl.host);
  map("COMPANION_PROTOCOL", selfUrl.protocol.replace(":", ""));
  map("COMPANION_DATADIR", config.dataDir ?? "/tmp/companion-data");
  map("COMPANION_CLIENT_ORIGINS", (config.clientOrigins ?? [appUrl]).join(","));
  // Only the host app may be an upload destination (SSRF guard; required in prod).
  map("COMPANION_UPLOAD_URLS", (config.uploadUrls ?? [`${appUrl}/api/`]).join(","));
  map("COMPANION_STREAMING_UPLOAD", "true");
  map(
    "COMPANION_CLIENT_SOCKET_CONNECT_TIMEOUT",
    String(config.socketConnectTimeoutMs ?? 1_800_000),
  );
  // Secrets: required in production; the standalone server generates ephemeral ones in
  // dev (fine locally — restarting just invalidates in-flight OAuth states).
  map("COMPANION_SECRET", config.secret);
  map("COMPANION_PREAUTH_SECRET", config.preauthSecret);

  // ── Providers ──────────────────────────────────────────────────────────────
  map("COMPANION_GOOGLE_KEY", config.providers?.google?.key);
  map("COMPANION_GOOGLE_SECRET", config.providers?.google?.secret);
  map("COMPANION_ONEDRIVE_KEY", config.providers?.onedrive?.key);
  map("COMPANION_ONEDRIVE_SECRET", config.providers?.onedrive?.secret);
  map("COMPANION_BOX_KEY", config.providers?.box?.key);
  map("COMPANION_BOX_SECRET", config.providers?.box?.secret);
  map("COMPANION_DROPBOX_KEY", config.providers?.dropbox?.key);
  map("COMPANION_DROPBOX_SECRET", config.providers?.dropbox?.secret);

  for (const [k, v] of Object.entries(config.extraEnv ?? {})) map(k, v);

  // Ensure the data dir exists (Companion validates read/write access at startup).
  mkdirSync(env.COMPANION_DATADIR!, { recursive: true });

  const enabled = [
    ["Google Drive", env.COMPANION_GOOGLE_KEY],
    ["OneDrive", env.COMPANION_ONEDRIVE_KEY],
    ["Box", env.COMPANION_BOX_KEY],
    ["Dropbox", env.COMPANION_DROPBOX_KEY],
  ]
    .filter(([, key]) => !!key)
    .map(([name]) => name);
  console.log(
    `[companion] origins=${env.COMPANION_CLIENT_ORIGINS} uploads→${env.COMPANION_UPLOAD_URLS} providers: ${enabled.join(", ") || "none (set provider keys)"}`,
  );

  // Hand off to the official standalone server (helmet, session, provider routes,
  // websocket progress). CJS deep import — @uppy/companion has no ESM exports map.
  // This path is an upstream internal, pinned by a contract test.
  const require = createRequire(import.meta.url);
  require("@uppy/companion/lib/standalone/start-server.js");
}
