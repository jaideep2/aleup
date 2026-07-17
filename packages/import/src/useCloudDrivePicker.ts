"use client";

// The cloud-drive picker STATE MACHINE, extracted from the styled dialog it powers:
// connection probing, OAuth kickoff, folder navigation with breadcrumbs, pagination,
// selection (incl. select-all), and breadth-first folder expansion into a flat file
// list. Companion owns the 3-legged OAuth (popup) + token storage via the headless
// provider plugins; this hook only drives `provider.list()`.
//
// Bring your own dialog: render `items`/`path`/`selected` however your design system
// likes and wire the returned actions to it.

import { useCallback, useEffect, useRef, useState } from "react";
import { isIndexable } from "@aleup/core";
import type { CompanionClient } from "./client.js";
import type { CompanionItem } from "./types.js";
import { isFolderShortcut } from "./helpers.js";

interface ListResponse {
  username?: string;
  nextPagePath?: string | null;
  items: CompanionItem[];
}

export interface BreadcrumbEntry {
  /** Companion requestPath (null = provider root). */
  requestPath: string | null;
  name: string;
}

export interface CloudDrivePickerOptions {
  /** Reset + probe when this flips true (mirror your dialog's open state). */
  open: boolean;
  /** The provider's Companion client (from useUppyImport().providerClient(id)). */
  provider: CompanionClient | null;
  /** Root breadcrumb label, usually the provider's display name. */
  rootLabel: string;
  /**
   * Client-side gate for which FILES can be selected (folders are always navigable).
   * Default: @aleup/core's isIndexable. The host's server stays authoritative on import.
   */
  isFileSelectable?: (mimeType: string) => boolean;
  /** Max files a folder expansion collects. Default 1000. */
  expansionCap?: number;
}

