import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { PlannerResult, DiagramNode, DiagramEdge } from '@codebase-viz/shared-types';
import { readFile, findEnvVarUsage } from '../services/treesitter.service';
import { graphitiService } from '../services/graphiti.service';
import { sseManager } from '../streaming/sseManager';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTERNAL_SDK_PATTERNS: Array<{ pattern: RegExp; name: string; category: string }> = [
  { pattern: /aws-sdk|@aws-sdk/i, name: 'AWS', category: 'cloud' },
  { pattern: /@google-cloud/i, name: 'Google Cloud', category: 'cloud' },
  { pattern: /azure-/i, name: 'Azure', category: 'cloud' },
  { pattern: /stripe/i, name: 'Stripe', category: 'payment' },
  { pattern: /nodemailer|sendgrid|@sendgrid|mailgun|resend/i, name: 'Email Service', category: 'email' },
  { pattern: /twilio/i, name: 'Twilio', category: 'other' },
  { pattern: /firebase|@firebase/i, name: 'Firebase', category: 'cloud' },
  { pattern: /supabase/i, name: 'Supabase', category: 'cloud' },
  { pattern: /ioredis|redis/i, name: 'Redis', category: 'queue' },
  { pattern: /amqplib|rabbitmq|bull|bullmq/i, name: 'Message Queue', category: 'queue' },
  { pattern: /openai/i, name: 'OpenAI', category: 'other' },
  { pattern: /@anthropic-ai/i, name: 'Anthropic', category: 'other' },
  { pattern: /sentry/i, name: 'Sentry', category: 'monitoring' },
  { pattern: /datadog/i, name: 'Datadog', category: 'monitoring' },
  { pattern: /auth0|passport|@auth0/i, name: 'Auth Provider', category: 'auth' },
  { pattern: /clerk/i, name: 'Clerk', category: 'auth' },
];

export async function runInfraAgent(
  sessionId: string,
  plannerResult: PlannerResult,
  mainServiceNodeId: string,
): Promise<{ nodes: DiagramNode[]; edges: DiagramEdge[] }> {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'infra', status: 'running', message: 'Scanning infrastructure and external dependencies...' },
  });

  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];
  const foundDeps = new Map<string, { name: string; category: string; envKeys: string[]; sdkPackage: string }>();

  const configFiles = [
    ...plannerResult.configFiles,
    ...plannerResult.fileMap
      .filter(f => /package\.json|requirements\.txt|go\.mod|docker-compose|\.env\.example|Dockerfile/i.test(f.path))
      .map(f => f.path),
  ].slice(0, 10);

  for (const filePath of configFiles) {
    const content = await readFile(filePath);
    if (!content) continue;

    const envKeys = findEnvVarUsage(content);

    for (const { pattern, name, category } of EXTERNAL_SDK_PATTERNS) {
      if (pattern.test(content)) {
        const key = name;
        const existing = foundDeps.get(key);
        if (existing) {
          existing.envKeys.push(...envKeys.filter(k => k.toUpperCase().includes(name.toUpperCase().replace(' ', '_'))));
        } else {
          foundDeps.set(key, {
            name,
            category,
            envKeys: envKeys.filter(k => k.toUpperCase().includes(name.toUpperCase().replace(' ', '_'))),
            sdkPackage: pattern.source.split('|')[0].replace(/[\\^@]/g, ''),
          });
        }
      }
    }
  }

  const sourceFiles = plannerResult.fileMap
    .filter(f => f.language !== 'unknown')
    .map(f => f.path)
    .slice(0, 20);

  const allEnvKeys = new Set<string>();
  for (const filePath of sourceFiles) {
    const content = await readFile(filePath);
    findEnvVarUsage(content).forEach(k => allEnvKeys.add(k));

    for (const { pattern, name, category } of EXTERNAL_SDK_PATTERNS) {
      if (pattern.test(content) && !foundDeps.has(name)) {
        foundDeps.set(name, { name, category, envKeys: [], sdkPackage: name.toLowerCase() });
      }
    }
  }

  if (allEnvKeys.size > 0 && foundDeps.size === 0) {
    const configSample = Array.from(allEnvKeys).join(', ');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Based on these environment variable names, identify external services used:
${configSample}

Respond as JSON array:
[{ "name": "ServiceName", "category": "cloud|payment|email|auth|monitoring|queue|other", "envKeys": ["KEY1"], "sdkPackage": "package-name" }]

Only include clearly identifiable external services. Return [] if none are obvious.`,
      }],
    });

    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed: Array<{ name: string; category: string; envKeys: string[]; sdkPackage: string }> = JSON.parse(jsonMatch[0]);
        for (const dep of parsed) {
          if (!foundDeps.has(dep.name)) foundDeps.set(dep.name, dep);
        }
      }
    } catch { /* ignore */ }
  }

  for (const dep of foundDeps.values()) {
    const nodeId = uuidv4();
    const nodeType = dep.category === 'queue' || dep.category === 'cloud' ? 'infra' : 'external';

    const node: DiagramNode = {
      id: nodeId,
      type: nodeType,
      position: { x: 0, y: 0 },
      data: {
        label: dep.name,
        confidence: 0.85,
        agentSource: 'infra',
        isNew: true,
        metadata: {
          type: 'ExternalDependency',
          name: dep.name,
          category: dep.category as 'cloud' | 'payment' | 'email' | 'auth' | 'monitoring' | 'queue' | 'other',
          envKeys: dep.envKeys,
          sdkPackage: dep.sdkPackage,
          confidence: 0.85,
          agentSource: 'infra',
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
      type: 'dataFlow',
      label: 'CONNECTS_TO',
      animated: true,
      data: { relationshipType: 'CONNECTS_TO', direction: 'unidirectional' },
    };
    edges.push(edge);
    
    sseManager.send(sessionId, { event: 'edge:added', data: edge });
  }

  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'infra', status: 'complete', message: `Found ${nodes.length} external dependencies` },
  });

  return { nodes, edges };
}
