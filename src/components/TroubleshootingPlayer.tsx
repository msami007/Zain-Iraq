"use client";

import { useState } from "react";

type FlowOption = {
  text: string;
  next: string;
};

type FlowNode = {
  text: string;
  options?: FlowOption[];
  is_terminal?: boolean;
  outcome?: "resolve" | "escalate";
};

type TroubleshootingFlow = {
  start_node: string;
  nodes: Record<string, FlowNode>;
};

type PlayerProps = {
  flow: any; // Can be JSON or null
};

export default function TroubleshootingPlayer({ flow }: PlayerProps) {
  const parsedFlow = flow as TroubleshootingFlow | null;
  const startNodeId = parsedFlow?.start_node || (parsedFlow?.nodes ? Object.keys(parsedFlow.nodes)[0] : "");
  
  const [currentNodeId, setCurrentNodeId] = useState<string>(startNodeId);
  const [history, setHistory] = useState<string[]>([]);

  if (!parsedFlow || !parsedFlow.nodes || !startNodeId || !parsedFlow.nodes[startNodeId]) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center shadow-2xs">
        <p className="text-xs text-zinc-500 font-semibold">No interactive troubleshooting flow configured for this variant.</p>
      </div>
    );
  }

  const currentNode = parsedFlow.nodes[currentNodeId];

  const handleOptionClick = (nextNodeId: string) => {
    if (parsedFlow.nodes[nextNodeId]) {
      setHistory([...history, currentNodeId]);
      setCurrentNodeId(nextNodeId);
    }
  };

  const handleBack = () => {
    if (history.length > 0) {
      const prevNodeId = history[history.length - 1];
      setCurrentNodeId(prevNodeId);
      setHistory(history.slice(0, -1));
    }
  };

  const handleReset = () => {
    setCurrentNodeId(startNodeId);
    setHistory([]);
  };

  if (!currentNode) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center shadow-2xs">
        <p className="text-xs text-zinc-500 font-semibold">Error: Selected step does not exist in flow definition.</p>
        <button
          onClick={handleReset}
          className="mt-3 rounded bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-zinc-800"
        >
          Reset Flow
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6 text-left">
      {/* Flow Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-455 flex items-center gap-1.5">
          <span>🔧</span> Interactive Diagnostics
        </h4>
        <div className="flex gap-2">
          {history.length > 0 && (
            <button
              onClick={handleBack}
              className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-600 transition-all"
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleReset}
            className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-650 transition-all"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Flow Content */}
      <div className="space-y-6">
        <p className="text-sm font-semibold text-zinc-800 leading-relaxed">
          {currentNode.text}
        </p>

        {/* Options / Terminal State */}
        {currentNode.is_terminal ? (
          <div className="pt-2">
            {currentNode.outcome === "resolve" ? (
              <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 text-xs text-green-800 flex items-start gap-2.5">
                <span className="text-base">✔</span>
                <div>
                  <p className="font-bold">Flow Concluded: Resolution Reached</p>
                  <p className="mt-0.5 font-medium text-green-700">Follow the instructions above to resolve the case. No escalation is required.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-xs text-red-800 flex items-start gap-2.5">
                <span className="text-base">🚨</span>
                <div>
                  <p className="font-bold">Flow Concluded: Escalate Required</p>
                  <p className="mt-0.5 font-medium text-red-700">Issue requires advanced troubleshooting. Escalate case to Tier 2 engineering queue.</p>
                </div>
              </div>
            )}
            <button
              onClick={handleReset}
              className="mt-4 w-full rounded bg-zinc-950 hover:bg-zinc-800 py-2.5 text-xs font-bold text-white shadow-xs transition-all text-center"
            >
              Run Diagnostics Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {currentNode.options?.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option.next)}
                className="rounded-lg border border-zinc-200 bg-white hover:border-zinc-350 hover:bg-zinc-50 p-3.5 text-xs font-bold text-zinc-700 hover:text-zinc-950 text-left transition-all shadow-2xs flex items-center justify-between"
              >
                <span>{option.text}</span>
                <span className="text-zinc-300 font-normal">→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progress breadcrumbs */}
      {history.length > 0 && (
        <div className="text-[10px] text-zinc-400 font-semibold font-mono border-t border-zinc-100 pt-4 flex items-center gap-1.5 flex-wrap">
          <span>Progress:</span>
          {history.map((h, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="rounded bg-zinc-50 border border-zinc-150 px-1.5 py-0.5 text-zinc-500">
                {h}
              </span>
              <span>➔</span>
            </span>
          ))}
          <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-white">
            {currentNodeId}
          </span>
        </div>
      )}
    </div>
  );
}
