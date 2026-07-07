import { describe, expect, test } from "vitest";
import {
  acceptExtensionsFor,
  DEFAULT_ACCEPT_EXTENSIONS,
  detectFormat,
  filterFilesByAccept,
  isIndexable,
  isMimeAllowed,
  isPickable,
  nativeGoogleExportTarget,
} from "./index.js";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("mime registry", () => {
  test("native Google Doc maps to DOCX export target", () => {
    expect(nativeGoogleExportTarget("application/vnd.google-apps.document")).toEqual({
      mime: DOCX,
      ext: ".docx",
    });
    expect(nativeGoogleExportTarget("application/vnd.google-apps.form")).toBeNull();
  });

  test("isMimeAllowed follows export target for native Google files", () => {
    expect(isMimeAllowed("application/vnd.google-apps.document", [DOCX])).toBe(true);
    expect(isMimeAllowed("application/vnd.google-apps.document", ["application/pdf"])).toBe(false);
    expect(isMimeAllowed("application/pdf", ["application/pdf"])).toBe(true);
  });

  test("folders are pickable but not indexable", () => {
    expect(isIndexable("application/vnd.google-apps.folder")).toBe(false);
    expect(isPickable("application/vnd.google-apps.folder")).toBe(true);
  });

  test("acceptExtensionsFor collapses duplicates and honors the allow-list", () => {
    expect(acceptExtensionsFor(["application/pdf", DOCX])).toBe(".pdf,.docx");
    expect(DEFAULT_ACCEPT_EXTENSIONS).toContain(".jpg");
  });
});

describe("detectFormat", () => {
  test.each([
    ["application/pdf", "a", "pdf"],
    ["", "report.PDF", "pdf"],
    [DOCX, "x", "docx"],
    ["", "notes.md", "md"],
    ["text/plain", "readme", "text"],
    ["application/vnd.google-apps.document", "doc", "google-native"],
    ["image/png", "pic", "image"],
    ["application/zip", "a.zip", "other"],
  ] as const)("(%s, %s) → %s", (mime, name, expected) => {
    expect(detectFormat(mime, name)).toBe(expected);
  });
});

describe("filterFilesByAccept", () => {
  const files = [{ name: "a.pdf" }, { name: "b.exe" }, { name: "C.DOCX" }];
  test("keeps only allowed extensions, case-insensitively", () => {
    expect(filterFilesByAccept(files, ".pdf,.docx").map((f) => f.name)).toEqual([
      "a.pdf",
      "C.DOCX",
    ]);
  });
  test("empty accept keeps everything", () => {
    expect(filterFilesByAccept(files, "")).toHaveLength(3);
  });
});
