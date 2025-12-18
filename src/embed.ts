/**
 * RSC Explorer Embed API
 *
 * Usage:
 * ```html
 * <div id="demo" style="height: 500px;"></div>
 * <script type="module">
 * import { mount } from 'https://rscexplorer.dev/embed.js';
 *
 * mount('#demo', {
 *   server: `
 * export default function App() {
 *   return <h1>Hello RSC</h1>;
 * }
 *   `,
 *   client: `
 * 'use client'
 * export function Button() {
 *   return <button>Click</button>;
 * }
 *   `
 * });
 * </script>
 * ```
 */

type EmbedOptions = {
  server: string;
  client: string;
  seamless?: boolean;
};

type EmbedControl = {
  iframe: HTMLIFrameElement;
  destroy: () => void;
};

type EmbedReadyMessage = {
  type: "rsc-embed:ready";
};

type EmbedInitMessage = {
  type: "rsc-embed:init";
  code: {
    server: string;
    client: string;
  };
};

function isEmbedReadyMessage(data: unknown): data is EmbedReadyMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: string }).type === "rsc-embed:ready"
  );
}

const getEmbedUrl = (): string => {
  return new URL("embed.html", import.meta.url).href;
};

/**
 * Mount an RSC Explorer embed into a container element
 * @param container - CSS selector or DOM element
 * @param options - Configuration options
 * @returns Control object with methods to interact with the embed
 */
export function mount(
  container: string | HTMLElement,
  { server, client, seamless }: EmbedOptions,
): EmbedControl {
  const el =
    typeof container === "string" ? document.querySelector<HTMLElement>(container) : container;

  if (!el) {
    throw new Error(`RSC Explorer: Container not found: ${container}`);
  }

  const embedUrl = new URL(getEmbedUrl());
  if (seamless) {
    embedUrl.searchParams.set("seamless", "1");
  }

  const iframe = document.createElement("iframe");
  iframe.src = embedUrl.href;
  iframe.style.cssText =
    "width: 100%; height: 100%; border: 1px solid #e0e0e0; border-radius: 8px;";

  const handleMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== iframe.contentWindow) return;

    if (isEmbedReadyMessage(event.data)) {
      const initMessage: EmbedInitMessage = {
        type: "rsc-embed:init",
        code: { server: server.trim(), client: client.trim() },
      };
      iframe.contentWindow?.postMessage(initMessage, "*");
    }
  };

  window.addEventListener("message", handleMessage);

  el.innerHTML = "";
  el.appendChild(iframe);

  return {
    iframe,
    destroy: (): void => {
      window.removeEventListener("message", handleMessage);
      el.innerHTML = "";
    },
  };
}
