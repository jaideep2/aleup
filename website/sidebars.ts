import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    "index",
    "getting-started",
    {
      type: "category",
      label: "Packages",
      collapsed: false,
      items: [
        "packages/core",
        "packages/import",
        "packages/companion",
        "packages/editor",
        "packages/view",
        "packages/docx",
        "packages/pdf",
        "packages/connect",
      ],
    },
    "theming",
    "ports",
    "examples",
    "wasm-setup",
    "installing",
    "licensing",
  ],
};

export default sidebars;
