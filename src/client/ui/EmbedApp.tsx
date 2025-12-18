import React, { useState, useEffect } from "react";
import { SAMPLES } from "../samples.ts";
import { Workspace } from "./Workspace.tsx";
import "./EmbedApp.css";

const DEFAULT_SAMPLE = SAMPLES.hello as { server: string; client: string };

type CodeState = {
  server: string;
  client: string;
};

function getParamsFromUrl(): { code: CodeState; seamless: boolean } {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("c");
  const seamless = params.get("seamless") === "1";

  let code: CodeState;
  if (encoded) {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json) as { server?: string; client?: string };
      code = {
        server: (parsed.server ?? DEFAULT_SAMPLE.server).trim(),
        client: (parsed.client ?? DEFAULT_SAMPLE.client).trim(),
      };
    } catch {
      code = {
        server: DEFAULT_SAMPLE.server,
        client: DEFAULT_SAMPLE.client,
      };
    }
  } else {
    code = {
      server: DEFAULT_SAMPLE.server,
      client: DEFAULT_SAMPLE.client,
    };
  }

  return { code, seamless };
}

function getFullscreenUrl(code: CodeState): string {
  const json = JSON.stringify({ server: code.server, client: code.client });
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return `https://rscexplorer.dev/?c=${encodeURIComponent(encoded)}`;
}

export function EmbedApp(): React.ReactElement {
  const [params] = useState(getParamsFromUrl);
  const [code, setCode] = useState(params.code);
  const seamless = params.seamless;

  // Listen for code updates from parent via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string; code?: CodeState };
      if (data?.type === "rscexplorer:reset" && data.code) {
        const newServer = data.code.server.trim();
        const newClient = data.code.client.trim();
        setCode((prev) => {
          if (prev.server === newServer && prev.client === newClient) {
            return prev;
          }
          return { server: newServer, client: newClient };
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

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
      {!seamless && (
        <div className="EmbedApp-header">
          <span className="EmbedApp-title">RSC Explorer</span>
          <a
            href={getFullscreenUrl(code)}
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
