import {
  createFromReadableStream,
  type CallServerCallback as ImportedCallServerCallback,
} from "react-server-dom-webpack/client";

export type CallServerCallback = ImportedCallServerCallback;

// React's Thenable type (not exported from react package)
export interface Thenable<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export interface SteppableStreamOptions {
  callServer?: CallServerCallback;
}

/**
 * SteppableStream - makes a Flight stream steppable for debugging.
 *
 * Buffers incoming rows and controls their release to the Flight decoder.
 * The flightPromise only resolves when all rows have been released.
 */
export class SteppableStream {
  rows: string[] = [];
  releasedCount = 0;
  buffered = false;
  closed = false;
  release: (count: number) => void;
  flightPromise: Thenable<unknown>;
  bufferPromise: Promise<void>;

  constructor(source: ReadableStream<Uint8Array>, options: SteppableStreamOptions = {}) {
    const { callServer } = options;

    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const output = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
      },
    });

    this.release = (count: number): void => {
      while (this.releasedCount < count && this.releasedCount < this.rows.length) {
        const row = this.rows[this.releasedCount];
        if (row !== undefined) {
          controller.enqueue(encoder.encode(row + "\n"));
        }
        this.releasedCount++;
      }
      if (this.releasedCount >= this.rows.length && this.buffered && !this.closed) {
        controller.close();
        this.closed = true;
      }
    };

    const streamOptions = callServer ? { callServer } : {};
    this.flightPromise = createFromReadableStream(output, streamOptions);
    this.bufferPromise = this.buffer(source);
  }

  private async buffer(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let partial = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        partial += decoder.decode(value, { stream: true });
        const lines = partial.split("\n");
        partial = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) this.rows.push(line);
        }
      }

      partial += decoder.decode();
      if (partial.trim()) this.rows.push(partial);
    } finally {
      this.buffered = true;
    }
  }

  async waitForBuffer(): Promise<void> {
    await this.bufferPromise;
  }
}
