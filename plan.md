# Codebase System Design Visualizer — Architecture Plan

## What it does
Point it at a GitHub repo → multiple AI agents analyze the codebase → an interactive system design diagram builds live on screen as agents work.

## Stack
- **Frontend:** Next.js (App Router) + React Flow + Tailwind + Zustand
- **Backend:** Express.js
- **AI:** Claude multi-agent (Planner → parallel specialists → Critic → Diagram Generator)
- **Streaming:** Server-Sent Events (SSE) for live diagram updates
- **Knowledge graph:** Graphiti (Zep) — Python microservice backed by Neo4j
- **Code parsing:** Tree-sitter (language-agnostic AST)
- **Observability:** Langfuse
- **Memory:** Letta (for large repos >20k lines)

---

## Project Structure

```
codebase-visualizer/
├── package.json
├── turbo.json
├── .env.example
├── docker-compose.yml              # Redis, Neo4j, Graphiti Python service
│
├── apps/
│   ├── web/                        # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                  # Landing / repo connect
│   │   │   │   ├── auth/callback/route.ts    # GitHub OAuth callback
│   │   │   │   └── visualize/[sessionId]/page.tsx
│   │   │   ├── components/
│   │   │   │   ├── diagram/
│   │   │   │   │   ├── DiagramCanvas.tsx     # React Flow wrapper
│   │   │   │   │   ├── nodes/
│   │   │   │   │   │   ├── ServiceNode.tsx
│   │   │   │   │   │   ├── ApiNode.tsx
│   │   │   │   │   │   ├── DatabaseNode.tsx
│   │   │   │   │   │   ├── InfraNode.tsx
│   │   │   │   │   │   └── ExternalNode.tsx
│   │   │   │   │   ├── edges/
│   │   │   │   │   │   ├── DataFlowEdge.tsx
│   │   │   │   │   │   └── AuthEdge.tsx
│   │   │   │   │   └── NodeDetailPanel.tsx   # Slide-out on node click
│   │   │   │   ├── repo/
│   │   │   │   │   ├── RepoConnector.tsx     # GitHub connect UI
│   │   │   │   │   └── ZipUploader.tsx
│   │   │   │   ├── query/
│   │   │   │   │   └── QueryBar.tsx
│   │   │   │   └── AgentStatusRail.tsx       # Live agent progress sidebar
│   │   │   ├── hooks/
│   │   │   │   ├── useSSE.ts
│   │   │   │   ├── useDiagramStore.ts
│   │   │   │   └── useAgentStatus.ts
│   │   │   ├── stores/
│   │   │   │   └── diagramStore.ts           # Zustand store
│   │   │   └── lib/
│   │   │       ├── github.ts
│   │   │       └── api.ts
│   │
│   └── api/                        # Express backend
│       ├── src/
│       │   ├── index.ts
│       │   ├── routes/
│       │   │   ├── auth.routes.ts
│       │   │   ├── session.routes.ts
│       │   │   ├── analyze.routes.ts
│       │   │   └── query.routes.ts
│       │   ├── agents/
│       │   │   ├── orchestrator.ts           # ← NOT BUILT
│       │   │   ├── plannerAgent.ts           # ← BUILT
│       │   │   ├── apiAgent.ts               # ← BUILT
│       │   │   ├── dataAgent.ts              # ← BUILT
│       │   │   ├── serviceAgent.ts           # ← NOT BUILT
│       │   │   ├── infraAgent.ts             # ← NOT BUILT
│       │   │   ├── criticAgent.ts            # ← NOT BUILT
│       │   │   └── diagramGenerator.ts       # ← NOT BUILT
│       │   ├── streaming/
│       │   │   └── sseManager.ts             # ← BUILT
│       │   ├── services/
│       │   │   ├── github.service.ts         # ← BUILT
│       │   │   ├── treesitter.service.ts     # ← BUILT
│       │   │   ├── graphiti.service.ts       # ← BUILT
│       │   │   ├── letta.service.ts          # ← NOT BUILT
│       │   │   └── langfuse.service.ts       # ← NOT BUILT
│       │   └── types/
│       │       └── session.types.ts          # ← BUILT
│
└── packages/
    ├── shared-types/
    │   └── src/
    │       ├── sse-events.ts                 # ← BUILT
    │       ├── diagram.ts                    # ← BUILT
    │       └── agents.ts                     # ← BUILT
    └── tsconfig/
```

---

## Agent Pipeline

```
POST /analyze
  │
  └─► orchestrator.run(sessionId, repoPath)
        │
        ├─ 1. PlannerAgent — maps structure, detects language/framework
        │      Output: PlannerResult { fileMap, entryPoints, routeFiles, modelFiles, configFiles }
        │
        ├─ 2. Parallel fan-out (Promise.allSettled):
        │      ├─ APIAgent     — finds HTTP routes/endpoints
        │      ├─ DataAgent    — finds DB schemas, ORM models
        │      ├─ ServiceAgent — maps internal module dependencies
        │      └─ InfraAgent   — reads env vars, Docker, cloud SDK usage
        │         Each agent: parses with tree-sitter → stores in Graphiti → emits node:added SSE events
        │
        ├─ 3. CriticAgent — deduplicates, resolves conflicts, applies Reflexion pattern
        │      re-reads source files for low-confidence findings
        │
        └─ 4. DiagramGenerator (deterministic)
               Graphiti graph → React Flow nodes/edges via Dagre layout
               emits: analysis:complete
```

