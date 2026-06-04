# Embedded creator-surface "App Home" — handover

This documents the spike that wires up **embedded third-party apps** for creators
end-to-end: install → in-app consent → an **online session token** the embedded
app exchanges for a live API token. It works locally today (validated in the
browser). This doc is for colleagues to refine/productionise.

---

## 1. What it does

A creator opens an installed app's **creator surface** (`/app-store/:appUuid/creator-surface`)
inside Fanvue. Two concerns:

1. **Consent** — record the creator's OAuth consent for the app, **entirely in
   the app shell** (no browser redirect to Hydra).
2. **Online session** — once consented, Fanvue **mints a short-lived JWT**,
   **injects it into the iframe**, and the embedded app **exchanges it at Hydra**
   for an online access token (RFC 7523 `jwt-bearer`). No auth-code dance, no
   refresh token.

```
creator opens surface
   │  fanguard: getCreatorSurfaceLaunch
   ├─ not_installed / no_surface / not_found → bounce away
   ├─ needs_consent → render OAuthConsentView in-shell
   │      └─ Allow → acceptCreatorSurfaceConsent (server-side Hydra login+consent) → grant
   └─ ready → mint session token (horizon) → iframe src + "?token=" → embedded app
                                                          └─ exchange at Hydra /oauth2/token (jwt-bearer)
                                                                 → online access token (sub = creator)
```

---

## 2. Repos & PRs

| Repo | Branch / PR | What |
| ---- | ----------- | ---- |
| **pandora** (eden + fanguard) | `feat/app-store/creator-surface-consent` — **PR #26148** (stacked on `feat/app-store/creator-app-surface` #26110) | Free-app install, OAuth-client-id from pandora as source of truth, in-shell server-orchestrated consent, mint+inject the session token. |
| **horizon** (app-integration-service) | `feat/app-integration/mint-app-session-token` — **PR #503** | `mintAppSessionToken` + `getSessionTokenJwks` RPCs, ES256 signer, and the free-install gate fix (`isAppInstalledForUser`). |
| **fanvue-app-surfaces-test** (this repo) | `main` | Trivial test 3P app: `/embedded` exchanges the injected token. |

> **Dependency:** pandora's runtime needs horizon #503 merged (its bundled router
> types — `shared/src/types/appIntegrationRouter.d.ts` — were regenerated from the
> horizon branch to expose the two new RPCs).

---

## 3. Key components

**horizon** (`service-app-integration/apps/app-integration-service`)
- `mintAppSessionToken({ userUuid, applicationUuid }) → { token }` — 60s ES256
  assertion. `iss=SESSION_TOKEN_ISSUER_URL`, `sub=user`, `aud=HYDRA_TOKEN_URL`,
  `scope=SESSION_TOKEN_SCOPE`. Gated on the user being **connected = active
  install row OR active subscription** (`mint-app-session-token.ts`).
- `getSessionTokenJwks()` — public JWK so fanguard can register the trust grant.
- `isAppInstalledForUser` repo query (`main-repository-postgres/installations.ts`).
- Design doc: `service-app-integration/docs/embedded-app-session-tokens.md`.

**pandora/fanguard**
- `helpers/appIntegration/getCreatorSurfaceLaunch.ts` — resolves the surface
  state; on `ready`, mints + appends `?token=` to the iframe src.
- `helpers/appIntegration/recordCreatorSurfaceConsent.ts` — drives Hydra
  login+consent **server-side** (uses Node's `http` client, not `fetch` — see
  gotchas), accepts both challenges via the admin API.
- `helpers/appIntegration/getThirdPartyApplicationOauthClientByUuidQuery.ts` —
  client-id lookup (no `published_at` filter).
- `scripts/register-creator-surface-trust.mjs` — **one-off local admin script**
  (register Hydra trusted issuer + add the jwt-bearer grant to a client).

**pandora/eden**
- `pagecomponents/AppStorePage/CreatorSurfaceLauncher.tsx` — renders the in-shell
  consent screen / the iframe.
- `pagecomponents/AppStorePage/getAppPrimaryAction.ts` — install/open CTA logic.

**this repo (test app)**
- `src/app/embedded/page.tsx` + `src/lib/embedded.ts` — read `?token=`, exchange
  at Hydra, show `sub` / `scope` / no-refresh.

---

## 4. Local dev bring-up

