import { Router } from 'express';
import type { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getSession } from './session.routes';
import { graphitiService } from '../services/graphiti.service';

export const queryRoutes = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

queryRoutes.post('/', async (req: Request, res: Response) => {
  const { sessionId, question } = req.body as { sessionId?: string; question?: string };

  if (!sessionId || !question) {
    res.status(400).json({ error: 'sessionId and question are required' });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  try {
    const relevantNodes = await graphitiService.searchNodes(sessionId, question);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are answering questions about a codebase based on its analyzed system design.

Relevant components found:
${JSON.stringify(relevantNodes, null, 2)}

Question: ${question}

Answer concisely based only on the components above. Reference specific service names, endpoints, or models when relevant.`,
        },
      ],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[query] error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Query failed' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Query failed' })}\n\n`);
      res.end();
    }
  }
});
