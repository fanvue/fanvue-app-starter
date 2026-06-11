import { NextResponse } from "next/server";
import {
  refreshAccessToken,
  createFanvueClient,
  createSessionJwt,
  HEADER_UPDATED_SESSION,
  type SessionPayload,
} from "@fanvue/auth";
import { createConfig, getSession } from "@fanvue/auth/nextjs/embedded-app";

const config = createConfig();

/**
 * Exercises the OFFLINE half of the embedded flow: a `refresh_token` grant at
 * Hydra followed by an API call with the freshly-minted access token — no
 * iframe, no session token involved. This is exactly what a background job
 * does; the only difference is that a real app would read the refresh token
 * from its own storage (persisted via the `onTokens` hook) instead of the
 * caller's session JWT.
 *
 * Hydra rotates refresh tokens on use (one-time tokens with reuse detection),
 * so the rotated token is re-signed into the session and returned via the
 * `X-Updated-Session` header — `authFetch` stores it automatically.
 */
export async function POST() {
  const session = await getSession(config.sessionSecret);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session.refreshToken) {
    return NextResponse.json(
      {
        error: "no_refresh_token",
        detail:
          "The token exchange returned no refresh token — offline access was not granted for this consent.",
      },
      { status: 409 },
    );
  }

  const refreshed = await refreshAccessToken(config, session.refreshToken);
  if (refreshed.isErr()) {
    return NextResponse.json(
      { error: refreshed.error.code, message: refreshed.error.message },
      { status: 502 },
    );
  }
  const tokens = refreshed.value;

  // Prove the refreshed token works against the API.
  const client = createFanvueClient(tokens.access_token, config.apiBaseUrl);
  const me = await client.getCurrentUser();

  const newSession: SessionPayload = {
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    tokenType: tokens.token_type ?? session.tokenType,
    scope: tokens.scope ?? session.scope,
    idToken: tokens.id_token ?? session.idToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  const jwt = await createSessionJwt(config.sessionSecret, newSession);

  const res = NextResponse.json({
    refreshGrant: "ok",
    refreshTokenRotated:
      tokens.refresh_token !== null && tokens.refresh_token !== session.refreshToken,
    accessTokenExpiresInSeconds: tokens.expires_in,
    scope: tokens.scope,
    apiCallWithRefreshedToken: me.isOk()
      ? { status: "ok", handle: me.value.handle, isCreator: me.value.isCreator }
      : { status: "failed", error: me.error.code },
  });
  res.headers.set(HEADER_UPDATED_SESSION, jwt);
  return res;
}
