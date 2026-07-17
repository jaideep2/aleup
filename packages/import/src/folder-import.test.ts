// @vitest-environment jsdom
//
// Folder-import path preservation: expandSelection must tag every folder-expanded file
// with its containing-folder path (relativePath), and the upload entry points must carry
// it as per-file Uppy meta so hosts can recreate the tree server-side.
import { expect, test } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import GoogleDrive from "@uppy/google-drive";
import { useCloudDrivePicker } from "./useCloudDrivePicker.js";
import { useUppyImport } from "./useUppyImport.js";
import type { CompanionClient } from "./client.js";
import type { CompanionItem } from "./types.js";

const folder = (id: string, name: string): CompanionItem => ({
  id,
  name,
  mimeType: "application/vnd.google-apps.folder",
  isFolder: true,
  requestPath: `path-${id}`,
});
const file = (id: string, name: string): CompanionItem => ({
  id,
  name,
  mimeType: "application/pdf",
  isFolder: false,
  requestPath: `path-${id}`,
});

/** Fake Companion client serving a small nested tree. */
function fakeProvider(listings: Record<string, CompanionItem[]>): CompanionClient {
  return {
    list: async <T,>(path: string | null) =>
      ({ items: listings[path ?? "root"] ?? [], nextPagePath: null }) as T,
    fileUrl: (requestPath) => `http://companion/get/${requestPath}`,
    login: async () => undefined,
    logout: async () => undefined,
    name: "Drive",
    provider: "drive",
  };
}

test("expandSelection tags folder-expanded files with relativePath; direct picks carry none", async () => {
  // root: [Evidence/, root.pdf]   Evidence: [2023/, a.pdf]   2023: [b.pdf]
  const provider = fakeProvider({
    root: [folder("ev", "Evidence"), file("root", "root.pdf")],
    "path-ev": [folder("y", "2023"), file("a", "a.pdf")],
    "path-y": [file("b", "b.pdf")],
  });

  const { result } = renderHook(() =>
    useCloudDrivePicker({
      open: true,
      provider,
      rootLabel: "Drive",
      isFileSelectable: () => true,
    }),
  );
  await waitFor(() => expect(result.current.items.length).toBe(2));

  act(() => {
    result.current.toggleSelect(folder("ev", "Evidence"));
    result.current.toggleSelect(file("root", "root.pdf"));
  });

  let files: CompanionItem[] | null = null;
  await act(async () => {
    files = await result.current.confirmSelection();
  });

  const byId = new Map(files!.map((f) => [f.id, f]));
  expect(byId.size).toBe(3);
  expect(byId.get("root")!.relativePath).toBeUndefined(); // picked directly → root
  expect(byId.get("a")!.relativePath).toBe("Evidence");
  expect(byId.get("b")!.relativePath).toBe("Evidence/2023");
});

test("a file picked directly AND via its folder dedups to the folder-expanded entry", async () => {
  const provider = fakeProvider({
    root: [folder("ev", "Evidence"), file("a", "a.pdf")],
    "path-ev": [file("a", "a.pdf")],
  });

  const { result } = renderHook(() =>
    useCloudDrivePicker({
      open: true,
      provider,
      rootLabel: "Drive",
      isFileSelectable: () => true,
    }),
  );
  await waitFor(() => expect(result.current.items.length).toBe(2));

  act(() => {
    result.current.toggleSelect(file("a", "a.pdf")); // direct pick first
    result.current.toggleSelect(folder("ev", "Evidence"));
  });

  let files: CompanionItem[] | null = null;
  await act(async () => {
    files = await result.current.confirmSelection();
  });

  expect(files!.length).toBe(1); // no duplicate import
  expect(files![0]!.relativePath).toBe("Evidence"); // tree mirror wins
});

function importHook() {
  return renderHook(() =>
    useUppyImport({
      companionUrl: "http://localhost:3020",
      destination: {
        localUploadTarget: () => ({ endpoint: "/local" }),
        remoteUploadTarget: async () => ({ endpoint: "/remote" }),
      },
      providers: [{ id: "drive", pluginId: "GoogleDrive", label: "Drive", plugin: GoogleDrive }],
      meta: () => ({ tags: "[]" }),
    }),
  );
}

test("importRemoteFiles carries relativePath as per-file meta (host meta preserved)", async () => {
  const { result, unmount } = importHook();

  await act(async () => {
    await result.current.importRemoteFiles(
      "drive",
      [
        { ...file("1", "nested.pdf"), relativePath: "Evidence/2023" },
        file("2", "adhoc.pdf"),
      ],
      { start: false },
    );
  });

  const metas = new Map(result.current.uppy.getFiles().map((f) => [f.name, f.meta]));
  expect(metas.get("nested.pdf")?.relativePath).toBe("Evidence/2023");
  expect(metas.get("nested.pdf")?.tags).toBe("[]");
  expect(metas.get("adhoc.pdf")?.relativePath).toBeUndefined();
  unmount();
});

test("uploadLocalFiles accepts per-file meta entries alongside plain Files", async () => {
  const { result, unmount } = importHook();

  await act(async () => {
    await result.current.uploadLocalFiles(
      [
        {
          file: new File(["x"], "in-folder.pdf", { type: "application/pdf" }),
          meta: { relativePath: "Case/Sub" },
        },
        new File(["y"], "plain.pdf", { type: "application/pdf" }),
      ],
      { start: false },
    );
  });

  const metas = new Map(result.current.uppy.getFiles().map((f) => [f.name, f.meta]));
  expect(metas.get("in-folder.pdf")?.relativePath).toBe("Case/Sub");
  expect(metas.get("in-folder.pdf")?.tags).toBe("[]");
  expect(metas.get("plain.pdf")?.relativePath).toBeUndefined();
  unmount();
});
