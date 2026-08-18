# Radar de Escolhas API

Fastify + TypeScript API for Radar de Escolhas. Persistent production data uses SQLite, with a database path configured by `ATLAS_DATABASE_PATH`; append-only tracking events are committed atomically.

## Run

```sh
pnpm --filter @atlas/api dev
pnpm --filter @atlas/api build
pnpm --filter @atlas/api test
```

Use `apps/api/.env.example` as the configuration reference. In production, set a persistent `ATLAS_DATABASE_PATH`, a long `AUTH_SECRET`, `ATLAS_ADMIN_EMAIL`, `ATLAS_REGISTRATION_ENABLED=false`, the web `CORS_ORIGIN`, and the public HTTPS `ATLAS_PUBLIC_URL`. Without an AI credential, the deterministic provider is development-only and is reported as `mock`. Do not commit `.env` files or OAuth tokens.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Runtime and storage readiness |
| GET | `/auth/registration-status` | Safe public registration availability |
| POST | `/auth/register` | Create the permitted initial administrator or an enabled member |
| POST | `/auth/login` | Create an authenticated session |
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
| GET | `/atlas/readiness` | Authenticated status of commercial integrations |
| GET | `/r/campaign/:id` | Record a confirmed campaign click and redirect |
| GET | `/r/shopee/:id` | Record a confirmed Shopee click and redirect |
| GET | `/r/hotmart/:id` | Record a confirmed Hotmart click and redirect |

Request bodies reject unknown fields and enforce lengths, enums and ISO dates. Errors use `{ error, message, statusCode, requestId? }`. Live social publication uses only official OAuth APIs and remains unavailable until the corresponding access token is configured.
