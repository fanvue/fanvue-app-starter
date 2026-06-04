import { oauthConfig } from "@/env";

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
    scope: "openid",
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
