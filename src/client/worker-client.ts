import workerUrl from "../server/worker-server.ts?rolldown-worker";
import type { Response, EncodedArgs, Deploy, Render, CallAction } from "../server/worker-server.ts";
import type { ClientManifest } from "../shared/compiler.ts";

export type { EncodedArgs, ClientManifest };

export function encodeArgs(encoded: FormData | string): EncodedArgs {
  if (encoded instanceof FormData) {
    return {
      type: "formdata",
      data: new URLSearchParams(encoded as unknown as Record<string, string>).toString(),
    };
  }
  return { type: "string", data: encoded };
}

export class WorkerClient {
  private worker: Worker;
  private requests = new Map<string, ReadableStreamDefaultController<Uint8Array>>();
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  constructor() {
    this.worker = new Worker(workerUrl);
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = (e) => {
      const err = new Error(e.message || "Worker error");
      for (const controller of this.requests.values()) {
        controller.error(err);
      }
      this.requests.clear();
    };
  }

  private handleMessage(event: MessageEvent<Response>): void {
    const msg = event.data;

    if (msg.type === "ready") {
      this.readyResolve();
      return;
    }

    const controller = this.requests.get(msg.requestId);
    if (!controller) throw new Error(`Unknown request: ${msg.requestId}`);

    switch (msg.type) {
      case "next":
        controller.enqueue(msg.value);
        break;

      case "done":
        controller.close();
        this.requests.delete(msg.requestId);
        break;

      case "throw": {
        const err = new Error(msg.error);
        if (msg.stack) {
          err.stack = msg.stack;
        }
        controller.error(err);
        this.requests.delete(msg.requestId);
        break;
      }
    }
  }

  private nextRequestId = 0;

  private request(body: Record<string, unknown>): ReadableStream<Uint8Array> {
    const requestId = String(this.nextRequestId++);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
      },
    });
    this.requests.set(requestId, controller);
    this.worker.postMessage({ ...body, requestId });
    return stream;
  }

  terminate(): void {
    this.worker.terminate();
    const err = new Error("Worker terminated");
    for (const controller of this.requests.values()) {
      controller.error(err);
    }
    this.requests.clear();
  }

  async deploy(...args: Parameters<Deploy>): Promise<ReturnType<Deploy>> {
    await this.readyPromise;
    return this.request({ method: "deploy", args });
  }

  async render(...args: Parameters<Render>): Promise<ReturnType<Render>> {
    await this.readyPromise;
    return this.request({ method: "render", args });
  }

  async callAction(...args: Parameters<CallAction>): ReturnType<CallAction> {
    await this.readyPromise;
    return this.request({ method: "action", args });
  }
}
