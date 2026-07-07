// Themed editor toolbar: daisyUI btn classes driven by useDocToolbarState(editor) for
// active/disabled flags and editor.chain().focus() commands — the DocEditor `toolbar`
// render-prop contract. Glyph labels keep this example free of an icon dependency.

import type { ReactNode } from "react";
import { useDocToolbarState, type Editor } from "@aleup/editor";

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm btn-square ${active ? "btn-active" : ""}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()} // keep the editor selection focused
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-base-300" />;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useDocToolbarState(editor);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-base-300 bg-base-100 px-2 py-1.5">
      <ToolButton
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <span className="text-base">↶</span>
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <span className="text-base">↷</span>
      </ToolButton>

      <Divider />

      <select
        aria-label="Block type"
        className="select select-sm w-32"
        value={state.heading}
        onChange={(event) => {
          const level = Number(event.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
        }}
      >
        <option value={0}>Paragraph</option>
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
      </select>

      <Divider />

      <ToolButton
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-black">B</span>
      </ToolButton>
      <ToolButton
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="font-serif italic">I</span>
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolButton>
      <ToolButton
        label="Inline code"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="font-mono text-xs">{"</>"}</span>
      </ToolButton>

      <Divider />

      <ToolButton
        label="Bullet list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <span className="text-base">≔</span>
      </ToolButton>
      <ToolButton
        label="Ordered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <span className="text-xs font-semibold">1.</span>
      </ToolButton>
      <ToolButton
        label="Blockquote"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <span className="font-serif text-lg leading-none">❝</span>
      </ToolButton>

      <Divider />

      <ToolButton
        label="Insert table"
        active={state.table}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <span className="text-base">⊞</span>
      </ToolButton>
    </div>
  );
}
