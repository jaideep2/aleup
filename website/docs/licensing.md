---
sidebar_position: 9
title: Licensing
---

# Licensing

aleup is licensed under **[Apache-2.0](https://github.com/aleup/aleup/blob/main/LICENSE)**,
© 2026 JD. That means you can use it freely in commercial products and services; the
license adds an explicit patent grant and requires preserving attribution notices.

Two things Apache-2.0 does *not* grant:

- **The name.** "aleup" is the project's identity — don't use it in a way that implies
  your product or service is provided or endorsed by the project (see `NOTICE`).
- **Future paid offerings.** The maintainer may offer commercial services and add-ons
  built around aleup; those live outside this repository. The open-source packages here
  are complete and unencumbered — no feature-flagged nagware, no phone-home.

## Contributing

Contributions are accepted under a one-time
[Contributor License Agreement](https://github.com/aleup/aleup/blob/main/CLA.md) (a bot
prompts on your first PR). Your contribution stays yours and stays credited; the CLA
licenses it to the project so the project's licensing remains future-proof.

## Third-party stack

Every dependency is MIT: `@uppy/*`, `@tiptap/*` (the MIT set only — **no Tiptap Pro**,
enforced in review), `docxodus` (WASM fork of Open-Xml-PowerTools, itself MIT),
`html2pdf.js` (which bundles jsPDF and html2canvas, both MIT), `pdf-lib`.

MIT's obligation is attribution: the repository ships a generated
`THIRD_PARTY_LICENSES.md` aggregating every dependency and peer dependency — including
the **bundled** packages a license crawler can't see (jsPDF + html2canvas inside
html2pdf.js, Open-Xml-PowerTools inside docxodus). CI regenerates the file and fails on
drift, so it can never go stale.
