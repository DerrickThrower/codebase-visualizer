import { Router } from 'express';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AnalysisSession } from '../types/session.types';

export const sessionRoutes = Router();

const sessions = new Map<string, AnalysisSession>();

export function getSession(id: string): AnalysisSession | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, patch: Partial<AnalysisSession>): void {
  const existing = sessions.get(id);
  if (existing) sessions.set(id, { ...existing, ...patch });
}

sessionRoutes.post('/', (req: Request, res: Response) => {
  const id = uuidv4();
  const session: AnalysisSession = {
    id,
    status: 'pending',
    createdAt: new Date(),
  };
  sessions.set(id, session);
  console.log(`[session] created ${id}`);
  res.json({ sessionId: id });
});

sessionRoutes.get('/:id', (req: Request, res: Response) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});