**Agent communication:** Agents do NOT call each other directly. They communicate via Graphiti (shared knowledge graph) and the SSE EventEmitter.

**ReAct pattern:** Each agent: THINK (reason about what tool to call) → ACT (call tool) → OBSERVE (feed result back) → repeat until done.

---

## SSE Event Schema

```typescript
type SSEEvent =
  | { event: 'agent:update'; data: { agentName: string; status: 'running' | 'complete' | 'error'; message: string } }
  | { event: 'node:added';   data: DiagramNode }
  | { event: 'edge:added';   data: DiagramEdge }
  | { event: 'node:updated'; data: { id: string; data: Partial<DiagramNode['data']> } }
  | { event: 'analysis:complete'; data: { nodes: DiagramNode[]; edges: DiagramEdge[]; sessionId: string } }
  | { event: 'error';        data: { message: string; agentName?: string } }
```

---

## Graphiti Node/Edge Schema

### Node Types
- **Service** — `{ name, language, framework, filePath, confidence, agentSource }`
- **ApiEndpoint** — `{ method, path, handlerName, authRequired, middlewares, filePath, lineNumber, confidence }`
- **DatabaseEntity** — `{ name, dbType, orm, fields[], filePath, confidence }`
- **ExternalDependency** — `{ name, category, envKeys[], sdkPackage, confidence }`

### Edge Types
- `HANDLES` — Service → ApiEndpoint
- `READS` / `WRITES` — Service → DatabaseEntity
- `RELATES_TO` — DatabaseEntity → DatabaseEntity (FK)
- `DEPENDS_ON` — Service → Service
- `CONNECTS_TO` — Service → ExternalDependency
- `PROTECTED_BY` — ApiEndpoint → AuthMechanism

---

## React Flow Node Types

| Type | Color | Shows |
|---|---|---|
| `service` | Blue | Service name, tech stack badge |
| `api` | Green | HTTP method + route path |
| `database` | Purple | DB type + schema name |
| `infra` | Orange | Config key / env var group |
| `external` | Gray (dashed) | Third-party name |

---

## GitHub Integration

**OAuth flow:**
1. `GET /auth/github` → redirect to GitHub OAuth
2. `GET /auth/github/callback?code=XXX` → exchange for token → store in Redis session → redirect to frontend
3. Frontend stores sessionId in localStorage

**Repo access:** Clone to `/tmp/sessions/{sessionId}` via `simple-git`. Preferred over GitHub API streaming because tree-sitter needs filesystem access. Cleanup after 1 hour.

---

## Infrastructure (docker-compose.yml)

```yaml
services:
  redis:         # Session storage
  neo4j:         # Graphiti backing store
  graphiti-service:  # Python microservice wrapping Graphiti (port 8001)
```

Graphiti uses a Python microservice because its canonical SDK is Python. The Node.js backend talks to it via REST.

---

## Environment Variables

```bash
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ANTHROPIC_API_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
REDIS_URL=redis://localhost:6379
LETTA_BASE_URL=http://localhost:8283
GRAPHITI_SERVICE_URL=http://localhost:8001
SESSION_SECRET=
TEMP_DIR=/tmp/sessions
FRONTEND_URL=http://localhost:3000
```

---

## Build Phases

| Phase | What | Status |
|---|---|---|
| 1 | Monorepo scaffold, shared types, bare Express + Next.js | ✅ Done |
| 2 | GitHub OAuth, repo cloning, session management | ✅ Done |
| 3 | SSE streaming infrastructure (sseManager, useSSE hook) | ✅ Done |
| 4 | Tree-sitter parsing service | ✅ Done |
| 5 | Graphiti Python microservice + Node.js client | ✅ Done |
| 6 | Individual agents (Planner, API, Data built; Service, Infra, Critic, DiagramGenerator missing) | 🔧 In Progress |
| 7 | Orchestrator + parallel execution | ❌ Not started |
| 8 | React Flow diagram + live node appearance via SSE | ❌ Not started |
| 9 | Plain English query interface | ❌ Not started |
| 10 | ZIP upload + error/loading states | ❌ Not started |
| 11 | E2E testing against real repos, prompt tuning | ❌ Not started |

---

## Architectural Decisions

- **SSE over WebSockets** — unidirectional server→client, simpler, no extra infra
- **Clone over GitHub API** — tree-sitter needs local filesystem; cloning is faster for repeated reads
- **Graphiti as shared agent memory** — agents run in parallel and need to reference each other's findings; Graphiti decouples them
- **Python microservice for Graphiti** — canonical SDK is Python; avoids reimplementing episodic memory in Node.js
- **Letta optional** — only kicks in for repos >20k lines where agent context windows fill up

---

## Critical Files

- `apps/api/src/agents/orchestrator.ts` — central agent coordination, parallel fan-out
- `apps/api/src/streaming/sseManager.ts` — SSE connection lifecycle
- `apps/api/src/services/treesitter.service.ts` — AST parsing used by all agents
- `apps/web/src/hooks/useSSE.ts` — SSE consumption → Zustand store
- `packages/shared-types/src/sse-events.ts` — contract between backend events and frontend