1. **Horizon** with minting enabled (generate an ES256 key once):
   ```bash
   node -e 'const {generateKeyPairSync,randomUUID}=require("node:crypto");const {privateKey}=generateKeyPairSync("ec",{namedCurve:"P-256"});console.log(JSON.stringify({...privateKey.export({format:"jwk"}),kid:randomUUID()}))' > /tmp/session-signing-key.json

   cd service-app-integration/apps/app-integration-service
   SESSION_TOKEN_SIGNING_KEY="$(cat /tmp/session-signing-key.json)" \
   SESSION_TOKEN_ISSUER_URL=https://app-integration.local.fanvue.dev \
   HYDRA_TOKEN_URL=http://localhost:4444/oauth2/token \
   SESSION_TOKEN_SCOPE=openid \
   ./dev.sh --pg --localstack
   ```
   Verify minting: `curl localhost:9000/trpc/getSessionTokenJwks` returns a key.

2. **Trust grant + jwt-bearer client** (Hydra + horizon must be up):
   ```bash
   node pandora/fanguard/scripts/register-creator-surface-trust.mjs
   ```

3. **Test app over HTTPS** (this repo) — mkcert + local-ssl-proxy:
   ```bash
   mkcert app.local.fanvue.dev          # one-time
   echo "127.0.0.1 app.local.fanvue.dev" | sudo tee -a /etc/hosts
   pnpm dev                              # next dev :3000
   npx local-ssl-proxy --source 4101 --target 3000 \
     --cert ./app.local.fanvue.dev.pem --key ./app.local.fanvue.dev-key.pem
   ```
   `.env.local`: `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` = the app's Hydra client,
   `OAUTH_ISSUER_BASE_URL=http://localhost:4444`.

4. **Seed app iframe src** → point `creator_landing` at the test app:
   `https://app.local.fanvue.dev:4101/embedded` (horizon `third_party_app_iframes.iframe_src`).

5. **Pandora**: `pnpm start:sso` (eden + fanguard, AWS SSO) + `fvproxy`.

6. Open `https://local.fanvue.com/app-store/:appUuid/creator-surface`.

---

## 5. Gotchas discovered (read before changing things)

- **Free installs are not subscriptions.** A no-plan app install writes an
  install row but **no** billing subscription. Both the pandora install CTA and
  the horizon mint gate had to treat "installed" (not "subscribed") as the
  connected signal. Don't regress to a subscription-only check.
- **Bundled undici drops multiple `Set-Cookie` headers.** The server-orchestrated
  consent flow must carry Hydra's login *and* consent CSRF cookies; `fetch()` +
  `getSetCookie()` returned only one in the webpack bundle. `recordCreatorSurfaceConsent`
  uses Node's `http`/`https` client instead (always arrays Set-Cookie).
- **`published_at` is unreliable.** The client-id lookup must not require
  `published_at IS NOT NULL` — approved apps may be unpublished in seeds.
- **Consent flow needs the admin plane.** Hydra has no public consent-accept; the
  consent provider (fanguard) must call the admin API. "No admin endpoints" is
  only possible by not using Hydra-recorded consent.

---

## 6. Follow-ups / things to refine

- **Token injection mechanism.** The assertion is passed as a `?token=` query
  param (single-use, 60s — spike-proven). For production, evaluate the leak
  surface (URL/referrer/logs) vs. `postMessage` or a one-time server fetch.
- **horizon coverage:** add a repo-level test for `isAppInstalledForUser`
  (no `installations.test.ts` exists yet; aim for the 95% target).
- **pandora i18n:** the consent-failure toast reuses
  `apps.app-store.toasts.install-error`; add a dedicated `…consent-error` key.
- **Trust-grant registration** is a manual local script — automate per-env
  (read `getSessionTokenJwks`, register on deploy / key rotation).
- **`HYDRA_PUBLIC_URL`** locally is `http://localhost:4444`; for a seamless
  consent UX point it at a same-origin proxy so no foreign domain is ever shown.
- **Key rotation** for `SESSION_TOKEN_SIGNING_KEY` — see the horizon design doc.

---

## 7. Validation

End-to-end in the browser (`creatorwitheverything@fanvue.com`): the surface
resolved to `ready`, the iframe loaded the test app, which exchanged the 496-char
assertion and showed **`✓ Exchanged for an online access token, sub: <creator
uuid>, scope: openid, refresh token returned: no`**. Headless mint→exchange and
unit tests (pandora: `getCreatorSurfaceLaunch`, `recordCreatorSurfaceConsent`,
`getAppPrimaryAction`; horizon: `mintAppSessionToken`) all pass.
