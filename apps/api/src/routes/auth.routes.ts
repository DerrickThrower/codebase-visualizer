import { Router } from 'express';
import type { Request, Response } from 'express';

export const authRoutes = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI!;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

authRoutes.get('/github', (_req: Request, res: Response) => {
  console.log('[auth] redirecting to GitHub OAuth');
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'repo read:user',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

authRoutes.get('/github/callback', async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    console.warn('[auth] callback missing code param');
    res.redirect(`${FRONTEND_URL}?error=missing_code`);
    return;
  }

  console.log('[auth] exchanging GitHub OAuth code for token');
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      console.error('[auth] token exchange failed:', tokenData.error);
      res.redirect(`${FRONTEND_URL}?error=token_exchange_failed`);
      return;
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json() as { login: string; id: number; avatar_url: string };

    req.session.githubToken = tokenData.access_token;
    req.session.githubUser = { login: user.login, id: user.id, avatar_url: user.avatar_url };

    console.log(`[auth] logged in as ${user.login}`);
    res.redirect(`${FRONTEND_URL}?connected=true`);
  } catch (err) {
    console.error('[auth] OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}?error=auth_failed`);
  }
});

authRoutes.get('/me', (req: Request, res: Response) => {
  if (!req.session.githubUser) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ user: req.session.githubUser });
});

authRoutes.post('/logout', (req: Request, res: Response) => {
  const user = req.session.githubUser?.login ?? 'unknown';
  req.session.destroy(() => {
    console.log(`[auth] logged out ${user}`);
    res.json({ ok: true });
  });
});
