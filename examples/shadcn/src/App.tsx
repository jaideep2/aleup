// aleup "document workbench" demo, shadcn/ui edition. The identical demo exists in
// examples/mui and examples/daisyui on the same aleup hooks — only the UI layer differs.
//
//  - Editor pane: <DocEditor> + a shadcn toolbar (see toolbar.tsx)
//  - Preview pane: <DocumentViewer> format router with themed slots + a doc switcher
//  - Cloud picker: a shadcn Dialog over useCloudDrivePicker + a mock CompanionClient
//  - Export PDF: downloadElementAsPdf over the editor's .doc-page element

import { useMemo, useState } from "react";
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
import {
  ChevronRight,
  Cloud,
  FileDown,
  FileQuestion,
  FileText,
  Folder,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";

import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { cn } from "./lib/utils";
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

/* ── Themed DocumentViewer slots ─────────────────────────────────────────── */

const viewerSlots = {
  loading: (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <p className="text-xs">Loading preview…</p>
    </div>
  ),
  error: (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-destructive">
      <TriangleAlert className="size-6" />
      <p className="text-sm font-medium">Failed to load this preview</p>
    </div>
  ),
  fallback: (source: DocSource) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <FileQuestion className="size-10 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">No preview for {source.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This file type isn't previewable — download it instead.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <a href={source.fileUrl} download={source.name}>
          Download
        </a>
      </Button>
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

/* ── Cloud picker dialog (useCloudDrivePicker over the mock client) ─────── */

function CloudPickerDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (files: CompanionItem[]) => void;
}) {
  // One client per session so mock auth persists across dialog open/close.
  const provider = useMemo(() => createMockClient(), []);
  const picker = useCloudDrivePicker({ open, provider, rootLabel: "MockDrive" });

  async function handleImport() {
    const files = await picker.confirmSelection();
    if (files) {
      onImported(files);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import from MockDrive</DialogTitle>
          <DialogDescription>
            A fake provider driven by useCloudDrivePicker — no Companion server, no network.
          </DialogDescription>
        </DialogHeader>

        {picker.connected === null ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-xs">Checking connection…</p>
          </div>
        ) : picker.connected === false ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Cloud className="size-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Connect your MockDrive account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The mock OAuth handshake resolves after ~300 ms.
              </p>
            </div>
            <Button onClick={() => void picker.startAuth()} disabled={picker.connecting}>
              {picker.connecting ? <Loader2 className="animate-spin" /> : null}
              {picker.connecting ? "Connecting…" : "Connect to MockDrive"}
            </Button>
          </div>
        ) : (
          <>
            <nav aria-label="Folders" className="flex flex-wrap items-center gap-0.5 text-xs">
              {picker.path.map((entry, index) => {
                const last = index === picker.path.length - 1;
                return (
                  <span key={`${entry.requestPath ?? "root"}-${index}`} className="flex items-center gap-0.5">
                    {index > 0 ? <ChevronRight className="size-3 text-muted-foreground" /> : null}
                    <button
                      type="button"
                      className={cn(
                        "rounded px-1.5 py-0.5",
                        last
                          ? "font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      disabled={last}
                      onClick={() => picker.navigateTo(index)}
                    >
                      {entry.name}
                    </button>
                  </span>
                );
              })}
            </nav>

            <div className="max-h-72 min-h-48 overflow-y-auto rounded-lg border">
              <label className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={picker.allSelected}
                  disabled={picker.selectableItems.length === 0}
                  onChange={picker.toggleSelectAll}
                  aria-label="Select all in this folder"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  Select all in this folder
                </span>
                {picker.listing ? (
                  <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </label>

              {picker.items.length === 0 && !picker.listing ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                  This folder is empty.
                </p>
              ) : null}

              {picker.items.map((item) => {
                const selectable = item.isFolder || picker.isFileSelectable(item.mimeType);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary disabled:opacity-40"
                      checked={picker.selected.has(item.id)}
                      disabled={!selectable}
                      onChange={() => picker.toggleSelect(item)}
                      aria-label={`Select ${item.name}`}
                    />
                    {item.isFolder ? (
                      <Folder className="size-4 shrink-0 text-amber-500" />
                    ) : (
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    {item.isFolder ? (
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                        onClick={() => picker.navigateInto(item)}
                      >
                        {item.name}
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          !selectable && "text-muted-foreground/60",
                        )}
                      >
                        {item.name}
                      </span>
                    )}
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {item.isFolder ? "Folder" : fileLabel(item.mimeType)}
                    </span>
                    <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {formatSize(item.size)}
                    </span>
                  </div>
                );
              })}

              {picker.nextPagePath ? (
                <div className="border-t p-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    disabled={picker.listing}
                    onClick={picker.loadMore}
                  >
                    {picker.listing ? <Loader2 className="animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}

        {picker.error ? (
          <p className="text-xs font-medium text-destructive">{picker.error}</p>
        ) : null}

        {picker.connected ? (
          <DialogFooter className="items-center gap-2 border-t pt-3 sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {selectionSummary(picker.fileCount, picker.folderCount)}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={picker.selectedCount === 0 || picker.expanding}
                onClick={() => void handleImport()}
              >
                {picker.expanding ? <Loader2 className="animate-spin" /> : null}
                {picker.expanding ? "Expanding folders…" : "Import selection"}
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ── App ─────────────────────────────────────────────────────────────────── */

export function App() {
  const [docId, setDocId] = useState(PREVIEW_DOCS[0]!.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imported, setImported] = useState<CompanionItem[] | null>(null);
  const [exporting, setExporting] = useState(false);

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
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-tight">aleup workbench</h1>
          <span className="text-xs text-muted-foreground">shadcn/ui example</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Cloud />
            Import from cloud
          </Button>
          <Button size="sm" disabled={exporting} onClick={() => void exportPdf()}>
            {exporting ? <Loader2 className="animate-spin" /> : <FileDown />}
            Export PDF
          </Button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex h-10 shrink-0 items-center border-b px-3">
            <span className="text-xs font-medium text-muted-foreground">
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

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
            <span className="mr-1 pl-1 text-xs font-medium text-muted-foreground">Preview</span>
            {PREVIEW_DOCS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  d.id === doc.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setDocId(d.id)}
              >
                {d.label}
              </button>
            ))}
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

      <CloudPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onImported={setImported} />

      {imported ? (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border bg-card p-4 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">
              Imported {imported.length} file{imported.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Dismiss"
              onClick={() => setImported(null)}
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
            {imported.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-muted-foreground">{fileLabel(f.mimeType)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Static demo — folder selections were expanded to files, but no transfer runs.
          </p>
        </div>
      ) : null}
    </div>
  );
}
