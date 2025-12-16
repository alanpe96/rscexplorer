import React from "react";

declare const __webpack_module_cache__: Record<string, { exports: unknown }>;

export function registerClientModule(moduleId: string, moduleExports: unknown): void {
  if (typeof __webpack_module_cache__ !== "undefined") {
    __webpack_module_cache__[moduleId] = { exports: moduleExports };
  }
}

type ModuleExports = Record<string, unknown>;
type RequireFn = (id: string) => unknown;

export function evaluateClientModule(compiledCode: string): ModuleExports {
  const module: { exports: ModuleExports } = { exports: {} };
  const require: RequireFn = (id: string): unknown => {
    if (id === "react") return React;
    throw new Error(`Module "${id}" not found in client context`);
  };
  const fn = new Function("module", "exports", "require", "React", compiledCode) as (
    module: { exports: ModuleExports },
    exports: ModuleExports,
    require: RequireFn,
    ReactLib: typeof React,
  ) => void;
  fn(module, module.exports, require, React);
  return module.exports;
}
