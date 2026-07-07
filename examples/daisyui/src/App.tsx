// aleup "document workbench" demo, daisyUI edition. The identical demo exists in
// examples/shadcn and examples/mui on the same aleup hooks — only the UI layer differs.
//
//  - Editor pane: <DocEditor> + a daisyUI btn toolbar (see toolbar.tsx)
//  - Preview pane: <DocumentViewer> format router with themed slots + a tabs doc switcher
//  - Cloud picker: a daisyUI modal over useCloudDrivePicker + a mock CompanionClient
//  - Export PDF: downloadElementAsPdf over the editor's .doc-page element
//  - Theme switcher: data-theme flips daisyUI tokens AND the --aleup-* variables mapped
//    to them in index.css, re-skinning the document page live.

import { useEffect, useMemo, useState } from "react";
import { DocEditor } from "@aleup/editor";
import { DocumentViewer, type DocFormat, type DocSource } from "@aleup/view";
import { MarkdownView } from "@aleup/view/markdown";
import {
  fileLabel,
  formatSize,
  useCloudDrivePicker,
  type CompanionItem,
} from "@aleup/import";
import { downloadElementAsPdf } from "@aleup/pdf";

import { EditorToolbar } from "./toolbar";
import { createMockClient } from "./mock-provider";

/* ── Sample documents ────────────────────────────────────────────────────── */

const EDITOR_DOC = `# Master Services Agreement

**This Master Services Agreement** ("Agreement") is entered into as of **July 7, 2026** by and between Meridian & Vale LLP ("Firm") and Acme Holdings, Inc. ("Client").

## 1. Engagement

The Firm will provide the legal services described in each mutually executed Statement of Work. Each SOW is governed by this Agreement; in the event of conflict, the SOW controls for that engagement only.

## 2. Client responsibilities

- Provide timely access to records, systems, and personnel
- Designate a single point of contact authorized to approve scope changes
- Remit payment within thirty (30) days of each invoice

## 3. Fee schedule

| Matter type | Partner rate | Associate rate |
| --- | --- | --- |
| Corporate / M&A | $950/hr | $520/hr |
| Litigation | $875/hr | $480/hr |
| Regulatory | $825/hr | $450/hr |

> Nothing in this Agreement creates a partnership, joint venture, or fiduciary relationship beyond the attorney–client relationship described herein.

## 4. Term and termination

Either party may terminate for convenience on thirty (30) days' written notice. Sections 3, 5, and 6 survive termination.
`;

const PREVIEW_MD = `# Deposition Summary — J. Whitfield

**Matter:** Acme Holdings v. Beacon Logistics · **Date:** June 24, 2026 · **Reporter:** K. Ames, CSR #4411

## Key admissions

1. Witness confirmed the warehouse manifest was altered on **March 3, 2025**.
2. Witness could not identify who authorized the schedule change.
3. Witness acknowledged receiving the compliance memo (Exhibit 12).

## Follow-ups

- Subpoena the March dispatch logs
- Depose the night-shift supervisor
- Request native-format copies of the manifest spreadsheet
`;

const PREVIEW_TXT = `CALL NOTES — 2026-07-02, 14:05
Participants: R. Ames (Firm), D. Okafor (Acme GC)

- Acme wants the indemnity cap revisited before signature.
- Confirm whether the Beacon subpoena response is due July 18 or July 25.
- GC prefers monthly invoicing; send the revised fee schedule Friday.

Next call: 2026-07-09, 10:00 PT
`;

const EXHIBIT_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='560' height='400' viewBox='0 0 560 400'>
  <rect width='560' height='400' fill='#f8fafc'/>
  <rect x='24' y='24' width='512' height='352' fill='#ffffff' stroke='#cbd5e1' stroke-width='2' rx='12'/>
  <g transform='rotate(-8 280 200)'>
    <rect x='120' y='140' width='320' height='120' fill='none' stroke='#b91c1c' stroke-width='6' rx='16'/>
    <text x='280' y='192' font-family='Georgia, serif' font-size='44' font-weight='bold' fill='#b91c1c' text-anchor='middle'>EXHIBIT A</text>
    <text x='280' y='232' font-family='Georgia, serif' font-size='18' fill='#b91c1c' text-anchor='middle'>Acme Holdings v. Beacon Logistics</text>
  </g>
  <text x='280' y='352' font-family='Arial, sans-serif' font-size='13' fill='#64748b' text-anchor='middle'>Scanned exhibit placeholder — served to the image renderer as a data: URL</text>
