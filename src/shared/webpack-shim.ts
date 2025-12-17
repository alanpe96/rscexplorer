// Minimal webpack shim for react-server-dom-webpack
// Works in both browser (window) and worker (self) contexts via globalThis

const g = globalThis as Record<string, unknown>;

const moduleCache: Record<string, unknown> = {};

g.__webpack_module_cache__ = moduleCache;

g.__webpack_require__ = function (moduleId: string): unknown {
  const cached = moduleCache[moduleId] as { exports?: unknown } | undefined;
  if (cached) return cached.exports ?? cached;
  throw new Error(`Module ${moduleId} not found`);
};

g.__webpack_chunk_load__ = () => Promise.resolve();

export {};
