---
title: "@aleup/connect"
---

# @aleup/connect

OAuth + save-back **write** clients for Google Drive, OneDrive (Graph), Box, and
Dropbox. Server-side, fetch-only, zero vendor dependencies, edge-runtime friendly.

Import OAuth is [Companion](/docs/packages/companion)'s job and never touches this
package — connect exists solely for per-user *save* connections. Your app persists the
tokens (encrypted) via its own storage; aleup defines the `TokenStorePort` shape but
never stores anything.

```ts
import { createConnectClient, envCredentials } from "@aleup/connect";

const client = createConnectClient(
  envCredentials({
    "google-drive": { clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID", clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET" },
  }),
);

// 1. Send the user to consent
const url = client.buildAuthUrl("google-drive", redirectUri, state);
// 2. Exchange the code, persist tokens yourself
const tokens = await client.exchangeCode("google-drive", code, redirectUri);
// 3. Later: refresh + save
const fresh = await client.refreshTokens("google-drive", tokens.refreshToken!);
const saved = await client.saveFileToProvider("google-drive", fresh.accessToken, {
  name: "letter.pdf", mimeType: "application/pdf", bytes,
});
```

Provider details handled for you: Google's `drive.file` least-privilege scope with
offline consent; OneDrive's scope-repeat-on-refresh quirk and resumable upload sessions
for files over 4 MB (320 KiB-aligned chunks); Box's 409-conflict → new-version upload;
Dropbox autorename. v1 saves land in the drive root — no folder picker yet.
