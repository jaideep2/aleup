---
sidebar_position: 4
title: Theming
---

# Theming

aleup bakes in **no design system** — components ship unstyled and expose one theming
contract with four layers. Use whichever fits; they compose.

## 1. Headless hooks (own everything)

Every capability exists as a hook with zero UI: `useUppyImport`, `useCloudDrivePicker`,
`useDocToolbarState`, the DOCX session API. If you build your UI from these, there is
nothing to theme — see the [examples](/docs/examples), which render the *same* picker
state machine as three different dialogs.

## 2. CSS variables + data attributes (pure CSS)

Every shipped component tags its structure with `data-aleup-*` attributes, and the
optional stylesheets read all colors/metrics from `--aleup-*` custom properties with
neutral fallbacks:

```css
:root {
  --aleup-backdrop: oklch(0.97 0 0);      /* page backdrop */
  --aleup-page-bg: #fff;                  /* the document page */
  --aleup-page-font: "Inter", sans-serif;
  --aleup-link: theme(colors.blue.600);   /* works with Tailwind/daisyUI tokens */
  --aleup-accent: var(--color-primary);
}
```

Or skip our stylesheets entirely and style the attributes yourself:

```css
[data-aleup-editor-scroll] { @apply bg-base-200; }   /* daisyUI */
[data-aleup-viewer-state="error"] { color: var(--mui-palette-error-main); }
```

## 3. Per-slot classNames

Components take a `classNames` object keyed by slot:

```tsx
<DocEditor classNames={{ backdrop: "bg-muted", page: "doc-page tiptap-doc shadow-lg" }} />
<DocxHtmlView classNames={{ backdrop: "bg-base-200" }} />
```

## 4. Slot substitution (`components` / render props)

Where a component needs interactive primitives, it accepts yours: `DocEditor`'s
`toolbar` render prop receives the live editor (bring MUI `IconButton`s, shadcn
`Toggle`s, …); `DocumentViewer`'s `slots.loading/error/fallback` and `renderers` replace
whole regions.

## Stylesheets are opt-in

- `@aleup/editor/styles.css` — document page + typography (doubles as print CSS).
- `@aleup/view/styles.css` — viewer states, spinner, iframe/img/pre defaults.

Skip them and nothing styles itself; import them and override variables. No Tailwind
is required by aleup, and no aleup class ever collides with your utility classes.
