// @vitest-environment jsdom
//
// CONTRACT TESTS against the installed @uppy/* versions. These pin the Uppy INTERNALS
// aleup deliberately relies on (none are semver-protected). If an `npm update` of Uppy
// breaks one of these, the breakage surfaces HERE, in one file, instead of silently in
// production imports.
import { expect, test } from "vitest";
import Uppy from "@uppy/core";
import XHRUpload from "@uppy/xhr-upload";
import GoogleDrive from "@uppy/google-drive";
import { providerClient } from "./client.js";

function makeUppy() {
  const uppy = new Uppy({ autoProceed: false, restrictions: {} });
  uppy.use(XHRUpload, { endpoint: "/fallback", fieldName: "file", formData: true });
  uppy.use(GoogleDrive, { id: "GoogleDrive", companionUrl: "http://localhost:3020" });
  return uppy;
}

test("contract 1: getPlugin(id).provider exposes the Companion client we adapt", () => {
  const uppy = makeUppy();
  const client = providerClient(uppy, "GoogleDrive");
  expect(client, "plugin.provider disappeared — Uppy internal changed").not.toBeNull();
  expect(typeof client!.list).toBe("function");
  expect(typeof client!.fileUrl).toBe("function");
  expect(typeof client!.login).toBe("function");
  expect(typeof client!.name).toBe("string");
  expect(typeof client!.provider).toBe("string");
  uppy.destroy();
});

test("contract 2: setFileState(id,{xhrUpload}) survives; addFile() drops top-level xhrUpload", () => {
  const uppy = makeUppy();
  const id = uppy.addFile({
    name: "a.txt",
    type: "text/plain",
    data: new Blob(["x"]),
    // Passed at addFile time — Uppy core drops unknown top-level keys, which is exactly
    // why aleup applies the override via setFileState instead. If addFile STOPS dropping
    // it one day, this assertion flags that the workaround can be simplified.
    xhrUpload: { endpoint: "/should-be-dropped" },
  } as never);
  const afterAdd = uppy.getFile(id) as { xhrUpload?: { endpoint?: string } };
  expect(afterAdd.xhrUpload?.endpoint).toBeUndefined();

  uppy.setFileState(id, {
    xhrUpload: { endpoint: "/per-file", headers: { "x-t": "1" } },
  } as never);
  const afterSet = uppy.getFile(id) as {
    xhrUpload?: { endpoint?: string; headers?: Record<string, string> };
  };
  expect(afterSet.xhrUpload?.endpoint).toBe("/per-file");
  expect(afterSet.xhrUpload?.headers?.["x-t"]).toBe("1");
  uppy.destroy();
});

test("contract 4: destroy() removes provider plugins — getPlugin/providerClient go null", () => {
  // This is the mechanism behind the "Plugin was nullish" crash: once an instance is
  // destroyed, its provider plugins are gone and companion-client's Provider.#getPlugin
  // (reached on every list()/login() and in the OAuth popup's message handler) throws.
  // useUppyImport must therefore NEVER hand back a destroyed instance — its teardown is
  // deferred so a React StrictMode re-mount can cancel it. If a future Uppy version stopped
  // clearing plugins on destroy this assertion would flip, and the deferral could be relaxed.
  const uppy = makeUppy();
  expect(providerClient(uppy, "GoogleDrive")).not.toBeNull();
  uppy.destroy();
  expect(uppy.getPlugin("GoogleDrive")).toBeFalsy();
  expect(providerClient(uppy, "GoogleDrive")).toBeNull();
});

test("contract 3: explicit stable ids dedup remote adds; distinct ids both land", () => {
  const uppy = makeUppy();
  const desc = (fileId: string) => ({
    id: `drive:${fileId}`,
    name: `${fileId}.pdf`,
    type: "application/pdf",
    isRemote: true,
    data: { size: 10 },
    remote: {
      companionUrl: "http://localhost:3020",
      url: "http://localhost:3020/drive/get/x",
      body: { fileId },
      providerName: "drive",
      provider: "drive",
      requestClientId: "drive",
    },
  });

  uppy.addFile(desc("A") as never);
  expect(() => uppy.addFile(desc("A") as never)).toThrow(); // same provider id → duplicate
  uppy.addFile(desc("B") as never);
  expect(uppy.getFiles().length).toBe(2);
  uppy.destroy();
});
