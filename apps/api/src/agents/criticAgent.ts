import Anthropic from '@anthropic-ai/sdk';
import type { DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { graphitiService } from '../services/graphiti.service';
import { sseManager } from '../streaming/sseManager';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface AgentResults {
  planner: { nodes: DiagramNode[]; edges: DiagramEdge[] };
  api: { nodes: DiagramNode[]; edges: DiagramEdge[] };
  data: { nodes: DiagramNode[]; edges: DiagramEdge[] };
  service: { nodes: DiagramNode[]; edges: DiagramEdge[] };
  infra: { nodes: DiagramNode[]; edges: DiagramEdge[] };
  mainServiceNode: DiagramNode;
}

export async function runCriticAgent(
  sessionId: string,
  results: AgentResults,
): Promise<{ nodes: DiagramNode[]; edges: DiagramEdge[] }> {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'critic', status: 'running', message: 'Reviewing and deduplicating findings...' },
  });

  const allNodes: DiagramNode[] = [
    results.mainServiceNode,
    ...results.api.nodes,
    ...results.data.nodes,
    ...results.service.nodes,
    ...results.infra.nodes,
  ];

  const allEdges: DiagramEdge[] = [
    ...results.api.edges,
    ...results.data.edges,
    ...results.service.edges,
    ...results.infra.edges,
  ];

  const deduped = deduplicateNodes(allNodes);
  const remappedEdges = remapEdges(allEdges, allNodes, deduped.idMap);

  const lowConfidence = deduped.nodes.filter(n => n.data.confidence < 0.7);
  if (lowConfidence.length > 0) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Review these low-confidence findings from a codebase analysis. For each, determine if it should be kept (confidence >= 0.7) or removed.

Findings:
${JSON.stringify(lowConfidence.map(n => ({ id: n.id, type: n.type, label: n.data.label, source: n.data.agentSource })), null, 2)}

Respond as JSON: { "keep": ["id1", "id2"], "remove": ["id3"] }`,
      }],
    });

    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const verdict: { keep: string[]; remove: string[] } = JSON.parse(jsonMatch[0]);
        const removeSet = new Set(verdict.remove ?? []);
        const filteredNodes = deduped.nodes.filter(n => !removeSet.has(n.id));
        const filteredEdges = remappedEdges.filter(
          e => !removeSet.has(e.source) && !removeSet.has(e.target),
        );

        sseManager.send(sessionId, {
          event: 'agent:update',
          data: { agentName: 'critic', status: 'complete', message: `Verified ${filteredNodes.length} nodes, removed ${removeSet.size} low-confidence findings` },
        });

        return { nodes: filteredNodes, edges: filteredEdges };
      }
    } catch { /* fall through to return deduped */ }
  }

  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'critic', status: 'complete', message: `Verified ${deduped.nodes.length} nodes` },
  });

  return { nodes: deduped.nodes, edges: remappedEdges };
}

function deduplicateNodes(nodes: DiagramNode[]): { nodes: DiagramNode[]; idMap: Map<string, string> } {
  const seen = new Map<string, DiagramNode>();
  const idMap = new Map<string, string>();

  for (const node of nodes) {
    const key = `${node.type}:${node.data.label.toLowerCase().trim()}`;
    const existing = seen.get(key);
    if (existing) {
      idMap.set(node.id, existing.id);
      if (node.data.confidence > existing.data.confidence) {
        seen.set(key, { ...node, id: existing.id });
      }
    } else {
      seen.set(key, node);
      idMap.set(node.id, node.id);
    }
  }

  return { nodes: Array.from(seen.values()), idMap };
}

function remapEdges(edges: DiagramEdge[], _allNodes: DiagramNode[], idMap: Map<string, string>): DiagramEdge[] {
  const seen = new Set<string>();
  const result: DiagramEdge[] = [];

  for (const edge of edges) {
    const source = idMap.get(edge.source) ?? edge.source;
    const target = idMap.get(edge.target) ?? edge.target;
    if (source === target) continue;

    const key = `${source}->${target}:${edge.data.relationshipType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({ ...edge, source, target });
  }

  return result;
}
