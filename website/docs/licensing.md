---
sidebar_position: 9
title: Licensing
---

# Licensing

**aleup's own license is pending** (MIT vs Apache-2.0 under legal review). Until a
LICENSE ships, the code is all-rights-reserved and the packages stay on a private
registry.

## Third-party stack

Every dependency in the stack is MIT: `@uppy/*`, `@tiptap/*` (the MIT set only — no
Tiptap Pro), `docxodus` (WASM fork of Open-Xml-PowerTools, itself MIT), `html2pdf.js`
(which bundles jsPDF and html2canvas, both MIT), `pdf-lib`.

MIT's obligation is attribution: the repository ships a generated
`THIRD_PARTY_LICENSES.md` aggregating every dependency and peer dependency — including
the **bundled** packages a license crawler can't see (jsPDF + html2canvas inside
html2pdf.js, Open-Xml-PowerTools inside docxodus). CI regenerates the file and fails on
drift, so it can never go stale.

## Boundaries we enforce

- No Tiptap Pro extensions — documented in `@aleup/editor` and enforced in review.
- No vendored/forked upstream code — we depend on published npm packages only, so
  upstream licenses apply to upstream artifacts.
- aleup's copyright covers aleup's original code only; the NOTICE file is how we stay
  honest about everyone else's.
