"use client";

// One or two Uppy instances per "add documents" surface. Uppy owns ALL upload networking:
//
//   Remote files  → XHRUpload; Uppy Companion streams the provider file server-side and
//                   multipart-POSTs it to DestinationPort.remoteUploadTarget() (token authed —
//                   Companion can't send the browser's session cookie). Bytes never touch the browser.
//   Local files   → depends on DestinationPort.localMode:
//                     "xhr" (default)   → XHRUpload straight to localUploadTarget() (today's path).
//                     "s3-multipart"    → @uppy/aws-s3 uploads RESUMABLY straight to object storage
//                                         via DestinationPort.s3 (PLAN_UPLOAD Phase 2), then the host
//                                         finalizes in s3.onObjectUploaded.
//
// Uppy allows only ONE uploader plugin per instance, so S3 local uploads run on a SECOND instance
// (`localUppy`); the remote/provider instance (`remoteUppy`) is unchanged. In "xhr" mode there is no
// second instance — local files ride remoteUppy exactly as before, so that path is untouched.
//
// Provider plugins are installed HEADLESS on remoteUppy (no target): they own the Companion OAuth
// popup, token storage, and request-client registration; the browsing UI is the host's.

import { useEffect, useMemo, useRef } from "react";
import Uppy from "@uppy/core";
import XHRUpload from "@uppy/xhr-upload";
import AwsS3 from "@uppy/aws-s3";
import GoldenRetriever from "@uppy/golden-retriever";
import {
  nativeGoogleExportTarget,
  type DestinationPort,
  type MetaSupplier,
  type S3MultipartApi,
  type UppyFileLike,
} from "@aleup/core";
import { providerClient, type CompanionClient } from "./client.js";
import type { CompanionItem, ImportCallbacks, ProviderRegistration } from "./types.js";

