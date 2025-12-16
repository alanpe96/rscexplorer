import workerUrl from "../server/worker.ts?rolldown-worker";
import type { ClientManifest } from "../shared/compiler.ts";

const randomUUID: () => string =
  crypto.randomUUID?.bind(crypto) ??
  function (): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 1
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  };

type EncodedArgsFormData = {
  type: "formdata";
  data: string;
};

type EncodedArgsString = {
  type: "string";
  data: string;
};

type EncodedArgsTransfer = EncodedArgsFormData | EncodedArgsString;

function serializeForTransfer(encoded: FormData | string): EncodedArgsTransfer {
  if (encoded instanceof FormData) {
    return {
      type: "formdata",
      data: new URLSearchParams(encoded as unknown as Record<string, string>).toString(),
    };
  }
  return { type: "string", data: encoded };
}

type WorkerReadyMessage = {
  type: "ready";
};

type WorkerStreamStartMessage = {
  type: "stream-start";
  requestId: string;
};

type WorkerStreamChunkMessage = {
  type: "stream-chunk";
  requestId: string;
  chunk: Uint8Array;
};

type WorkerStreamEndMessage = {
  type: "stream-end";
  requestId: string;
};

type WorkerStreamErrorMessage = {
  type: "stream-error";
  requestId: string;
  error: { message: string };
};

type WorkerDeployedMessage = {
  type: "deployed";
  requestId: string;
};

type WorkerErrorMessage = {
  type: "error";
  requestId: string;
  error: { message: string; stack?: string };
};

type WorkerMessage =
  | WorkerReadyMessage
  | WorkerStreamStartMessage
  | WorkerStreamChunkMessage
  | WorkerStreamEndMessage
  | WorkerStreamErrorMessage
  | WorkerDeployedMessage
  | WorkerErrorMessage;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class ServerWorker {
  private worker: Worker;
  private pending: Map<string, PendingRequest> = new Map();
  private streams: Map<string, ReadableStreamDefaultController<Uint8Array>> = new Map();
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  constructor() {
    this.worker = new Worker(workerUrl);
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
  }

  private handleMessage(event: MessageEvent<WorkerMessage>): void {
    const { type } = event.data;

    if (type === "ready") {
      this.readyResolve();
      return;
    }

    if (type === "stream-start") {
      const { requestId } = event.data;
      const pending = this.pending.get(requestId);
      if (!pending) return;
      this.pending.delete(requestId);

      let controller: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start: (c) => {
          controller = c;
        },
      });
      this.streams.set(requestId, controller!);
      pending.resolve(stream);
      return;
    }

    if (type === "stream-chunk") {
      const { requestId, chunk } = event.data;
      const controller = this.streams.get(requestId);
      if (controller) controller.enqueue(chunk);
      return;
    }

    if (type === "stream-end") {
      const { requestId } = event.data;
      const controller = this.streams.get(requestId);
      if (controller) {
        controller.close();
        this.streams.delete(requestId);
      }
      return;
    }

    if (type === "stream-error") {
      const { requestId, error } = event.data;
      const controller = this.streams.get(requestId);
      if (controller) {
        controller.error(new Error(error.message));
        this.streams.delete(requestId);
      }
      return;
    }

    if (type === "deployed") {
      const { requestId } = event.data as WorkerDeployedMessage;
      const pending = this.pending.get(requestId);
      if (!pending) {
        console.warn(`No pending request for ${requestId}`);
        return;
      }
      this.pending.delete(requestId);
      pending.resolve(undefined);
      return;
    }

    if (type === "error") {
      const { requestId, error } = event.data as WorkerErrorMessage;
      const pending = this.pending.get(requestId);
      if (!pending) {
        console.warn(`No pending request for ${requestId}`);
        return;
      }
      this.pending.delete(requestId);
      const err = new Error(error.message);
      if (error.stack) {
        err.stack = error.stack;
      }
      pending.reject(err);
    }
  }

  private handleError(event: ErrorEvent): void {
    const errorMsg = event.message || "Unknown worker error";
    console.error(`Worker error: ${errorMsg}`);

    for (const [, pending] of this.pending) {
      pending.reject(new Error(`Worker error: ${errorMsg}`));
    }
    this.pending.clear();
  }

  async deploy({
    compiledCode,
    manifest,
    actionNames,
  }: {
    compiledCode: string;
    manifest: ClientManifest;
    actionNames: string[];
  }): Promise<void> {
    await this.readyPromise;
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({
        type: "deploy",
        requestId,
        compiledCode,
        manifest,
        actionNames,
      });
    });
  }

  async render(): Promise<ReadableStream<Uint8Array>> {
    await this.readyPromise;
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({ type: "render", requestId });
    });
  }

  async callAction(
    actionId: string,
    encodedArgs: FormData | string,
  ): Promise<ReadableStream<Uint8Array>> {
    await this.readyPromise;
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({
        type: "action",
        requestId,
        actionId,
        encodedArgs: serializeForTransfer(encodedArgs),
      });
    });
  }

  async callActionRaw(actionId: string, rawPayload: string): Promise<ReadableStream<Uint8Array>> {
    await this.readyPromise;
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({
        type: "action",
        requestId,
        actionId,
        encodedArgs: { type: "formdata", data: rawPayload },
      });
    });
  }

  terminate(): void {
    this.worker.terminate();
    for (const [, pending] of this.pending) {
      pending.reject(new Error("Worker terminated"));
    }
    this.pending.clear();
    for (const [, controller] of this.streams) {
      controller.error(new Error("Worker terminated"));
    }
    this.streams.clear();
  }
}
