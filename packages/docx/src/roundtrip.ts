// DOCX editing round-trip.
//
// Docxodus's npm surface intentionally has no one-shot HTML→DOCX converter; instead it
// exposes a stateful `DocxSession` over the ORIGINAL OpenXML: blocks are addressed by
// anchor ids and edited with markdown patches, and `session.save()` re-serializes the
// package. That beats HTML→WML regeneration for fidelity — every byte of untouched
// formatting (styles, numbering, headers/footers, section props) survives the round
// trip, because we only patch the blocks the user actually changed.
//
// Flow:
//   openDocxForEditing(bytes)
//     → session.project()          — anchor-addressed markdown `{#id}` per block
//     → strip anchors              — clean markdown for Tiptap (@tiptap/markdown)
//   handle.save(editedMarkdown)
//     → split both sides into blocks, LCS-align on normalized text
//     → replaceText / insertParagraph / deleteBlock per changed region
//     → session.save() → native .docx bytes
//
// If a patch fails (markdown outside the session's supported subset, exotic
// structures), save() throws DocxPatchError — hosts should fall back to a lossier
// markdown→DOCX regeneration path with user consent (formatting reset, never silent).

import type { DocxSession, EditResult } from "docxodus";
import { getDocxodus } from "./client.js";

/** Matches Docxodus markdown-projection anchor tokens, e.g. `{#p.4F2A…}`. */
const ANCHOR_TOKEN = /\{#([^}\s]+)\}/g;

export class DocxPatchError extends Error {
  constructor(
    message: string,
    readonly failures: { anchor?: string; markdown: string; reason: string }[],
  ) {
    super(message);
    this.name = "DocxPatchError";
  }
}

export interface DocxEditingHandle {
  /** Anchor-free markdown of the document body, ready for Tiptap ingestion. */
  markdown: string;
  /** Diff the edited markdown against the projection, patch, and serialize. */
  save(editedMarkdown: string): Promise<Uint8Array>;
  /** Release the WASM-side session (not GC'd automatically). */
  close(): void;
}

export interface AnchoredBlock {
  anchor: string;
  markdown: string;
  norm: string;
}

// The splitters and differ below are exported for unit tests (roundtrip.test.ts) —
// they're pure and WASM-free; only openDocxForEditing touches the Docxodus runtime.

/**
 * Split an anchor-addressed projection into blocks. Docxodus PREFIXES each block with its
 * anchor (`{#id} <block markdown>`, blocks separated by blank lines), so each block is the
 * anchor token plus the text that FOLLOWS it, up to the next anchor (or end of string) —
 * robust even when a block (table, multi-line list item) contains blank lines.
 *
 * Pairing the anchor with the text before it (as an earlier version did) mis-mapped every
 * block onto the *next* block's id — so `replaceText`/`deleteBlock` patched the wrong node
 * (→ DocxPatchError, forcing the lossy regenerate fallback) and silently dropped the final
 * block (the text after the last anchor). Any text before the FIRST anchor is unaddressable
 * (docxodus emits no id for it); it's left out of the editable projection but survives a
 * patch-save untouched, since we never target it.
 */
export function splitProjection(projection: string): AnchoredBlock[] {
  const blocks: AnchoredBlock[] = [];
  const matches = [...projection.matchAll(ANCHOR_TOKEN)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : projection.length;
    const markdown = projection.slice(start, end).replace(/^\s+|\s+$/g, "");
    blocks.push({ anchor: m[1]!, markdown, norm: normalizeBlock(markdown) });
  }
  return blocks;
}

/** Split editor markdown into top-level blocks (blank-line separated, fence-aware). */
export function splitEditedMarkdown(markdown: string): string[] {
  const lines = markdown.replace(ANCHOR_TOKEN, "").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  const flush = () => {
    const text = current.join("\n").replace(/^\n+|\s+$/g, "");
    if (text) blocks.push(text);
    current = [];
  };
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      current.push(line);
      continue;
    }
    if (!inFence && line.trim() === "") {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return blocks;
}

/** Normalization for equality: collapse whitespace so soft-wrap changes aren't edits. */
function normalizeBlock(markdown: string): string {
  return markdown.replace(/\s+/g, " ").trim();
}

export type DiffOp =
  | { kind: "equal"; oldIdx: number; newIdx: number }
  | { kind: "replace"; oldIdxs: number[]; newIdxs: number[] }
  | { kind: "delete"; oldIdxs: number[] }
  | { kind: "insert"; newIdxs: number[] };

/** Classic LCS alignment over normalized block text, grouped into edit regions. */
export function diffBlocks(oldBlocks: AnchoredBlock[], newBlocks: string[]): DiffOp[] {
  const newNorm = newBlocks.map(normalizeBlock);
  const n = oldBlocks.length;
  const m = newNorm.length;
  // LCS table (documents are block-counted in the hundreds — O(n·m) is fine).
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        oldBlocks[i]!.norm === newNorm[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let pendingOld: number[] = [];
  let pendingNew: number[] = [];
  const flushPending = () => {
    if (pendingOld.length && pendingNew.length) {
      ops.push({ kind: "replace", oldIdxs: pendingOld, newIdxs: pendingNew });
    } else if (pendingOld.length) {
      ops.push({ kind: "delete", oldIdxs: pendingOld });
    } else if (pendingNew.length) {
      ops.push({ kind: "insert", newIdxs: pendingNew });
    }
    pendingOld = [];
    pendingNew = [];
  };
  while (i < n && j < m) {
    if (oldBlocks[i]!.norm === newNorm[j]) {
      flushPending();
      ops.push({ kind: "equal", oldIdx: i, newIdx: j });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      pendingOld.push(i++);
    } else {
      pendingNew.push(j++);
    }
  }
  while (i < n) pendingOld.push(i++);
  while (j < m) pendingNew.push(j++);
  flushPending();
  return ops;
}

export async function openDocxForEditing(bytes: Uint8Array): Promise<DocxEditingHandle> {
  const dx = await getDocxodus();
  // Accept tracked changes for the editable projection — the editor has no revision UI,
  // and re-serializing rejected-but-rendered markup would corrupt intent.
  const session = dx.openDocxSession(bytes, { trackedChanges: "accept" });
  const projection = session.project();
  const blocks = splitProjection(projection.markdown);
  const markdown = blocks
    .map((b) => b.markdown)
    .filter(Boolean)
    .join("\n\n");

  let closed = false;

  return {
    markdown,

    async save(editedMarkdown: string): Promise<Uint8Array> {
      if (closed) throw new Error("DOCX editing session already closed");
      const newBlocks = splitEditedMarkdown(editedMarkdown);
      const ops = diffBlocks(blocks, newBlocks);
      const failures: { anchor?: string; markdown: string; reason: string }[] = [];

      // Tracks the anchor a subsequent insert should attach after (last block that
      // still exists in the patched document).
      let lastLiveAnchor: string | null = null;

      const apply = (result: EditResult, md: string, anchor?: string) => {
        if (!result.success) {
          failures.push({ anchor, markdown: md, reason: result.error?.message ?? "unknown" });
          return null;
        }
        return result;
      };

      for (const op of ops) {
        if (op.kind === "equal") {
          lastLiveAnchor = blocks[op.oldIdx]!.anchor;
          continue;
        }
        if (op.kind === "delete") {
          for (const idx of op.oldIdxs) {
            apply(
              session.deleteBlock(blocks[idx]!.anchor),
              blocks[idx]!.markdown,
              blocks[idx]!.anchor,
            );
          }
          continue;
        }
        if (op.kind === "replace") {
          const paired = Math.min(op.oldIdxs.length, op.newIdxs.length);
          for (let k = 0; k < paired; k++) {
            const old = blocks[op.oldIdxs[k]!]!;
            const next = newBlocks[op.newIdxs[k]!]!;
            const res = apply(session.replaceText(old.anchor, next), next, old.anchor);
            if (res) lastLiveAnchor = old.anchor;
          }
          for (let k = paired; k < op.oldIdxs.length; k++) {
            const old = blocks[op.oldIdxs[k]!]!;
            apply(session.deleteBlock(old.anchor), old.markdown, old.anchor);
          }
          for (let k = paired; k < op.newIdxs.length; k++) {
            lastLiveAnchor =
              insertAfter(session, lastLiveAnchor, newBlocks[op.newIdxs[k]!]!, failures) ??
              lastLiveAnchor;
          }
          continue;
        }
        // insert
        for (const idx of op.newIdxs) {
          lastLiveAnchor =
            insertAfter(session, lastLiveAnchor, newBlocks[idx]!, failures) ?? lastLiveAnchor;
        }
      }

      if (failures.length) {
        throw new DocxPatchError(
          `Couldn't apply ${failures.length} change(s) to the original document structure`,
          failures,
        );
      }
      return session.save();
    },

    close() {
      if (closed) return;
      closed = true;
      session.close();
    },
  };

  function insertAfter(
    session: DocxSession,
    afterAnchor: string | null,
    markdown: string,
    failures: { anchor?: string; markdown: string; reason: string }[],
  ): string | null {
    if (!afterAnchor) {
      // Document prepend: anchor to the first block instead.
      const first = blocks[0];
      if (!first) {
        failures.push({ markdown, reason: "cannot insert into an empty projection" });
        return null;
      }
      const res = session.insertParagraph(first.anchor, "before", markdown);
      if (!res.success) {
        failures.push({ markdown, reason: res.error?.message ?? "unknown" });
        return null;
      }
      return res.created[0]?.id ?? null;
    }
    const res = session.insertParagraph(afterAnchor, "after", markdown);
    if (!res.success) {
      failures.push({ anchor: afterAnchor, markdown, reason: res.error?.message ?? "unknown" });
      return null;
    }
    return res.created[0]?.id ?? afterAnchor;
  }
}
