import { useState } from "react";
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./HeroDemo.module.css";

/**
 * The live aleup demo, front and center on the landing page. Shows the flagship
 * (shadcn-themed) document workbench — editor, format-routed preview, cloud import
 * picker, PDF export — running entirely in the browser with a mocked backend.
 *
 * Click-to-launch keeps the homepage's first paint light (the demo app is ~1.8 MB); once
 * launched, the iframe stays mounted. "Theme it" points to the Examples page, where the
 * same workbench can be switched across design systems.
 */
export default function HeroDemo() {
  const [launched, setLaunched] = useState(false);
  const demoUrl = useBaseUrl("/demos/shadcn/");

  return (
    <div className={styles.wrap}>
      <div className={styles.chrome}>
        <div className={styles.dots}>
          <span /> <span /> <span />
        </div>
        <span className={styles.addr}>aleup document workbench — live demo</span>
        <a className={styles.expand} href={demoUrl} target="_blank" rel="noreferrer">
          Open full screen ↗
        </a>
      </div>

      <div className={styles.stage}>
        {launched ? (
          <iframe title="aleup live demo" src={demoUrl} className={styles.frame} />
        ) : (
          <button className={styles.poster} onClick={() => setLaunched(true)} type="button">
            <span className={styles.play}>▶</span>
            <span className={styles.launch}>Launch the live demo</span>
            <span className={styles.hint}>
              Import, preview, edit, and export — running in your browser, no backend.
            </span>
          </button>
        )}
      </div>

      <p className={styles.caption}>
        This is the shadcn-themed build.{" "}
        <Link to="/docs/examples">Theme it across MUI, daisyUI, and more →</Link>
      </p>
    </div>
  );
}
