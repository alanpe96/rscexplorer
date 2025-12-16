// Global type declarations

// Rolldown worker import pattern
declare module "*?rolldown-worker" {
  const workerUrl: string;
  export default workerUrl;
}

// Allow importing JSON modules
declare module "*.json" {
  const value: unknown;
  export default value;
}

// Webpack shim globals for client-side (window context)
// Note: interface required here for declaration merging with global Window
interface Window {
  __webpack_module_cache__: Record<string, { exports: unknown }>;
  __webpack_modules__: Record<string, (module: { exports: unknown }) => void>;
  __webpack_require__: WebpackRequire;
  __webpack_chunk_load__: (chunkId: string) => Promise<void>;
}

// Webpack shim globals for worker context (self/globalThis)
declare const __webpack_module_cache__: Record<string, { exports: unknown }>;

type WebpackRequire = {
  (moduleId: string): unknown;
  m: Record<string, (module: { exports: unknown }) => void>;
  c: Record<string, { exports: unknown } | unknown>;
  d: (exports: object, definition: Record<string, () => unknown>) => void;
  r: (exports: object) => void;
  o: (obj: object, prop: string) => boolean;
  e: (chunkId: string) => Promise<void>;
  p: string;
};

// Worker global context extensions
type WorkerGlobalScope = {
  __webpack_require__: WebpackRequire;
  __webpack_chunk_load__: (chunkId: string) => Promise<void>;
};

// Extend globalThis for worker context
declare namespace globalThis {
  let ReadableStream: typeof globalThis.ReadableStream;
  let ReadableByteStreamController: typeof globalThis.ReadableByteStreamController;
}

// Vite environment
type ImportMeta = {
  readonly env: {
    readonly PROD: boolean;
    readonly DEV: boolean;
    readonly MODE: string;
  };
  readonly hot?: {
    accept: (callback?: () => void) => void;
  };
};
