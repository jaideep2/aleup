#!/usr/bin/env node
// Copies the docxodus WASM runtime (a .NET-on-WASM bundle, ~16 MB) into a host-chosen public
// directory so the browser can fetch it — see `configureDocx()`/`getDocxodus()`. Run it from
// predev/prebuild:  aleup-copy-docxodus-wasm --dest public/docxodus
//
// The copy is stamped with the installed docxodus version (.docxodus-version) and skipped when
// the stamp already matches, so repeated dev runs are instant — and a version bump can never be
// served stale assets silently (the runtime path is version-coupled, semver does not protect it).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const destFlag = process.argv.indexOf("--dest");
const dest = destFlag !== -1 ? process.argv[destFlag + 1] : undefined;
if (!dest) {
  console.error("usage: aleup-copy-docxodus-wasm --dest <dir>   (e.g. --dest public/docxodus)");
  process.exit(1);
}
const destDir = path.resolve(process.cwd(), dest);

// docxodus is ESM-only (exports map with only an "import" condition), so resolve the entry
// (dist/index.js) via import.meta.resolve — this finds the HOST's installed copy, since
// docxodus is a peer dependency of @aleup/docx — and take dist/wasm next to it.
const entry = fileURLToPath(import.meta.resolve("docxodus"));
const src = path.join(path.dirname(entry), "wasm");
if (!existsSync(src)) {
  console.error(`[aleup-docx] WASM runtime not found at ${src} — did the install change layout?`);
  process.exit(1);
}

const pkg = JSON.parse(
  readFileSync(path.join(path.dirname(entry), "..", "package.json"), "utf8"),
) as { version: string };
const stampFile = path.join(destDir, ".docxodus-version");
const existing = existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : null;

if (existing === pkg.version) {
  console.log(`[aleup-docx] WASM runtime already at ${dest} (docxodus ${pkg.version})`);
  process.exit(0);
}
if (existing && existing !== pkg.version) {
  console.warn(
    `[aleup-docx] docxodus changed ${existing} → ${pkg.version}; refreshing assets at ${dest}`,
  );
}
rmSync(destDir, { recursive: true, force: true });
mkdirSync(path.dirname(destDir), { recursive: true });
cpSync(src, destDir, { recursive: true });
writeFileSync(stampFile, `${pkg.version}\n`);
console.log(`[aleup-docx] WASM runtime → ${dest} (docxodus ${pkg.version})`);
