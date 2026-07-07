// Themed editor toolbar: shadcn-style buttons driven by useDocToolbarState(editor) for
// active/disabled flags and editor.chain().focus() commands — the DocEditor `toolbar`
// render-prop contract.

import type { ReactNode } from "react";
import { useDocToolbarState, type Editor } from "@aleup/editor";
import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Table,
  TextQuote,
  Undo2,
} from "lucide-react";

import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";

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
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(active && "bg-accent text-accent-foreground")}
      onMouseDown={(event) => event.preventDefault()} // keep the editor selection focused
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <div aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useDocToolbarState(editor);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-card px-2 py-1.5">
      <ToolButton
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 />
      </ToolButton>
      <ToolButton
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 />
      </ToolButton>

      <Divider />

      <select
        aria-label="Block type"
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <Bold />
      </ToolButton>
      <ToolButton
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolButton>
      <ToolButton
        label="Inline code"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code />
      </ToolButton>

      <Divider />

      <ToolButton
        label="Bullet list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolButton>
      <ToolButton
        label="Ordered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolButton>
      <ToolButton
        label="Blockquote"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <TextQuote />
      </ToolButton>

      <Divider />

      <ToolButton
        label="Insert table"
        active={state.table}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <Table />
      </ToolButton>
    </div>
  );
}
