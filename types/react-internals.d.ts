// Internal React types adapted from React source (Flow -> TypeScript)

import type { ReactNode, ReactElement as ReactElementPublic } from "react";

export type ReactKey = string | null;

/** Internal React element structure with $$typeof */
export interface ReactElementInternal {
  $$typeof: symbol;
  type: unknown;
  key: ReactKey;
  ref: unknown;
  props: Record<string, unknown>;
}

/** Lazy element type */
export interface ReactLazy<T = unknown> {
  $$typeof: symbol;
  _payload: unknown;
  _init: (payload: unknown) => T;
}

/** Check if value is a React element (internal) */
export function isReactElement(value: unknown): value is ReactElementInternal;

// Re-export React types we use
export type { ReactNode, ReactElementPublic };
