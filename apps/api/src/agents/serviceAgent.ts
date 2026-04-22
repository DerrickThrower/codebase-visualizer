import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { PlannerResult, DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { readFile, findImports } from '../services/treesitter.service';
import { graphitiService } from '../services/graphiti.service';
import { sseManager } from '../streaming/sseManager';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runServiceAgent(
  sessionId: string,
  plannerResult: PlannerResult,
  mainServiceNodeId: string,
): Promise<{ nodes: DiagramNode[]; edges: DiagramEdge[] }> {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'service', status: 'running', message: 'Mapping internal services and modules...' },
  });

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  const sourceFiles = plannerResult.fileMap
    .filter(f => f.language !== 'unknown')
    .map(f => f.path)
    .slice(0, 25);

  const importMap = new Map<string, string[]>();
  for (const filePath of sourceFiles) {
    const content = await readFile(filePath);
    if (!content) continue;
    const imports = findImports(content, plannerResult.languages[0] as 'typescript' | 'javascript' | 'python' | 'go' | 'unknown');
    importMap.set(filePath, imports);
  }

  const sampleFiles = sourceFiles.slice(0, 15);
  const fileContents = await Promise.all(
    sampleFiles.map(async f => ({ path: f, content: (await readFile(f)).slice(0, 1500) }))
  );

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Identify distinct internal services or modules in this codebase. Focus on service classes, providers, or clearly separated concerns.

Framework: ${plannerResult.framework}
Files:
${fileContents.map(f => `--- ${f.path}\n${f.content}`).join('\n\n')}

Respond as JSON array (max 8 items):
[{ "name": "ServiceName", "filePath": "/path/to/file", "description": "what it does", "dependsOn": ["OtherService"] }]

Only include services that are clearly distinct modules. If the codebase is small/monolithic, return [].`,
    }],
  });

  let services: Array<{ name: string; filePath: string; description: string; dependsOn: string[] }> = [];
  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) services = JSON.parse(jsonMatch[0]);
  } catch {
    services = [];
  }

  const serviceNodeIds = new Map<string, string>();

  for (const svc of services) {
    const nodeId = uuidv4();
    serviceNodeIds.set(svc.name, nodeId);

    const node: DiagramNode = {
      id: nodeId,
      type: 'service',
      position: { x: 0, y: 0 },
      data: {
        label: svc.name,
        confidence: 0.8,
        agentSource: 'service',
        isNew: true,
        metadata: {
          type: 'Service',
          name: svc.name,
          language: plannerResult.languages[0] ?? 'unknown',
          framework: plannerResult.framework,
          filePath: svc.filePath,
          confidence: 0.8,
          agentSource: 'service',
        },
      },
    };

    nodes.push(node);
    await graphitiService.addNode(sessionId, node);
    sseManager.send(sessionId, { event: 'node:added', data: node });

    const edgeId = uuidv4();
    const edge: DiagramEdge = {
      id: edgeId,
      source: mainServiceNodeId,
      target: nodeId,
      type: 'dependency',
      label: 'DEPENDS_ON',
      animated: false,
      data: { relationshipType: 'DEPENDS_ON', direction: 'unidirectional' },
    };
    edges.push(edge);
    
    sseManager.send(sessionId, { event: 'edge:added', data: edge });
  }

  for (const svc of services) {
    const sourceId = serviceNodeIds.get(svc.name);
    if (!sourceId) continue;
    for (const dep of svc.dependsOn) {
      const targetId = serviceNodeIds.get(dep);
      if (!targetId || targetId === sourceId) continue;
      const edgeId = uuidv4();
      const edge: DiagramEdge = {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: 'dependency',
        label: 'DEPENDS_ON',
        animated: false,
        data: { relationshipType: 'DEPENDS_ON', direction: 'unidirectional' },
      };
      edges.push(edge);
      
      sseManager.send(sessionId, { event: 'edge:added', data: edge });
    }
  }

  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'service', status: 'complete', message: `Found ${nodes.length} internal services` },
  });

  return { nodes, edges };
}
