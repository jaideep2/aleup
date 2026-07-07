---
title: "@aleup/editor"
---

# @aleup/editor

Headless [Tiptap](https://tiptap.dev) document editor. Tiptap owns all DOM/editing
state; content moves in and out as Markdown (bidirectional) or HTML (DOCX ingestion).

**Peers:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/markdown`, the four
`@tiptap/extension-table*` packages, `@tiptap/pm`, `react`, `react-dom`.

:::note Tiptap Pro boundary
Only MIT-licensed Tiptap packages are used and allowed here. Do not add Tiptap Pro
extensions (collaboration, comments, …) if you redistribute this stack.
:::

## The preset

`DOC_EDITOR_EXTENSIONS` = StarterKit + Markdown + resizable tables. Tables are included
deliberately: DOCX→HTML ingestion silently strips tables with StarterKit alone — the #1
data-loss risk.

## `<DocEditor>`

```tsx
<DocEditor
  content={markdown}
  contentType="markdown"        // or "html"
  editable
  toolbar={(editor) => <MyToolbar editor={editor} />}
  onEditor={(editor) => ref.current = editor}
  classNames={{ root, backdrop, page }}
/>
```

- Unstyled; structure exposed as `data-aleup-editor`, `data-aleup-editor-toolbar`,
  `data-aleup-editor-scroll`. Import `@aleup/editor/styles.css` for the neutral
  document-page look (US-Letter page, backdrop, typography) — all colors/metrics read
  from `--aleup-*` variables.
- The stylesheet doubles as **print CSS**: [`@aleup/pdf`](/docs/packages/pdf) renders the
  same DOM, so the editor is a live print preview.
- Remount (key by document id) to load a different document.

## `useDocToolbarState(editor)`

Subscribes to exactly the flags a toolbar renders (bold/italic/…/heading level/
canUndo/canRedo/table) without re-rendering the editor tree. Pair with
`editor.chain().focus()` commands from any design system's buttons.

## `getMarkdown(editor)`

Read the current content back as markdown for saving.
