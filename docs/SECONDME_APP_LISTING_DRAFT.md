# SecondMe App Listing Draft

Updated: 2026-04-01

This document is the single source of truth for the current Pet Agent Social
App listing draft. It is intended to be copy-pasted into the SecondMe App
listing flow after a production HTTPS domain is ready.

## 1. Listing status

### Confirmed

- Existing External App already exists.
  - `appId`: `534fd830-773a-4876-b825-ee6343c154c8`
  - `appName`: `Pet Agent Social`
- Current platform status:
  - `listingStatus = not_applied`
  - `publishStatus = unpublished`
- Current local callback route already works:
  - `http://localhost:3000/api/auth/secondme/callback`
- Local public pages now exist:
  - `/`
  - `/support`
  - `/privacy`
- Local icon asset now exists:
  - `web/public/secondme/pet-agent-social-icon.svg`

### Inferred / recommended

- Recommended listing scope set:
  - `userinfo`
  - `chat.read`
  - `chat.write`
- Reason:
  - the current app positioning is not sign-in only
  - it explicitly includes pet chat and pet interaction features
  - shrinking to `userinfo` only would understate the current product behavior
- Recommended production callback route:
  - `https://<your-domain>/api/auth/secondme/callback`

### Missing

- Production HTTPS domain
- `websiteUrl`
- `supportUrl`
- `privacyPolicyUrl`
- `iconUrl`
- Final uploaded screenshots or final deployed screenshot captures

---

## 2. Copy-paste listing draft

Use the values below unless a later product decision changes them.

```text
App Name
Pet Agent Social

App Description
An AI pet social card built with SecondMe ecosystem APIs. Users can create AI pets, view pet status, chat with pets, and trigger pet-to-pet social interactions.

Website URL
https://<your-domain>/

Support URL
https://<your-domain>/support

Privacy Policy URL
https://<your-domain>/privacy

Icon URL
https://<your-domain>/secondme/pet-agent-social-icon.svg

Redirect URI
https://<your-domain>/api/auth/secondme/callback

Allowed Scopes
userinfo
chat.read
chat.write
```

---

## 3. Scope decision note

### Confirmed

- The current platform-side app already has:
  - `userinfo`
  - `chat.read`
  - `chat.write`

### Inferred

- Keep the current three scopes for the listing draft.

### Why this is the safest current choice

- The app already presents chat as a core user-facing feature.
- The public website copy now mentions chat and live pet interaction.
- A later scope reduction should only happen if the product surface or OAuth
  implementation is intentionally narrowed.

### Do not do this yet

- Do not switch the listing draft back to `userinfo` only unless the app copy,
  implementation, and platform-side scope config are all updated together.

---

## 4. Final URL map after deployment

Replace `<your-domain>` only after the production site is live.

| Field | Final value pattern | Current status |
|------|----------------------|----------------|
| `websiteUrl` | `https://<your-domain>/` | missing |
| `supportUrl` | `https://<your-domain>/support` | missing |
| `privacyPolicyUrl` | `https://<your-domain>/privacy` | missing |
| `iconUrl` | `https://<your-domain>/secondme/pet-agent-social-icon.svg` | missing |
| `redirectUri` | `https://<your-domain>/api/auth/secondme/callback` | missing |

---

## 5. Screenshot mapping

Use `docs/SECONDME_REVIEW_ASSETS.md` as the capture guide. The recommended
minimum set is:

1. Public website: `/`
2. Sign-in page: `/login`
3. Pet profile: `/my-pet`
4. Home scene: `/home`
5. Social page: `/social`

Optional:

6. Multi-pet page: `/my-pets`

---

## 6. Submission gate

Do not run formal App listing submission until all items below are true:

1. Production HTTPS domain is available.
2. The four public URLs in section 4 resolve correctly.
3. Final screenshots are captured from the deployed site.
4. The icon is reachable through the deployed `iconUrl`.
5. The production callback URL has been added to the SecondMe External App.

Current conclusion:

- local listing draft is ready
- formal App submission is still blocked on production deployment
