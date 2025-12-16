// Type declarations for react-server-dom-webpack
// Based on Flow types from React source

declare module "react-server-dom-webpack/server" {
  import type { Thenable, ReactNode } from "react";

  export type TemporaryReferenceSet = Set<unknown>;

  export type ClientManifest = {
    [moduleId: string]: {
      id: string;
      chunks: string[];
      name: string;
    };
  };

  export type ServerManifest = {
    [id: string]: {
      id: string;
      chunks: string[];
      name: string;
    };
  };

  export type RenderOptions = {
    debugChannel?: { readable?: ReadableStream; writable?: WritableStream };
    environmentName?: string | (() => string);
    filterStackFrame?: (url: string, functionName: string) => boolean;
    identifierPrefix?: string;
    signal?: AbortSignal;
    temporaryReferences?: TemporaryReferenceSet;
    onError?: (error: unknown) => void;
  };

  export type StaticResult = {
    prelude: ReadableStream;
  };

  export function renderToReadableStream(
    model: ReactNode,
    webpackMap: ClientManifest,
    options?: RenderOptions,
  ): ReadableStream;

  export function prerender(
    model: ReactNode,
    webpackMap: ClientManifest,
    options?: RenderOptions,
  ): Promise<StaticResult>;

  export function decodeReply<T = unknown>(
    body: string | FormData,
    webpackMap: ServerManifest,
    options?: { temporaryReferences?: TemporaryReferenceSet },
  ): Thenable<T>;

  export function decodeAction<T = unknown>(
    body: FormData,
    serverManifest: ServerManifest,
  ): Promise<() => T> | null;

  export function decodeFormState<S>(
    actionResult: S,
    body: FormData,
    serverManifest: ServerManifest,
  ): Promise<unknown>;

  export function registerServerReference<T extends Function>(
    reference: T,
    id: string,
    exportName: string | null,
  ): T;

  export function registerClientReference<T>(
    proxyImplementation: T,
    id: string,
    exportName: string,
  ): T;

  export function createClientModuleProxy<T = Record<string, unknown>>(moduleId: string): T;

  export function createTemporaryReferenceSet(): TemporaryReferenceSet;
}

declare module "react-server-dom-webpack/client" {
  import type { Thenable } from "react";

  export type TemporaryReferenceSet = Set<unknown>;

  export type CallServerCallback = (id: string, args: unknown[]) => Promise<unknown>;

  export type FindSourceMapURLCallback = (
    fileName: string,
    environmentName: string,
  ) => string | null | undefined;

  export type Options = {
    callServer?: CallServerCallback;
    debugChannel?: { writable?: WritableStream; readable?: ReadableStream };
    temporaryReferences?: TemporaryReferenceSet;
    findSourceMapURL?: FindSourceMapURLCallback;
    replayConsoleLogs?: boolean;
    environmentName?: string;
    startTime?: number;
    endTime?: number;
  };

  export function createFromReadableStream<T = unknown>(
    stream: ReadableStream,
    options?: Options,
  ): Thenable<T>;

  export function createFromFetch<T = unknown>(
    promiseForResponse: Promise<Response>,
    options?: Options,
  ): Thenable<T>;

  export function encodeReply(
    value: unknown,
    options?: { temporaryReferences?: TemporaryReferenceSet; signal?: AbortSignal },
  ): Promise<string | FormData>;

  export function createServerReference<T extends Function>(
    id: string,
    callServer: CallServerCallback,
  ): T;

  export function registerServerReference<T extends Function>(
    reference: T,
    id: string,
    exportName: string | null,
  ): T;

  export function createTemporaryReferenceSet(): TemporaryReferenceSet;
}
