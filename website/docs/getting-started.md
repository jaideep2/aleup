---
sidebar_position: 2
title: Getting started
---

# Getting started

## A minimal viewer

```bash
pnpm add @aleup/core @aleup/view
```

```tsx
import { DocumentViewer, detectFormat } from "@aleup/view";
import "@aleup/view/styles.css";

export function Preview({ name, mime, url }: { name: string; mime: string; url: string }) {
  return <DocumentViewer format={detectFormat(mime, name)} name={name} fileUrl={url} />;
}
```

That renders pdf (iframe), images, and plain text out of the box. Markdown and DOCX are
opt-in so their dependencies stay out of your bundle until you want them:

```tsx
import { MarkdownView } from "@aleup/view/markdown"; // pulls @aleup/editor (Tiptap)
import { DocxHtmlView } from "@aleup/view/docx";     // pulls @aleup/docx (WASM)

<DocumentViewer
  renderers={{ md: MarkdownView, docx: (s) => <DocxHtmlView bytes={s.docxBytes ?? null} /> }}
  {...source}
/>;
```

## An editor

```bash
pnpm add @aleup/editor @tiptap/react @tiptap/starter-kit @tiptap/markdown \
  @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell \
  @tiptap/extension-table-header @tiptap/pm
```

```tsx
import { DocEditor, useDocToolbarState, getMarkdown, type Editor } from "@aleup/editor";
import "@aleup/editor/styles.css";

<DocEditor
  content={"# Hello"}
  contentType="markdown"
  toolbar={(editor) => <MyToolbar editor={editor} />}  // bring your design system
  onEditor={setEditor}
/>;
```

`useDocToolbarState(editor)` gives your toolbar live active/disabled flags without
re-rendering the editor tree; call `getMarkdown(editor)` to read content back.

## Local + cloud import

```bash
pnpm add @aleup/import @uppy/core @uppy/xhr-upload @uppy/google-drive
```

```tsx
import { useUppyImport } from "@aleup/import";
import { googleDrive } from "@aleup/import/google-drive";

const { uploadLocalFiles, importRemoteFiles, providerClient } = useUppyImport({
  companionUrl: "https://companion.example.com",
  providers: [googleDrive()],
  destination: {
    // Local uploads: browser → your route (session cookie).
    localUploadTarget: () => ({ endpoint: "/api/files" }),
    // Remote imports: Companion streams server-side → typically a token-authed route,
    // because Companion can't send the browser's session cookie.
    remoteUploadTarget: async () => {
      const { token } = await (await fetch("/api/upload-token", { method: "POST" })).json();
      return {
        endpoint: `${location.origin}/api/files/companion`,
        headers: { "x-upload-token": token },
      };
    },
  },
  meta: () => ({ tags: JSON.stringify(currentTags) }),
  onProgress: setProgress,
});
```

Provider registrations live behind subpaths (`@aleup/import/google-drive`, `/onedrive`,
`/box`, `/dropbox`) so plugins you don't enable never enter your bundle — they're
optional peer dependencies.

Build your picker UI on `useCloudDrivePicker` — it handles connection probing, OAuth
kickoff, navigation, pagination, selection, and capped breadth-first folder expansion.
You render the list.

You'll also need a Companion server for the cloud providers — see
[@aleup/companion](/docs/packages/companion).

## DOCX + PDF

See [@aleup/docx](/docs/packages/docx) (don't skip the
[WASM asset setup](/docs/wasm-setup)) and [@aleup/pdf](/docs/packages/pdf). For local
development against an aleup checkout, see [Installing](/docs/installing).
