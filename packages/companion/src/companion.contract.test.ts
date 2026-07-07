// CONTRACT TEST against the installed @uppy/companion: the standalone server has no ESM
// exports map, so startStandaloneCompanion() deep-requires a lib path that semver does
// NOT protect. If an upstream restructure moves it, this fails loudly here.
import { createRequire } from "node:module";
import { expect, test } from "vitest";

test("contract 6: @uppy/companion standalone start-server deep path resolves", () => {
  const require = createRequire(import.meta.url);
  expect(() => require.resolve("@uppy/companion/lib/standalone/start-server.js")).not.toThrow();
});
