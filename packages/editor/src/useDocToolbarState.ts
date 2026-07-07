"use client";

// Headless toolbar state: subscribes to exactly the selection flags a document toolbar
// renders, so a host toolbar stays in sync without re-rendering the editor tree. Pair it
// with your own buttons (any design system) and `editor.chain().focus()` commands.

import { useEditorState, type Editor } from "@tiptap/react";

export interface DocToolbarState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  table: boolean;
  /** Active heading level, 0 when the selection is body text. */
  heading: 0 | 1 | 2 | 3;
  canUndo: boolean;
  canRedo: boolean;
}

export function useDocToolbarState(editor: Editor): DocToolbarState {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      table: e.isActive("table"),
      heading: (e.isActive("heading", { level: 1 })
        ? 1
        : e.isActive("heading", { level: 2 })
          ? 2
          : e.isActive("heading", { level: 3 })
            ? 3
            : 0) as 0 | 1 | 2 | 3,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
}
