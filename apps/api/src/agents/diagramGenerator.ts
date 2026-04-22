import dagre from 'dagre';
import type { DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { sseManager } from '../streaming/sseManager';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

const TYPE_RANK: Record<string, number> = {
  service: 0,
  api: 1,
  database: 2,
  infra: 3,
  external: 4,
};

export function runDiagramGenerator(
  sessionId: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'diagram', status: 'running', message: 'Calculating layout...' },
  });

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const positionedNodes = nodes.map(node => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: pos
        ? { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 }
        : { x: TYPE_RANK[node.type] * 250, y: Math.random() * 400 },
      data: { ...node.data, isNew: false },
    };
  });

  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'diagram', status: 'complete', message: `Diagram ready — ${nodes.length} nodes, ${edges.length} edges` },
  });

  sseManager.send(sessionId, {
    event: 'analysis:complete',
    data: { nodes: positionedNodes, edges, sessionId },
  });

  return { nodes: positionedNodes, edges };
}
