// Shim webpack globals for react-server-dom-webpack/client in browser context

type ModuleFactory = {
  (module: { exports: unknown }): void;
};

type WebpackRequire = {
  (moduleId: string): unknown;
  m: Record<string, ModuleFactory>;
  c: Record<string, { exports: unknown } | unknown>;
  d: (exports: object, definition: Record<string, () => unknown>) => void;
  r: (exports: object) => void;
  o: (obj: object, prop: string) => boolean;
  e: (chunkId: string) => Promise<void>;
  p: string;
};

const clientModuleCache: Record<string, { exports: unknown }> = {};
const clientModuleFactories: Record<string, ModuleFactory> = {};

window.__webpack_module_cache__ = clientModuleCache;
window.__webpack_modules__ = clientModuleFactories;

const clientWebpackRequire: WebpackRequire = function (moduleId: string): unknown {
  const cached = clientModuleCache[moduleId];
  if (cached) {
    return cached.exports ?? cached;
  }
  const factory = clientModuleFactories[moduleId];
  if (factory) {
    const module: { exports: unknown } = { exports: {} };
    factory(module);
    clientModuleCache[moduleId] = module;
    return module.exports;
  }
  throw new Error(`Module ${moduleId} not found in webpack shim`);
} as WebpackRequire;

clientWebpackRequire.m = clientModuleFactories;
clientWebpackRequire.c = clientModuleCache;
clientWebpackRequire.d = function (
  exports: object,
  definition: Record<string, () => unknown>,
): void {
  for (const key in definition) {
    const getter = definition[key];
    if (
      getter &&
      Object.prototype.hasOwnProperty.call(definition, key) &&
      !Object.prototype.hasOwnProperty.call(exports, key)
    ) {
      Object.defineProperty(exports, key, { enumerable: true, get: getter });
    }
  }
};
clientWebpackRequire.r = function (exports: object): void {
  if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  }
  Object.defineProperty(exports, "__esModule", { value: true });
};
clientWebpackRequire.o = function (obj: object, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};
clientWebpackRequire.e = function (_chunkId: string): Promise<void> {
  return Promise.resolve();
};
clientWebpackRequire.p = "/";

window.__webpack_require__ = clientWebpackRequire;

window.__webpack_chunk_load__ = function (_chunkId: string): Promise<void> {
  return Promise.resolve();
};

export {};
