export type NodeType = 'service' | 'api' | 'database' | 'infra' | 'external';

export type RelationshipType =
  | 'HANDLES'
  | 'READS'
  | 'WRITES'
  | 'RELATES_TO'
  | 'DEPENDS_ON'
  | 'CONNECTS_TO'
  | 'PROTECTED_BY';

export interface ServiceMetadata {
  type: 'Service';
  name: string;
  language: string;
  framework: string;
  filePath: string;
  confidence: number;
  agentSource: string;
}

export interface ApiEndpointMetadata {
  type: 'ApiEndpoint';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handlerName: string;
  authRequired: boolean;
  middlewares: string[];
  filePath: string;
  lineNumber: number;
  confidence: number;
  agentSource: string;
}

export interface DatabaseEntityMetadata {
  type: 'DatabaseEntity';
  name: string;
  dbType: 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'unknown';
  orm: 'prisma' | 'typeorm' | 'sequelize' | 'sqlalchemy' | 'mongoose' | 'raw';
  fields: Array<{ name: string; type: string; nullable: boolean }>;
  filePath: string;
  confidence: number;
  agentSource: string;
}

export interface ExternalDependencyMetadata {
  type: 'ExternalDependency';
  name: string;
  category: 'cloud' | 'payment' | 'email' | 'auth' | 'monitoring' | 'queue' | 'other';
  envKeys: string[];
  sdkPackage: string;
  confidence: number;
  agentSource: string;
}

export type NodeMetadata =
  | ServiceMetadata
  | ApiEndpointMetadata
  | DatabaseEntityMetadata
  | ExternalDependencyMetadata;

export interface DiagramNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    metadata: NodeMetadata;
    confidence: number;
    agentSource: string;
    isNew?: boolean;
  };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: 'dataFlow' | 'auth' | 'dependency';
  label?: string;
  animated: boolean;
  data: {
    relationshipType: RelationshipType;
    direction: 'unidirectional' | 'bidirectional';
  };
}
