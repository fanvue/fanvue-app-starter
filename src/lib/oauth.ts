import { randomBytes, createHash } from "crypto";
import { oauthConfig, env } from "@/env";

function base64url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function generatePkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(
    createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge, method: "S256" as const };
}

// Do not remove these, your app won't work without them
const DEFAULT_SCOPES = "openid offline_access offline";

export function getAuthorizeUrl({
  state,
  codeChallenge,
  redirectUri,
}: {
  state: string;
  codeChallenge: string;
  redirectUri?: string;
}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: oauthConfig.clientId,
    redirect_uri: redirectUri ?? env.OAUTH_REDIRECT_URI ?? oauthConfig.redirectUri ?? "",
    scope: `${DEFAULT_SCOPES} ${env.OAUTH_SCOPES ?? ""}`,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  if (env.OAUTH_RESPONSE_MODE) params.set("response_mode", env.OAUTH_RESPONSE_MODE);
  if (env.OAUTH_PROMPT) params.set("prompt", env.OAUTH_PROMPT);
  return `${oauthConfig.issuerBaseURL}/oauth2/auth?${params.toString()}`;
}

export async function exchangeCodeForToken({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  redirectUri?: string;
}) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri ?? oauthConfig.redirectUri ?? "",
    client_id: oauthConfig.clientId,
    code_verifier: codeVerifier,
  });

  const res = await fetch(`${oauthConfig.issuerBaseURL}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${oauthConfig.clientId}:${oauthConfig.clientSecret}`,
        ).toString("base64"),
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    id_token?: string;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: oauthConfig.clientId,
  });

  const res = await fetch(`${oauthConfig.issuerBaseURL}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${oauthConfig.clientId}:${oauthConfig.clientSecret}`,
        ).toString("base64"),
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
    id_token?: string;
  };
}


