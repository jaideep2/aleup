# Contributing to aleup

Thanks for helping! aleup is Apache-2.0 licensed and welcomes issues and PRs.

## Ground rules

1. **CLA** — first-time contributors are asked to sign the [Contributor License
   Agreement](./CLA.md) once; a bot will prompt on your first PR. It keeps the project's
   licensing future-proof while your contribution stays credited to you.
2. **MIT-compatible dependencies only.** In particular, `@aleup/editor` and everything
   near it must never depend on Tiptap Pro extensions — only the MIT-licensed Tiptap
   packages are allowed anywhere in this repo.
3. **Vendor code stays behind adapters.** Anything touching `@uppy/*`, `@tiptap/*`,
   `docxodus`, or `html2pdf.js` internals lives in one adapter module per package and is
   pinned by a contract test (`*.contract.test.ts`). If your change reaches into a vendor
   internal, add the contract test with it.
4. **Headless first.** New capabilities land as hooks/logic with zero UI; shipped
   components follow the theming contract (per-slot `classNames`, `components` slots,
   `data-aleup-*` attributes, `--aleup-*` variables). No design-system dependency may
   enter `packages/*` — that's what `examples/*` are for.
5. **Ports, not opinions.** aleup never reads the host's env, calls its backend, or
   persists anything it wasn't handed a port for.

## Scope: what belongs here

This repository is the open-source aleup toolkit: import, view, edit, convert/export,
save-back, docs, and themed examples. Commercial offerings built *around* aleup (hosted
services, premium add-ons) are developed separately and are out of scope for this repo —
PRs implementing paid-tier features will be redirected there.

## Dev loop

```sh
pnpm install
pnpm build        # tsc per package (dist/ is what tests + examples consume)
pnpm test         # vitest, incl. contract tests
pnpm lint && pnpm typecheck
pnpm gen-licenses # regenerate THIRD_PARTY_LICENSES.md after dependency changes
```

Add a changeset for anything user-visible: `pnpm changeset`.

## Releases

Versioning/publishing runs through changesets in CI on merge to `main`.
