---
sidebar_position: 5
title: Ports
---

# Ports

Ports are the interfaces your app implements — the entire surface where aleup meets host
concerns. All live in `@aleup/core`; none have default implementations that do IO.

## DestinationPort

Where finalized bytes go. aleup stays ignorant of *why* your endpoints look the way
they do (signed tokens, drive-as-truth copies, S3 proxies — all host policy).

```ts
interface UploadTarget {
  endpoint: string;                      // absolute or app-relative URL (multipart POST)
  headers?: Record<string, string>;
  fieldName?: string;                    // default "file"
}

interface DestinationPort {
  /** LOCAL browser uploads — typically session-cookie authed. */
  localUploadTarget(): UploadTarget | Promise<UploadTarget>;
  /** REMOTE Companion-streamed uploads — called once per batch; do your token dance here.
   *  Must be an absolute URL and typically token-authed: Companion can't send cookies. */
  remoteUploadTarget(): Promise<UploadTarget>;
  onFileUploaded?(file: { id?: string; name: string; response?: unknown }): void;
}
```

## AcceptPolicy & MetaSupplier

```ts
interface AcceptPolicy {
  accept?: string;                        // ".pdf,.docx,…" for <input accept>
  isMimeAllowed?(mime: string): boolean;  // picker-side gate; server stays authoritative
}
type MetaSupplier = () => Record<string, string>;  // extra multipart fields, e.g. tags
```

## ConnectProvider, TokenStorePort, CredentialsPort

```ts
type ConnectProvider = "google-drive" | "onedrive" | "box" | "dropbox";

interface TokenStorePort {   // save-back token persistence — host owns storage/encryption
  get(userId: string, provider: ConnectProvider): Promise<ProviderTokens | null>;
  put(userId: string, provider: ConnectProvider, tokens: ProviderTokens): Promise<void>;
}

type CredentialsPort = (provider: ConnectProvider) =>
  { clientId: string; clientSecret: string } | null;  // null = not configured
```

`@aleup/connect` ships `envCredentials({...})` for the common env-var case — the
package itself never reads `process.env`.

## TelemetryPort

```ts
interface TelemetryPort { event(name: string, data?: unknown): void }
```

## Example: a signed-token destination

```ts
const destination: DestinationPort = {
  localUploadTarget: () => ({ endpoint: `/api/vaults/${vaultId}/documents` }),
  async remoteUploadTarget() {
    const res = await fetch(`/api/vaults/${vaultId}/upload-token`, { method: "POST" });
    if (!res.ok) throw new Error("Couldn't authorize the import.");
    const { token } = await res.json();
    return {
      endpoint: `${location.origin}/api/vaults/${vaultId}/documents/companion`,
      headers: { "x-upload-token": token },
    };
  },
};
```
