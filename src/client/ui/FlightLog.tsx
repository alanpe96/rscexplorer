import React, { useState, useRef, useEffect, useTransition } from "react";
import { FlightTreeView } from "./TreeView.tsx";
import { Select } from "./Select.tsx";
import type { EntryView } from "../runtime/index.ts";
import "./FlightLog.css";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type RenderLogViewProps = {
  entry: EntryView;
  cursor: number;
};

function RenderLogView({ entry, cursor }: RenderLogViewProps): React.ReactElement | null {
  const activeRef = useRef<HTMLSpanElement>(null);
  const { rows, chunkStart, flightPromise } = entry;

  const nextLineIndex =
    cursor >= chunkStart && cursor < chunkStart + rows.length ? cursor - chunkStart : -1;

  useEffect(() => {
    if (activeRef.current && document.hasFocus()) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [nextLineIndex]);

  if (rows.length === 0) return null;

  const getLineClass = (i: number): string => {
    const globalChunk = chunkStart + i;
    if (globalChunk < cursor) return "FlightLog-line--done";
    if (globalChunk === cursor) return "FlightLog-line--next";
    return "FlightLog-line--pending";
  };

  const showTree = cursor >= chunkStart;

  return (
    <div className="FlightLog-renderView">
      <div className="FlightLog-renderView-split">
        <div className="FlightLog-linesWrapper">
          <pre className="FlightLog-lines">
            {rows.map((line, i) => {
              const isCurrent = i === nextLineIndex;
              return (
                <span
                  key={i}
                  ref={isCurrent ? activeRef : null}
                  className={`FlightLog-line ${getLineClass(i)}`}
                  data-testid="flight-line"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {escapeHtml(line)}
                </span>
              );
            })}
          </pre>
        </div>
        <div className="FlightLog-tree" data-testid="flight-tree">
          {showTree && <FlightTreeView flightPromise={flightPromise ?? null} inEntry />}
        </div>
      </div>
    </div>
  );
}

type FlightLogEntryProps = {
  entry: EntryView;
  index: number;
  cursor: number;
  onDelete: (index: number) => void;
};

function FlightLogEntry({
  entry,
  index,
  cursor,
  onDelete,
}: FlightLogEntryProps): React.ReactElement {
  const hasError = entry.error !== null;
  const modifierClass = hasError
    ? "FlightLog-entry--error"
    : entry.isActive
      ? "FlightLog-entry--active"
      : entry.isDone
        ? "FlightLog-entry--done"
        : "FlightLog-entry--pending";

  return (
    <div className={`FlightLog-entry ${modifierClass}`} data-testid="flight-entry">
      <div className="FlightLog-entry-header">
        <span className="FlightLog-entry-label">
          {entry.type === "render" ? "Render" : `Action: ${entry.name}`}
        </span>
        <span className="FlightLog-entry-headerRight">
          {entry.canDelete && (
            <button
              className="FlightLog-entry-deleteBtn"
              onClick={() => onDelete(index)}
              title="Delete"
              aria-label="Delete entry"
            >
              ×
            </button>
          )}
        </span>
      </div>
      {entry.type === "action" && entry.args && (
        <div className="FlightLog-entry-request">
          <pre className="FlightLog-entry-requestArgs">{entry.args}</pre>
        </div>
      )}
      {hasError ? (
        <div className="FlightLog-entry-error" data-testid="flight-entry-error">
          <pre className="FlightLog-entry-errorMessage">{entry.error!.message}</pre>
        </div>
      ) : (
        <RenderLogView entry={entry} cursor={cursor} />
      )}
    </div>
  );
}

type FlightLogProps = {
  entries: EntryView[];
  cursor: number;
  availableActions: string[];
  onAddRawAction: (actionName: string, rawPayload: string) => Promise<void>;
  onDeleteEntry: (index: number) => void;
};

export function FlightLog({
  entries,
  cursor,
  availableActions,
  onAddRawAction,
  onDeleteEntry,
}: FlightLogProps): React.ReactElement {
  const logRef = useRef<HTMLDivElement>(null);
  const [showRawInput, setShowRawInput] = useState(false);
  const [selectedAction, setSelectedAction] = useState("");
  const [rawPayload, setRawPayload] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAddRaw = (): void => {
    if (rawPayload.trim()) {
      startTransition(async () => {
        try {
          await onAddRawAction(selectedAction, rawPayload);
        } catch {
          // Error entry added to timeline
        }
        startTransition(() => {
          setSelectedAction(availableActions[0] ?? "");
          setRawPayload("");
          setShowRawInput(false);
        });
      });
    }
  };

  const handleShowRawInput = (): void => {
    setSelectedAction(availableActions[0] ?? "");
    setShowRawInput(true);
  };

  if (entries.length === 0) {
    return (
      <div className="FlightLog-output">
        <span className="FlightLog-empty FlightLog-empty--waiting">Loading</span>
      </div>
    );
  }

  return (
    <div className="FlightLog" ref={logRef}>
      {entries.map((entry, i) => (
        <FlightLogEntry key={i} entry={entry} index={i} cursor={cursor} onDelete={onDeleteEntry} />
      ))}
      {availableActions.length > 0 &&
        (showRawInput ? (
          <div className="FlightLog-rawForm">
            <Select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              disabled={isPending}
            >
              {availableActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
            <textarea
              placeholder="Paste a request payload from a real action"
              value={rawPayload}
              onChange={(e) => setRawPayload(e.target.value)}
              className="FlightLog-rawForm-textarea"
              rows={6}
              disabled={isPending}
            />
            <div className="FlightLog-rawForm-buttons">
              <button
                className="FlightLog-rawForm-submitBtn"
                onClick={handleAddRaw}
                disabled={!rawPayload.trim() || isPending}
              >
                {isPending ? "Adding..." : "Add"}
              </button>
              <button
                className="FlightLog-rawForm-cancelBtn"
                onClick={() => setShowRawInput(false)}
                disabled={isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="FlightLog-addButton-wrapper">
            <button
              className="FlightLog-addButton"
              onClick={handleShowRawInput}
              title="Add action"
              aria-label="Add action"
            >
              +
            </button>
          </div>
        ))}
    </div>
  );
}
