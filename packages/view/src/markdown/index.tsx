"use client";

// Read-only markdown renderer (opt-in subpath — pulls @aleup/editor and therefore Tiptap):
// same schema and page styling as the editor, so preview and edit look identical. Register
// it on the router: <DocumentViewer renderers={{ md: MarkdownView }} …/>.

import { DocEditor } from "@aleup/editor";
import type { DocSource } from "../DocumentViewer.js";

export function MarkdownView({ textContent }: DocSource) {
  return (
    <DocEditor content={textContent ?? ""} contentType="markdown" editable={false} />
  );
}
