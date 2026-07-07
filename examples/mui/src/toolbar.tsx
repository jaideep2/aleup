// Themed editor toolbar: MUI ToggleButtons/IconButtons driven by useDocToolbarState(editor)
// for active/disabled flags and editor.chain().focus() commands — the DocEditor `toolbar`
// render-prop contract.

import type { ReactNode } from "react";
import { useDocToolbarState, type Editor } from "@aleup/editor";
import {
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  Tooltip,
} from "@mui/material";
import {
  Code,
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  GridOn,
  Redo,
  Undo,
  StrikethroughS,
} from "@mui/icons-material";

function MarkToggle({
  label,
  value,
  selected,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <ToggleButton
        value={value}
        size="small"
        selected={selected}
        aria-label={label}
        sx={{ border: 0, px: 0.9, py: 0.6 }}
        onMouseDown={(event) => event.preventDefault()} // keep the editor selection focused
        onChange={onToggle}
      >
        {children}
      </ToggleButton>
    </Tooltip>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useDocToolbarState(editor);

  return (
    <Stack
      direction="row"
      alignItems="center"
      flexWrap="wrap"
      gap={0.25}
      sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}
    >
      <Tooltip title="Undo">
        <span>
          <IconButton
            size="small"
            disabled={!state.canUndo}
            aria-label="Undo"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo">
        <span>
          <IconButton
            size="small"
            disabled={!state.canRedo}
            aria-label="Redo"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

      <Select
        size="small"
        value={state.heading}
        aria-label="Block type"
        sx={{ mx: 0.5, minWidth: 122, fontSize: 13, "& .MuiSelect-select": { py: 0.5 } }}
        onChange={(event) => {
          const level = Number(event.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
        }}
      >
        <MenuItem value={0}>Paragraph</MenuItem>
        <MenuItem value={1}>Heading 1</MenuItem>
        <MenuItem value={2}>Heading 2</MenuItem>
        <MenuItem value={3}>Heading 3</MenuItem>
      </Select>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

      <MarkToggle
        label="Bold"
        value="bold"
        selected={state.bold}
        onToggle={() => editor.chain().focus().toggleBold().run()}
      >
        <FormatBold fontSize="small" />
      </MarkToggle>
      <MarkToggle
        label="Italic"
        value="italic"
        selected={state.italic}
        onToggle={() => editor.chain().focus().toggleItalic().run()}
      >
        <FormatItalic fontSize="small" />
      </MarkToggle>
      <MarkToggle
        label="Strikethrough"
        value="strike"
        selected={state.strike}
        onToggle={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughS fontSize="small" />
      </MarkToggle>
      <MarkToggle
        label="Inline code"
        value="code"
        selected={state.code}
        onToggle={() => editor.chain().focus().toggleCode().run()}
      >
        <Code fontSize="small" />
      </MarkToggle>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

      <MarkToggle
        label="Bullet list"
        value="bulletList"
        selected={state.bulletList}
        onToggle={() => editor.chain().focus().toggleBulletList().run()}
      >
        <FormatListBulleted fontSize="small" />
      </MarkToggle>
      <MarkToggle
        label="Ordered list"
        value="orderedList"
        selected={state.orderedList}
        onToggle={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <FormatListNumbered fontSize="small" />
      </MarkToggle>
      <MarkToggle
        label="Blockquote"
        value="blockquote"
        selected={state.blockquote}
        onToggle={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <FormatQuote fontSize="small" />
      </MarkToggle>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

      <MarkToggle
        label="Insert table"
        value="table"
        selected={state.table}
        onToggle={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <GridOn fontSize="small" />
      </MarkToggle>
    </Stack>
  );
}
