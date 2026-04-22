import Anthropic from '@anthropic-ai/sdk';
import type { PlannerResult, FileEntry } from '@codebase-viz/shared-types';
import { listFilesRecursive } from '../services/github.service';
import { detectLanguage, readFile, detectFramework } from '../services/treesitter.service';
import { sseManager } from '../streaming/sseManager';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runPlannerAgent(sessionId: string, repoPath: string): Promise<PlannerResult> {
  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'planner', status: 'running', message: 'Scanning repository structure...' },
  });

  const allFiles = await listFilesRecursive(repoPath);

  const fileMap: FileEntry[] = allFiles.map(f => ({
    path: f,
    language: detectLanguage(f),
    size: 0,
  }));

  const knownFiles = fileMap.filter(f => f.language !== 'unknown');
  const samplePaths = knownFiles.slice(0, 50).map(f => f.path.replace(repoPath, ''));

  const sampleContents = new Map<string, string>();
  for (const file of knownFiles.slice(0, 20)) {
    sampleContents.set(file.path, await readFile(file.path));
  }

  const framework = detectFramework(allFiles, sampleContents);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `You are analyzing a codebase to identify key files for system design extraction.

File structure (sample):
${samplePaths.join('\n')}

Detected framework: ${framework}
Languages found: ${[...new Set(knownFiles.map(f => f.language))].join(', ')}

Identify:
1. Entry point files (main app file, server startup)
2. Route/controller files (files with HTTP endpoint definitions)
3. Model/schema files (database models, ORM schemas)
4. Config files (env config, docker, cloud config)

Respond as JSON: { "entryPoints": [], "routeFiles": [], "modelFiles": [], "configFiles": [] }
Only include relative paths that match the file structure above.`,
    }],
  });

  let parsed: Partial<PlannerResult> = {};
  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = { entryPoints: [], routeFiles: [], modelFiles: [], configFiles: [] };
  }

  const result: PlannerResult = {
    fileMap,
    entryPoints: (parsed.entryPoints ?? []).map((p: string) => `${repoPath}${p}`),
    languages: [...new Set(knownFiles.map(f => f.language))],
    framework,
    routeFiles: (parsed.routeFiles ?? []).map((p: string) => `${repoPath}${p}`),
    modelFiles: (parsed.modelFiles ?? []).map((p: string) => `${repoPath}${p}`),
    configFiles: (parsed.configFiles ?? []).map((p: string) => `${repoPath}${p}`),
  };

  sseManager.send(sessionId, {
    event: 'agent:update',
    data: { agentName: 'planner', status: 'complete', message: `Found ${fileMap.length} files, framework: ${framework}` },
  });

  return result;
}
