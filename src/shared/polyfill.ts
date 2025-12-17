import { ReadableStream as PolyfillReadableStream } from "web-streams-polyfill";

// Safari doesn't implement ReadableByteStreamController.
if (typeof globalThis.ReadableByteStreamController === "undefined") {
  globalThis.ReadableStream = PolyfillReadableStream as typeof ReadableStream;
}
