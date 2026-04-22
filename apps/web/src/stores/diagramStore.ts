import { create } from 'zustand';
import type { DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';

interface AgentStatus {
  agentName: string;
  status: 'running' | 'complete' | 'error';
  message: string;
}

interface DiagramStore {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  selectedNodeId: string | null;
  agentStatuses: Record<string, AgentStatus>;
  isAnalyzing: boolean;
  isComplete: boolean;
  error: string | null;

  addNode: (node: DiagramNode) => void;
  addEdge: (edge: DiagramEdge) => void;
  setNodes: (nodes: DiagramNode[]) => void;
  setEdges: (edges: DiagramEdge[]) => void;
  updateAgentStatus: (status: AgentStatus) => void;
  setSelectedNodeId: (id: string | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setComplete: () => void;
  setError: (msg: string) => void;
  reset: () => void;
}

export const useDiagramStore = create<DiagramStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  agentStatuses: {},
  isAnalyzing: false,
  isComplete: false,
  error: null,

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes.filter((n) => n.id !== node.id), node] })),

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges.filter((e) => e.id !== edge.id), edge] })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  updateAgentStatus: (status) =>
    set((s) => ({ agentStatuses: { ...s.agentStatuses, [status.agentName]: status } })),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setComplete: () => set({ isAnalyzing: false, isComplete: true }),
  setError: (msg) => set({ isAnalyzing: false, error: msg }),
  reset: () => set({ nodes: [], edges: [], selectedNodeId: null, agentStatuses: {}, isAnalyzing: false, isComplete: false, error: null }),
}));
