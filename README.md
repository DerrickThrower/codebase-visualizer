# Codebase Visualizer

A Turborepo monorepo that connects to a GitHub repository, runs multi-agent analysis on the cloned codebase, and streams an interactive system-design diagram to the browser with Server-Sent Events (SSE).

## What’s inside

| Package / app | Description |
|---------------|-------------|
| `apps/web` | Next.js 14 (App Router) UI: repo connection, OAuth callback, React Flow diagram, agent status, natural-language query bar |
| `apps/api` | Express API: sessions (Redis), GitHub OAuth, clone + analyze pipeline, SSE stream, streaming query responses |
| `packages/shared-types` | Shared TypeScript types for diagrams and SSE events |
| `packages/tsconfig` | Shared `tsconfig` presets |

## Prerequisites

- **Node.js** (see root `package.json` for `packageManager`; npm 11.x is specified)
- **Redis** (required for sessions; easiest via Docker Compose below)
- **Anthropic** and **GitHub OAuth** credentials for real analysis and private repos
- **Docker** (optional but recommended) for Redis, Neo4j, Graphiti, and optional Letta

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment files

Copy the examples and fill in values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

- **`apps/api/.env`** — `ANTHROPIC_API_KEY`, GitHub OAuth (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`), `SESSION_SECRET`, `REDIS_URL`, `FRONTEND_URL`, optional `GRAPHITI_SERVICE_URL` / `LETTA_BASE_URL`, `TEMP_DIR`
- **`apps/web/.env`** — `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`)

For Graphiti in Docker, set `OPENAI_API_KEY` in your shell or a `.env` file next to `docker-compose.yml` so the Graphiti service can embed text.

### 3. Supporting services (recommended)

From the repository root:

```bash
docker compose up -d
```

This starts Redis, Neo4j, the Graphiti image, and Letta (see `docker-compose.yml` for ports). The API degrades gracefully if Graphiti is unavailable; Redis should be running for session-backed OAuth and analyze flows.

### 4. Run the stack

```bash
npm run dev
```

Turbo runs the API and web app together:

- **Web:** http://localhost:3000  
- **API:** http://localhost:4000 (`GET /health` for a quick check)

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start all workspaces in development mode |
| `npm run build` | Production build (Turbo) |
| `npm run lint` | Lint across workspaces |

## How it works (high level)

1. The user opens the web app and signs in with GitHub (OAuth handled by the API; session cookie + Redis).
2. A session is created; the user submits a repository URL.
3. The API clones the repo, runs planner and specialist agents (API surface, data, services, infra), merges results with a critic step, lays out nodes with Dagre, and pushes **SSE** events (`node:added`, `edge:added`, `agent:update`, `analysis:complete`, etc.) to the client.
4. The visualize page consumes the stream and updates the React Flow canvas and status rail.
5. Optional **query** flow searches Graphiti-backed facts and streams a short answer from Claude.

## GitHub OAuth

Register a GitHub OAuth app with:

- **Authorization callback URL** matching `GITHUB_REDIRECT_URI` (for local dev, typically `http://localhost:4000/auth/github/callback`).

Ensure `FRONTEND_URL` matches where the browser loads the Next app (e.g. `http://localhost:3000`) so CORS and redirects stay consistent.

## License

Private / unpublished unless you add a license file.
