import fs from 'fs/promises';
import path from 'path';

export type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'unknown';

export function detectLanguage(filePath: string): Language {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, Language> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
  };
  return map[ext] ?? 'unknown';
}

export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export function findRoutePatterns(content: string, language: Language): string[] {
  const routes: string[] = [];

  if (language === 'typescript' || language === 'javascript') {
    const expressPattern = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = expressPattern.exec(content)) !== null) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
    const nextPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g;
    while ((match = nextPattern.exec(content)) !== null) {
      routes.push(match[1]);
    }
  }

  if (language === 'python') {
    const fastapiPattern = /@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = fastapiPattern.exec(content)) !== null) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
  }

  if (language === 'go') {
    const goPattern = /(?:http\.HandleFunc|r\.(?:GET|POST|PUT|DELETE|PATCH))\s*\(\s*"([^"]+)"/g;
    let match;
    while ((match = goPattern.exec(content)) !== null) {
      routes.push(match[1]);
    }
  }

  return routes;
}

export function findModelPatterns(content: string, language: Language): string[] {
  const models: string[] = [];

  if (language === 'typescript' || language === 'javascript') {
    const prismaPattern = /model\s+(\w+)\s*\{/g;
    const typeormPattern = /@Entity\([^)]*\)\s*(?:export\s+)?class\s+(\w+)/g;
    const sequelizePattern = /class\s+(\w+)\s+extends\s+Model/g;
    const mongoosePattern = /new\s+Schema\s*\(/g;

    let match;
    while ((match = prismaPattern.exec(content)) !== null) models.push(match[1]);
    while ((match = typeormPattern.exec(content)) !== null) models.push(match[1]);
    while ((match = sequelizePattern.exec(content)) !== null) models.push(match[1]);
    if (mongoosePattern.test(content)) models.push('MongooseSchema');
  }

  if (language === 'python') {
    const sqlalchemyPattern = /class\s+(\w+)\s*\(\s*(?:Base|db\.Model|Model)\s*\)/g;
    let match;
    while ((match = sqlalchemyPattern.exec(content)) !== null) models.push(match[1]);
  }

  return models;
}

export function findImports(content: string, language: Language): string[] {
  const imports: string[] = [];

  if (language === 'typescript' || language === 'javascript') {
    const importPattern = /(?:import|require)\s*(?:\{[^}]*\}|[\w*]+)\s*(?:from\s*)?['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      if (!match[1].startsWith('.')) imports.push(match[1]);
    }
  }

  if (language === 'python') {
    const importPattern = /^(?:import|from)\s+([\w.]+)/gm;
    let match;
    while ((match = importPattern.exec(content)) !== null) imports.push(match[1]);
  }

  if (language === 'go') {
    const importPattern = /"([\w./]+)"/g;
    let match;
    while ((match = importPattern.exec(content)) !== null) imports.push(match[1]);
  }

  return imports;
}

export function findEnvVarUsage(content: string): string[] {
  const envVars: string[] = [];
  const patterns = [
    /process\.env\.(\w+)/g,
    /os\.environ(?:\.get)?\s*\(\s*['"](\w+)['"]/g,
    /os\.Getenv\s*\(\s*"(\w+)"/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      envVars.push(match[1]);
    }
  }

  return [...new Set(envVars)];
}

export function detectFramework(files: string[], contents: Map<string, string>): string {
  const allContent = Array.from(contents.values()).join('\n');
  const allPaths = files.join('\n');

  if (allPaths.includes('prisma/schema.prisma')) return 'express+prisma';
  if (allContent.includes("from 'fastapi'") || allContent.includes('from fastapi')) return 'fastapi';
  if (allContent.includes("from 'next'") || allPaths.includes('next.config')) return 'nextjs';
  if (allContent.includes("express()")) return 'express';
  if (allContent.includes('gin.Default()') || allContent.includes('gin.New()')) return 'gin';
  if (allContent.includes('NestFactory.create')) return 'nestjs';

  return 'unknown';
}
