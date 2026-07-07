// Mock CompanionClient for the static demo: a fake cloud drive with nested folders,
// realistic mimeTypes, one paginated folder, and a ~300 ms "OAuth" handshake. It
// implements the CompanionClient seam from @aleup/import (packages/import/src/client.ts),
// so useCloudDrivePicker drives it exactly like a real Companion provider — connection
// probing, login, navigation, pagination, and folder expansion all behave for real.

import type { CompanionClient, CompanionItem } from "@aleup/import";

interface ListResponse {
  username?: string;
  nextPagePath?: string | null;
  items: CompanionItem[];
}

const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  gdoc: "application/vnd.google-apps.document",
  folder: "application/vnd.google-apps.folder",
  mp4: "video/mp4",
} as const;

let seq = 0;

function folder(name: string, requestPath: string): CompanionItem {
  return { id: `mock-${++seq}`, name, mimeType: MIME.folder, isFolder: true, requestPath };
}

function file(name: string, mimeType: string, size: number, modifiedDate: string): CompanionItem {
  return {
    id: `mock-${++seq}`,
    name,
    mimeType,
    isFolder: false,
    requestPath: `file:${name}`,
    size,
    modifiedDate,
  };
}

const ROOT = "root";

/** Fake drive contents, keyed by Companion requestPath (ROOT for the provider root). */
const PAGES: Record<string, ListResponse> = {
  [ROOT]: {
    username: "demo@mockdrive.example",
    nextPagePath: null,
    items: [
      folder("Contracts", "folder:contracts"),
      folder("Discovery", "folder:discovery"),
      folder("Templates", "folder:templates"),
      file("Retainer Agreement — Acme.pdf", MIME.pdf, 184_320, "2026-06-12T10:24:00Z"),
      file("Client Intake Notes.md", MIME.md, 4_812, "2026-06-30T16:02:00Z"),
      file("Billing Summary FY26.xlsx", MIME.xlsx, 88_064, "2026-07-01T09:15:00Z"),
      // Not importable — demonstrates the picker's selectability gate (isIndexable).
      file("hearing-recording.mp4", MIME.mp4, 512_000_000, "2026-05-19T13:40:00Z"),
    ],
  },
  "folder:contracts": {
    // Paginated folder: the picker's "Load more" and folder expansion both walk this.
    nextPagePath: "folder:contracts?page=2",
    items: [
      folder("Executed", "folder:contracts/executed"),
      file("MSA — Acme Holdings.docx", MIME.docx, 148_480, "2026-06-02T11:12:00Z"),
      file("NDA — Meridian Partners.pdf", MIME.pdf, 92_160, "2026-05-28T08:44:00Z"),
      file("SOW 2026-Q3 (draft).docx", MIME.docx, 66_560, "2026-07-03T15:31:00Z"),
      file("Vendor Agreement — Beacon.pdf", MIME.pdf, 210_944, "2026-04-17T09:05:00Z"),
      file("Indemnity Rider.docx", MIME.docx, 31_744, "2026-06-21T17:56:00Z"),
      file("Term Sheet.md", MIME.md, 6_120, "2026-06-25T10:40:00Z"),
    ],
  },
  "folder:contracts?page=2": {
    nextPagePath: null,
    items: [
      file("Amendment No. 2.pdf", MIME.pdf, 54_272, "2026-06-29T14:22:00Z"),
      file("Assignment Consent.docx", MIME.docx, 27_648, "2026-06-14T12:09:00Z"),
      file("Guaranty — Acme Subsidiaries.pdf", MIME.pdf, 118_784, "2026-05-06T16:47:00Z"),
    ],
  },
  "folder:contracts/executed": {
    nextPagePath: null,
    items: [
      file("MSA — Acme Holdings (signed).pdf", MIME.pdf, 201_216, "2026-06-05T09:58:00Z"),
      file("NDA — Meridian Partners (signed).pdf", MIME.pdf, 97_280, "2026-05-30T13:03:00Z"),
    ],
  },
  "folder:discovery": {
    nextPagePath: null,
    items: [
      file("Deposition Transcript — J. Whitfield.txt", MIME.txt, 402_432, "2026-06-24T18:20:00Z"),
      file("Exhibit A — Site Photo.png", MIME.png, 1_843_200, "2026-06-10T07:41:00Z"),
      file("Interrogatories — Set One.pdf", MIME.pdf, 133_120, "2026-06-08T11:33:00Z"),
      file("privilege-log.csv", MIME.csv, 18_944, "2026-06-27T15:14:00Z"),
    ],
  },
  "folder:templates": {
    nextPagePath: null,
    items: [
      file("Engagement Letter", MIME.gdoc, 0, "2026-03-11T10:00:00Z"),
      file("Motion Caption Template.docx", MIME.docx, 22_528, "2026-02-19T09:26:00Z"),
      file("Settlement Checklist.md", MIME.md, 3_584, "2026-04-02T14:55:00Z"),
    ],
  },
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Create a mock provider client. Auth state lives in the closure, so it persists across
 * dialog open/close (like Companion's server-side token store) within the page session.
 */
export function createMockClient(): CompanionClient {
  let authed = false;
  return {
    name: "MockDrive",
    provider: "mock",

    async list<T>(path: string | null, _options: Record<string, never>): Promise<T> {
      await delay(authed ? 350 : 200);
      if (!authed) {
        // The picker's connection probe expects an auth-shaped failure pre-login.
        throw Object.assign(new Error("Not authenticated with MockDrive"), {
          statusCode: 401,
          isAuthError: true,
        });
      }
      const page = PAGES[path ?? ROOT];
      if (!page) {
        throw Object.assign(new Error(`Unknown path: ${String(path)}`), { statusCode: 404 });
      }
      return { ...page, items: [...page.items] } as unknown as T;
    },

    fileUrl: () => "#",

    async login(_options: { signal?: AbortSignal } = {}) {
      await delay(300); // stand-in for Companion's OAuth popup + postMessage handshake
      authed = true;
      return { ok: true };
    },

    async logout() {
      authed = false;
      return { ok: true };
    },
  };
}
