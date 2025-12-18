import React, { useState, useEffect, useSyncExternalStore, startTransition } from "react";
import { WorkspaceSession } from "../workspace-session.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { FlightLog } from "./FlightLog.tsx";
import { LivePreview } from "./LivePreview.tsx";
import "./Workspace.css";

type WorkspaceProps = {
  initialServerCode: string;
  initialClientCode: string;
  onCodeChange?: (server: string, client: string) => void;
};

export function Workspace({
  initialServerCode,
  initialClientCode,
  onCodeChange,
}: WorkspaceProps): React.ReactElement {
  const [serverCode, setServerCode] = useState(initialServerCode);
  const [clientCode, setClientCode] = useState(initialClientCode);
  const [resetKey, setResetKey] = useState(0);
  const [session, setSession] = useState<WorkspaceSession | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    WorkspaceSession.create(serverCode, clientCode, abort.signal).then((nextSession) => {
      if (!abort.signal.aborted) {
        startTransition(() => {
          setSession(nextSession);
        });
      }
    });
    return () => abort.abort();
  }, [serverCode, clientCode, resetKey]);

  function handleServerChange(code: string) {
    setServerCode(code);
    onCodeChange?.(code, clientCode);
  }

  function handleClientChange(code: string) {
    setClientCode(code);
    onCodeChange?.(serverCode, code);
  }

  function reset() {
    setResetKey((k) => k + 1);
  }

  return (
    <main className="Workspace">
      <CodeEditor
        label="server"
        defaultValue={serverCode}
        onChange={handleServerChange}
        paneClass="Workspace-pane--server"
      />
      <CodeEditor
        label="client"
        defaultValue={clientCode}
        onChange={handleClientChange}
        paneClass="Workspace-pane--client"
      />
      {session ? (
        <WorkspaceContent session={session} onReset={reset} key={session.id} />
      ) : (
        <WorkspaceLoading />
      )}
    </main>
  );
}

function WorkspaceLoading(): React.ReactElement {
  return (
    <>
      <div className="Workspace-pane Workspace-pane--flight">
        <div className="Workspace-paneHeader">flight</div>
        <div className="WorkspaceLoading-output">
          <span className="WorkspaceLoading-empty WorkspaceLoading-empty--waiting">Compiling</span>
        </div>
      </div>
      <div className="Workspace-pane Workspace-pane--preview">
        <div className="Workspace-paneHeader">preview</div>
        <div className="WorkspaceLoading-preview">
          <span className="WorkspaceLoading-empty WorkspaceLoading-empty--waiting">Compiling</span>
        </div>
      </div>
    </>
  );
}

type WorkspaceContentProps = {
  session: WorkspaceSession;
  onReset: () => void;
};

function WorkspaceContent({ session, onReset }: WorkspaceContentProps): React.ReactElement {
  const { entries, cursor, totalChunks, isAtStart, isAtEnd } = useSyncExternalStore(
    session.timeline.subscribe,
    session.timeline.getSnapshot,
  );

  if (session.state.status === "error") {
    return (
      <>
        <div className="Workspace-pane Workspace-pane--flight">
          <div className="Workspace-paneHeader">flight</div>
          <pre className="FlightLog-output FlightLog-output--error">{session.state.message}</pre>
        </div>
        <div className="Workspace-pane Workspace-pane--preview">
          <div className="Workspace-paneHeader">preview</div>
          <div className="LivePreview-container">
            <span className="LivePreview-empty LivePreview-empty--error">Compilation error</span>
          </div>
        </div>
      </>
    );
  }

  const { availableActions } = session.state;

  return (
    <>
      <div className="Workspace-pane Workspace-pane--flight">
        <div className="Workspace-paneHeader">flight</div>
        <FlightLog
          entries={entries}
          cursor={cursor}
          availableActions={availableActions}
          onAddRawAction={(name, payload) => session.addRawAction(name, payload)}
          onDeleteEntry={(idx) => session.timeline.deleteEntry(idx)}
        />
      </div>
      <LivePreview
        entries={entries}
        cursor={cursor}
        totalChunks={totalChunks}
        isAtStart={isAtStart}
        isAtEnd={isAtEnd}
        onStep={() => session.timeline.stepForward()}
        onSkip={() => session.timeline.skipToEntryEnd()}
        onReset={onReset}
      />
    </>
  );
}
