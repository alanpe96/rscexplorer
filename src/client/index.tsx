import "../shared/webpack-shim.ts";
import "../shared/polyfill.ts";

import { createRoot } from "react-dom/client";
import { App } from "./ui/App.tsx";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("app");
  if (!container) {
    throw new Error("Could not find #app element");
  }
  const root = createRoot(container);
  root.render(<App />);
});
