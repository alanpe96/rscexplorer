import type { SteppableStream } from "./steppable-stream.ts";

/**
 * Timeline - manages a sequence of Flight responses for debugging.
 *
 * Each entry owns its SteppableStream(s). The cursor controls playback.
 * Stepping releases data to streams; I/O is handled externally.
 *
 * Entry types:
 * - render: { type, stream } - initial render
 * - action: { type, name, args, stream } - action invoked from client or added manually
 */

export interface RenderEntry {
  type: "render";
  stream: SteppableStream;
}

export interface ActionEntry {
  type: "action";
  name: string;
  args: string;
  stream: SteppableStream;
}

export type TimelineEntry = RenderEntry | ActionEntry;

export interface TimelineSnapshot {
  entries: TimelineEntry[];
  cursor: number;
  totalChunks: number;
  isAtStart: boolean;
  isAtEnd: boolean;
}

export interface TimelinePosition {
  entryIndex: number;
  localChunk: number;
}

type TimelineListener = () => void;

export class Timeline {
  entries: TimelineEntry[] = [];
  cursor = 0;
  private listeners: Set<TimelineListener> = new Set();
  private snapshot: TimelineSnapshot | null = null;

  subscribe = (listener: TimelineListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    this.snapshot = null; // Invalidate cache
    this.listeners.forEach((fn) => fn());
  }

  getChunkCount(entry: TimelineEntry): number {
    return entry.stream.rows.length;
  }

  getTotalChunks(): number {
    return this.entries.reduce((sum, e) => sum + this.getChunkCount(e), 0);
  }

  getPosition(globalChunk: number): TimelinePosition | null {
    let remaining = globalChunk;
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (!entry) continue;
      const count = this.getChunkCount(entry);
      if (remaining < count) {
        return { entryIndex: i, localChunk: remaining };
      }
      remaining -= count;
    }
    return null;
  }

  getEntryStart(entryIndex: number): number {
    let start = 0;
    for (let i = 0; i < entryIndex; i++) {
      const entry = this.entries[i];
      if (entry) {
        start += this.getChunkCount(entry);
      }
    }
    return start;
  }

  canDeleteEntry(entryIndex: number): boolean {
    if (entryIndex < 0 || entryIndex >= this.entries.length) return false;
    return this.cursor <= this.getEntryStart(entryIndex);
  }

  // For useSyncExternalStore compatibility - must return cached object
  getSnapshot = (): TimelineSnapshot => {
    if (this.snapshot) return this.snapshot;

    const totalChunks = this.getTotalChunks();
    this.snapshot = {
      entries: this.entries,
      cursor: this.cursor,
      totalChunks,
      isAtStart: this.cursor === 0,
      isAtEnd: this.cursor >= totalChunks,
    };
    return this.snapshot;
  };

  setRender(stream: SteppableStream): void {
    this.entries = [{ type: "render", stream }];
    this.cursor = 0;
    this.notify();
  }

  addAction(name: string, args: string, stream: SteppableStream): void {
    this.entries = [...this.entries, { type: "action", name, args, stream }];
    this.notify();
  }

  deleteEntry(entryIndex: number): boolean {
    if (!this.canDeleteEntry(entryIndex)) return false;
    this.entries = this.entries.filter((_, i) => i !== entryIndex);
    this.notify();
    return true;
  }

  stepForward(): void {
    const total = this.getTotalChunks();
    if (this.cursor >= total) return;

    const pos = this.getPosition(this.cursor);
    if (!pos) return;

    const entry = this.entries[pos.entryIndex];
    if (!entry) return;

    this.cursor++;
    entry.stream.release(pos.localChunk + 1);

    this.notify();
  }

  skipToEntryEnd(): void {
    const pos = this.getPosition(this.cursor);
    if (!pos) return;

    const entry = this.entries[pos.entryIndex];
    if (!entry) return;

    const entryEnd = this.getEntryStart(pos.entryIndex) + this.getChunkCount(entry);
    while (this.cursor < entryEnd) {
      this.stepForward();
    }
  }

  clear(): void {
    this.entries = [];
    this.cursor = 0;
    this.notify();
  }
}
