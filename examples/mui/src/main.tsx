import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// aleup's optional neutral stylesheets first, then the app CSS (variable overrides win).
import "@aleup/editor/styles.css";
import "@aleup/view/styles.css";
import "./index.css";

import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
