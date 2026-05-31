# Deployment

## Platform: Render.com

This app is deployed on **Render.com** (not Vercel). The deployment is configured via `render.yaml` at the project root.

- **Build command**: `pnpm install && pnpm build`
- **Start command**: `pnpm start`
- **Health check**: `/api/trpc/healthcheck`
- **Database**: PostgreSQL provisioned by Render (connection injected via `DATABASE_URL`)
- **Plan**: Free tier (web service + PostgreSQL)

## Pre-Deploy Checklist

- Run `pnpm prisma migrate deploy` before any launch or schema-changing deploy.
- Ensure all required env vars are set in the Render dashboard (see `.env-example` for the full list).
- Keep environment variables secure; never expose private values (e.g. `AUTH_SECRET`, `AI_API_KEY`, `AWS_SECRET_ACCESS_KEY`) to the client.

## Scheduled Jobs / Cron

- Cron jobs (e.g., AI import image cleanup at `/api/ai-import/cleanup`) are authenticated with `CRON_SECRET`.
- If scheduling cron on Render, use a Render Cron Job service pointing to the same `DATABASE_URL`.
- `CRON_SECRET` must be set in the Render environment and passed as a `Bearer` token in the `Authorization` header.

## CI/CD

- Use GitHub Actions for automated linting, testing, and build validation on PR.
- Render auto-deploys on push to the configured branch (typically `main`).
- Test SSR and static outputs thoroughly before merging to main.

## Local Development vs Production

- Local: PostgreSQL via Docker (`docker-compose.yaml`) or a local Postgres instance.
- Production: Render-managed PostgreSQL; connection string injected automatically via `render.yaml`.
