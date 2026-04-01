# SecondMe Review Assets

Updated: 2026-04-01

## 1. Current local assets

### Icon

- Source asset:
  - `web/public/secondme/pet-agent-social-icon.svg`
- Suggested deployment URL after HTTPS is ready:
  - `https://<your-domain>/secondme/pet-agent-social-icon.svg`
- Suggested export set for submission backups:
  - `512x512`
  - `256x256`
  - `128x128`

Current conclusion:

- local icon asset is ready
- `iconUrl` is still blocked on production HTTPS deployment

---

## 2. Screenshot shot list

Use the existing product pages instead of mock images. Capture clean states only.

### Screenshot A: public website

- Route: `/`
- Goal: show the app overview, SecondMe positioning, and public links
- Keep visible:
  - hero title
  - `Continue With SecondMe`
  - support/privacy links

### Screenshot B: sign-in page

- Route: `/login`
- Goal: show that SecondMe is the only sign-in method
- Keep visible:
  - `Continue with SecondMe`
  - current session area if already signed in
- Avoid:
  - transient error messages

### Screenshot C: pet profile

- Route: `/my-pet`
- Goal: show one pet's identity, status, and recent chat history
- Prepare before capture:
  - one fully created pet
  - non-empty status panel
  - at least 2 to 3 recent messages

### Screenshot D: home scene

- Route: `/home`
- Goal: show the 2D home scene and live pet interaction surface
- Prepare before capture:
  - one pet selected
  - furniture and room scene visible
  - no loading state

### Screenshot E: social page

- Route: `/social`
- Goal: show pet-to-pet interaction capability
- Prepare before capture:
  - at least one available social target
  - one visible friendship or task history item when possible

### Optional Screenshot F: pet list

- Route: `/my-pets`
- Goal: show multi-pet support
- Prepare before capture:
  - at least 2 pets in the same account
  - one active pet highlighted

---

## 3. Capture checklist

Before taking screenshots:

1. Use a logged-in SecondMe session.
2. Remove temporary error banners and empty states.
3. Make sure pet names and descriptions are presentable.
4. Use a desktop viewport wide enough to avoid mobile wrapping.
5. Capture full-quality originals first, then crop to platform requirements later.

Recommended practical baseline:

- desktop browser width around `1440px`
- browser zoom `100%`
- light theme only

---

## 4. Remaining blockers

Still missing before real submission:

- public HTTPS domain
- final deployed `websiteUrl`
- final deployed `supportUrl`
- final deployed `privacyPolicyUrl`
- final exported screenshots from the deployed site
