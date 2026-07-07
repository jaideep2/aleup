# aleup-example-daisyui

The aleup **document workbench** demo — `DocEditor` with a themed toolbar, format-routed
`DocumentViewer` with themed slots, a cloud-drive picker built on `useCloudDrivePicker`
(mock provider, zero backend), and one-click PDF export — styled with daisyUI 5 on
Tailwind v4, including a live theme switcher: the `--aleup-*` CSS variables are mapped to
daisyUI color tokens, so switching `data-theme` re-skins the document page itself. The
same demo exists in `examples/shadcn` and `examples/mui` on identical aleup hooks.

```bash
pnpm install && pnpm build            # at the repo root (builds the packages first)
pnpm --filter aleup-example-daisyui dev
```

`@aleup/docx` is intentionally skipped — its ~16 MB WASM asset would dwarf a static demo.
