// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DocumentViewer, type DocSource } from "./DocumentViewer.js";

afterEach(cleanup);

const base = { name: "f", fileUrl: "http://x/f" };

test("text renders in a <pre>", () => {
  render(<DocumentViewer {...base} format="text" textContent="hello world" />);
  expect(screen.getByText("hello world").tagName).toBe("PRE");
});

test("text loading/error route to slots", () => {
  const { rerender } = render(
    <DocumentViewer {...base} format="text" textLoading slots={{ loading: <p>LOAD</p> }} />,
  );
  expect(screen.getByText("LOAD")).toBeTruthy();
  rerender(<DocumentViewer {...base} format="text" textError slots={{ error: <p>ERR</p> }} />);
  expect(screen.getByText("ERR")).toBeTruthy();
});

test("unknown format falls back with a download link", () => {
  render(<DocumentViewer {...base} format="other" />);
  const link = document.querySelector("[data-aleup-download]") as HTMLAnchorElement;
  expect(link).toBeTruthy();
  expect(link.getAttribute("download")).toBe("f");
});

test("registered renderer wins for its format; md without renderer falls back", () => {
  const Custom = (s: DocSource) => <p>CUSTOM:{s.format}</p>;
  const { rerender } = render(
    <DocumentViewer {...base} format="docx" renderers={{ docx: Custom }} />,
  );
  expect(screen.getByText("CUSTOM:docx")).toBeTruthy();
  rerender(<DocumentViewer {...base} format="md" textContent="# hi" />);
  expect(document.querySelector("[data-aleup-viewer-state='fallback']")).toBeTruthy();
  rerender(<DocumentViewer {...base} format="md" textContent="# hi" renderers={{ md: Custom }} />);
  expect(screen.getByText("CUSTOM:md")).toBeTruthy();
});

test("pdf and google-native render iframes; image renders img", () => {
  const { rerender } = render(<DocumentViewer {...base} format="pdf" />);
  expect(document.querySelector("[data-aleup-pdf]")).toBeTruthy();
  rerender(<DocumentViewer {...base} format="google-native" />);
  expect(document.querySelector("[data-aleup-frame]")).toBeTruthy();
  rerender(<DocumentViewer {...base} format="image" />);
  expect(document.querySelector("[data-aleup-image]")).toBeTruthy();
});
