import { simpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';

const TEMP_DIR = process.env.TEMP_DIR || '/tmp/sessions';

export function validateGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'github.com' &&
      /^\/[\w.-]+\/[\w.-]+(\.git)?$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

export async function cloneRepo(sessionId: string, repoUrl: string, token?: string): Promise<string> {
  const targetDir = path.join(TEMP_DIR, sessionId);
  await fs.mkdir(targetDir, { recursive: true });

  let cloneUrl = repoUrl;
  if (token) {
    const parsed = new URL(repoUrl);
    cloneUrl = `https://oauth2:${token}@${parsed.host}${parsed.pathname}`;
  }

  const git = simpleGit();
  await git.clone(cloneUrl, targetDir, ['--depth', '1']);

  return targetDir;
}

export async function cleanupRepo(sessionId: string): Promise<void> {
  const targetDir = path.join(TEMP_DIR, sessionId);
  await fs.rm(targetDir, { recursive: true, force: true });
}

export async function listFilesRecursive(dir: string, maxFiles = 2000): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    if (results.length >= maxFiles) return;

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}
