import React, { useState, useRef, useEffect } from "react";
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
    if (globalChunk < cursor) return "RenderLogView-line--done";
    if (globalChunk === cursor) return "RenderLogView-line--next";
    return "RenderLogView-line--pending";
  };

  const showTree = cursor >= chunkStart;

  return (
    <div className="RenderLogView">
      <div className="RenderLogView-split">
        <div className="RenderLogView-linesWrapper">
          <pre className="RenderLogView-lines">
            {rows.map((line, i) => (
              <span
                key={i}
                ref={i === nextLineIndex ? activeRef : null}
                className={`RenderLogView-line ${getLineClass(i)}`}
              >
                {escapeHtml(line)}
              </span>
            ))}
          </pre>
        </div>
        <div className="RenderLogView-tree">
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
  const modifierClass = entry.isActive
    ? "FlightLogEntry--active"
    : entry.isDone
      ? "FlightLogEntry--done"
      : "FlightLogEntry--pending";

  return (
    <div className={`FlightLogEntry ${modifierClass}`}>
      <div className="FlightLogEntry-header">
        <span className="FlightLogEntry-label">
          {entry.type === "render" ? "Render" : `Action: ${entry.name}`}
        </span>
        <span className="FlightLogEntry-headerRight">
          {entry.canDelete && (
            <button
              className="FlightLogEntry-deleteBtn"
              onClick={() => onDelete(index)}
              title="Delete"
            >
              ×
            </button>
          )}
        </span>
      </div>
      {entry.type === "action" && entry.args && (
        <div className="FlightLogEntry-request">
          <pre className="FlightLogEntry-requestArgs">{entry.args}</pre>
        </div>
      )}
      <RenderLogView entry={entry} cursor={cursor} />
    </div>
  );
}

type FlightLogProps = {
  entries: EntryView[];
  cursor: number;
  availableActions: string[];
  onAddRawAction: (actionName: string, rawPayload: string) => void;
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

  const handleAddRaw = (): void => {
    if (rawPayload.trim()) {
      onAddRawAction(selectedAction, rawPayload);
      setSelectedAction(availableActions[0] ?? "");
      setRawPayload("");
      setShowRawInput(false);
    }
  };

  const handleShowRawInput = (): void => {
    setSelectedAction(availableActions[0] ?? "");
    setShowRawInput(true);
  };

  if (entries.length === 0) {
    return (
      <div className="FlightLog-output">
        <span className="FlightLog-empty FlightLog-empty--waiting">Compiling</span>
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
          <div className="RawActionForm">
            <Select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
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
              className="RawActionForm-textarea"
              rows={6}
            />
            <div className="RawActionForm-buttons">
              <button
                className="RawActionForm-submitBtn"
                onClick={handleAddRaw}
                disabled={!rawPayload.trim()}
              >
                Add
              </button>
              <button className="RawActionForm-cancelBtn" onClick={() => setShowRawInput(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="AddActionButton-wrapper">
            <button className="AddActionButton" onClick={handleShowRawInput} title="Add action">
              +
            </button>
          </div>
        ))}
    </div>
  );
}
