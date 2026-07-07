# aleup

A headless, modular document toolkit for React apps: **import** files from local
and cloud sources (Uppy + Companion), **view** pdf/docx/md/text/images,
**edit** markdown/docx (headless Tiptap with high-fidelity DOCX round-tripping),
**export** to DOCX/PDF/MD, and **save back** to a user's cloud drive.

aleup never talks to your database, auth, or storage. Host concerns are injected
through small ports (`DestinationPort`, `TokenStorePort`, `CredentialsPort`), so
the same packages work in any Next.js or Vite React app.

## Packages

| Package | What it does | Wraps |
|---|---|---|
| `@aleup/core` | Ports, MIME registry, format detection. Zero deps, platform-neutral. | — |
| `@aleup/import` | Headless Uppy orchestration (`useUppyImport`) + cloud-drive picker state (`useCloudDrivePicker`). | `@uppy/*` |
| `@aleup/companion` | Env-mapped factory for the Uppy Companion server + Dockerfile template. | `@uppy/companion` |
| `@aleup/editor` | Headless Tiptap document editor preset with markdown/HTML IO. | `@tiptap/*` |
| `@aleup/view` | Format router + renderers (`/docx` and `/markdown` subpaths are opt-in). | peers |
| `@aleup/docx` | DOCX ⇄ HTML/Markdown round-trip sessions. | `docxodus` (WASM) |
| `@aleup/pdf` | DOM → paginated PDF export. | `html2pdf.js` |
| `@aleup/connect` | OAuth + save-back to Google Drive / OneDrive / Box / Dropbox. | fetch only |

Vendor libraries are `peerDependencies`: your app owns the single installed copy,
`npm update` bumps it once, and contract tests in this repo pin the behaviors we
rely on so upstream breaks fail loudly in CI.

## Theming

Everything is headless-first. The optional React components share one theming
contract: per-slot `classNames`, `components` slot substitution (bring your own
Button/Dialog/Icon), `data-aleup-*` attributes + `--aleup-*` CSS variables for
pure-CSS theming, and an optional neutral stylesheet per package. See
`website/docs/theming.md` and the `examples/` gallery (shadcn, MUI, daisyUI, …).

## License

[Apache-2.0](./LICENSE), © 2026 JD. Third-party attribution lives in
[THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) (generated, CI-verified).
Contributions are welcome under a one-time [CLA](./CLA.md) — see
[CONTRIBUTING.md](./CONTRIBUTING.md). The Apache-2.0 license does not grant rights to
the "aleup" name (see `NOTICE`).

## Development

```sh
pnpm install
pnpm build        # turbo: tsc per package
pnpm test         # vitest, includes upstream contract tests
pnpm gen-licenses # regenerate THIRD_PARTY_LICENSES.md
```

Note: `@aleup/editor` and friends must not depend on Tiptap Pro extensions —
only MIT-licensed Tiptap packages are allowed here.
