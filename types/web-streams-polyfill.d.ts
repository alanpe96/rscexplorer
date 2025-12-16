// Type declarations for web-streams-polyfill specific exports

declare module "web-streams-polyfill" {
  export const ReadableStream: {
    new <R = unknown>(
      underlyingSource?: UnderlyingSource<R>,
      strategy?: QueuingStrategy<R>,
    ): ReadableStream<R>;
    prototype: ReadableStream;
  };
  // ReadableByteStreamController is an internal class, we type it loosely
  export const ReadableByteStreamController: unknown;
  export const WritableStream: typeof globalThis.WritableStream;
  export const TransformStream: typeof globalThis.TransformStream;
}

declare module "web-streams-polyfill/polyfill" {
  // Side-effect only import that polyfills globals
}
