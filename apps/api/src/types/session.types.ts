import 'express-session';

declare module 'express-session' {
  interface SessionData {
    githubToken?: string;
    githubUser?: {
      login: string;
      id: number;
      avatar_url: string;
    };
  }
}

export interface AnalysisSession {
  id: string;
  repoUrl?: string;
  zipPath?: string;
  repoPath?: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}
