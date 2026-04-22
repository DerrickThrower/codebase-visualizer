import type { DiagramNode } from '@codebase-viz/shared-types';

const GRAPHITI_URL = process.env.GRAPHITI_SERVICE_URL || 'http://localhost:8001';

interface SearchResult {
  fact: string;
  uuid: string;
  valid_at?: string;
  name?: string;
}

class GraphitiService {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${GRAPHITI_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`Graphiti request failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async addNode(sessionId: string, node: DiagramNode): Promise<void> {
    try {
      await this.request('/entity-node', {
        method: 'POST',
        body: JSON.stringify({
          uuid: node.id,
          group_id: sessionId,
          name: node.data.label,
          summary: `${node.type}: ${node.data.label} (${node.data.agentSource})`,
        }),
      });
    } catch {
      // non-fatal — diagram still streams via SSE without Graphiti persistence
    }
  }

  async addNodeFact(sessionId: string, node: DiagramNode): Promise<void> {
    try {
      const content = buildNodeSummary(node);
      await this.request('/messages', {
        method: 'POST',
        body: JSON.stringify({
          group_id: sessionId,
          messages: [{ role: 'system', content }],
        }),
      });
    } catch {
      // non-fatal
    }
  }

  async searchNodes(sessionId: string, query: string): Promise<SearchResult[]> {
    try {
      const result = await this.request<{ facts: SearchResult[] }>('/search', {
        method: 'POST',
        body: JSON.stringify({
          group_ids: [sessionId],
          query,
          max_facts: 10,
        }),
      });
      return result.facts ?? [];
    } catch {
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.request(`/group/${sessionId}`, { method: 'DELETE' });
    } catch {
      // non-fatal
    }
  }
}

function buildNodeSummary(node: DiagramNode): string {
  const meta = node.data.metadata;
  switch (meta.type) {
    case 'ApiEndpoint':
      return `API endpoint: ${meta.method} ${meta.path} — handler: ${meta.handlerName}, auth required: ${meta.authRequired}, file: ${meta.filePath}`;
    case 'DatabaseEntity':
      return `Database model: ${meta.name} (${meta.orm}, ${meta.dbType}) with fields: ${meta.fields.map(f => f.name).join(', ')} — file: ${meta.filePath}`;
    case 'Service':
      return `Service: ${meta.name} (${meta.language}, ${meta.framework}) — entry: ${meta.filePath}`;
    case 'ExternalDependency':
      return `External dependency: ${meta.name} (${meta.category}), package: ${meta.sdkPackage}, env keys: ${meta.envKeys.join(', ')}`;
    case 'Feature':
      return `Feature: ${meta.name}${meta.route ? ` at route ${meta.route}` : ''} — file: ${meta.filePath}, auth: ${meta.usesAuth}`;
  }
}

export const graphitiService = new GraphitiService();
