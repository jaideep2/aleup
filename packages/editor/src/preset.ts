// The aleup document schema. Deliberately includes the table extensions so DOCX→HTML
// ingestion (@aleup/docx) doesn't silently strip tables — the #1 data-loss risk with
// StarterKit alone. Markdown IO is bidirectional via @tiptap/markdown.
//
// NOTE: only MIT-licensed Tiptap packages may appear here — no Tiptap Pro extensions.

import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import type { Editor } from "@tiptap/react";

export const DOC_EDITOR_EXTENSIONS = [
  StarterKit,
  Markdown,
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
];

/** The editor's current content as markdown (@tiptap/markdown's Editor augmentation). */
export function getMarkdown(editor: Editor): string {
  return editor.getMarkdown();
}
