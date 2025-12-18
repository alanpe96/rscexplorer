import React from "react";
import { SAMPLES } from "../samples.ts";
import { Workspace } from "./Workspace.tsx";
import "./EmbedApp.css";

const DEFAULT_SAMPLE = SAMPLES.hello as { server: string; client: string };

type CodeState = {
  server: string;
  client: string;
};

function getCodeFromUrl(): CodeState {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("c");

  if (encoded) {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json) as { server?: string; client?: string };
      return {
        server: (parsed.server ?? DEFAULT_SAMPLE.server).trim(),
        client: (parsed.client ?? DEFAULT_SAMPLE.client).trim(),
      };
    } catch {
      // Fall through to defaults
    }
  }

  return {
    server: DEFAULT_SAMPLE.server,
    client: DEFAULT_SAMPLE.client,
  };
}

function getFullscreenUrl(code: CodeState): string {
  const json = JSON.stringify({ server: code.server, client: code.client });
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return `https://rscexplorer.dev/?c=${encodeURIComponent(encoded)}`;
}

export function EmbedApp(): React.ReactElement {
  const initialCode = getCodeFromUrl();

  const handleCodeChange = (server: string, client: string): void => {
    if (window.parent !== window) {
      window.parent.postMessage(
        {
          type: "rscexplorer:edit",
          code: { server, client },
        },
        "*",
      );
    }
  };

  return (
    <>
      <div className="EmbedApp-header">
        <span className="EmbedApp-title">RSC Explorer</span>
        <a
          href={getFullscreenUrl(initialCode)}
          target="_blank"
          rel="noopener noreferrer"
          className="EmbedApp-fullscreenLink"
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
      <Workspace
        initialServerCode={initialCode.server}
        initialClientCode={initialCode.client}
        onCodeChange={handleCodeChange}
      />
    </>
  );
}