export interface UppyImportOptions extends ImportCallbacks {
  /** Where bytes go — the host's policy (signed-token route, S3 multipart, …). */
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

type OptsRef = React.RefObject<UppyImportOptions>;

/**
 * Wire one Uppy instance's progress accounting + (optionally) the stall watchdog, reporting through
 * the host callbacks. Each call keeps its OWN counters, so two instances don't share state. A
 * `finalize` hook (S3 local mode) runs after a file's bytes land and its return becomes the
 * onFileUploaded response; a throw there marks the file failed.
 */
function attachProgress(
  instance: Uppy,
  optsRef: OptsRef,
  cfg: { watchdog: boolean; stallMs: number; finalize?: (file: UppyFileLike, response: unknown) => Promise<unknown> },
): void {
  let total = 0;
  let done = 0;
  let failed = 0;
  let failedNames: string[] = [];
  const report = () => optsRef.current.onProgress?.({ phase: "uploading", total, done, failed });

  // Stall watchdog (remote imports only): a file that STARTED transferring but then goes silent for
  // stallMs is abandoned + counted failed. Only files that produced real bytes are watched.
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
      if (now - entry.at <= cfg.stallMs) continue;
      lastActivity.delete(id);
      done++;
      failed++;
      failedNames.push(entry.name);
      report();
      instance.removeFile(id); // aborts the in-flight transfer + retry loop
    }
  };

  instance.on("upload", (_uploadId, files) => {
    total += files.length;
    if (cfg.watchdog) watchdog ??= setInterval(runWatchdog, 10_000);
    report();
  });
  instance.on("upload-progress", (file, progress) => {
    if (cfg.watchdog && file && (progress?.bytesUploaded ?? 0) > 0) {
      lastActivity.set(file.id, { name: file.name ?? "file", at: Date.now() });
    }
  });
  instance.on("upload-success", (file, response) => {
    if (file) lastActivity.delete(file.id);
    done++;
    report();
    const rawBody = (response as { body?: unknown })?.body;
    const emit = (body: unknown) => {
      optsRef.current.onFileUploaded?.({ name: file?.name ?? "", response: body });
      optsRef.current.destination.onFileUploaded?.({ id: file?.id, name: file?.name ?? "", response: body });
    };
    if (!cfg.finalize || !file) {
      emit(rawBody);
      return;
    }
    // S3 local mode: run the host's finalize seam, then emit its result. A finalize failure counts
    // the file as failed and skips onFileUploaded (no Document was created).
    void cfg
      .finalize(file as unknown as UppyFileLike, response)
      .then((body) => emit(body))
      .catch((err) => {
        failed++;
        if (file.name) failedNames.push(file.name);
        report();
        optsRef.current.onError?.(err instanceof Error ? err.message : "Finalizing an upload failed.");
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
}

/**
 * @uppy/aws-s3 plugin options wired to the host's S3MultipartApi. `s3Meta` records each file's
 * {key, uploadId} so the finalize seam (in attachProgress) can reference them at upload-success.
 */
function s3PluginOptions(
  s3: () => S3MultipartApi,
  s3Meta: Map<string, { key: string; uploadId?: string }>,
) {
  const asFile = (f: unknown) => f as unknown as UppyFileLike;
  return {
    // Presigned single PUT for small files. We stash the key (Uppy ignores extra return fields).
    getUploadParameters: async (file: unknown) => {
      const r = await s3().getUploadParameters(asFile(file));
      if (r.key) s3Meta.set((file as { id: string }).id, { key: r.key });
      return { method: r.method, url: r.url, fields: r.fields ?? {}, headers: r.headers };
    },
    createMultipartUpload: async (file: unknown) => {
      const r = await s3().createMultipartUpload(asFile(file));
      s3Meta.set((file as { id: string }).id, { key: r.key, uploadId: r.uploadId });
      return { uploadId: r.uploadId, key: r.key };
    },
    signPart: (file: unknown, o: { uploadId: string; key: string; partNumber: number; signal?: AbortSignal }) =>
      s3().signPart(asFile(file), o),
    listParts: (file: unknown, o: { uploadId: string; key: string; signal?: AbortSignal }) =>
      s3().listParts(asFile(file), o),
    completeMultipartUpload: (
      file: unknown,
      o: { uploadId: string; key: string; parts: { PartNumber: number; ETag: string }[]; signal?: AbortSignal },
    ) => s3().completeMultipartUpload(asFile(file), o),
    abortMultipartUpload: (file: unknown, o: { uploadId: string; key: string; signal?: AbortSignal }) =>
      s3().abortMultipartUpload(asFile(file), o),
    ...(() => {
      const su = s3().shouldUseMultipart;
      return su ? { shouldUseMultipart: (file: unknown) => su(asFile(file)) } : {};
    })(),
  };
}

export function useUppyImport(opts: UppyImportOptions) {
  // Keep callbacks/options fresh without rebuilding the Uppy instance.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const { companionUrl, concurrency = 8, stallMs = 120_000 } = opts;
  const s3Mode = opts.destination.localMode === "s3-multipart";

  // Track teardown scheduled by an unmount, so a StrictMode re-mount of the SAME instances can cancel
  // it (see the destroy effect). Holds both instances.
  const pendingDestroy = useRef<{ instances: Uppy[]; timer: ReturnType<typeof setTimeout> } | null>(null);

  const { remoteUppy, localUppy } = useMemo(() => {
    // ── Remote/provider instance (XHRUpload + Companion). Also serves local files in "xhr" mode. ──
    const remote = new Uppy({
      autoProceed: false,
      allowMultipleUploadBatches: true,
      restrictions: {},
    });
    remote.use(XHRUpload, {
      endpoint: "/__aleup-missing-endpoint__", // per-file override set at upload time; loud 404 otherwise
      fieldName: "file",
      formData: true,
      limit: concurrency,
      allowedMetaFields: [...new Set([...Object.keys(optsRef.current.meta?.() ?? {}), "type", "name"])],
    });
    const use = remote.use.bind(remote) as (plugin: unknown, opts?: unknown) => unknown;
    for (const reg of optsRef.current.providers ?? []) {
      use(reg.plugin, { id: reg.pluginId, companionUrl });
    }
    attachProgress(remote, optsRef, { watchdog: true, stallMs });

    // ── Local S3 instance (only in s3-multipart mode). No watchdog: local files have no "unreadable
    //    remote source" failure mode, and large multipart uploads legitimately run long. ──
    let local = remote;
    if (s3Mode) {
      const s3Meta = new Map<string, { key: string; uploadId?: string }>();
      local = new Uppy({ autoProceed: false, allowMultipleUploadBatches: true, restrictions: {} });
      const s3 = () => {
        const api = optsRef.current.destination.s3;
        if (!api) throw new Error("localMode is 's3-multipart' but destination.s3 was not provided");
        return api;
      };
      // Loosely typed on purpose (as with provider plugins) so the vendor plugin's strict generic
      // option type never leaks into aleup's API. Named mountLocal (not use*) so eslint's
      // rules-of-hooks doesn't mistake these plugin installs for React Hook calls.
      const mountLocal = local.use.bind(local) as (plugin: unknown, opts?: unknown) => unknown;
      mountLocal(AwsS3, s3PluginOptions(s3, s3Meta));
      // Cross-refresh resume: persist the batch manifest + multipart part state (+ small blobs) to
      // IndexedDB. On reload, restored non-ghost files auto-resume (AwsS3 reconciles via listParts);
      // ghost files (large local blobs over the IndexedDB cap) can't be re-read and need reselection.
      mountLocal(GoldenRetriever, { serviceWorker: false });
      local.on("restored", () => {
        const autoResumed: { id: string; name: string; size?: number | null }[] = [];
        const needsReselection: { id: string; name: string; size?: number | null }[] = [];
        for (const f of local.getFiles()) {
          const entry = { id: f.id, name: f.name ?? "file", size: f.size };
          if ((f as { isGhost?: boolean }).isGhost) needsReselection.push(entry);
          else autoResumed.push(entry);
        }
        optsRef.current.onRestored?.({ autoResumed, needsReselection });
        if (autoResumed.length) void local.upload(); // resume what we can
      });
      attachProgress(local, optsRef, {
        watchdog: false,
        stallMs,
        finalize: async (file) => {
          const meta = s3Meta.get(file.id);
          s3Meta.delete(file.id);
          return s3().onObjectUploaded(file, { key: meta?.key ?? "", uploadId: meta?.uploadId });
        },
      });
    }
    return { remoteUppy: remote, localUppy: local };
    // Endpoints/keys are resolved per upload via the DestinationPort, never baked in.
  }, [companionUrl, concurrency, stallMs, s3Mode]);

  useEffect(() => {
    // StrictMode-safe teardown: defer destroy by a macrotask so a synchronous re-mount cancels it;
    // a genuine unmount has no re-mount, so it tears down. Handles both instances (localUppy may be
    // the same object as remoteUppy in xhr mode — dedupe so we don't destroy twice).
    const instances = remoteUppy === localUppy ? [remoteUppy] : [remoteUppy, localUppy];
    if (pendingDestroy.current && pendingDestroy.current.instances[0] === remoteUppy) {
      clearTimeout(pendingDestroy.current.timer);
      pendingDestroy.current = null;
    }
    return () => {
      const timer = setTimeout(() => {
        pendingDestroy.current = null;
        for (const inst of instances) {
          if (inst.getFiles().length > 0 || Object.keys(inst.getState().currentUploads).length > 0) {
            inst.once("complete", () => inst.destroy());
          } else {
            inst.destroy();
          }
        }
      }, 0);
      pendingDestroy.current = { instances, timer };
    };
  }, [remoteUppy, localUppy]);

  /** The headless plugin's Companion client (auth/list) for a registered provider (on remoteUppy). */
  function client(providerId: string): CompanionClient | null {
    const reg = (optsRef.current.providers ?? []).find((c) => c.id === providerId);
    if (!reg) return null;
    return providerClient(remoteUppy, reg.pluginId);
  }

  /**
   * Add local File objects and start the upload. In s3-multipart mode they go to the S3 instance
   * (resumable, direct-to-storage); otherwise they XHR-POST to the host's local target (today's path).
   */
  async function uploadLocalFiles(files: File[], o?: { start?: boolean }): Promise<void> {
    if (!files.length) return;

    if (s3Mode) {
      for (const file of files) {
        try {
          localUppy.addFile({
            name: file.name,
            type: file.type,
            data: file,
            meta: { ...optsRef.current.meta?.() },
          } as never);
        } catch {
          /* duplicate in batch — skip */
        }
      }
      if (o?.start !== false) void localUppy.upload();
      return;
    }

    const target = await optsRef.current.destination.localUploadTarget();
    for (const file of files) {
      try {
        const id = remoteUppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
          meta: { ...optsRef.current.meta?.() },
        } as never);
        // Per-file endpoint (Uppy core drops unknown top-level addFile keys; must use setFileState).
        remoteUppy.setFileState(id, {
          xhrUpload: {
            endpoint: target.endpoint,
            ...(target.headers ? { headers: target.headers } : {}),
          },
        } as never);
      } catch {
        /* duplicate in batch — skip */
      }
    }
    if (o?.start !== false) void remoteUppy.upload();
  }

  /**
   * Add remote provider files and start the import. Companion streams each file server-side into the
   * host's remote target. Always on remoteUppy (XHRUpload), regardless of localMode.
   */
  async function importRemoteFiles(
    providerId: string,
    items: CompanionItem[],
    o?: { start?: boolean },
  ): Promise<void> {
    if (!items.length) return;
    optsRef.current.onProgress?.({ phase: "importing", total: items.length, done: 0, failed: 0 });
    try {
      const provider = client(providerId);
      if (!provider) throw new Error(`Provider ${providerId} not initialized`);

      const target = await optsRef.current.destination.remoteUploadTarget();
      const transform = optsRef.current.transformRemoteItem ?? defaultTransform;

      let added = 0;
      for (const item of items) {
        const { name, type } = transform(item);
        try {
          const id = remoteUppy.addFile({
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
          remoteUppy.setFileState(id, {
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
      if (added === 0) {
        optsRef.current.onProgress?.(null);
        return;
      }
      if (o?.start !== false) void remoteUppy.upload();
    } catch (err) {
      optsRef.current.onProgress?.(null);
      throw err;
    }
  }

  /** Start uploading everything queued across both instances (for hosts batching local + remote). */
  function startUpload() {
    const jobs = [remoteUppy.upload()];
    if (remoteUppy !== localUppy) jobs.push(localUppy.upload());
    return Promise.all(jobs);
  }

  return { uppy: remoteUppy, providerClient: client, uploadLocalFiles, importRemoteFiles, startUpload };
}
