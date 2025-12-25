import {
  createFromReadableStream,
  type CallServerCallback as ImportedCallServerCallback,
} from "react-server-dom-webpack/client";
import { parseRows, type ParsedRow } from "./flight-parser.ts";

export type CallServerCallback = ImportedCallServerCallback;

export interface Thenable<T> {
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export interface SteppableStreamOptions {
  callServer?: CallServerCallback;
}

const noop = () => {};

function wrapParseError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  return new Error(`RSC Explorer could not parse the React output into rows: ${msg}`);
}

interface Row {
  display: string;
  bytes: Uint8Array;
  hexStart: number;
}

export class SteppableStream {
  rows: Row[] = [];
  done = false;
  error: Error | null = null;
  flightPromise: Thenable<unknown>;

  private controller!: ReadableStreamDefaultController<Uint8Array>;
  private releasedCount = 0;
  private closed = false;
  private yieldIndex = 0;
  private ping = noop;
  private decoder = new TextDecoder("utf-8", { fatal: false });

  constructor(source: ReadableStream<Uint8Array>, options: SteppableStreamOptions = {}) {
    const { callServer } = options;

    const output = new ReadableStream<Uint8Array>({
      start: (c) => {
        this.controller = c;
      },
    });

    const streamOptions = callServer ? { callServer } : {};
    this.flightPromise = createFromReadableStream(output, streamOptions);
    this.consumeSource(source);
  }

  release(count: number): void {
    if (this.closed) return;

    while (this.releasedCount < count && this.releasedCount < this.rows.length) {
      this.controller.enqueue(this.rows[this.releasedCount]!.bytes);
      this.releasedCount++;
    }

    this.maybeClose();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<string> {
    while (true) {
      while (this.yieldIndex < this.rows.length) {
        yield this.rows[this.yieldIndex++]!.display;
      }
      if (this.error) throw this.error;
      if (this.done) return;

      await new Promise<void>((resolve) => {
        this.ping = resolve;
      });
      this.ping = noop;
    }
  }

  private async consumeSource(source: ReadableStream<Uint8Array>): Promise<void> {
    const reader = source.getReader();
    let buffer: Uint8Array = new Uint8Array(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;

        let result;
        try {
          result = parseRows(buffer, false);
        } catch (err) {
          throw wrapParseError(err);
        }
        for (const row of result.rows) {
          const formatted = this.formatRow(row);
          if (formatted) {
            this.rows.push(formatted);
          }
        }
        buffer = result.remainder;
        this.ping();
      }

      if (buffer.length > 0) {
        let result;
        try {
          result = parseRows(buffer, true);
        } catch (err) {
          throw wrapParseError(err);
        }
        for (const row of result.rows) {
          const formatted = this.formatRow(row);
          if (formatted) {
            this.rows.push(formatted);
          }
        }
      }
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
    } finally {
      this.done = true;
      this.ping();
      this.maybeClose();
    }
  }

  private formatRow(parsed: ParsedRow): Row | null {
    const { segment, raw } = parsed;

    if (segment.type === "text") {
      const headerLen = raw.length - segment.data.length - 1; // -1 for newline
      const header = this.decoder.decode(raw.slice(0, headerLen));
      const content = this.decoder.decode(segment.data);
      const display = (header + content).trim();
      if (!display) return null;
      return { display, bytes: raw, hexStart: -1 };
    }

    const header = this.decoder.decode(raw.slice(0, raw.length - segment.data.length));
    const maxPreview = 16;
    const previewLen = Math.min(segment.data.length, maxPreview);
    const hex = Array.from(segment.data.slice(0, previewLen))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const ellipsis = segment.data.length > maxPreview ? "..." : "";
    const display = header + hex + ellipsis;
    if (!display.trim()) return null;
    return { display, bytes: raw, hexStart: header.length };
  }

  private maybeClose(): void {
    if (this.closed) return;
    if (this.done && this.releasedCount >= this.rows.length) {
      this.closed = true;
      if (this.error) {
        this.controller.error(this.error);
      } else {
        this.controller.close();
      }
    }
  }
}
