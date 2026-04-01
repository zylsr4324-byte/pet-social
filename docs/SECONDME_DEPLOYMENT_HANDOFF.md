# SecondMe Deployment Handoff

Updated: 2026-04-01

This document is for the moment when Pet Agent Social gets a real production
HTTPS domain. Use it together with:

- `docs/SECONDME_APP_LISTING_DRAFT.md`
- `docs/SECONDME_REVIEW_ASSETS.md`
- `docs/RAILWAY_DEPLOYMENT.md`
- `docs/RAILWAY_DEPLOYMENT_ZH.md`
- `docs/RAILWAY_CONSOLE_CHECKLIST_ZH.md`

## 1. Required web environment variables

Start from:

- `web/.env.example`

Production values to replace:

```env
NEXT_PUBLIC_APP_BASE_URL=https://<your-domain>
NEXT_PUBLIC_API_BASE_URL=https://<your-api-domain>
API_BASE_URL=https://<your-api-domain>

SECONDME_CLIENT_ID=<your-secondme-client-id>
SECONDME_CLIENT_SECRET=<your-secondme-client-secret>
SECONDME_REDIRECT_URI=https://<your-domain>/api/auth/secondme/callback
SECONDME_OAUTH_URL=https://go.second.me/oauth/
SECONDME_TOKEN_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/code
SECONDME_REFRESH_ENDPOINT=https://api.mindverse.com/gate/lab/api/oauth/token/refresh
```

Notes:

- `NEXT_PUBLIC_APP_BASE_URL` is now used by public metadata, `robots.txt`,
  `sitemap.xml`, and SecondMe login redirects.
- `API_BASE_URL` is used by Next route handlers on the server side.
- `NEXT_PUBLIC_API_BASE_URL` is used by browser-side requests.
- `SECONDME_REDIRECT_URI` must match the production callback registered in the
  SecondMe External App.

---

## 2. URLs that must work after deployment

These URLs should all return successfully over HTTPS:

- `https://<your-domain>/`
- `https://<your-domain>/support`
- `https://<your-domain>/privacy`
- `https://<your-domain>/login`
- `https://<your-domain>/secondme/pet-agent-social-icon.svg`
- `https://<your-domain>/robots.txt`
- `https://<your-domain>/sitemap.xml`
- `https://<your-domain>/api/auth/secondme/callback`

If the API is hosted separately, also verify:

- `https://<your-api-domain>/health`

---

## 3. SecondMe-specific production checks

Before listing submission:

1. Confirm the production callback URL has been added to the existing External
   App.
2. Confirm the login page can start the SecondMe OAuth flow successfully.
3. Confirm the callback route finishes login and returns to `/login` with a
   working session.
4. Confirm `/auth/me` still returns `authProvider = secondme` for the logged-in
   session.
5. Confirm refresh-token renewal still works in the deployed backend.

---

## 4. Public listing URLs to backfill

After deployment, replace the placeholders in
`docs/SECONDME_APP_LISTING_DRAFT.md` with the real values:

- `websiteUrl`
- `supportUrl`
- `privacyPolicyUrl`
- `iconUrl`
- production `redirectUri`

Recommended patterns:

```text
websiteUrl=https://<your-domain>/
supportUrl=https://<your-domain>/support
privacyPolicyUrl=https://<your-domain>/privacy
iconUrl=https://<your-domain>/secondme/pet-agent-social-icon.svg
redirectUri=https://<your-domain>/api/auth/secondme/callback
```

---

## 5. Screenshot capture after deployment

Use `docs/SECONDME_REVIEW_ASSETS.md` as the shot list.

Minimum recommended capture set:

1. `/`
2. `/login`
3. `/my-pet`
4. `/home`
5. `/social`

Optional:

6. `/my-pets`

Do not capture:

- loading states
- temporary error banners
- broken image or missing icon states

---

## 6. Final pre-submit gate

Do not run `apply-listing` until all items below are true:

1. Production HTTPS deployment is stable.
2. All URLs in section 2 load correctly.
3. SecondMe OAuth works with the production callback.
4. Final screenshots are captured from the deployed site.
5. Listing fields in `docs/SECONDME_APP_LISTING_DRAFT.md` have been replaced
   with real production URLs.

Current conclusion:

- local deployment handoff is ready
- actual submission still depends on production deployment
