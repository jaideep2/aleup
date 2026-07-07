import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import styles from "./index.module.css";

const PACKAGES: { name: string; desc: string }[] = [
  { name: "@aleup/core", desc: "Ports, MIME registry, format detection. Zero deps." },
  { name: "@aleup/import", desc: "Headless Uppy orchestration + cloud-drive picker state." },
  { name: "@aleup/companion", desc: "Config-mapped Uppy Companion server factory." },
  { name: "@aleup/editor", desc: "Headless Tiptap document editor with markdown/HTML IO." },
  { name: "@aleup/view", desc: "Format-routing viewer; DOCX/markdown renderers opt-in." },
  { name: "@aleup/docx", desc: "High-fidelity DOCX round-trip editing over WASM." },
  { name: "@aleup/pdf", desc: "What-you-see-is-what-prints DOM → PDF export." },
  { name: "@aleup/connect", desc: "OAuth save-back to Drive, OneDrive, Box, Dropbox." },
];

export default function Home() {
  return (
    <Layout description="Headless file management, cloud import, preview, editing, and export for React apps">
      <header className={styles.hero}>
        <div className="container">
          <Heading as="h1" className={styles.title}>
            aleup
          </Heading>
          <p className={styles.subtitle}>
            Import files from anywhere, preview anything, edit documents, export faithfully —
            headless building blocks for React apps that never touch your auth, storage, or
            database.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/getting-started">
              Get started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/examples">
              See it themed
            </Link>
          </div>
        </div>
      </header>
      <main className="container margin-vert--lg">
        <div className="row">
          {PACKAGES.map((p) => (
            <div key={p.name} className="col col--3 margin-bottom--lg">
              <div className={styles.card}>
                <code>{p.name}</code>
                <p>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
