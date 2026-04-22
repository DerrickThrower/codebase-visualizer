'use client';

import { useEffect, useRef } from 'react';
import type { SSEEvent, DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { useDiagramStore } from '@/stores/diagramStore';
import { getStreamUrl } from '@/lib/api';

export function useSSE(sessionId: string | null) {
  const esRef = useRef<EventSource | null>(null);
  const { addNode, addEdge, setNodes, setEdges, updateAgentStatus, setComplete, setError } = useDiagramStore();

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(getStreamUrl(sessionId));
    esRef.current = es;

    es.addEventListener('node:added', (e: MessageEvent) => {
      const node = JSON.parse(e.data) as DiagramNode;
      addNode(node);
    });

    es.addEventListener('edge:added', (e: MessageEvent) => {
      const edge = JSON.parse(e.data) as DiagramEdge;
      addEdge(edge);
    });

    es.addEventListener('agent:update', (e: MessageEvent) => {
      updateAgentStatus(JSON.parse(e.data));
    });

    es.addEventListener('analysis:complete', (e: MessageEvent) => {
      const { nodes, edges } = JSON.parse(e.data) as { nodes: DiagramNode[]; edges: DiagramEdge[] };
      setNodes(nodes);
      setEdges(edges);
      setComplete();
      es.close();
    });

    es.addEventListener('error', (e: MessageEvent) => {
      if (e.data) {
        const parsed = JSON.parse(e.data) as { message: string };
        setError(parsed.message);
      }
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setComplete();
      }
    };

    return () => {
      es.close();
    };
  }, [sessionId, addNode, addEdge, setNodes, setEdges, updateAgentStatus, setComplete, setError]);
}
