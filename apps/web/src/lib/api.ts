const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function createSession(): Promise<{ sessionId: string }> {
  const res = await fetch(`${API_BASE}/session`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function startAnalysis(sessionId: string, repoUrl: string): Promise<void> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, repoUrl }),
  });
  if (!res.ok) throw new Error('Failed to start analysis');
}

export function getStreamUrl(sessionId: string): string {
  return `${API_BASE}/analyze/${sessionId}/stream`;
}

export async function getMe(): Promise<{ user: { login: string; avatar_url: string } } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function getGitHubAuthUrl(): string {
  return `${API_BASE}/auth/github`;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function* queryStream(sessionId: string, question: string): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, question }),
  });

  if (!res.ok || !res.body) throw new Error('Query failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed: { text: string } = JSON.parse(data);
          yield parsed.text;
        } catch { /* skip malformed */ }
      }
    }
  }
}
