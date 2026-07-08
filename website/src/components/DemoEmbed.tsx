import { useState } from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./DemoEmbed.module.css";

type Demo = { id: string; label: string; note: string };

const DEMOS: Demo[] = [
  { id: "shadcn", label: "shadcn/ui", note: "Tailwind v4 + Radix + cva — the flagship reference." },
  { id: "mui", label: "MUI", note: "Material UI + Emotion, ThemeProvider + CssBaseline. No Tailwind." },
  { id: "daisyui", label: "daisyUI", note: "daisyUI 5 with a live theme switcher (try it inside the demo)." },
];

/**
 * Live, in-page embeds of the themed example apps deployed under /demos/*. The SAME
 * document workbench (editor, preview, cloud picker, PDF export) on identical aleup
 * hooks, differing only in design system — switch tabs to see the theming contract hold.
 *
 * Each demo iframe mounts lazily on first selection and then stays mounted, so switching
 * back is instant and only the demos you actually open are downloaded.
 */
export default function DemoEmbed(): JSX.Element {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const base = useBaseUrl("/demos/");

  const select = (i: number) => {
    setActive(i);
    setSeen((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs} role="tablist" aria-label="Themed example demos">
        {DEMOS.map((d, i) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={active === i}
            className={active === i ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => select(i)}
          >
            {d.label}
          </button>
        ))}
        <a
          className={styles.openLink}
          href={`${base}${DEMOS[active].id}/`}
          target="_blank"
          rel="noreferrer"
        >
          Open full screen ↗
        </a>
      </div>

      <p className={styles.note}>{DEMOS[active].note}</p>

      <div className={styles.stage}>
        {DEMOS.map((d, i) =>
          seen.has(i) ? (
            <iframe
              key={d.id}
              title={`${d.label} demo`}
              src={`${base}${d.id}/`}
              className={styles.frame}
              style={{ display: active === i ? "block" : "none" }}
              loading="lazy"
            />
          ) : null,
        )}
      </div>
    </div>
  );
}
