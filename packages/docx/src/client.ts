// Client-side Docxodus loader — the single owner of all DOCX ⇄ HTML/Markdown translation
// (Uppy syncs, Tiptap owns DOM state, Docxodus owns translation). The WASM runtime (~16 MB,
// .NET-on-WASM) is served from a host-configurable base path (copy it there with the
// `aleup-copy-docxodus-wasm` bin) and initialized lazily exactly once, on first use, so views
// that never open a DOCX pay nothing.
//
// Import this module ONLY from client components ("use client") — the WASM runtime has no
// Node/SSR story here.

import type * as Docxodus from "docxodus";

let assetBase = "/docxodus/";
let loader: Promise<typeof Docxodus> | null = null;

/**
 * Set where the docxodus WASM assets are served from (default "/docxodus/"). Must be called
 * before the first DOCX is opened; later calls throw rather than silently applying to nothing.
 * Copy the assets with `aleup-copy-docxodus-wasm --dest <public dir>/docxodus`.
 */
export function configureDocx(options: { assetBase: string }): void {
  if (loader) throw new Error("configureDocx() must be called before the docxodus runtime loads");
  assetBase = options.assetBase.endsWith("/") ? options.assetBase : `${options.assetBase}/`;
}

/** Lazily import + initialize the Docxodus WASM runtime (singleton). */
export function getDocxodus(): Promise<typeof Docxodus> {
  loader ??= (async () => {
    const mod = await import("docxodus");
    await mod.initialize(assetBase);
    return mod;
  })().catch((err) => {
    loader = null; // allow retry on transient load failures
    throw err;
  });
  return loader;
}

/**
 * Convert DOCX bytes to semantic HTML (Docxodus `WmlToHtmlConverter`) for 1:1 structural
 * preview and for Tiptap ingestion.
 */
export async function docxToHtml(bytes: Uint8Array): Promise<string> {
  const dx = await getDocxodus();
  return dx.convertDocxToHtml(bytes, {
    // Class-based CSS keeps the output self-contained so the preview matches Word's
    // styling without leaking rules into the app shell.
    fabricateClasses: true,
    cssPrefix: "docx-",
  });
}

/** Extract the `<body>` inner HTML + hoisted `<style>` from a full Docxodus HTML doc. */
export function splitDocxHtml(html: string): { css: string; body: string } {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return { css, body: bodyMatch ? bodyMatch[1]! : html };
}
