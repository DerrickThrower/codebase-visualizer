import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { PlannerResult, DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { readFile } from '../services/treesitter.service';
import { graphitiService } from '../services/graphiti.service';
import { sseManager } from '../streaming/sseManager';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Patterns that suggest a file contains a user-facing feature/screen */
const FEATURE_FILE_PATTERNS = [
  /Page\.(tsx|jsx|ts|js)$/,
  /Screen\.(tsx|jsx|ts|js)$/,
  /View\.(tsx|jsx|ts|js)$/,
  /Dashboard\.(tsx|jsx|ts|js)$/,
  /\/pages\/[^/]+\.(tsx|jsx|ts|js)$/,
  /\/app\/[^/]*page\.(tsx|jsx|ts|js)$/,
];

/** Patterns that indicate React Router or Next.js route definitions */
const ROUTE_FILE_PATTERNS = [
  /router\.(tsx|jsx|ts|js)$/,
  /routes\.(tsx|jsx|ts|js)$/,
  /App\.(tsx|jsx|ts|js)$/,
  /index\.(tsx|jsx)$/,
  /layout\.(tsx|jsx)$/,
];

function isFeatureFile(filePath: string): boolean {
  return FEATURE_FILE_PATTERNS.some(p => p.test(filePath));
}

function isRouteFile(filePath: string): boolean {
  return ROUTE_FILE_PATTERNS.some(p => p.test(filePath));
}

function hasRouteContent(content: string): boolean {
  return (
    content.includes('<Route') ||
    content.includes('createBrowserRouter') ||
    content.includes('createHashRouter') ||
    content.includes('useRoutes(') ||
    content.includes("from 'react-router") ||
    content.includes('from "react-router') ||
    content.includes('/pages/') ||
    content.includes("export default function") ||
    content.includes('export default page') ||
    content.includes('generateStaticParams')
  );
}

export async function runFeaturesAgent(
  sessionId: string,
  plannerResult: PlannerResult,
  existingNodes: DiagramNode[],
): Promise<{ nodes: DiagramNode[]; edges: DiagramEdge[] }> {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'features', status: 'running', message: 'Discovering user-facing features and screens...' },
  });

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // Collect candidate files: feature files and route files from the file map
  const allPaths = plannerResult.fileMap.map(f => f.path);

  const featureFiles = allPaths.filter(p => isFeatureFile(p));
  const routeFiles = allPaths.filter(p => isRouteFile(p));

  // Combine, deduplicate, and limit
  const candidateSet = new Set([...featureFiles, ...routeFiles]);

  // Also scan route files discovered by the planner
  for (const rf of plannerResult.routeFiles) {
    candidateSet.add(rf);
  }
  const allCandidates = Array.from(candidateSet).slice(0, 30);

  // Build a summary of existing nodes so Claude can match references
  const existingNodeSummary = existingNodes.map(n => ({
    id: n.id,
    type: n.type,
    label: n.data.label,
  }));

  interface FeatureResult {
    name: string;
    route: string | null;
    filePath: string;
    usesAuth: boolean;
    usesServices: string[];
    confidence: number;
  }

  const discoveredFeatures: FeatureResult[] = [];
  const seenNames = new Set<string>();

  for (const filePath of allCandidates) {
    const content = await readFile(filePath);
    if (!content || content.length < 50) continue;

    // Skip files that clearly aren't frontend screens
    if (!isFeatureFile(filePath) && !hasRouteContent(content)) continue;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this file and identify user-facing screens or features (NOT technical services, contexts, or utilities).

File: ${filePath}
Content:
\`\`\`
${content.slice(0, 3000)}
\`\`\`

Existing system nodes for reference (use their labels when listing usesServices):
${JSON.stringify(existingNodeSummary.slice(0, 30), null, 2)}

For each distinct user-facing screen or feature found, respond as a JSON array:
[{
  "name": "HumanReadableName",
  "route": "/path or null",
  "filePath": "${filePath}",
  "usesAuth": true/false,
  "usesServices": ["ServiceNodeLabel"],
  "confidence": 0.75
}]

Rules:
- Only include screens the user actually sees/navigates to
- "name" should be human-readable (e.g. "Login Page", "Dashboard", "User Profile")
- "usesServices" should match labels from the existing nodes list where possible
- If this file defines multiple routes, return one entry per route
- If this file is not a user-facing screen, respond with []`,
      }],
    });

    let features: FeatureResult[] = [];
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) features = JSON.parse(jsonMatch[0]);
    } catch {
      features = [];
    }

    for (const feature of features) {
      if (!feature.name || seenNames.has(feature.name.toLowerCase().trim())) continue;
      seenNames.add(feature.name.toLowerCase().trim());
      discoveredFeatures.push({ ...feature, filePath });
    }
  }

  // If we found route files with router definitions, do one more pass asking Claude
  // to extract all routes from router config files
  const routerConfigFiles = allCandidates.filter(p =>
    /App\.(tsx|jsx)$|router\.(tsx|jsx|ts|js)$|routes\.(tsx|jsx|ts|js)$/.test(p)
  );

  for (const filePath of routerConfigFiles.slice(0, 5)) {
    const content = await readFile(filePath);
    if (!content || content.length < 50) continue;
    if (!content.includes('<Route') && !content.includes('createBrowserRouter') && !content.includes('useRoutes')) continue;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract all React Router route definitions from this file.

File: ${filePath}
Content:
\`\`\`
${content.slice(0, 4000)}
\`\`\`

For each route, respond as JSON array:
[{
  "name": "HumanReadableName",
  "route": "/path",
  "filePath": "${filePath}",
  "usesAuth": false,
  "usesServices": [],
  "confidence": 0.8
}]

- Derive "name" from the path or component name (e.g. "/users/:id" → "User Detail")
- If the file has no route definitions, respond with []`,
      }],
    });

    let features: FeatureResult[] = [];
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) features = JSON.parse(jsonMatch[0]);
    } catch {
      features = [];
    }

    for (const feature of features) {
      if (!feature.name || seenNames.has(feature.name.toLowerCase().trim())) continue;
      seenNames.add(feature.name.toLowerCase().trim());
      discoveredFeatures.push({ ...feature, filePath });
    }
  }

  // Build a lookup from existing node labels to their IDs for edge creation
  const labelToNodeId = new Map<string, string>();
  for (const n of existingNodes) {
    labelToNodeId.set(n.data.label.toLowerCase().trim(), n.id);
  }

  // Convert discovered features into DiagramNodes and edges
  for (const feature of discoveredFeatures) {
    const nodeId = uuidv4();
    const node: DiagramNode = {
      id: nodeId,
      type: 'feature',
      position: { x: 0, y: 0 },
      data: {
        label: feature.name,
        confidence: feature.confidence ?? 0.8,
        agentSource: 'features',
        isNew: true,
        metadata: {
          type: 'Feature',
          name: feature.name,
          route: feature.route ?? null,
          filePath: feature.filePath,
          usesAuth: feature.usesAuth ?? false,
          confidence: feature.confidence ?? 0.8,
          agentSource: 'features',
        },
      },
    };

    nodes.push(node);
    await graphitiService.addNode(sessionId, node);
    sseManager.send(sessionId, { event: 'node:added', data: node });

    // Create edges from this feature to any services it references
    for (const serviceLabel of feature.usesServices ?? []) {
      const targetId = labelToNodeId.get(serviceLabel.toLowerCase().trim());
      if (!targetId) continue;

      const edgeId = uuidv4();
      const edge: DiagramEdge = {
        id: edgeId,
        source: nodeId,
        target: targetId,
        type: 'dependency',
        label: 'USES',
        animated: false,
        data: { relationshipType: 'DEPENDS_ON', direction: 'unidirectional' },
      };
      edges.push(edge);
      sseManager.send(sessionId, { event: 'edge:added', data: edge });
    }
  }

  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'features', status: 'complete', message: `Found ${nodes.length} features/screens` },
  });

  return { nodes, edges };
}
