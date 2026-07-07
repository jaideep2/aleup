import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "aleup",
  tagline:
    "Headless file management, cloud import, preview, editing, and export for React apps",
  favicon: "img/favicon.ico",

  // GitHub Pages deploy target (enabled once the repo goes public).
  url: "https://jaideep2.github.io",
  baseUrl: "/aleup/",
  organizationName: "jaideep2",
  projectName: "aleup",

  onBrokenLinks: "throw",

  i18n: { defaultLocale: "en", locales: ["en"] },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "docs",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "aleup",
      items: [
        { type: "docSidebar", sidebarId: "docs", position: "left", label: "Docs" },
        { to: "/docs/examples", label: "Examples", position: "left" },
        { href: "https://github.com/jaideep2/aleup", label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting started", to: "/docs/getting-started" },
            { label: "Theming", to: "/docs/theming" },
            { label: "Ports", to: "/docs/ports" },
          ],
        },
        {
          title: "More",
          items: [{ label: "GitHub", href: "https://github.com/jaideep2/aleup" }],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} JD. Apache-2.0 licensed.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