export function useCloudDrivePicker({
  open,
  provider,
  rootLabel,
  isFileSelectable = isIndexable,
  expansionCap = 1000,
}: CloudDrivePickerOptions) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirror `connected` into a ref so the memoized `list` can tell an initial connection
  // probe (connected === null) from a post-connect navigation error without being rebuilt.
  const connectedRef = useRef<boolean | null>(null);
  connectedRef.current = connected;

  const [items, setItems] = useState<CompanionItem[]>([]);
  const [listing, setListing] = useState(false);
  const [nextPagePath, setNextPagePath] = useState<string | null>(null);
  const [path, setPath] = useState<BreadcrumbEntry[]>([{ requestPath: null, name: rootLabel }]);
  const [selected, setSelected] = useState<Map<string, CompanionItem>>(new Map());
  const [expanding, setExpanding] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const list = useCallback(
    async (requestPath: string | null, append = false) => {
      // No provider client yet (Uppy plugin not mounted) — can't be connected; offer the
      // Connect screen rather than sitting on the probe spinner forever.
      if (!provider) {
        setConnected(false);
        return;
      }
      setListing(true);
      try {
        const res = await provider.list<ListResponse>(requestPath, {});
        setItems((prev) => (append ? [...prev, ...(res.items ?? [])] : (res.items ?? [])));
        setNextPagePath(res.nextPagePath ?? null);
        setConnected(true);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        const isAuth =
          (err as Error).name === "AuthError" ||
          (err as { isAuthError?: boolean }).isAuthError === true ||
          status === 401;
        if (isAuth) {
          setConnected(false);
        } else if (append || connectedRef.current === true) {
          // A pagination / navigation failure while already connected — keep the browser
          // open and just surface the error, don't bounce back to the connect screen.
          setError(`Couldn't load files from ${rootLabel}.`);
        } else {
          // Initial probe failed for a non-auth reason (Companion unreachable, unexpected
          // status, blocked request). A fresh session is "not connected" regardless — drop
          // to the Connect screen instead of an endless spinner. Any real failure surfaces
          // when the user actually clicks Connect (startAuth sets its own error).
          setConnected(false);
        }
      } finally {
        setListing(false);
      }
    },
    [provider, rootLabel],
  );

  // Reset and probe on open (a failing root list tells us we're not connected yet).
  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setError(null);
    setConnected(null);
    setPath([{ requestPath: null, name: rootLabel }]);
    setItems([]);
    void list(null);
  }, [open, rootLabel, list]);

  const startAuth = useCallback(async () => {
    if (!provider) return;
    setConnecting(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Companion drives the OAuth popup + postMessage handshake and stores the token.
      await provider.login({ signal: controller.signal });
      setConnected(true);
      setPath([{ requestPath: null, name: rootLabel }]);
      await list(null);
    } catch {
      setError(`${rootLabel} authorization failed. Please try again.`);
    } finally {
      setConnecting(false);
    }
  }, [provider, rootLabel, list]);

  const navigateInto = useCallback(
    (item: CompanionItem) => {
      setPath((prev) => [...prev, { requestPath: item.requestPath, name: item.name }]);
      setItems([]);
      void list(item.requestPath);
    },
    [list],
  );

  const navigateTo = useCallback(
    (index: number) => {
      setPath((prev) => {
        const entry = prev[index];
        if (!entry) return prev;
        setItems([]);
        void list(entry.requestPath);
        return prev.slice(0, index + 1);
      });
    },
    [list],
  );

  const loadMore = useCallback(() => {
    if (nextPagePath) void list(nextPagePath, true);
  }, [nextPagePath, list]);

  const toggleSelect = useCallback(
    (item: CompanionItem) => {
      if (isFolderShortcut(item)) return;
      if (!item.isFolder && !isFileSelectable(item.mimeType)) return;
      setSelected((prev) => {
        const next = new Map(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.set(item.id, item);
        return next;
      });
    },
    [isFileSelectable],
  );

  // Selectable items at the current level — powers "select all / deselect all" so users
  // don't have to tick hundreds of rows one by one.
  const selectableItems = items.filter(
    (item) => !isFolderShortcut(item) && (item.isFolder || isFileSelectable(item.mimeType)),
  );
  const allSelected =
    selectableItems.length > 0 && selectableItems.every((item) => selected.has(item.id));

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allSelected) {
        for (const item of selectableItems) next.delete(item.id);
      } else {
        for (const item of selectableItems) next.set(item.id, item);
      }
      return next;
    });
    // selectableItems/allSelected are derived from state read in this render.
  }, [allSelected, items, selected]);

  // Expand selected folders client-side (breadth-first, capped) so the import gets a
  // flat file list. Each expanded file carries `relativePath` (its containing folder
  // relative to the selection, including the picked folder's name) so hosts can
  // recreate the tree; directly-picked files carry none.
  const expandSelection = useCallback(async (): Promise<CompanionItem[]> => {
    const files: CompanionItem[] = [];
    const queue: { requestPath: string; relPath: string }[] = [];
    for (const item of selected.values()) {
      if (item.isFolder) queue.push({ requestPath: item.requestPath, relPath: item.name });
      else files.push(item);
    }
    while (queue.length && files.length < expansionCap) {
      const dir = queue.shift()!;
      let page: string | null = dir.requestPath;
      while (page && files.length < expansionCap) {
        const res: ListResponse = await provider!.list<ListResponse>(page, {});
        for (const child of res.items ?? []) {
          if (isFolderShortcut(child)) continue; // guaranteed 404 on download — skip
          if (child.isFolder)
            queue.push({ requestPath: child.requestPath, relPath: `${dir.relPath}/${child.name}` });
          else if (isFileSelectable(child.mimeType))
            files.push({ ...child, relativePath: dir.relPath });
        }
        page = res.nextPagePath ?? null;
      }
    }
    // Dedup by provider file id (a file picked directly AND via its folder). Map keeps the
    // LAST entry, so the folder-expanded one wins and the import mirrors the source tree.
    return [...new Map(files.map((f) => [f.id, f])).values()];
  }, [selected, provider, isFileSelectable, expansionCap]);

  /**
   * Expand the selection into a flat, importable file list. Returns null (and sets
   * `error`) when nothing importable was selected or a folder read failed — keep the
   * dialog open in that case.
   */
  const confirmSelection = useCallback(async (): Promise<CompanionItem[] | null> => {
    setExpanding(true);
    try {
      const files = await expandSelection();
      if (!files.length) {
        setError("No importable files in that selection.");
        return null;
      }
      return files;
    } catch {
      setError("Couldn't read the selected folders. Please try again.");
      return null;
    } finally {
      setExpanding(false);
    }
  }, [expandSelection]);

  const selectedCount = selected.size;
  const folderCount = Array.from(selected.values()).filter((f) => f.isFolder).length;

  return {
    // connection
    connected,
    connecting,
    startAuth,
    // browsing
    items,
    listing,
    path,
    navigateInto,
    navigateTo,
    nextPagePath,
    loadMore,
    // selection
    selected,
    toggleSelect,
    toggleSelectAll,
    selectableItems,
    allSelected,
    selectedCount,
    folderCount,
    fileCount: selectedCount - folderCount,
    isFileSelectable,
    // confirm
    expanding,
    confirmSelection,
    // errors
    error,
    setError,
  };
}
