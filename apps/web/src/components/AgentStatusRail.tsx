'use client';

import { CheckCircle, Loader2, XCircle, Circle } from 'lucide-react';
import { useDiagramStore } from '@/stores/diagramStore';
import clsx from 'clsx';

const AGENT_ORDER = ['orchestrator', 'planner', 'api', 'data', 'service', 'infra', 'critic', 'diagram'];
const AGENT_LABELS: Record<string, string> = {
  orchestrator: 'Orchestrator',
  planner: 'Planner',
  api: 'API Agent',
  data: 'Data Agent',
  service: 'Service Agent',
  infra: 'Infra Agent',
  critic: 'Critic',
  diagram: 'Layout',
};

export default function AgentStatusRail() {
  const { agentStatuses, isAnalyzing, isComplete, nodes, edges } = useDiagramStore();

  const agents = AGENT_ORDER.map((name) => ({
    name,
    label: AGENT_LABELS[name],
    status: agentStatuses[name],
  }));

  return (
    <aside className="w-56 bg-panel border-r border-border flex flex-col h-full overflow-hidden shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-[#555555]">Agents</h2>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {agents.map(({ name, label, status }) => (
          <div key={name} className="px-4 py-2">
            <div className="flex items-center gap-2.5">
              <StatusIcon status={status?.status} />
              <div className="min-w-0">
                <p className={clsx('text-sm truncate', status ? 'text-white' : 'text-[#444444]')}>{label}</p>
                {status?.message && (
                  <p className="text-[11px] text-[#555555] truncate mt-0.5">{status.message}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(isAnalyzing || isComplete) && (
        <div className="px-4 py-3 border-t border-border space-y-1.5">
          <div className="flex justify-between text-[11px] text-[#555555]">
            <span>Nodes</span>
            <span className="text-white tabular-nums">{nodes.length}</span>
          </div>
          <div className="flex justify-between text-[11px] text-[#555555]">
            <span>Edges</span>
            <span className="text-white tabular-nums">{edges.length}</span>
          </div>
          {isComplete && (
            <p className="text-[11px] text-[#888888] mt-1">Analysis complete</p>
          )}
        </div>
      )}
    </aside>
  );
}

function StatusIcon({ status }: { status?: 'running' | 'complete' | 'error' }) {
  if (!status) return <Circle className="w-3 h-3 text-[#333333] shrink-0" />;
  if (status === 'running') return <Loader2 className="w-3 h-3 text-white animate-spin shrink-0" />;
  if (status === 'complete') return <CheckCircle className="w-3 h-3 text-[#888888] shrink-0" />;
  return <XCircle className="w-3 h-3 text-red-400 shrink-0" />;
}
