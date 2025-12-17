import "../shared/webpack-shim.ts";
import "../shared/polyfill.ts";

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Workspace } from "./ui/Workspace.tsx";
import "./styles/workspace.css";

const DEFAULT_SERVER = `export default function App() {
  return <h1>RSC Explorer</h1>;
}`;

const DEFAULT_CLIENT = `'use client'

export function Button({ children }) {
  return <button>{children}</button>;
}`;

type CodeState = {
  server: string;
  client: string;
};

type EmbedInitMessage = {
  type: "rsc-embed:init";
  code?: {
    server?: string;
    client?: string;
  };
  showFullscreen?: boolean;
};

type EmbedReadyMessage = {
  type: "rsc-embed:ready";
};

type EmbedCodeChangedMessage = {
  type: "rsc-embed:code-changed";
  code: {
    server: string;
    client: string;
  };
};

function isEmbedInitMessage(data: unknown): data is EmbedInitMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: string }).type === "rsc-embed:init"
  );
}

function EmbedApp(): React.ReactElement | null {
  const [code, setCode] = useState<CodeState | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>): void => {
      const { data } = event;
      if (isEmbedInitMessage(data)) {
        setCode({
          server: (data.code?.server ?? DEFAULT_SERVER).trim(),
          client: (data.code?.client ?? DEFAULT_CLIENT).trim(),
        });
        if (data.showFullscreen !== false) {
          setShowFullscreen(true);
        }
      }
    };

    window.addEventListener("message", handleMessage);

    if (window.parent !== window) {
      const readyMessage: EmbedReadyMessage = { type: "rsc-embed:ready" };
      window.parent.postMessage(readyMessage, "*");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleCodeChange = (server: string, client: string): void => {
    if (window.parent !== window) {
      const changedMessage: EmbedCodeChangedMessage = {
        type: "rsc-embed:code-changed",
        code: { server, client },
      };
      window.parent.postMessage(changedMessage, "*");
    }
  };

  const getFullscreenUrl = (): string => {
    if (!code) return "#";
    const json = JSON.stringify({ server: code.server, client: code.client });
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
    return `https://rscexplorer.dev/?c=${encoded}`;
  };

  if (!code) {
    return null;
  }

  return (
    <>
      {showFullscreen && (
        <div className="embed-header">
          <span className="embed-title">RSC Explorer</span>
          <a
            href={getFullscreenUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="embed-fullscreen-link"
            title="Open in RSC Explorer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        </div>
      )}
      <Workspace
        key={`${code.server}:${code.client}`}
        initialServerCode={code.server}
        initialClientCode={code.client}
        onCodeChange={handleCodeChange}
      />
    </>
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("embed-root");
  if (!container) {
    throw new Error("Could not find #embed-root element");
  }
  const root = createRoot(container);
  root.render(<EmbedApp />);
});
