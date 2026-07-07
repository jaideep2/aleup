// Cloud-drive write clients for save-back: OAuth URL building, code exchange, token
// refresh, account info, and "save these bytes as a file" for Google Drive, OneDrive
// (Graph), Box, and Dropbox. Server-side only, fetch + Web APIs — no Node-only types, so
// it also runs in edge runtimes.
//
// Import OAuth is Companion's job (@aleup/companion) and never touches these; this module
// exists solely for per-user SAVE connections (the host persists tokens via its
// TokenStorePort, encrypted at rest). v1 saves land in the drive root (Drive: app-scoped
// via drive.file), no folder picker.
//
// OAuth app credentials are injected via a CredentialsPort (@aleup/core) — this package
// never reads process.env itself; use envCredentials() to wire your env names.

import type { ConnectProvider, CredentialsPort, ProviderTokens } from "@aleup/core";

export type { ConnectProvider, CredentialsPort, ProviderTokens };

export interface SavedFile {
  id: string;
  name: string;
  viewUrl?: string;
}

export interface AccountInfo {
  email?: string;
  name?: string;
}

interface ProviderEndpoints {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  extraAuthParams?: Record<string, string>;
}

const ENDPOINTS: Record<ConnectProvider, ProviderEndpoints> = {
  "google-drive": {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // drive.file = only files this app creates — least privilege for save-back.
    scope: "https://www.googleapis.com/auth/drive.file openid email profile",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  onedrive: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "offline_access Files.ReadWrite User.Read",
  },
  box: {
    authUrl: "https://account.box.com/api/oauth2/authorize",
    tokenUrl: "https://api.box.com/oauth2/token",
    scope: "root_readwrite",
  },
  dropbox: {
    authUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    scope: "files.content.write account_info.read",
    extraAuthParams: { token_access_type: "offline" },
  },
};

/**
 * A CredentialsPort backed by environment variables. Pass your env names per provider;
 * unlisted providers count as not configured.
 */
export function envCredentials(
  names: Partial<Record<ConnectProvider, { clientIdEnv: string; clientSecretEnv: string }>>,
): CredentialsPort {
  return (provider) => {
    const n = names[provider];
    if (!n) return null;
    const clientId = process.env[n.clientIdEnv];
    const clientSecret = process.env[n.clientSecretEnv];
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  };
}

export interface ConnectClient {
  providerConfigured(provider: ConnectProvider): boolean;
  buildAuthUrl(provider: ConnectProvider, redirectUri: string, state: string): string;
  exchangeCode(
    provider: ConnectProvider,
    code: string,
    redirectUri: string,
  ): Promise<ProviderTokens>;
  refreshTokens(provider: ConnectProvider, refreshToken: string): Promise<ProviderTokens>;
  fetchAccountInfo(provider: ConnectProvider, accessToken: string): Promise<AccountInfo>;
  saveFileToProvider(
    provider: ConnectProvider,
    accessToken: string,
    file: SaveFileInput,
  ): Promise<SavedFile>;
}

export interface SaveFileInput {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export function createConnectClient(credentials: CredentialsPort): ConnectClient {
  function creds(provider: ConnectProvider): { clientId: string; clientSecret: string } {
    const c = credentials(provider);
    if (!c) throw new Error(`${provider} OAuth is not configured`);
    return c;
  }

