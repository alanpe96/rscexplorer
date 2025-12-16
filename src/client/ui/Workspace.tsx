import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { encodeReply } from "react-server-dom-webpack/client";
import {
  Timeline,
  SteppableStream,
  registerClientModule,
  evaluateClientModule,
  type CallServerCallback,
} from "../runtime/index.ts";
import { ServerWorker } from "../server-worker.ts";
import {
  parseClientModule,
  parseServerActions,
  compileToCommonJS,
  buildManifest,
} from "../../shared/compiler.ts";
import { CodeEditor } from "./CodeEditor.tsx";
import { FlightLog } from "./FlightLog.tsx";
import { LivePreview } from "./LivePreview.tsx";

type WorkspaceProps = {
  initialServerCode: string;
  initialClientCode: string;
  onCodeChange?: (server: string, client: string) => void;
};

type CallServerRef = {
  current: ((actionId: string, args: unknown[]) => Promise<unknown>) | null;
};

export function Workspace({
  initialServerCode,
  initialClientCode,
  onCodeChange,
}: WorkspaceProps): React.ReactElement {
  const [serverCode, setServerCode] = useState(initialServerCode);
  const [clientCode, setClientCode] = useState(initialClientCode);
  const [serverWorker] = useState(() => new ServerWorker());
  const [timeline] = useState(() => new Timeline());
  const [callServerRef] = useState<CallServerRef>({ current: null });

  const snapshot = useSyncExternalStore(timeline.subscribe, timeline.getSnapshot);
  const { entries, cursor, totalChunks, isAtStart, isAtEnd } = snapshot;

  const [clientModuleReady, setClientModuleReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const compileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleServerChange = (code: string): void => {
    setServerCode(code);
    onCodeChange?.(code, clientCode);
  };

  const handleClientChange = (code: string): void => {
    setClientCode(code);
    onCodeChange?.(serverCode, code);
  };

  const handleStep = useCallback(() => {
    timeline.stepForward();
  }, [timeline]);

  const handleSkip = useCallback(() => {
    timeline.skipToEntryEnd();
  }, [timeline]);

  const handleAddRawAction = useCallback(
    async (actionName: string, rawPayload: string) => {
      try {
        const responseRaw = await serverWorker.callActionRaw(actionName, rawPayload);
        const streamOptions = callServerRef.current ? { callServer: callServerRef.current } : {};
        const stream = new SteppableStream(responseRaw, streamOptions);
        await stream.waitForBuffer();
        timeline.addAction(actionName, rawPayload, stream);
      } catch (err) {
        console.error("[raw action] Failed:", err);
      }
    },
    [serverWorker, timeline, callServerRef],
  );

  const compile = useCallback(
    async (sCode: string, cCode: string) => {
      try {
        setError(null);
        timeline.clear();

        const clientExports = parseClientModule(cCode);
        const manifest = buildManifest("client", clientExports);
        const compiledClient = compileToCommonJS(cCode);
        const clientModule = evaluateClientModule(compiledClient);
        registerClientModule("client", clientModule);

        const actionNames = parseServerActions(sCode);
        const compiledServer = compileToCommonJS(sCode);
        setAvailableActions(actionNames);

        await serverWorker.deploy({
          compiledCode: compiledServer,
          manifest,
          actionNames,
        });

        const callServer: CallServerCallback | null =
          actionNames.length > 0
            ? async (actionId: string, args: unknown[]): Promise<unknown> => {
                const actionName = actionId.split("#")[0] ?? actionId;
                const encodedArgs = await encodeReply(args);
                const argsDisplay =
                  typeof encodedArgs === "string"
                    ? `0=${encodedArgs}`
                    : new URLSearchParams(
                        encodedArgs as unknown as Record<string, string>,
                      ).toString();

                const responseRaw = await serverWorker.callAction(actionName, encodedArgs);
                const stream = new SteppableStream(responseRaw, {
                  callServer: callServer as CallServerCallback,
                });
                await stream.waitForBuffer();
                timeline.addAction(actionName, argsDisplay, stream);
                return stream.flightPromise;
              }
            : null;

        callServerRef.current = callServer;

        const renderRaw = await serverWorker.render();
        const renderStreamOptions = callServer ? { callServer } : {};
        const renderStream = new SteppableStream(renderRaw, renderStreamOptions);
        await renderStream.waitForBuffer();

        timeline.setRender(renderStream);
        setClientModuleReady(true);
      } catch (err) {
        console.error("[compile] Error:", err);
        setError(err instanceof Error ? err.message : String(err));
        timeline.clear();
        setClientModuleReady(false);
      }
    },
    [timeline, serverWorker, callServerRef],
  );

  const handleReset = useCallback(() => {
    compile(serverCode, clientCode);
  }, [compile, serverCode, clientCode]);

  useEffect(() => {
    if (compileTimeoutRef.current) {
      clearTimeout(compileTimeoutRef.current);
    }
    compileTimeoutRef.current = setTimeout(() => {
      compile(serverCode, clientCode);
    }, 300);
  }, [serverCode, clientCode, compile]);

  useEffect(() => {
    return () => serverWorker.terminate();
  }, [serverWorker]);

  return (
    <main>
      <CodeEditor label="server" defaultValue={serverCode} onChange={handleServerChange} />
      <div className="pane">
        <div className="pane-header">flight</div>
        <FlightLog
          timeline={timeline}
          entries={entries}
          cursor={cursor}
          error={error}
          availableActions={availableActions}
          onAddRawAction={handleAddRawAction}
          onDeleteEntry={(idx) => timeline.deleteEntry(idx)}
        />
      </div>
      <CodeEditor label="client" defaultValue={clientCode} onChange={handleClientChange} />
      <LivePreview
        timeline={timeline}
        clientModuleReady={clientModuleReady}
        totalChunks={totalChunks}
        cursor={cursor}
        isAtStart={isAtStart}
        isAtEnd={isAtEnd}
        onStep={handleStep}
        onSkip={handleSkip}
        onReset={handleReset}
      />
    </main>
  );
}
