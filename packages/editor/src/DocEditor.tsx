"use client";

// Headless Tiptap document editor. Tiptap owns all DOM/editing state; content moves in and
// out as Markdown (@tiptap/markdown, bidirectional) or HTML (e.g. @aleup/docx DOCX ingestion).
//
// Theming contract: the component is unstyled. Structure is exposed via data-aleup-* attributes
// and per-slot classNames; import "@aleup/editor/styles.css" for the neutral document-page look
// (which doubles as print CSS for @aleup/pdf exports). The toolbar is a render-prop slot — bring
// buttons from your design system and drive them with useDocToolbarState().

import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { DOC_EDITOR_EXTENSIONS } from "./preset.js";

export interface DocEditorClassNames {
  /** Outer column container. */
  root?: string;
  /** Scrollable backdrop around the page. Default styling class: doc-page-backdrop. */
  backdrop?: string;
  /** The ProseMirror page element itself. Defaults to "doc-page tiptap-doc". */
  page?: string;
}

export interface DocEditorProps {
  /** Initial content — remount (key by doc id) to load a different document. */
  content: string;
  contentType: "markdown" | "html";
  editable?: boolean;
  /**
   * Toolbar slot, rendered above the page while editable. Receives the live editor;
   * combine with useDocToolbarState() for active/disabled flags.
   */
  toolbar?: (editor: Editor) => ReactNode;
  /** Surface the live Editor instance to the parent (save/export handlers). */
  onEditor?: (editor: Editor | null) => void;
  classNames?: DocEditorClassNames;
  /** Extra attributes for the ProseMirror element (e.g. spellcheck). */
  editorAttributes?: Record<string, string>;
}

export function DocEditor({
  content,
  contentType,
  editable = true,
  toolbar,
  onEditor,
  classNames,
  editorAttributes,
}: DocEditorProps) {
  const editor = useEditor({
    extensions: DOC_EDITOR_EXTENSIONS,
    content,
    contentType,
    editable,
    // SSR frameworks (Next app router): render on the client only.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: classNames?.page ?? "doc-page tiptap-doc",
        spellcheck: "true",
        ...editorAttributes,
      },
    },
  });

  useEffect(() => {
    onEditor?.(editor ?? null);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <div data-aleup-editor="" className={classNames?.root}>
      {editable && editor && toolbar ? (
        <div data-aleup-editor-toolbar="">{toolbar(editor)}</div>
      ) : null}
      <div
        data-aleup-editor-scroll=""
        className={classNames?.backdrop ?? "doc-page-backdrop"}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