  async function tokenRequest(
    provider: ConnectProvider,
    body: Record<string, string>,
  ): Promise<ProviderTokens> {
    const cfg = ENDPOINTS[provider];
    const res = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    if (!res.ok)
      throw new Error(`${provider} token endpoint → ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      scope: data.scope ?? null,
    };
  }

  return {
    providerConfigured(provider) {
      return credentials(provider) !== null;
    },

    buildAuthUrl(provider, redirectUri, state) {
      const cfg = ENDPOINTS[provider];
      const { clientId } = creds(provider);
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
        ...(cfg.scope ? { scope: cfg.scope } : {}),
        ...cfg.extraAuthParams,
      });
      return `${cfg.authUrl}?${params}`;
    },

    exchangeCode(provider, code, redirectUri) {
      const { clientId, clientSecret } = creds(provider);
      return tokenRequest(provider, {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });
    },

    refreshTokens(provider, refreshToken) {
      const { clientId, clientSecret } = creds(provider);
      return tokenRequest(provider, {
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        // OneDrive requires the scope repeated on refresh; the others ignore it.
        ...(provider === "onedrive" ? { scope: ENDPOINTS.onedrive.scope } : {}),
      });
    },

    fetchAccountInfo,
    saveFileToProvider,
  };
}

export async function fetchAccountInfo(
  provider: ConnectProvider,
  accessToken: string,
): Promise<AccountInfo> {
  const auth = { Authorization: `Bearer ${accessToken}` };
  try {
    switch (provider) {
      case "google-drive": {
        const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: auth });
        if (!r.ok) return {};
        const d = (await r.json()) as { email?: string; name?: string };
        return { email: d.email, name: d.name };
      }
      case "onedrive": {
        const r = await fetch("https://graph.microsoft.com/v1.0/me", { headers: auth });
        if (!r.ok) return {};
        const d = (await r.json()) as {
          mail?: string;
          userPrincipalName?: string;
          displayName?: string;
        };
        return { email: d.mail ?? d.userPrincipalName, name: d.displayName };
      }
      case "box": {
        const r = await fetch("https://api.box.com/2.0/users/me", { headers: auth });
        if (!r.ok) return {};
        const d = (await r.json()) as { login?: string; name?: string };
        return { email: d.login, name: d.name };
      }
      case "dropbox": {
        const r = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
          method: "POST",
          headers: auth,
        });
        if (!r.ok) return {};
        const d = (await r.json()) as { email?: string; name?: { display_name?: string } };
        return { email: d.email, name: d.name?.display_name };
      }
    }
  } catch {
    return {};
  }
}

// ─── Save ────────────────────────────────────────────────────────────────────

export async function saveFileToProvider(
  provider: ConnectProvider,
  accessToken: string,
  file: SaveFileInput,
): Promise<SavedFile> {
  switch (provider) {
    case "google-drive":
      return saveToGoogleDrive(accessToken, file);
    case "onedrive":
      return saveToOneDrive(accessToken, file);
    case "box":
      return saveToBox(accessToken, file);
    case "dropbox":
      return saveToDropbox(accessToken, file);
  }
}

const encoder = new TextEncoder();

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

async function saveToGoogleDrive(token: string, file: SaveFileInput): Promise<SavedFile> {
  const boundary = `aleup-${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: file.name, mimeType: file.mimeType });
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = concatBytes([encoder.encode(head), file.bytes, encoder.encode(tail)]);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Google Drive upload → ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { id: string; name: string; webViewLink?: string };
  return { id: d.id, name: d.name, viewUrl: d.webViewLink };
}

const GRAPH = "https://graph.microsoft.com/v1.0";
const GRAPH_SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024;

async function saveToOneDrive(token: string, file: SaveFileInput): Promise<SavedFile> {
  const auth = { Authorization: `Bearer ${token}` };
  const itemPath = `${GRAPH}/me/drive/root:/${encodeURIComponent(file.name)}`;
  const buf = file.bytes;

  if (buf.byteLength <= GRAPH_SIMPLE_UPLOAD_MAX) {
    const res = await fetch(`${itemPath}:/content?@microsoft.graph.conflictBehavior=rename`, {
      method: "PUT",
      headers: { ...auth, "Content-Type": file.mimeType },
      body: buf,
    });
    if (!res.ok) throw new Error(`OneDrive upload → ${res.status}: ${await res.text()}`);
    const d = (await res.json()) as { id: string; name: string; webUrl?: string };
    return { id: d.id, name: d.name, viewUrl: d.webUrl };
  }

  // Large files: resumable upload session, 5 MiB chunks (Graph requires 320 KiB multiples).
  const sessionRes = await fetch(`${itemPath}:/createUploadSession`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      item: { "@microsoft.graph.conflictBehavior": "rename", name: file.name },
    }),
  });
  if (!sessionRes.ok)
    throw new Error(`OneDrive session → ${sessionRes.status}: ${await sessionRes.text()}`);
  const { uploadUrl } = (await sessionRes.json()) as { uploadUrl: string };

  const CHUNK = 5 * 1024 * 1024 - ((5 * 1024 * 1024) % (320 * 1024));
  let last: Response | null = null;
  for (let start = 0; start < buf.byteLength; start += CHUNK) {
    const end = Math.min(start + CHUNK, buf.byteLength);
    last = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(end - start),
        "Content-Range": `bytes ${start}-${end - 1}/${buf.byteLength}`,
      },
      body: buf.subarray(start, end),
    });
    if (!last.ok) throw new Error(`OneDrive chunk → ${last.status}: ${await last.text()}`);
  }
  const d = (await last!.json()) as { id: string; name: string; webUrl?: string };
  return { id: d.id, name: d.name, viewUrl: d.webUrl };
}

async function saveToBox(token: string, file: SaveFileInput): Promise<SavedFile> {
  const form = new FormData();
  form.append("attributes", JSON.stringify({ name: file.name, parent: { id: "0" } }));
  form.append("file", new Blob([file.bytes], { type: file.mimeType }), file.name);

  let res = await fetch("https://upload.box.com/api/2.0/files/content", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  // 409 name conflict → upload as a new version of the existing file.
  if (res.status === 409) {
    const conflict = (await res.json().catch(() => null)) as {
      context_info?: { conflicts?: { id?: string } };
    } | null;
    const existingId = conflict?.context_info?.conflicts?.id;
    if (!existingId) throw new Error("Box upload conflict without a resolvable file id");
    const versionForm = new FormData();
    versionForm.append(
      "file",
      new Blob([file.bytes], { type: file.mimeType }),
      file.name,
    );
    res = await fetch(`https://upload.box.com/api/2.0/files/${existingId}/content`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: versionForm,
    });
  }
  if (!res.ok) throw new Error(`Box upload → ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { entries: { id: string; name: string }[] };
  const entry = d.entries?.[0];
  if (!entry) throw new Error("Box upload returned no file entry");
  return { id: entry.id, name: entry.name, viewUrl: `https://app.box.com/file/${entry.id}` };
}

async function saveToDropbox(token: string, file: SaveFileInput): Promise<SavedFile> {
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: `/${file.name}`,
        mode: "add",
        autorename: true,
        mute: true,
      }),
    },
    body: file.bytes,
  });
  if (!res.ok) throw new Error(`Dropbox upload → ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { id: string; name: string; path_display?: string };
  return {
    id: d.id,
    name: d.name,
    viewUrl: d.path_display
      ? `https://www.dropbox.com/home${encodeURI(d.path_display.replace(/\/[^/]+$/, ""))}`
      : undefined,
  };
}
