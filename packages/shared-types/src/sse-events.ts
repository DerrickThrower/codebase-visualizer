import type { DiagramNode, DiagramEdge } from './diagram';

export type AgentName =
  | 'orchestrator'
  | 'planner'
  | 'api'
  | 'data'
  | 'service'
  | 'infra'
  | 'features'
  | 'critic'
  | 'diagram'
  | 'diagram-generator';

export type AgentStatus = 'running' | 'complete' | 'error';

export interface AgentUpdateEvent {
  event: 'agent:update';
  data: {
    agentName: AgentName;
    status: AgentStatus;
    message: string;
  };
}

export interface NodeAddedEvent {
  event: 'node:added';
  data: DiagramNode;
}

export interface EdgeAddedEvent {
  event: 'edge:added';
  data: DiagramEdge;
}

export interface NodeUpdatedEvent {
  event: 'node:updated';
  data: {
    id: string;
    data: Partial<DiagramNode['data']>;
  };
}

export interface AnalysisCompleteEvent {
  event: 'analysis:complete';
  data: {
    nodes: DiagramNode[];
    edges: DiagramEdge[];
    sessionId: string;
  };
}

export interface ErrorEvent {
  event: 'error';
  data: {
    message: string;
    agentName?: AgentName;
  };
}

export type SSEEvent =
  | AgentUpdateEvent
  | NodeAddedEvent
  | EdgeAddedEvent
  | NodeUpdatedEvent
  | AnalysisCompleteEvent
  | ErrorEvent;
