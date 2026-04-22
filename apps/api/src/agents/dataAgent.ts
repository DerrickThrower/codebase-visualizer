import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { PlannerResult, DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { readFile, findModelPatterns } from '../services/treesitter.service';
import { graphitiService } from '../services/graphiti.service';
import { sseManager } from '../streaming/sseManager';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runDataAgent(
  sessionId: string,
  plannerResult: PlannerResult,
): Promise<{ nodes: DiagramNode[]; edges: DiagramEdge[] }> {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'data', status: 'running', message: 'Discovering database schemas...' },
  });

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  const targetFiles = plannerResult.modelFiles.length > 0
    ? plannerResult.modelFiles
    : plannerResult.fileMap
        .filter(f => /model|schema|entity|migration/i.test(f.path))
        .map(f => f.path)
        .slice(0, 15);

  for (const filePath of targetFiles.slice(0, 15)) {
    const content = await readFile(filePath);
    if (!content) continue;

    const quickModels = findModelPatterns(content, plannerResult.languages[0] as 'typescript' | 'javascript' | 'python' | 'go' | 'unknown');
    if (quickModels.length === 0 && !content.includes('Schema') && !content.includes('model')) continue;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract all database models or schemas from this file.

File: ${filePath}
Content:
\`\`\`
${content.slice(0, 3000)}
\`\`\`

For each model/schema, respond as JSON array:
[{ "name": "ModelName", "dbType": "postgres|mysql|mongodb|sqlite|unknown", "orm": "prisma|typeorm|sequelize|sqlalchemy|mongoose|raw", "fields": [{ "name": "fieldName", "type": "string|int|bool|etc", "nullable": true/false }] }]

If no models found, respond with [].`,
      }],
    });

    let models: Array<{ name: string; dbType: string; orm: string; fields: Array<{ name: string; type: string; nullable: boolean }> }> = [];
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) models = JSON.parse(jsonMatch[0]);
    } catch {
      models = [];
    }

    for (const model of models) {
      const nodeId = uuidv4();
      const node: DiagramNode = {
        id: nodeId,
        type: 'database',
        position: { x: 0, y: 0 },
        data: {
          label: model.name,
          confidence: 0.9,
          agentSource: 'data',
          isNew: true,
          metadata: {
            type: 'DatabaseEntity',
            name: model.name,
            dbType: model.dbType as 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'unknown',
            orm: model.orm as 'prisma' | 'typeorm' | 'sequelize' | 'sqlalchemy' | 'mongoose' | 'raw',
            fields: model.fields,
            filePath,
            confidence: 0.9,
            agentSource: 'data',
          },
        },
      };

      nodes.push(node);
      await graphitiService.addNode(sessionId, node);
      sseManager.send(sessionId, { event: 'node:added', data: node });
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const edgeId = uuidv4();
        const edge: DiagramEdge = {
          id: edgeId,
          source: nodes[i].id,
          target: nodes[j].id,
          type: 'dataFlow',
          label: 'RELATES_TO',
          animated: false,
          data: { relationshipType: 'RELATES_TO', direction: 'bidirectional' },
        };
        edges.push(edge);
        
        sseManager.send(sessionId, { event: 'edge:added', data: edge });
      }
    }
  }

  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'data', status: 'complete', message: `Found ${nodes.length} database entities` },
  });

  return { nodes, edges };
}
