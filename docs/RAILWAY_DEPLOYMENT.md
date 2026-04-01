# Railway Deployment

Updated: 2026-04-01

Chinese step-by-step version:

- `docs/RAILWAY_DEPLOYMENT_ZH.md`

This is the simplest production deployment path for the current SecondMe app
submission track.

Use one Railway project with 4 services:

1. `web`
2. `api`
3. `Postgres`
4. `Redis`

This keeps the current monorepo structure and does not require MCP release work.

## 1. Service layout

### `web`

- Root directory: `/web`
- Config as code file: `/web/railway.json`
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Watch paths: `/web/**`

### `api`

- Root directory: `/api`
- Config as code file: `/api/railway.json`
- Deploy with the existing `api/Dockerfile`
- Watch paths: `/api/**`

### `Postgres`

- Add a managed Railway Postgres service

### `Redis`

- Add a managed Railway Redis service

---

## 2. Web environment variables

Set these in the `web` service:

```env
NEXT_PUBLIC_APP_BASE_URL=https://<your-web-domain>
NEXT_PUBLIC_API_BASE_URL=https://<your-api-domain>
API_BASE_URL=https://<your-api-domain>

SECONDME_CLIENT_ID=<your-secondme-client-id>
SECONDME_CLIENT_SECRET=<your-secondme-client-secret>
SECONDME_REDIRECT_URI=https://<your-web-domain>/api/auth/secondme/callback
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh
```

Notes:

- `NEXT_PUBLIC_APP_BASE_URL` is used by metadata, sitemap, robots, and OAuth
  redirect generation.
- `NEXT_PUBLIC_API_BASE_URL` is used by browser-side API requests.
- `API_BASE_URL` is used by server-side route handlers.

---

## 3. API environment variables

Set these in the `api` service:

```env
APP_ENV=production
API_HOST=0.0.0.0
CORS_ALLOWED_ORIGINS=https://<your-web-domain>

DATABASE_URL=<your-railway-postgres-connection-url>
REDIS_URL=<your-railway-redis-connection-url>

SECONDME_API_BASE_URL=https://api.mindverse.com/gate/lab
SECONDME_CLIENT_ID=<your-secondme-client-id>
SECONDME_CLIENT_SECRET=<your-secondme-client-secret>
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh

LLM_BASE_URL=https://dashscope.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1
LLM_API_KEY=<your-llm-api-key>
LLM_MODEL=qwen-flash
```

Notes:

- `PORT` is provided by Railway automatically. The API now supports that
  directly.
- When `DATABASE_URL` is present, `POSTGRES_HOST` / `POSTGRES_PORT` /
  `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` can be omitted.
- When `REDIS_URL` is present, `REDIS_HOST` / `REDIS_PORT` can be omitted.
- `CORS_ALLOWED_ORIGINS` must point at the deployed `web` domain, otherwise the
  browser app cannot call the API with cookies.

---

## 4. Recommended deployment order

1. Deploy `Postgres`
2. Deploy `Redis`
3. Deploy `api`
4. Open `https://<your-api-domain>/health` and confirm it returns `status=ok`
5. Deploy `web`
6. Open:
   - `https://<your-web-domain>/`
   - `https://<your-web-domain>/support`
   - `https://<your-web-domain>/privacy`
   - `https://<your-web-domain>/login`

---

## 5. SecondMe production callback update

After `web` has a stable HTTPS domain, update the existing External App
callback from:

```text
http://localhost:3000/api/auth/secondme/callback
```

to:

```text
https://<your-web-domain>/api/auth/secondme/callback
```

Then verify:

1. `/login` can start the SecondMe OAuth flow
2. callback returns to the app successfully
3. `/auth/me` shows the logged-in user
4. the user remains linked to `authProvider = secondme`

---

## 6. After deployment

Once both services are working over HTTPS:

1. Fill the real production URLs into `docs/SECONDME_APP_LISTING_DRAFT.md`
2. Capture screenshots using `docs/SECONDME_REVIEW_ASSETS.md`
3. Re-check `docs/SECONDME_SUBMISSION_CHECKLIST.md`
4. Only then submit the SecondMe `App` listing

Current conclusion:

- Railway is the simplest path for this repo right now
- the repo is now prepared for Railway-style `DATABASE_URL`, `REDIS_URL`,
  production CORS, and production API startup
- actual SecondMe listing submission still waits on real HTTPS deployment
