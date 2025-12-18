// Safari doesn't implement ReadableByteStreamController.
// Only load the polyfill when needed.
export const polyfillReady: Promise<void> =
  typeof globalThis.ReadableByteStreamController === "undefined"
    ? import("web-streams-polyfill").then(({ ReadableStream }) => {
        globalThis.ReadableStream = ReadableStream as typeof globalThis.ReadableStream;
      })
    : Promise.resolve();
