import dagre from 'dagre';
import type { DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { sseManager } from '../streaming/sseManager';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

/**
 * Column assignment for the features-first left-to-right layout:
 *   Features (col 0) → Services/APIs (col 1-2) → Infra/External (col 3)
 *
 * Lower number = further left.
 */
const TYPE_RANK: Record<string, number> = {
  feature: 0,
  service: 1,
  api: 2,
  database: 2,
  infra: 3,
  external: 3,
};

const COLUMN_X: Record<number, number> = {
  0: 0,
  1: 320,
  2: 640,
  3: 960,
};

const COLUMN_RANKSEP = 140;
const COLUMN_NODESEP = 70;

export function runDiagramGenerator(
  sessionId: string,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'diagram', status: 'running', message: 'Calculating layout...' },
  });

  // Bucket nodes by column rank
  const columns = new Map<number, DiagramNode[]>();
  for (const node of nodes) {
    const rank = TYPE_RANK[node.type] ?? 1;
    if (!columns.has(rank)) columns.set(rank, []);
    columns.get(rank)!.push(node);
  }

  // Run a separate dagre sub-graph per column to get clean vertical stacking,
  // then override the x position to the column's fixed x offset.
  const positionMap = new Map<string, { x: number; y: number }>();

  for (const [rank, colNodes] of columns) {
    if (colNodes.length === 0) continue;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: COLUMN_NODESEP, ranksep: COLUMN_RANKSEP, marginx: 20, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of colNodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    // Add intra-column edges so dagre can stack related nodes together
    for (const edge of edges) {
      const srcRank = TYPE_RANK[nodes.find(n => n.id === edge.source)?.type ?? ''] ?? -1;
      const tgtRank = TYPE_RANK[nodes.find(n => n.id === edge.target)?.type ?? ''] ?? -1;
      if (srcRank === rank && tgtRank === rank) {
        if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
          g.setEdge(edge.source, edge.target);
        }
      }
    }

    dagre.layout(g);

    const colX = COLUMN_X[rank] ?? rank * 320;

    for (const node of colNodes) {
      const pos = g.node(node.id);
      positionMap.set(node.id, {
        x: colX,
        y: pos ? pos.y - NODE_HEIGHT / 2 : 0,
      });
    }
  }

  const positionedNodes = nodes.map(node => ({
    ...node,
    position: positionMap.get(node.id) ?? { x: (TYPE_RANK[node.type] ?? 1) * 320, y: 0 },
    data: { ...node.data, isNew: false },
  }));

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
