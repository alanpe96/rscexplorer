// Shim webpack globals for react-server-dom-webpack/server in worker context
// Uses self instead of window since this runs in a Web Worker

type WebpackRequire = {
  (moduleId: string): unknown;
  m: Record<string, (module: { exports: unknown }) => void>;
  c: Record<string, unknown>;
  d: (exports: object, definition: Record<string, () => unknown>) => void;
  r: (exports: object) => void;
  o: (obj: object, prop: string) => boolean;
  e: (chunkId: string) => Promise<void>;
  p: string;
};

type WorkerSelf = DedicatedWorkerGlobalScope & {
  __webpack_require__: WebpackRequire;
  __webpack_chunk_load__: (chunkId: string) => Promise<void>;
};

const workerSelf = self as unknown as WorkerSelf;

const moduleCache: Record<string, unknown> = {};

const webpackRequire: WebpackRequire = function (moduleId: string): unknown {
  if (moduleCache[moduleId]) {
    return moduleCache[moduleId];
  }
  throw new Error(`Module ${moduleId} not found in webpack shim`);
} as WebpackRequire;

webpackRequire.m = {};
webpackRequire.c = moduleCache;
webpackRequire.d = function (exports: object, definition: Record<string, () => unknown>): void {
  for (const key in definition) {
    const getter = definition[key];
    if (
      getter &&
      Object.prototype.hasOwnProperty.call(definition, key) &&
      !Object.prototype.hasOwnProperty.call(exports, key)
    ) {
      Object.defineProperty(exports, key, {
        enumerable: true,
        get: getter,
      });
    }
  }
};
webpackRequire.r = function (exports: object): void {
  if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  }
  Object.defineProperty(exports, "__esModule", { value: true });
};
webpackRequire.o = function (obj: object, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};
webpackRequire.e = function (_chunkId: string): Promise<void> {
  return Promise.resolve();
};
webpackRequire.p = "/";

workerSelf.__webpack_require__ = webpackRequire;

workerSelf.__webpack_chunk_load__ = function (_chunkId: string): Promise<void> {
  return Promise.resolve();
};

export {};
