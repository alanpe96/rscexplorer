// Server Worker - RSC server simulation
//
// Models a real server: deploy code once, then handle requests against it.
// - `deploy`: Store compiled code, manifest, etc. (like deploying to production)
// - `render`/`action`: Execute against deployed code

import "./webpack-shim.ts";
import "../client/byte-stream-polyfill.ts";
import "text-encoding";

import {
  renderToReadableStream,
  registerServerReference,
  createClientModuleProxy,
  decodeReply,
  type ClientManifest,
} from "react-server-dom-webpack/server";
import React from "react";

declare const self: DedicatedWorkerGlobalScope;

type DeployMessage = {
  type: "deploy";
  requestId: string;
  compiledCode: string;
  manifest: ClientManifest;
  actionNames: string[];
};

type RenderMessage = {
  type: "render";
  requestId: string;
};

type ActionMessage = {
  type: "action";
  requestId: string;
  actionId: string;
  encodedArgs: EncodedArgs;
};

type WorkerMessage = DeployMessage | RenderMessage | ActionMessage;

type EncodedArgs = {
  type: "formdata" | "string";
  data: string;
};

type ErrorResponse = {
  type: "error";
  requestId: string;
  error: { message: string; stack?: string };
};

type DeployedResponse = {
  type: "deployed";
  requestId: string;
};

type StreamStartResponse = {
  type: "stream-start";
  requestId: string;
};

type StreamChunkResponse = {
  type: "stream-chunk";
  requestId: string;
  chunk: Uint8Array;
};

type StreamEndResponse = {
  type: "stream-end";
  requestId: string;
};

type StreamErrorResponse = {
  type: "stream-error";
  requestId: string;
  error: { message: string };
};

type ReadyResponse = {
  type: "ready";
};

type ServerModule = {
  default?: React.ComponentType | React.ReactNode;
  [key: string]: unknown;
};

type DeployedState = {
  manifest: ClientManifest;
  serverModule: ServerModule;
  actionNames: string[];
};

let deployed: DeployedState | null = null;

// Safari doesn't support transferable streams
async function streamToMain(stream: ReadableStream<Uint8Array>, requestId: string): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        self.postMessage({ type: "stream-end", requestId } satisfies StreamEndResponse);
        break;
      }
      self.postMessage({
        type: "stream-chunk",
        requestId,
        chunk: value,
      } satisfies StreamChunkResponse);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    self.postMessage({
      type: "stream-error",
      requestId,
      error: { message: error.message },
    } satisfies StreamErrorResponse);
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, requestId } = event.data;

  try {
    switch (type) {
      case "deploy":
        handleDeploy(event.data);
        break;
      case "render":
        await handleRender(event.data);
        break;
      case "action":
        await handleAction(event.data);
        break;
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unknown message type: ${_exhaustive}`);
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const errorPayload: { message: string; stack?: string } = { message: err.message };
    if (err.stack) {
      errorPayload.stack = err.stack;
    }
    self.postMessage({
      type: "error",
      requestId,
      error: errorPayload,
    } satisfies ErrorResponse);
  }
};

function handleDeploy({ compiledCode, manifest, actionNames, requestId }: DeployMessage): void {
  const clientModule = createClientModuleProxy("client");
  const modules: Record<string, unknown> = { react: React, "./client": clientModule };
  const serverModule = evalModule(compiledCode, modules, actionNames);

  deployed = { manifest, serverModule, actionNames };

  self.postMessage({ type: "deployed", requestId } satisfies DeployedResponse);
}

function requireDeployed(): DeployedState {
  if (!deployed) throw new Error("No code deployed");
  return deployed;
}

async function handleRender({ requestId }: RenderMessage): Promise<void> {
  const { manifest, serverModule } = requireDeployed();

  const App = serverModule.default ?? serverModule;
  const element =
    typeof App === "function"
      ? React.createElement(App as React.ComponentType)
      : (App as React.ReactNode);

  const flightStream = renderToReadableStream(element, manifest, {
    onError: (error: unknown) => {
      if (error instanceof Error) return error.message;
      return String(error);
    },
  });

  self.postMessage({ type: "stream-start", requestId } satisfies StreamStartResponse);
  streamToMain(flightStream, requestId);
}

async function handleAction({ actionId, encodedArgs, requestId }: ActionMessage): Promise<void> {
  const { manifest, serverModule } = requireDeployed();

  const actionFn = serverModule[actionId];
  if (typeof actionFn !== "function") {
    throw new Error(`Action "${actionId}" not found`);
  }

  const toDecode = reconstructEncodedArgs(encodedArgs);
  const args = await decodeReply(toDecode, {});
  const argsArray = Array.isArray(args) ? args : [args];
  const result = (await (actionFn as (...args: unknown[]) => Promise<unknown>)(
    ...argsArray,
  )) as React.ReactNode;

  const flightStream = renderToReadableStream(result, manifest, {
    onError: (error: unknown) => {
      if (error instanceof Error) return error.message;
      return String(error);
    },
  });

  self.postMessage({ type: "stream-start", requestId } satisfies StreamStartResponse);
  streamToMain(flightStream, requestId);
}

function reconstructEncodedArgs(encodedArgs: EncodedArgs): FormData | string {
  if (encodedArgs.type === "formdata") {
    const formData = new FormData();
    for (const [key, value] of new URLSearchParams(encodedArgs.data)) {
      formData.append(key, value);
    }
    return formData;
  }
  return encodedArgs.data;
}

function evalModule(
  code: string,
  modules: Record<string, unknown>,
  actionNames: string[] | undefined,
): ServerModule {
  let finalCode = code;
  if (actionNames && actionNames.length > 0) {
    finalCode +=
      "\n" +
      actionNames
        .map(
          (name) =>
            `__registerServerReference(${name}, "${name}", "${name}"); exports.${name} = ${name};`,
        )
        .join("\n");
  }

  const module: { exports: ServerModule } = { exports: {} };
  const require = (id: string): unknown => {
    if (!modules[id]) throw new Error(`Module "${id}" not found`);
    return modules[id];
  };

  const fn = new Function(
    "module",
    "exports",
    "require",
    "React",
    "__registerServerReference",
    finalCode,
  ) as (
    module: { exports: ServerModule },
    exports: ServerModule,
    require: (id: string) => unknown,
    ReactLib: typeof React,
    registerServerRef: typeof registerServerReference,
  ) => void;

  fn(module, module.exports, require, React, registerServerReference);

  return module.exports;
}

self.postMessage({ type: "ready" } satisfies ReadyResponse);
