// aleup "document workbench" demo, MUI edition. The identical demo exists in
// examples/shadcn and examples/daisyui on the same aleup hooks — only the UI layer differs.
//
//  - Editor pane: <DocEditor> + a MUI ToggleButton toolbar (see toolbar.tsx)
//  - Preview pane: <DocumentViewer> format router with themed slots + a Tabs doc switcher
//  - Cloud picker: a MUI Dialog + List over useCloudDrivePicker + a mock CompanionClient
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
  Alert,
  AlertTitle,
  AppBar,
  Box,
  Breadcrumbs,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link as MuiLink,
  List,
  ListItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar as MuiToolbar,
  Typography,
  createTheme,
} from "@mui/material";
import {
  Cloud,
  Folder,
  HelpOutline,
  InsertDriveFileOutlined,
  NavigateNext,
  PictureAsPdf,
  WarningAmber,
} from "@mui/icons-material";

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
    <Stack alignItems="center" justifyContent="center" gap={1} sx={{ height: "100%", color: "text.secondary" }}>
      <CircularProgress size={24} />
      <Typography variant="caption">Loading preview…</Typography>
    </Stack>
  ),
  error: (
    <Stack alignItems="center" justifyContent="center" gap={1} sx={{ height: "100%", color: "error.main" }}>
      <WarningAmber />
      <Typography variant="body2" fontWeight={600}>
        Failed to load this preview
      </Typography>
    </Stack>
  ),
  fallback: (source: DocSource) => (
    <Stack alignItems="center" justifyContent="center" gap={1.5} sx={{ height: "100%", p: 4, textAlign: "center" }}>
      <HelpOutline sx={{ fontSize: 40, color: "text.disabled" }} />
      <Box>
        <Typography variant="body2" fontWeight={600}>
          No preview for {source.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          This file type isn't previewable — download it instead.
        </Typography>
      </Box>
      <Button variant="outlined" size="small" href={source.fileUrl} download={source.name}>
        Download
      </Button>
    </Stack>
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
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (files: CompanionItem[]) => void;
}) {
  // One client per session so mock auth persists across dialog open/close.
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Import from MockDrive
        <Typography variant="caption" component="p" color="text.secondary">
          A fake provider driven by useCloudDrivePicker — no Companion server, no network.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 320 }}>
        {picker.connected === null ? (
          <Stack alignItems="center" justifyContent="center" flex={1} gap={1} sx={{ color: "text.secondary" }}>
            <CircularProgress size={24} />
            <Typography variant="caption">Checking connection…</Typography>
          </Stack>
        ) : picker.connected === false ? (
          <Stack alignItems="center" justifyContent="center" flex={1} gap={1.5} textAlign="center">
            <Cloud sx={{ fontSize: 42, color: "text.disabled" }} />
            <Box>
              <Typography variant="body2" fontWeight={600}>
                Connect your MockDrive account
              </Typography>
              <Typography variant="caption" color="text.secondary">
                The mock OAuth handshake resolves after ~300 ms.
              </Typography>
            </Box>
            <Button
              variant="contained"
              disabled={picker.connecting}
              startIcon={picker.connecting ? <CircularProgress size={14} color="inherit" /> : undefined}
              onClick={() => void picker.startAuth()}
            >
              {picker.connecting ? "Connecting…" : "Connect to MockDrive"}
            </Button>
          </Stack>
        ) : (
          <>
            <Breadcrumbs separator={<NavigateNext fontSize="small" />} aria-label="Folders">
              {picker.path.map((entry, index) => {
                const last = index === picker.path.length - 1;
                return last ? (
                  <Typography key={`${entry.requestPath ?? "root"}-${index}`} variant="body2" fontWeight={600}>
                    {entry.name}
                  </Typography>
                ) : (
                  <MuiLink
                    key={`${entry.requestPath ?? "root"}-${index}`}
                    component="button"
                    type="button"
                    variant="body2"
                    underline="hover"
                    onClick={() => picker.navigateTo(index)}
                  >
                    {entry.name}
                  </MuiLink>
                );
              })}
            </Breadcrumbs>

            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, minHeight: 192, maxHeight: 300, overflowY: "auto" }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  py: 0.25,
                  bgcolor: "action.hover",
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <Checkbox
                  size="small"
                  checked={picker.allSelected}
                  disabled={picker.selectableItems.length === 0}
                  onChange={picker.toggleSelectAll}
                  inputProps={{ "aria-label": "Select all in this folder" }}
                />
                <Typography variant="caption" color="text.secondary">
                  Select all in this folder
                </Typography>
                {picker.listing ? <CircularProgress size={14} sx={{ ml: "auto", mr: 1 }} /> : null}
              </Box>

              {picker.items.length === 0 && !picker.listing ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 3, textAlign: "center" }}>
                  This folder is empty.
                </Typography>
              ) : null}

              <List dense disablePadding>
                {picker.items.map((item) => {
                  const selectable = item.isFolder || picker.isFileSelectable(item.mimeType);
                  return (
                    <ListItem key={item.id} divider disableGutters sx={{ gap: 1, pl: 1, pr: 1.5, py: 0.25 }}>
                      <Checkbox
                        size="small"
                        checked={picker.selected.has(item.id)}
                        disabled={!selectable}
                        onChange={() => picker.toggleSelect(item)}
                        inputProps={{ "aria-label": `Select ${item.name}` }}
                      />
                      {item.isFolder ? (
                        <Folder fontSize="small" color="warning" />
                      ) : (
                        <InsertDriveFileOutlined fontSize="small" color="disabled" />
                      )}
                      {item.isFolder ? (
                        <MuiLink
                          component="button"
                          type="button"
                          underline="hover"
                          color="inherit"
                          sx={{ flex: 1, minWidth: 0, textAlign: "left" }}
                          onClick={() => picker.navigateInto(item)}
                        >
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {item.name}
                          </Typography>
                        </MuiLink>
                      ) : (
                        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, opacity: selectable ? 1 : 0.5 }}>
                          {item.name}
                        </Typography>
                      )}
                      <Chip
                        size="small"
                        variant="outlined"
                        label={item.isFolder ? "Folder" : fileLabel(item.mimeType)}
                        sx={{ fontSize: 11 }}
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ width: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatSize(item.size)}
                      </Typography>
                    </ListItem>
                  );
                })}
              </List>

              {picker.nextPagePath ? (
                <Button fullWidth size="small" disabled={picker.listing} onClick={picker.loadMore}>
                  Load more
                </Button>
              ) : null}
            </Box>
          </>
        )}

        {picker.error ? (
          <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
            {picker.error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          {picker.connected ? selectionSummary(picker.fileCount, picker.folderCount) : ""}
        </Typography>
        <Stack direction="row" gap={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!picker.connected || picker.selectedCount === 0 || picker.expanding}
            startIcon={picker.expanding ? <CircularProgress size={14} color="inherit" /> : undefined}
            onClick={() => void handleImport()}
          >
            {picker.expanding ? "Expanding folders…" : "Import selection"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

/* ── App ─────────────────────────────────────────────────────────────────── */

const theme = createTheme({
  palette: {
    primary: { main: "#1e5aa8" },
    background: { default: "#eef1f5" },
  },
  shape: { borderRadius: 10 },
});

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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
        <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <MuiToolbar variant="dense" sx={{ gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              aleup workbench
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              MUI example
            </Typography>
            <Button variant="outlined" size="small" startIcon={<Cloud />} onClick={() => setPickerOpen(true)}>
              Import from cloud
            </Button>
            <Button
              variant="contained"
              size="small"
              disabled={exporting}
              startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdf />}
              onClick={() => void exportPdf()}
            >
              Export PDF
            </Button>
          </MuiToolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gap: 2,
            p: 2,
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          }}
        >
          <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <Box sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary">
                Editor — master-services-agreement.md
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <DocEditor
                content={EDITOR_DOC}
                contentType="markdown"
                toolbar={(editor) => <EditorToolbar editor={editor} />}
              />
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <Tabs
              value={doc.id}
              variant="scrollable"
              sx={{ minHeight: 40, borderBottom: 1, borderColor: "divider" }}
              onChange={(_event, value) => setDocId(value as string)}
            >
              {PREVIEW_DOCS.map((d) => (
                <Tab key={d.id} value={d.id} label={d.label} sx={{ minHeight: 40, py: 0 }} />
              ))}
            </Tabs>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <DocumentViewer
                key={doc.id}
                format={doc.format}
                name={doc.name}
                fileUrl={doc.fileUrl}
                textContent={doc.textContent}
                renderers={{ md: MarkdownView }}
                slots={viewerSlots}
              />
            </Box>
          </Paper>
        </Box>

        <CloudPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} onImported={setImported} />

        <Snackbar open={imported !== null} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
          <Alert severity="success" onClose={() => setImported(null)} sx={{ width: 380, alignItems: "flex-start" }}>
            <AlertTitle>
              Imported {imported?.length ?? 0} file{(imported?.length ?? 0) === 1 ? "" : "s"}
            </AlertTitle>
            <Box component="ul" sx={{ m: 0, maxHeight: 176, overflowY: "auto", pl: 2 }}>
              {(imported ?? []).map((f) => (
                <Typography key={f.id} component="li" variant="caption" sx={{ display: "list-item" }}>
                  {f.name} — {fileLabel(f.mimeType)}
                </Typography>
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Static demo — folder selections were expanded to files, but no transfer runs.
            </Typography>
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
