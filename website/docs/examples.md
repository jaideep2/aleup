---
sidebar_position: 6
title: Examples
---

# Themed examples

The `examples/` directory holds the same **document workbench** demo — editor with
toolbar, format-routed preview, local import queue with progress, PDF export — rebuilt
in different design systems on the *identical* aleup hooks. They're the proof that the
theming contract holds, and they build in CI as integration tests of the published
package surface.

| Example | Design system | Status |
|---|---|---|
| `examples/shadcn` | shadcn/ui-style (Tailwind v4 + cva) — flagship reference | ✅ Tier 1 |
| `examples/mui` | MUI (Material UI) | ✅ Tier 1 |
| `examples/daisyui` | daisyUI 5 | ✅ Tier 1 |
| `examples/mantine` | Mantine | planned |
| `examples/heroui` | HeroUI | planned |
| `examples/headlessui` | Headless UI | planned |
| `examples/magicui` | Magic UI (shadcn-based) | planned |
| `examples/aceternity` | Aceternity UI (shadcn-based) | planned |

Run one locally:

```bash
pnpm install
pnpm build                              # build the packages first
pnpm --filter aleup-example-shadcn dev
```

The built examples deploy with this site under `/demos/*` so you can play with each one
in the browser without cloning anything.

:::note
The examples mock the server side (`DestinationPort` targets a echo endpoint, the cloud
picker browses a fake provider) so they run with zero backend. Wiring real providers
needs a [Companion server](/docs/packages/companion).
:::
