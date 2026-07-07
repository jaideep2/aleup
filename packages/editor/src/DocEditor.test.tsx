// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DocEditor } from "./DocEditor.js";
import { getMarkdown } from "./preset.js";
import type { Editor } from "@tiptap/react";

afterEach(cleanup);

test("renders markdown content and surfaces the editor instance", async () => {
  let live: Editor | null = null;
  render(
    <DocEditor
      content={"# Hello\n\nA **bold** move."}
      contentType="markdown"
      onEditor={(e) => (live = e)}
    />,
  );
  await waitFor(() => expect(live).not.toBeNull());
  await waitFor(() => expect(screen.getByText("Hello")).toBeTruthy());
  expect(getMarkdown(live!)).toContain("# Hello");
});

test("toolbar slot renders only when editable", async () => {
  const { rerender } = render(
    <DocEditor content="x" contentType="markdown" editable toolbar={() => <button>TB</button>} />,
  );
  await waitFor(() => expect(screen.getByText("TB")).toBeTruthy());
  rerender(
    <DocEditor
      content="x"
      contentType="markdown"
      editable={false}
      toolbar={() => <button>TB</button>}
    />,
  );
  await waitFor(() => expect(screen.queryByText("TB")).toBeNull());
});

test("markdown round-trips through the schema, tables included", async () => {
  let live: Editor | null = null;
  const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
  render(<DocEditor content={md} contentType="markdown" onEditor={(e) => (live = e)} />);
  await waitFor(() => expect(live).not.toBeNull());
  // The table extensions are in the preset, so the table must survive ingestion (the #1
  // data-loss risk with StarterKit alone). Cell padding varies by serializer version —
  // normalize whitespace before asserting.
  await waitFor(() =>
    expect(getMarkdown(live!).replace(/ +/g, " ")).toContain("| 1 | 2 |"),
  );
});
