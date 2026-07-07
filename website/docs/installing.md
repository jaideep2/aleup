---
sidebar_position: 8
title: Installing
---

# Installing

`@aleup/*` packages are published to the public npm registry:

```bash
pnpm add @aleup/core @aleup/view          # and whatever else you use
```

Each package lists its vendor libraries (Uppy, Tiptap, docxodus, html2pdf.js) as **peer
dependencies** — your app owns the single installed copy, `npm update` bumps it once,
and aleup's contract tests (run in this repo's CI) pin the behaviors we rely on so an
upstream break fails loudly rather than silently. Optional peers (individual Uppy
provider plugins, the DOCX/markdown renderers' deps) only need installing if you import
the matching subpath.

## Developing against a local checkout

Working on aleup and an app at the same time? With an `aleup` checkout next to your
repo, override the registry resolution locally:

```jsonc
// package.json (root)
"pnpm": {
  "overrides": {
    "@aleup/core": "file:../aleup/packages/core",
    "@aleup/import": "file:../aleup/packages/import"
    // …one per package you use
  }
}
```

Keep real semver ranges in your `dependencies` — the overrides rewrite them on your
machine only, and deleting the overrides block restores registry resolution. Run
`pnpm build` in the aleup checkout after changes (packages are consumed as built
`dist/`).
