// @vitest-environment jsdom
// Contract test for the oklch() shim: its whole job is to be a NO-THROW best-effort rewrite.
// jsdom has no real canvas, so getContext("2d") returns null here — exactly the degraded
// environment the shim must survive (an export must never abort because of the shim).
import { expect, test } from "vitest";
import { neutralizeOklchColors } from "./index.js";

test("no-throw on null/undefined root", () => {
  expect(() => neutralizeOklchColors(null)).not.toThrow();
  expect(() => neutralizeOklchColors(undefined)).not.toThrow();
});

test("no-throw without a canvas 2d context (jsdom), element tree untouched", () => {
  const root = document.createElement("div");
  root.innerHTML = `<p style="color: oklch(0.5 0.1 200)">text</p>`;
  expect(() => neutralizeOklchColors(root)).not.toThrow();
  // Without a 2d context the shim exits early — inline style must be unchanged.
  expect(root.querySelector("p")!.style.color).toContain("oklch");
});

test("no-throw on a deep tree", () => {
  const root = document.createElement("div");
  let cur: HTMLElement = root;
  for (let i = 0; i < 50; i++) {
    const child = document.createElement("span");
    cur.appendChild(child);
    cur = child;
  }
  expect(() => neutralizeOklchColors(root)).not.toThrow();
});
