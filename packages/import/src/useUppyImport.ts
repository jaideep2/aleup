"use client";

// One Uppy instance per "add documents" surface — Uppy owns ALL upload networking,
// local and remote:
//
//   Local files   → XHRUpload straight to the host's DestinationPort.localUploadTarget()
//                   (browser request, typically session-cookie authed).
//   Remote files  → Uppy Companion streams the provider file server-side and
//                   multipart-POSTs it to DestinationPort.remoteUploadTarget() —
//                   typically a token-authenticated route, since Companion can't send
//                   the browser's session cookie. Bytes never touch the browser.
//
// Provider plugins are installed HEADLESS (no target): they exist to own the Companion
// OAuth popup, token storage, and request-client registration; the browsing UI is the
// host's (build it on useCloudDrivePicker).

import { useEffect, useMemo, useRef } from "react";
import Uppy from "@uppy/core";
import XHRUpload from "@uppy/xhr-upload";
import { nativeGoogleExportTarget, type DestinationPort, type MetaSupplier } from "@aleup/core";
import { providerClient, type CompanionClient } from "./client.js";
import type { CompanionItem, ImportCallbacks, ProviderRegistration } from "./types.js";

export interface UppyImportOptions extends ImportCallbacks {
  /** Where bytes go — the host's policy (signed-token route, S3 proxy, …). */
  destination: DestinationPort;
  /** The Companion server origin (e.g. https://companion.example.com). */
  companionUrl: string;
  /** Cloud providers to mount. Import registrations from "@aleup/import/<provider>". */
  providers?: ProviderRegistration[];
  /**
   * Extra multipart fields attached to every upload, re-read at upload time (e.g. tags).
   * The KEY SET must be stable across the instance's lifetime — keys are baked into
   * XHRUpload's allowedMetaFields once.
   */
  meta?: MetaSupplier;
  /**
   * Rename/retype a remote item before import. Default: native Google editor files map to
   * their Office export target (Doc→.docx, …), since Companion exports them on download.
   */
  transformRemoteItem?: (item: CompanionItem) => { name: string; type: string };
  /** Parallel transfer limit. Default 8. */
  concurrency?: number;
  /** Abandon a transferring-then-silent remote file after this long. Default 120s. */
  stallMs?: number;
}

function defaultTransform(item: CompanionItem): { name: string; type: string } {
  // Companion exports native Google editor files to their Office equivalent during
  // download — declare the exported name/mime so ingestion sees what actually lands.
  const native = nativeGoogleExportTarget(item.mimeType);
  return {
    name: native ? item.name.replace(/\.[^.]+$/, "") + native.ext : item.name,
    type: native ? native.mime : item.mimeType,
  };
}

