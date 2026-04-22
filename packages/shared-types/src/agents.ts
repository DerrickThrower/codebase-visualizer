export interface FileEntry {
  path: string;
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'unknown';
  size: number;
}

export interface PlannerResult {
  fileMap: FileEntry[];
  entryPoints: string[];
  languages: string[];
  framework: string;
  routeFiles: string[];
  modelFiles: string[];
  configFiles: string[];
}

export interface AgentFinding {
  agentName: string;
  nodeIds: string[];
  edgeIds: string[];
  confidence: number;
}
