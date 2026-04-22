'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Github, ArrowRight, Loader2 } from 'lucide-react';
import { createSession, startAnalysis, getMe, getGitHubAuthUrl } from '@/lib/api';
import { useDiagramStore } from '@/stores/diagramStore';

export default function RepoConnector() {
  const router = useRouter();
  const { reset, setIsAnalyzing } = useDiagramStore();

  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe().then((data) => {
      if (data) setUser(data.user);
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      getMe().then((data) => { if (data) setUser(data.user); });
      window.history.replaceState({}, '', '/');
    }
    if (params.get('error')) {
      setError('GitHub authentication failed. Please try again.');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setError('');
    setLoading(true);
    reset();

    try {
      const { sessionId } = await createSession();
      setIsAnalyzing(true);
      await startAnalysis(sessionId, repoUrl.trim());
      router.push(`/visualize/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {user ? (
        <div className="flex items-center gap-3 bg-panel border border-border rounded-lg px-4 py-3">
          <img src={user.avatar_url} alt={user.login} className="w-7 h-7 rounded-full" />
          <span className="text-sm text-[#888888]">
            Connected as <span className="text-white">{user.login}</span>
          </span>
        </div>
      ) : (
        <a
          href={getGitHubAuthUrl()}
          className="flex items-center justify-center gap-2 w-full bg-panel border border-border hover:border-[#555555] rounded-lg px-4 py-3 text-sm text-[#888888] hover:text-white transition-colors"
        >
          <Github className="w-4 h-4" />
          Connect GitHub for private repos
        </a>
      )}

      <form onSubmit={handleAnalyze} className="space-y-3">
        <input
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#444444] focus:outline-none focus:border-[#555555] transition-colors"
          required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !repoUrl.trim()}
          className="flex items-center justify-center gap-2 w-full bg-white hover:bg-[#f0f0f0] text-black disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-3 text-sm font-medium transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
          ) : (
            <>Visualize <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </form>

      <p className="text-center text-xs text-[#444444]">
        Works with public repos without auth. Private repos require GitHub connection.
      </p>
    </div>
  );
}
