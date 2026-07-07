---
title: "@aleup/companion"
---

# @aleup/companion

A config-mapped factory for the official [Uppy Companion](https://uppy.io/docs/companion/)
standalone server — the service that owns 3-legged OAuth and streams provider files
server-side so remote bytes never touch the browser.

:::caution This package doesn't remove the ops surface
Companion is a **server**, not a library. `@aleup/companion` ships a factory + a
Dockerfile template (`templates/Dockerfile`); you still run and operate the process.
:::

## Usage

```ts
// apps/companion/src/index.ts
import { startStandaloneCompanion } from "@aleup/companion";

startStandaloneCompanion({
  appUrl: process.env.APP_URL,          // allowed client origin + default upload target
  selfUrl: process.env.COMPANION_SELF_URL,
  secret: process.env.COMPANION_SECRET, // required in production
  preauthSecret: process.env.COMPANION_PREAUTH_SECRET,
  providers: {
    google: { key: process.env.GOOGLE_OAUTH_CLIENT_ID, secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET },
    onedrive: { key: process.env.MS_GRAPH_CLIENT_ID, secret: process.env.MS_GRAPH_CLIENT_SECRET },
  },
});
```

The factory maps typed config onto `COMPANION_*` env vars **without clobbering any
already set** (so operators can always override), ensures the data dir exists, and hands
off to the official standalone server (helmet, session, provider routes, websocket
progress channel).

## Opinionated defaults you get

- **SSRF guard**: `COMPANION_UPLOAD_URLS` defaults to `${appUrl}/api/` — only your app
  can be an upload destination.
- **Socket-connect timeout raised to 30 min** (stock: 60 s). Large batch imports open
  progress websockets through a rate-limited queue whose slots are held for entire
  transfers, so a file's socket connect can legitimately wait minutes; the stock timeout
  falsely kills those downloads.
- Streaming upload mode on.

## OAuth redirect URIs

Add to each provider's OAuth app: `${selfUrl}/drive/redirect`,
`${selfUrl}/onedrive/redirect`, `${selfUrl}/box/redirect`, `${selfUrl}/dropbox/redirect`.
