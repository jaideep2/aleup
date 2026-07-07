---
sidebar_position: 7
title: WASM setup (docxodus)
---

# WASM setup for @aleup/docx

docxodus is a .NET-on-WASM runtime (~16 MB) that must be served as static assets from
your app's origin. `@aleup/docx` ships a bin that copies them from the installed package
and stamps the version:

```bash
aleup-copy-docxodus-wasm --dest public/docxodus
```

The copy is **stamped** (`.docxodus-version`) and skipped when already current, so it's
cheap to run on every dev/build. When a docxodus upgrade changes the version, assets are
refreshed automatically — the runtime path is version-coupled and NOT semver-protected,
which is why the stamp exists.

## Next.js

```jsonc
// package.json
"scripts": {
  "predev": "aleup-copy-docxodus-wasm --dest public/docxodus",
  "prebuild": "aleup-copy-docxodus-wasm --dest public/docxodus"
}
```

Add `public/docxodus/` to `.gitignore` (build artifact, not source) — and to your
eslint ignores.

## Vite

Same commands with `--dest public/docxodus`; Vite serves `public/` at the root.

## Custom asset location

```ts
import { configureDocx } from "@aleup/docx";
configureDocx({ assetBase: "/static/docx-wasm/" }); // before the first DOCX opens
```

## Bundle-size note

The 16 MB runtime is fetched lazily on the **first DOCX open**, never bundled. Apps that
never open a DOCX never pay for it — that's also why the DOCX renderer lives behind the
`@aleup/view/docx` subpath.
