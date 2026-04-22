'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AgentStatusRail from '@/components/AgentStatusRail';
import DiagramCanvas from '@/components/diagram/DiagramCanvas';
import NodeDetailPanel from '@/components/diagram/NodeDetailPanel';
import QueryBar from '@/components/query/QueryBar';
import { useSSE } from '@/hooks/useSSE';
import { useDiagramStore } from '@/stores/diagramStore';

interface Props {
  params: { sessionId: string };
}

export default function VisualizePage({ params }: Props) {
  const { sessionId } = params;
  const router = useRouter();
  const { setIsAnalyzing, error } = useDiagramStore();

  useEffect(() => {
    setIsAnalyzing(true);
  }, [setIsAnalyzing]);

  useSSE(sessionId);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      <header className="h-12 flex items-center gap-3 px-4 bg-panel border-b border-border shrink-0">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          New
        </button>
        <div className="w-px h-4 bg-border" />
        <span className="text-sm text-[#555555] font-mono truncate">{sessionId}</span>
        {error && <span className="ml-auto text-xs text-red-400 truncate">{error}</span>}
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <AgentStatusRail />
        <div className="flex-1 relative overflow-hidden">
          <DiagramCanvas />
          <NodeDetailPanel />
        </div>
        <QueryBar sessionId={sessionId} />
      </div>
    </div>
  );
}