</svg>`;

interface DemoDoc {
  id: string;
  label: string;
  format: DocFormat;
  name: string;
  fileUrl: string;
  textContent?: string;
}

const PREVIEW_DOCS: DemoDoc[] = [
  {
    id: "summary",
    label: "Markdown",
    format: "md",
    name: "deposition-summary.md",
    fileUrl: "#",
    textContent: PREVIEW_MD,
  },
  {
    id: "notes",
    label: "Plain text",
    format: "text",
    name: "call-notes.txt",
    fileUrl: "#",
    textContent: PREVIEW_TXT,
  },
  {
    id: "exhibit",
    label: "Image",
    format: "image",
    name: "exhibit-a.svg",
    fileUrl: `data:image/svg+xml,${encodeURIComponent(EXHIBIT_SVG)}`,
  },
  {
    id: "archive",
    label: "Unknown",
    format: "other",
    name: "discovery-bundle.zip",
    fileUrl: "#",
  },
];

const THEMES = ["corporate", "dark", "cupcake"] as const;
type ThemeName = (typeof THEMES)[number];

/* ── Themed DocumentViewer slots ─────────────────────────────────────────── */

const viewerSlots = {
  loading: (
    <div className="flex h-full flex-col items-center justify-center gap-2 opacity-60">
      <span className="loading loading-spinner loading-md" />
      <p className="text-xs">Loading preview…</p>
    </div>
  ),
  error: (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-error">
      <span className="text-2xl">⚠︎</span>
      <p className="text-sm font-semibold">Failed to load this preview</p>
    </div>
  ),
  fallback: (source: DocSource) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-4xl opacity-40">🗂️</span>
      <div>
        <p className="text-sm font-semibold">No preview for {source.name}</p>
        <p className="mt-1 text-xs opacity-60">
          This file type isn't previewable — download it instead.
        </p>
      </div>
      <a className="btn btn-outline btn-sm" href={source.fileUrl} download={source.name}>
        Download
      </a>
    </div>
  ),
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function selectionSummary(fileCount: number, folderCount: number): string {
  const parts: string[] = [];
  if (fileCount > 0) parts.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
  if (folderCount > 0) parts.push(`${folderCount} folder${folderCount === 1 ? "" : "s"}`);
  return parts.length > 0 ? `${parts.join(", ")} selected` : "Nothing selected";
}

/* ── Cloud picker modal (useCloudDrivePicker over the mock client) ──────── */

function CloudPickerModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (files: CompanionItem[]) => void;
}) {
  // One client per session so mock auth persists across modal open/close.
  const provider = useMemo(() => createMockClient(), []);
  const picker = useCloudDrivePicker({ open, provider, rootLabel: "MockDrive" });

  async function handleImport() {
    const files = await picker.confirmSelection();
    if (files) {
      onImported(files);
      onClose();
    }
  }

  return (
    <div className={`modal ${open ? "modal-open" : ""}`} role="dialog" aria-modal="true">
      <div className="modal-box flex max-h-[85vh] max-w-xl flex-col gap-3">
        <div>
          <h3 className="text-lg font-bold">Import from MockDrive</h3>
          <p className="text-xs opacity-60">
            A fake provider driven by useCloudDrivePicker — no Companion server, no network.
          </p>
        </div>

        {picker.connected === null ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 opacity-60">
            <span className="loading loading-spinner loading-md" />
            <p className="text-xs">Checking connection…</p>
          </div>
        ) : picker.connected === false ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <span className="text-4xl opacity-40">☁️</span>
            <div>
              <p className="text-sm font-semibold">Connect your MockDrive account</p>
              <p className="mt-1 text-xs opacity-60">
                The mock OAuth handshake resolves after ~300 ms.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={picker.connecting}
              onClick={() => void picker.startAuth()}
            >
              {picker.connecting ? <span className="loading loading-spinner loading-xs" /> : null}
              {picker.connecting ? "Connecting…" : "Connect to MockDrive"}
            </button>
          </div>
        ) : (
          <>
            <div className="breadcrumbs py-0 text-xs" aria-label="Folders">
              <ul>
                {picker.path.map((entry, index) => {
                  const last = index === picker.path.length - 1;
                  return (
                    <li key={`${entry.requestPath ?? "root"}-${index}`}>
                      {last ? (
                        <span className="font-semibold">{entry.name}</span>
                      ) : (
                        <button
                          type="button"
                          className="link link-hover"
                          onClick={() => picker.navigateTo(index)}
                        >
                          {entry.name}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="max-h-72 min-h-48 overflow-y-auto rounded-box border border-base-300">
              <label className="flex items-center gap-2 border-b border-base-300 bg-base-200 px-3 py-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={picker.allSelected}
                  disabled={picker.selectableItems.length === 0}
                  onChange={picker.toggleSelectAll}
                  aria-label="Select all in this folder"
                />
                <span className="text-xs opacity-70">Select all in this folder</span>
                {picker.listing ? (
                  <span className="loading loading-spinner loading-xs ml-auto" />
                ) : null}
              </label>

              {picker.items.length === 0 && !picker.listing ? (
                <p className="px-3 py-8 text-center text-xs opacity-60">This folder is empty.</p>
              ) : null}

              {picker.items.map((item) => {
                const selectable = item.isFolder || picker.isFileSelectable(item.mimeType);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 border-b border-base-300 px-3 py-2 last:border-b-0 hover:bg-base-200"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={picker.selected.has(item.id)}
                      disabled={!selectable}
                      onChange={() => picker.toggleSelect(item)}
                      aria-label={`Select ${item.name}`}
                    />
                    <span aria-hidden className="shrink-0 text-sm">
                      {item.isFolder ? "📁" : "📄"}
                    </span>
                    {item.isFolder ? (
                      <button
                        type="button"
                        className="link link-hover min-w-0 flex-1 truncate text-left text-sm font-semibold no-underline"
                        onClick={() => picker.navigateInto(item)}
                      >
                        {item.name}
                      </button>
                    ) : (
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${selectable ? "" : "opacity-40"}`}
                      >
                        {item.name}
                      </span>
                    )}
                    <span className="badge badge-ghost badge-sm shrink-0">
                      {item.isFolder ? "Folder" : fileLabel(item.mimeType)}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[11px] tabular-nums opacity-60">
                      {formatSize(item.size)}
                    </span>
                  </div>
                );
              })}

              {picker.nextPagePath ? (
                <div className="border-t border-base-300 p-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-block"
                    disabled={picker.listing}
                    onClick={picker.loadMore}
                  >
                    {picker.listing ? <span className="loading loading-spinner loading-xs" /> : null}
                    Load more
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}

        {picker.error ? (
          <div className="alert alert-error px-3 py-2 text-xs">{picker.error}</div>
        ) : null}

        <div className="modal-action mt-0 items-center justify-between">
          <span className="text-xs opacity-60">
            {picker.connected ? selectionSummary(picker.fileCount, picker.folderCount) : ""}
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!picker.connected || picker.selectedCount === 0 || picker.expanding}
              onClick={() => void handleImport()}
            >
              {picker.expanding ? <span className="loading loading-spinner loading-xs" /> : null}
              {picker.expanding ? "Expanding folders…" : "Import selection"}
            </button>
          </div>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose}>
        close
      </button>
    </div>
  );
}

