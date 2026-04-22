'use client';

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagramStore } from '@/stores/diagramStore';
import ServiceNode from './nodes/ServiceNode';
import ApiNode from './nodes/ApiNode';
import DatabaseNode from './nodes/DatabaseNode';
import InfraNode from './nodes/InfraNode';
import ExternalNode from './nodes/ExternalNode';
import type { DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';

const nodeTypes: NodeTypes = {
  service: ServiceNode as never,
  api: ApiNode as never,
  database: DatabaseNode as never,
  infra: InfraNode as never,
  external: ExternalNode as never,
};

function toFlowNode(n: DiagramNode): Node {
  return { id: n.id, type: n.type, position: n.position, data: n.data };
}

function toFlowEdge(e: DiagramEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated,
    style: { stroke: '#444444', strokeWidth: 1 },
    labelStyle: { fill: '#666666', fontSize: 10 },
    labelBgStyle: { fill: '#111111' },
  };
}

export default function DiagramCanvas() {
  const { nodes, edges, setSelectedNodeId } = useDiagramStore();

  const flowNodes = nodes.map(toFlowNode);
  const flowEdges = edges.map(toFlowEdge);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1a1a" gap={24} variant={BackgroundVariant.Dots} size={1} />
      </ReactFlow>
    </div>
  );
}
