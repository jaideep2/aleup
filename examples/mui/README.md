# aleup-example-mui

The aleup **document workbench** demo — `DocEditor` with a themed toolbar, format-routed
`DocumentViewer` with themed slots, a cloud-drive picker built on `useCloudDrivePicker`
(mock provider, zero backend), and one-click PDF export — styled with MUI (Material UI +
Emotion, no Tailwind). The same demo exists in `examples/shadcn` and `examples/daisyui`
on identical aleup hooks.

```bash
pnpm install && pnpm build            # at the repo root (builds the packages first)
pnpm --filter aleup-example-mui dev
```

`@aleup/docx` is intentionally skipped — its ~16 MB WASM asset would dwarf a static demo.
