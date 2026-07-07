"use client";

// Read-only DOCX preview (opt-in subpath — pulls @aleup/docx WASM + @aleup/editor):
// raw bytes → Docxodus WmlToHtmlConverter → semantic HTML rendered 1:1 inside the page
// chrome, so preview and editor share one translation engine.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { docxToHtml, splitDocxHtml, openDocxForEditing } from "@aleup/docx";
import { DocEditor } from "@aleup/editor";

export interface DocxHtmlViewProps {
  bytes: Uint8Array | null;
  /** Called when conversion fails (parent may offer download instead). */
  onFail?: () => void;
  slots?: {
    loading?: ReactNode;
    error?: ReactNode;
  };
  classNames?: {
    /** Scrollable backdrop. Default styling class: doc-page-backdrop. */
    backdrop?: string;
    /** The page element. Defaults to "doc-page docx-html-view". */
    page?: string;
  };
}

export function DocxHtmlView({ bytes, onFail, slots, classNames }: DocxHtmlViewProps) {
  const [html, setHtml] = useState<{ css: string; body: string } | null>(null);
  // Fallback markdown from the editing session's projection, used when the HTML
  // converter (WmlToHtmlConverter) chokes on a document the session engine handles fine.
  const [fallbackMd, setFallbackMd] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    setHtml(null);
    setFallbackMd(null);
    setError(false);
    docxToHtml(bytes)
      .then((full) => {
        if (!cancelled) setHtml(splitDocxHtml(full));
      })
      .catch(async () => {
        // WmlToHtmlConverter can fail on structures the session-based projection still
        // reads (the same path editing uses). Fall back to a read-only markdown render so
        // preview works whenever editing does, rather than showing "can't render".
        try {
          const handle = await openDocxForEditing(bytes);
          const md = handle.markdown;
          handle.close();
          if (!cancelled) setFallbackMd(md);
        } catch {
          if (!cancelled) {
            setError(true);
            failRef.current?.();
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bytes]);

  if (!error && fallbackMd !== null) {
    return <DocEditor content={fallbackMd} contentType="markdown" editable={false} />;
  }

  if (error) {
    return (
      <>
        {slots?.error ?? (
          <div data-aleup-viewer-state="error">
            <p>Couldn’t render this document.</p>
          </div>
        )}
      </>
    );
  }
  if (!bytes || !html) {
    return (
      <>
        {slots?.loading ?? (
          <div data-aleup-viewer-state="loading">
            <span data-aleup-spinner="" />
          </div>
        )}
      </>
    );
  }
  return (
    <div data-aleup-docx="" className={classNames?.backdrop ?? "doc-page-backdrop"}>
      {/* Docxodus fabricates its own classes (docx-*) — scope them to this subtree. */}
      <style dangerouslySetInnerHTML={{ __html: scopeCss(html.css) }} />
      <div
        className={classNames?.page ?? "doc-page docx-html-view"}
        dangerouslySetInnerHTML={{ __html: html.body }}
      />
    </div>
  );
}

/** Prefix Docxodus's element selectors so its stylesheet can't restyle the app shell. */
export function scopeCss(css: string): string {
  return css.replace(/(^|\})\s*([^@{}][^{]*)\{/g, (_, close: string, selector: string) => {
    const scoped = selector
      .split(",")
      .map((s) => `.docx-html-view ${s.trim()}`)
      .join(", ");
    return `${close}\n${scoped} {`;
  });
}
