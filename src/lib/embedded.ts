import { env, oauthConfig } from "@/env";

/**
 * Embedded-app online session flow (RFC 7523 jwt-bearer).
 *
 * Fanvue mints a short-lived assertion and injects it into the iframe as a
 * `?token=` query param. The embedded app's backend exchanges that assertion at
 * Hydra's token endpoint for a scoped online access token — no auth-code dance,
 * no refresh token.
 */
export type ExchangedToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
  id_token?: string;
};

export async function exchangeAssertionForToken(assertion: string): Promise<ExchangedToken> {
  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
    scope: "openid read:self",
  });

  const res = await fetch(`${oauthConfig.issuerBaseURL}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${oauthConfig.clientId}:${oauthConfig.clientSecret}`).toString("base64"),
    },
    body: params.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`jwt-bearer exchange failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as ExchangedToken;
}

/**
 * Calls the Fanvue API (styx) `/users/me` with the exchanged online access
 * token — proves the token is accepted by a real resource server. Returns the
 * HTTP status and the parsed body (or raw text on non-JSON).
 */
export async function fetchCurrentUser(
  accessToken: string
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${env.API_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

/** Decode a JWT payload without verifying — for display only. */
export function decodeJwtClaims(jwt: string): Record<string, unknown> | null {
  const part = jwt.split(".")[1];
  if (!part) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
