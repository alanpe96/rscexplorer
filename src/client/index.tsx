import "../shared/webpack-shim.ts";

import { createRoot } from "react-dom/client";
import { App } from "./ui/App.tsx";

const container = document.getElementById("app");
const root = createRoot(container!);
root.render(<App />);
