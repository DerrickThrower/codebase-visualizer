import { Router } from 'express';
import type { Request, Response } from 'express';
import { sseManager } from '../streaming/sseManager';
import { getSession, updateSession } from './session.routes';
import { runOrchestrator } from '../agents/orchestrator';
import { validateGitHubUrl } from '../services/github.service';

export const analyzeRoutes = Router();

analyzeRoutes.post('/', async (req: Request, res: Response) => {
  const { sessionId, repoUrl } = req.body as { sessionId?: string; repoUrl?: string };

  if (!sessionId || !repoUrl) {
    res.status(400).json({ error: 'sessionId and repoUrl are required' });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!validateGitHubUrl(repoUrl)) {
    console.warn(`[analyze] invalid GitHub URL: ${repoUrl}`);
    res.status(400).json({ error: 'Invalid GitHub repository URL' });
    return;
  }

  const githubToken = req.session.githubToken;
  console.log(`[analyze] starting analysis for session=${sessionId} repo=${repoUrl}`);

  updateSession(sessionId, { repoUrl, status: 'running' });

  res.json({ ok: true, sessionId });

  runOrchestrator(sessionId, repoUrl, githubToken).catch((err: Error) => {
    console.error(`[analyze] orchestrator failed for session=${sessionId}:`, err.message);
    updateSession(sessionId, { status: 'error', errorMessage: err.message });
    sseManager.send(sessionId, {
      event: 'error',
      data: { message: err.message },
    });
  });
});

analyzeRoutes.get('/:sessionId/stream', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  console.log(`[sse] client connected for session=${sessionId}`);
  sseManager.register(sessionId, res);
});
