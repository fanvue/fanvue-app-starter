pnpm install
pnpm build
pnpm start# Fanvue App Starter (Next.js App Router)

## Requirements

- pnpm
- Node 18+
- An existing Fanvue App from [Fanvue Developer Area](https://fanvue.com/developers/apps) (client id/secret)

## Setup

1. Create `.env.local` using `.env.example`

2. Install deps and run:

```bash
pnpm install
pnpm dev
```

3. Set up HTTPS for local development:

#### Option A: Using [portless](https://github.com/vercel-labs/portless) (Recommended)

Portless gives you stable, named `.localhost` URLs with automatic HTTPS/HTTP2 — no manual cert generation or hosts file editing.

```bash
npm install -g portless
```

One-time setup (generates and trusts certs automatically):

```bash
portless proxy start --https
```

Update your `package.json` dev script:

```json
{
  "scripts": {
    "dev": "portless run next dev"
  }
}
```

Then run:

```bash
pnpm dev
# -> https://fanvue-app-starter.localhost
```

Now set your redirect URI in the Fanvue UI to match:

```
https://fanvue-app-starter.localhost/api/oauth/callback
```

#### Option B: Manual mkcert + local-ssl-proxy

Insert the actual name of your app instead of `[your-app-name-here]`

Install mkcert and generate certificates

```
brew install mkcert
mkcert -install
mkcert [your-app-name-here].dev
```

Change your hosts file

```
echo "127.0.0.1 [your-app-name-here].dev" | sudo tee -a /etc/hosts
```

Then run the local SSL proxy

```
npx local-ssl-proxy --source 3001 --target 3000 --cert ./[your-app-name-here].dev.pem --key ./[your-app-name-here].dev-key.pem
```

Now setup your redirect URI in the Fanvue UI to match:

```
https://[your-app-name-here].dev:3001/api/oauth/callback
```

## Environment variables (.env)

### Get your Fanvue OAuth credentials

1. Visit [Fanvue Developer Area](https://fanvue.com/developers)
2. Create a new App to obtain your Client ID and Client Secret
3. Configure a Redirect URI
   - Development: `http://localhost:3000/api/oauth/callback`
   - Production: `https://YOUR_DOMAIN/api/oauth/callback`
4. Configure scopes
   - For this starter, you need: `read:self`
   - The scopes you set in your `.env` must exactly match what you select in the Fanvue developer UI for your app
   - Note: The app automatically includes required system scopes (`openid`, `offline_access`, `offline`) in addition to what you set in `OAUTH_SCOPES`

Required variables

- `OAUTH_CLIENT_ID`: From your Fanvue app
- `OAUTH_CLIENT_SECRET`: From your Fanvue app
- `OAUTH_SCOPES`: App scopes selected in the Fanvue UI (e.g. `read:self`)
- `OAUTH_REDIRECT_URI`: Full URL to `/api/oauth/callback` for your environment
- `SESSION_SECRET`: A random string of at least 16 characters
- `SESSION_COOKIE_NAME` (default: `fanvue_oauth`)

These are not something you should change

- `OAUTH_ISSUER_BASE_URL` (default: `https://auth.fanvue.com`)
- `API_BASE_URL` (default: `https://api.fanvue.com`)

Example `.env.local` (development)

```bash
OAUTH_CLIENT_ID=YOUR_CLIENT_ID
OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET
OAUTH_SCOPES=read:self
OAUTH_REDIRECT_URI=http://localhost:3000/api/oauth/callback
SESSION_SECRET=use-a-random-16-char-secret
OAUTH_ISSUER_BASE_URL=https://auth.fanvue.com
API_BASE_URL=https://api.fanvue.com
SESSION_COOKIE_NAME=fanvue_oauth
```

## Production deployment

- Set the same environment variables in your hosting provider for production
- Ensure the Fanvue app has the production Redirect URI configured: `https://YOUR_DOMAIN/api/oauth/callback`
- Ensure `OAUTH_SCOPES` exactly matches your selected scopes (e.g. `read:self`)
- Build and run

```bash
pnpm install
pnpm build
pnpm start
```

### Recommended Services

To deploy, we recommend using [Vercel](https://vercel.com/)

If you need a database, [Supabase](https://supabase.com/) should have you covered

Usage

- Visit `/` and click “Login with Fanvue”
- After OAuth, your Fanvue current user JSON is shown
- Click “Logout” to clear the session

Docs

- Fanvue API: [https://api.fanvue.com/docs](https://api.fanvue.com/docs)
