import { v4 as uuidv4 } from 'uuid';
import type { DiagramNode } from '@codebase-viz/shared-types';
import { cloneRepo, cleanupRepo } from '../services/github.service';
import { sseManager } from '../streaming/sseManager';
import { graphitiService } from '../services/graphiti.service';
import { runPlannerAgent } from './plannerAgent';
import { runApiAgent } from './apiAgent';
import { runDataAgent } from './dataAgent';
import { runServiceAgent } from './serviceAgent';
import { runInfraAgent } from './infraAgent';
import { runFeaturesAgent } from './featuresAgent';
import { runCriticAgent } from './criticAgent';
import { runDiagramGenerator } from './diagramGenerator';

export async function runOrchestrator(
  sessionId: string,
  repoUrl: string,
  githubToken?: string,
): Promise<void> {
  let repoPath: string | undefined;

  try {
    console.log(`[orchestrator] session=${sessionId} cloning ${repoUrl}`);
    sseManager.send(sessionId, {
      event: 'agent:update',
      data: { agentName: 'orchestrator', status: 'running', message: 'Cloning repository...' },
    });

    repoPath = await cloneRepo(sessionId, repoUrl, githubToken);
    console.log(`[orchestrator] session=${sessionId} cloned to ${repoPath}`);

    console.log(`[orchestrator] session=${sessionId} running planner agent`);
    const plannerResult = await runPlannerAgent(sessionId, repoPath);
    console.log(`[orchestrator] session=${sessionId} planner done — framework=${plannerResult.framework} languages=[${plannerResult.languages.join(', ')}]`);

    const mainServiceNodeId = uuidv4();
    const mainServiceNode: DiagramNode = {
      id: mainServiceNodeId,
      type: 'service',
      position: { x: 0, y: 0 },
      data: {
        label: plannerResult.framework !== 'unknown' ? plannerResult.framework : 'Application',
        confidence: 1,
        agentSource: 'planner',
        isNew: true,
        metadata: {
          type: 'Service',
          name: plannerResult.framework !== 'unknown' ? plannerResult.framework : 'Application',
          language: plannerResult.languages[0] ?? 'unknown',
          framework: plannerResult.framework,
          filePath: plannerResult.entryPoints[0] ?? repoPath,
          confidence: 1,
          agentSource: 'planner',
        },
      },
    };

    await graphitiService.addNode(sessionId, mainServiceNode);
    sseManager.send(sessionId, { event: 'node:added', data: mainServiceNode });

    console.log(`[orchestrator] session=${sessionId} running api/data/service/infra agents in parallel`);
    const [apiResult, dataResult, serviceResult, infraResult] = await Promise.allSettled([
      runApiAgent(sessionId, plannerResult, mainServiceNodeId),
      runDataAgent(sessionId, plannerResult),
      runServiceAgent(sessionId, plannerResult, mainServiceNodeId),
      runInfraAgent(sessionId, plannerResult, mainServiceNodeId),
    ]);
    for (const [name, result] of [['api', apiResult], ['data', dataResult], ['service', serviceResult], ['infra', infraResult]] as const) {
      if (result.status === 'rejected') console.error(`[orchestrator] session=${sessionId} ${name} agent failed:`, result.reason);
      else console.log(`[orchestrator] session=${sessionId} ${name} agent done`);
    }

    // Collect all nodes discovered so far so the features agent can match references
    const parallelNodes: DiagramNode[] = [
      mainServiceNode,
      ...(apiResult.status === 'fulfilled' ? apiResult.value.nodes : []),
      ...(dataResult.status === 'fulfilled' ? dataResult.value.nodes : []),
      ...(serviceResult.status === 'fulfilled' ? serviceResult.value.nodes : []),
      ...(infraResult.status === 'fulfilled' ? infraResult.value.nodes : []),
    ];

    console.log(`[orchestrator] session=${sessionId} running features agent`);
    let featuresResult: { nodes: DiagramNode[]; edges: import('@codebase-viz/shared-types').DiagramEdge[] } = { nodes: [], edges: [] };
    try {
      featuresResult = await runFeaturesAgent(sessionId, plannerResult, parallelNodes);
      console.log(`[orchestrator] session=${sessionId} features agent done — ${featuresResult.nodes.length} features`);
    } catch (err) {
      console.error(`[orchestrator] session=${sessionId} features agent failed:`, err);
    }

    const criticInput = {
      planner: { nodes: [], edges: [] },
      api: apiResult.status === 'fulfilled' ? apiResult.value : { nodes: [], edges: [] },
      data: dataResult.status === 'fulfilled' ? dataResult.value : { nodes: [], edges: [] },
      service: serviceResult.status === 'fulfilled' ? serviceResult.value : { nodes: [], edges: [] },
      infra: infraResult.status === 'fulfilled' ? infraResult.value : { nodes: [], edges: [] },
      features: featuresResult,
      mainServiceNode,
    };

    console.log(`[orchestrator] session=${sessionId} running critic agent`);
    const { nodes, edges } = await runCriticAgent(sessionId, criticInput);
    console.log(`[orchestrator] session=${sessionId} critic done — ${nodes.length} nodes, ${edges.length} edges`);

    console.log(`[orchestrator] session=${sessionId} generating diagram`);
    runDiagramGenerator(sessionId, nodes, edges);

    console.log(`[orchestrator] session=${sessionId} complete`);
    sseManager.close(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[orchestrator] session=${sessionId} failed:`, message);
    sseManager.send(sessionId, { event: 'error', data: { message } });
    sseManager.close(sessionId);
    throw err;
  } finally {
    if (repoPath) {
      cleanupRepo(sessionId).catch(() => {});
    }
  }
}
