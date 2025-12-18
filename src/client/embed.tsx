import "../shared/webpack-shim.ts";
import "../shared/polyfill.ts";

import { createRoot } from "react-dom/client";
import { EmbedApp } from "./ui/EmbedApp.tsx";

const container = document.getElementById("embed-root")!;
const root = createRoot(container!);
root.render(<EmbedApp />);