/* ── App ─────────────────────────────────────────────────────────────────── */

export function App() {
  const [docId, setDocId] = useState(PREVIEW_DOCS[0]!.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imported, setImported] = useState<CompanionItem[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("corporate");

  // Live retheming: daisyUI tokens AND the --aleup-* variables mapped to them flip together.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const doc = PREVIEW_DOCS.find((d) => d.id === docId) ?? PREVIEW_DOCS[0]!;

  async function exportPdf() {
    // The editor pane renders first in the DOM, so this grabs its page element.
    const page = document.querySelector<HTMLElement>(".doc-page");
    if (!page) return;
    setExporting(true);
    try {
      await downloadElementAsPdf(page, { filename: "master-services-agreement.pdf" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-base-200 text-base-content">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-base-300 bg-base-100 px-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-bold">aleup workbench</h1>
          <span className="text-xs opacity-60">daisyUI example</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs opacity-80">
            Theme
            <select
              className="select select-sm w-28"
              value={theme}
              onChange={(event) => setTheme(event.target.value as ThemeName)}
            >
              {THEMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPickerOpen(true)}>
            ☁︎ Import from cloud
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={exporting}
            onClick={() => void exportPdf()}
          >
            {exporting ? <span className="loading loading-spinner loading-xs" /> : "⤓"}
            Export PDF
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
          <div className="flex h-10 shrink-0 items-center border-b border-base-300 px-3">
            <span className="text-xs font-medium opacity-60">
              Editor — master-services-agreement.md
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <DocEditor
              content={EDITOR_DOC}
              contentType="markdown"
              toolbar={(editor) => <EditorToolbar editor={editor} />}
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-base-300 px-2">
            <span className="pl-1 text-xs font-medium opacity-60">Preview</span>
            <div role="tablist" className="tabs tabs-sm">
              {PREVIEW_DOCS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  className={`tab ${d.id === doc.id ? "tab-active" : ""}`}
                  onClick={() => setDocId(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <DocumentViewer
              key={doc.id}
              format={doc.format}
              name={doc.name}
              fileUrl={doc.fileUrl}
              textContent={doc.textContent}
              renderers={{ md: MarkdownView }}
              slots={viewerSlots}
            />
          </div>
        </section>
      </main>

      <CloudPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onImported={setImported}
      />

      {imported ? (
        <div className="toast toast-end z-50">
          <div className="alert alert-success grid max-w-sm grid-cols-1 items-start gap-1 text-left shadow-lg">
            <div className="flex w-full items-start justify-between gap-4">
              <span className="font-bold">
                Imported {imported.length} file{imported.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                aria-label="Dismiss"
                onClick={() => setImported(null)}
              >
                ✕
              </button>
            </div>
            <ul className="max-h-40 w-full overflow-y-auto text-xs">
              {imported.map((f) => (
                <li key={f.id} className="flex justify-between gap-3">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 opacity-70">{fileLabel(f.mimeType)}</span>
                </li>
              ))}
            </ul>
            <span className="text-[11px] opacity-70">
              Static demo — folder selections were expanded to files, but no transfer runs.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
