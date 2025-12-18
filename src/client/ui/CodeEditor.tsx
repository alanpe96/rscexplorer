import React, { useRef, useLayoutEffect, useEffectEvent, useState } from "react";
import { Pane } from "./Pane.tsx";
import "./CodeEditor.css";

let cmModule: typeof import("./codemirror.ts") | null = null;
const cmModulePromise = import("./codemirror.ts").then((mod) => {
  cmModule = mod;
  return mod;
});

type CodeEditorProps = {
  defaultValue: string;
  onChange: (code: string) => void;
  label: string;
};

export function CodeEditor({ defaultValue, onChange, label }: CodeEditorProps): React.ReactElement {
  const [initialDefaultValue] = useState(defaultValue);
  const [cmLoaded, setCmLoaded] = useState(cmModule !== null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const onEditorChange = useEffectEvent((doc: string) => {
    onChange(doc);
  });

  useLayoutEffect(() => {
    let editorHandle: { destroy: () => void } | null = null;
    let destroyed = false;

    function initEditor(cm: typeof import("./codemirror.ts")) {
      if (!destroyed) {
        editorHandle = cm.createEditor(
          containerRef.current!,
          textareaRef.current?.value ?? initialDefaultValue,
          onEditorChange,
        );
        setCmLoaded(true);
      }
    }

    if (cmModule) {
      initEditor(cmModule);
    } else {
      cmModulePromise.then(initEditor);
    }

    return () => {
      destroyed = true;
      editorHandle?.destroy();
    };
  }, [initialDefaultValue]);

  return (
    <Pane label={label}>
      <div className="CodeEditor" ref={containerRef}>
        {!cmLoaded && (
          <textarea
            ref={textareaRef}
            className="CodeEditor-fallback"
            defaultValue={initialDefaultValue}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        )}
      </div>
    </Pane>
  );
}