export function useUppyImport(opts: UppyImportOptions) {
  // Keep callbacks/options fresh without rebuilding the Uppy instance.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const { companionUrl, concurrency = 8, stallMs = 120_000 } = opts;

  const uppy = useMemo(() => {
    const instance = new Uppy({
      autoProceed: false,
      allowMultipleUploadBatches: true,
      // The host's server enforces the real allow-list; keep client restrictions off so
      // the picker's own filtering is the single client-side gate.
      restrictions: {},
    });
    instance.use(XHRUpload, {
      // Every file carries a per-file endpoint override (see uploadLocalFiles /
      // importRemoteFiles); this instance-level one is only the required fallback — it
      // 404s loudly if a bug ever lets a file through without its override.
      endpoint: "/__aleup-missing-endpoint__",
      fieldName: "file",
      formData: true,
      limit: concurrency,
      // Forwarded as form fields: host meta keys (e.g. tags) + type (companion posts
      // carry no content-type on the file part; destination routes prefer this field)
      // + name. `name` matters for REMOTE imports: Companion builds its multipart file
      // part on the server and names it from metadata.name — without it forwarded,
      // every imported file lands as "uppy-file-<uuid>". (Local uploads set the
      // filename directly on the form part, so this is belt-and-suspenders for them.)
      allowedMetaFields: [
        ...new Set([...Object.keys(optsRef.current.meta?.() ?? {}), "type", "name"]),
      ],
    });
    // No `target` → headless: provider auth/list/request-client only, UI is the host's.
    // Loosely typed on purpose: registrations carry the plugin class as `unknown` so
    // vendor plugin types never leak into aleup's public API.
    const use = instance.use.bind(instance) as (plugin: unknown, opts?: unknown) => unknown;
    for (const reg of optsRef.current.providers ?? []) {
      use(reg.plugin, { id: reg.pluginId, companionUrl });
    }

    // Progress accounting — one batch at a time.
    let total = 0;
    let done = 0;
    let failed = 0;
    let failedNames: string[] = [];
    const report = () =>
      optsRef.current.onProgress?.({ phase: "uploading", total, done, failed });

    // Stall watchdog. A remote file that STARTED transferring but then goes silent for
    // stallMs (e.g. its source became unreadable mid-stream and companion-client is
    // grinding through its retry/backoff loop) is abandoned and counted as failed.
    //
    // Crucially, only files that have ALREADY produced real bytes are watched — a file
    // still queued behind the concurrency limit shows no progress yet, and must never be
    // killed for that. stallMs is generous (files can pause under provider throttling)
    // and stays well under companion-client's own 5-min socket-activity timeout, which
    // remains the backstop for never-started files.
    const lastActivity = new Map<string, { name: string; at: number }>();
    let watchdog: ReturnType<typeof setInterval> | null = null;
    const stopWatchdog = () => {
      if (watchdog) {
        clearInterval(watchdog);
        watchdog = null;
      }
    };
    const runWatchdog = () => {
      const now = Date.now();
      for (const [id, entry] of lastActivity) {
        if (now - entry.at <= stallMs) continue;
        lastActivity.delete(id);
        done++;
        failed++;
        failedNames.push(entry.name);
        report();
        // Aborts the in-flight transfer + retry loop (XHRUpload listens for removal).
        instance.removeFile(id);
      }
    };

    instance.on("upload", (_uploadId, files) => {
      total += files.length;
      // Runs for the whole batch; only acts on files that have started transferring (below).
      watchdog ??= setInterval(runWatchdog, 10_000);
      report();
    });
    instance.on("upload-progress", (file, progress) => {
      // A file joins the stall watch on its FIRST real bytes and refreshes on every chunk.
      // Zero-byte progress (emitted during retry cycles) is ignored so it neither revives
      // a dead source nor enrols a file that hasn't genuinely started.
      if (file && (progress?.bytesUploaded ?? 0) > 0) {
        lastActivity.set(file.id, { name: file.name ?? "file", at: Date.now() });
      }
    });
    instance.on("upload-success", (file, response) => {
      if (file) lastActivity.delete(file.id);
      done++;
      report();
      const body = response?.body as unknown;
      optsRef.current.onFileUploaded?.({ name: file?.name ?? "", response: body });
      optsRef.current.destination.onFileUploaded?.({
        id: file?.id,
        name: file?.name ?? "",
        response: body,
      });
    });
    instance.on("upload-error", (file, _err, response) => {
      if (file) lastActivity.delete(file.id);
      done++;
      failed++;
      if (file?.name) failedNames.push(file.name);
      report();
      if (response?.status === 415) {
        optsRef.current.onError?.("Some files were skipped because their type isn't allowed.");
      }
    });
    instance.on("complete", () => {
      const summary = { ok: done - failed, failed };
      // Name the casualties. Broken Drive shortcuts are the most common cause, so say so.
      if (failedNames.length) {
        const names = failedNames.slice(0, 3).join(", ");
        const more = failedNames.length > 3 ? ` and ${failedNames.length - 3} more` : "";
        optsRef.current.onError?.(
          `${failedNames.length} file(s) failed to import: ${names}${more}. ` +
            `These are usually Drive shortcuts pointing at something that can't be downloaded — ` +
            `try importing the original file or folder instead.`,
        );
      }
      total = 0;
      done = 0;
      failed = 0;
      failedNames = [];
      lastActivity.clear();
      stopWatchdog();
      void (async () => {
        await optsRef.current.onComplete?.(summary);
        optsRef.current.onProgress?.(null);
      })();
      instance.clear(); // fresh slate for the next batch
    });
    return instance;
    // One stable instance per surface; endpoints are resolved per upload via the
    // DestinationPort, never baked in — so late-bound destinations (host creates the
    // container after files were chosen) need no rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionUrl, concurrency, stallMs]);

  useEffect(
    () => () => {
      // If a batch is mid-flight when the host unmounts (e.g. the host navigates the
      // moment uploads start), destroying now would abort the XHRs — let the batch
      // finish first. Files are checked too because upload() registers the batch a
      // microtask after files are added, and unmount can race that.
      if (uppy.getFiles().length > 0 || Object.keys(uppy.getState().currentUploads).length > 0) {
        uppy.once("complete", () => uppy.destroy());
      } else {
        uppy.destroy();
      }
    },
    [uppy],
  );

  /** The headless plugin's Companion client (auth/list) for a registered provider. */
  function client(providerId: string): CompanionClient | null {
    const reg = (optsRef.current.providers ?? []).find((c) => c.id === providerId);
    if (!reg) return null;
    return providerClient(uppy, reg.pluginId);
  }

  /**
   * Add local File objects and start the upload (browser → host's local target).
   * Pass `start: false` to only queue them — combine with remote adds into one batch
   * via startUpload().
   */
  async function uploadLocalFiles(files: File[], o?: { start?: boolean }): Promise<void> {
    if (!files.length) return;
    const target = await optsRef.current.destination.localUploadTarget();
    for (const file of files) {
      try {
        const id = uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
          meta: { ...optsRef.current.meta?.() },
        } as never);
        // Per-file endpoint so late-bound destinations target the right container. Must
        // be applied via setFileState: Uppy core's addFile() drops unknown top-level keys
        // (incl. `xhrUpload`), so passing it to addFile silently loses it and XHRUpload
        // falls back to the instance endpoint. (Pinned by a contract test.)
        uppy.setFileState(id, {
          xhrUpload: {
            endpoint: target.endpoint,
            ...(target.headers ? { headers: target.headers } : {}),
          },
        } as never);
      } catch {
        /* duplicate in batch — skip */
      }
    }
    if (o?.start !== false) void uppy.upload();
  }

  /**
   * Add remote provider files and start the import. Companion streams each file
   * server-side into the host's remote target.
   */
  async function importRemoteFiles(
    providerId: string,
    items: CompanionItem[],
    o?: { start?: boolean },
  ): Promise<void> {
    if (!items.length) return;
    // Flip to an indeterminate "importing" state immediately — before the host's token
    // dance and Companion's first upload event — so progress UI appears the moment the
    // user confirms the selection, instead of sitting blank for the seconds/minutes until
    // bytes start flowing. The `upload` event overwrites this with real progress.
    optsRef.current.onProgress?.({
      phase: "importing",
      total: items.length,
      done: 0,
      failed: 0,
    });
    try {
      const provider = client(providerId);
      if (!provider) throw new Error(`Provider ${providerId} not initialized`);

      // The host's token dance happens here (signed upload token, per-batch).
      const target = await optsRef.current.destination.remoteUploadTarget();
      const transform = optsRef.current.transformRemoteItem ?? defaultTransform;

      let added = 0;
      for (const item of items) {
        const { name, type } = transform(item);
        try {
          const id = uppy.addFile({
            // Drive/Box/Dropbox are "stable-id" providers: Uppy dedups them by the file's
            // OWN `id` rather than a generated name+size hash (see getSafeFileId). The
            // picker builds descriptors by hand, so we MUST supply a unique id — otherwise
            // every file gets id `undefined`, collides as a duplicate, and only the first
            // one is ever added (the rest throw noDuplicates and are swallowed below).
            id: `${providerId}:${item.id}`,
            source: "AleupCloudPicker",
            name,
            type,
            isRemote: true,
            data: { size: item.size ?? null },
            meta: { ...optsRef.current.meta?.(), type },
            body: { fileId: item.id },
            remote: {
              companionUrl,
              url: provider.fileUrl(item.requestPath),
              body: { fileId: item.id },
              providerName: provider.name,
              provider: provider.provider,
              requestClientId: provider.provider,
            },
          } as never);
          // Per-file override: remote uploads land on the host's remote target (Companion
          // can't send the session cookie, hence typically token headers). Applied via
          // setFileState because addFile() drops the `xhrUpload` key — without this
          // Companion receives the fallback endpoint and rejects it.
          uppy.setFileState(id, {
            xhrUpload: {
              endpoint: target.endpoint,
              ...(target.headers ? { headers: target.headers } : {}),
            },
          } as never);
          added++;
        } catch {
          /* duplicate in batch — skip */
        }
      }
      // Nothing actually queued (whole batch was duplicates) — no upload/complete event
      // will fire to clear it, so drop the "importing" state we optimistically showed.
      if (added === 0) {
        optsRef.current.onProgress?.(null);
        return;
      }
      if (o?.start !== false) void uppy.upload();
    } catch (err) {
      // Setup failed (bad token, no provider) before any upload started — the "complete"
      // event won't fire to clear progress, so reset it here, then surface the error.
      optsRef.current.onProgress?.(null);
      throw err;
    }
  }

  /** Start uploading everything queued (for hosts batching local + remote adds). */
  function startUpload() {
    return uppy.upload();
  }

  return { uppy, providerClient: client, uploadLocalFiles, importRemoteFiles, startUpload };
}
