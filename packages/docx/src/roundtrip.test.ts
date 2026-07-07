// Unit tests for the DOCX round-trip's pure pieces: projection splitting, editor-markdown
// splitting, and the LCS block diff. The WASM session itself is exercised in the browser;
// these guard the patch-planning logic around it.
import { expect, test } from "vitest";
import { diffBlocks, splitEditedMarkdown, splitProjection, type DiffOp } from "./roundtrip.js";

// Docxodus PREFIXES each block with its anchor; blocks are separated by blank lines. A
// leading unanchored line (docxodus sometimes emits a bare title) is not addressable.
const PROJECTION = [
  "# Document",
  "",
  "{#h.111} # Engagement Letter",
  "",
  "{#p.222} This letter confirms the terms of our engagement.",
  "",
  "{#tbl.333} | Fee | Amount |\n| --- | --- |\n| Retainer | $5,000 |",
  "",
  "{#p.444} Please sign and return.",
].join("\n");

test("splitProjection: anchors prefix their block; last block + blank-line blocks survive", () => {
  const blocks = splitProjection(PROJECTION);
  // Four anchored blocks; the leading unanchored "# Document" is excluded.
  expect(blocks.length).toBe(4);
  expect(blocks.map((b) => b.anchor)).toEqual(["h.111", "p.222", "tbl.333", "p.444"]);
  expect(blocks[0]!.markdown).toBe("# Engagement Letter");
  // The table block keeps its internal newlines.
  expect(blocks[2]!.markdown).toContain("| Retainer | $5,000 |");
  // The final block (text after the last anchor) is captured, not dropped.
  expect(blocks[3]!.markdown).toBe("Please sign and return.");
});

test("splitEditedMarkdown: blank-line blocks, fences kept intact, stray anchors stripped", () => {
  const blocks = splitEditedMarkdown(
    "# Title\n\npara one {#p.999}\n\n```\ncode\n\nstill code\n```\n\nlast",
  );
  expect(blocks).toEqual(["# Title", "para one", "```\ncode\n\nstill code\n```", "last"]);
});

function ops(oldMd: string, newMd: string): DiffOp[] {
  return diffBlocks(splitProjection(oldMd), splitEditedMarkdown(newMd));
}

test("diffBlocks: identical content is all-equal (whitespace-insensitive)", () => {
  const result = ops(
    PROJECTION,
    "# Engagement Letter\n\nThis letter confirms   the terms of our engagement.\n\n| Fee | Amount |\n| --- | --- |\n| Retainer | $5,000 |\n\nPlease sign and return.",
  );
  expect(result.every((op) => op.kind === "equal"), JSON.stringify(result)).toBe(true);
});

test("diffBlocks: a single edited paragraph becomes one replace, neighbors stay equal", () => {
  const result = ops(
    PROJECTION,
    "# Engagement Letter\n\nThis letter confirms the REVISED terms of our engagement.\n\n| Fee | Amount |\n| --- | --- |\n| Retainer | $5,000 |\n\nPlease sign and return.",
  );
  expect(result.map((o) => o.kind)).toEqual(["equal", "replace", "equal", "equal"]);
  const replace = result[1] as Extract<DiffOp, { kind: "replace" }>;
  expect(replace.oldIdxs).toEqual([1]);
  expect(replace.newIdxs).toEqual([1]);
});

test("diffBlocks: deletions and insertions land as delete/insert regions", () => {
  // Drop the table, add two new paragraphs at the end.
  const result = ops(
    PROJECTION,
    "# Engagement Letter\n\nThis letter confirms the terms of our engagement.\n\nPlease sign and return.\n\nNew closing paragraph.\n\nAnother addition.",
  );
  expect(result.map((o) => o.kind)).toEqual(["equal", "equal", "delete", "equal", "insert"]);
  const del = result[2] as Extract<DiffOp, { kind: "delete" }>;
  expect(del.oldIdxs).toEqual([2]); // the table block
  const ins = result[4] as Extract<DiffOp, { kind: "insert" }>;
  expect(ins.newIdxs).toEqual([3, 4]);
});

test("diffBlocks: full rewrite pairs blocks positionally", () => {
  const result = ops("{#p.1} alpha\n\n{#p.2} beta", "gamma\n\ndelta\n\nepsilon");
  expect(result.length).toBe(1);
  const replace = result[0] as Extract<DiffOp, { kind: "replace" }>;
  expect(replace.oldIdxs).toEqual([0, 1]);
  expect(replace.newIdxs).toEqual([0, 1, 2]);
});
