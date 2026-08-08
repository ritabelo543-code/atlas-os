# Atlas API

Fastify + TypeScript API for the Atlas MVP. The current persistence is local JSON in `apps/api/data`; writes use a temporary file and atomic rename.

## Run

```sh
pnpm --filter @atlas/api dev
pnpm --filter @atlas/api build
pnpm --filter @atlas/api test
```

Environment variables: `PORT`, `HOST`, `CORS_ORIGIN`, `ATLAS_DATA_DIR`, `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL` and `AI_API_KEY`. Without `AI_API_KEY`, the safe deterministic development provider is used. Do not commit `.env` files.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Runtime and storage readiness |
| GET/POST | `/projects` | List/create projects |
| GET/PATCH/DELETE | `/projects/:id` | Read/update/delete a project |
| GET/POST | `/projects/:id/tasks` | List/create tasks for a project |
| GET | `/tasks` | List all tasks (dashboard compatibility) |
| PATCH/DELETE | `/tasks/:id` | Update/delete a task |
| GET | `/atlas/status` | Atlas lifecycle, modules and AI provider metadata |
| GET/POST | `/missions` | List/create missions |
| GET | `/missions/:id` | Read a mission |
| POST | `/missions/:id/execute` | Execute the decision flow |
| GET | `/decisions/:id` | Read a structured decision |

Request bodies reject unknown fields and enforce lengths, enums and ISO dates. Errors use `{ error, message, statusCode, requestId? }`. Deleting a project also deletes its tasks.
