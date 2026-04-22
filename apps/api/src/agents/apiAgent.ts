import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { PlannerResult, DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { readFile, findRoutePatterns } from '../services/treesitter.service';
import { graphitiService } from '../services/graphiti.service';
import { sseManager } from '../streaming/sseManager';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runApiAgent(
  sessionId: string,
  plannerResult: PlannerResult,
  serviceNodeId: string,
): Promise<{ nodes: DiagramNode[]; edges: DiagramEdge[] }> {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'api', status: 'running', message: 'Discovering API endpoints...' },
  });

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  const targetFiles = plannerResult.routeFiles.length > 0
    ? plannerResult.routeFiles
    : plannerResult.fileMap.filter(f => f.language !== 'unknown').map(f => f.path).slice(0, 30);

  for (const filePath of targetFiles.slice(0, 20)) {
    const content = await readFile(filePath);
    if (!content) continue;

    const quickRoutes = findRoutePatterns(content, plannerResult.languages[0] as 'typescript' | 'javascript' | 'python' | 'go' | 'unknown');

    if (quickRoutes.length === 0 && !content.includes('route') && !content.includes('endpoint')) continue;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract all HTTP endpoint definitions from this file.

File: ${filePath}
Content:
\`\`\`
${content.slice(0, 3000)}
\`\`\`

For each endpoint, respond as JSON array:
[{ "method": "GET|POST|PUT|DELETE|PATCH", "path": "/api/...", "handlerName": "functionName", "authRequired": true/false, "middlewares": [] }]

If no endpoints found, respond with [].`,
      }],
    });

    let endpoints: Array<{ method: string; path: string; handlerName: string; authRequired: boolean; middlewares: string[] }> = [];
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) endpoints = JSON.parse(jsonMatch[0]);
    } catch {
      endpoints = [];
    }

    for (const ep of endpoints) {
      const nodeId = uuidv4();
      const node: DiagramNode = {
        id: nodeId,
        type: 'api',
        position: { x: 0, y: 0 },
        data: {
          label: `${ep.method} ${ep.path}`,
          confidence: 0.85,
          agentSource: 'api',
          isNew: true,
          metadata: {
            type: 'ApiEndpoint',
            method: ep.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
            path: ep.path,
            handlerName: ep.handlerName,
            authRequired: ep.authRequired,
            middlewares: ep.middlewares,
            filePath,
            lineNumber: 0,
            confidence: 0.85,
            agentSource: 'api',
          },
        },
      };

      nodes.push(node);
      await graphitiService.addNode(sessionId, node);
      sseManager.send(sessionId, { event: 'node:added', data: node });

      const edgeId = uuidv4();
      const edge: DiagramEdge = {
        id: edgeId,
        source: serviceNodeId,
        target: nodeId,
        type: 'dependency',
        label: 'HANDLES',
        animated: false,
        data: { relationshipType: 'HANDLES', direction: 'unidirectional' },
      };
      edges.push(edge);
      
      sseManager.send(sessionId, { event: 'edge:added', data: edge });
    }
  }

  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'api', status: 'complete', message: `Found ${nodes.length} endpoints` },
  });

  return { nodes, edges };
}
