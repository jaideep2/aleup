# aleup-example-shadcn

The aleup **document workbench** demo — `DocEditor` with a themed toolbar, format-routed
`DocumentViewer` with themed slots, a cloud-drive picker built on `useCloudDrivePicker`
(mock provider, zero backend), and one-click PDF export — styled with shadcn/ui-style
components (Tailwind v4, class-variance-authority, Radix, lucide). The same demo exists
in `examples/mui` and `examples/daisyui` on identical aleup hooks.

```bash
pnpm install && pnpm build            # at the repo root (builds the packages first)
pnpm --filter aleup-example-shadcn dev
```

`@aleup/docx` is intentionally skipped — its ~16 MB WASM asset would dwarf a static demo.
