import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/env";
import { exchangeCodeForToken } from "@/lib/oauth";
import { setSession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const verifier = cookieStore.get("oauth_verifier")?.value;

  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_verifier");

  if (!code || !state || !storedState || !verifier || state !== storedState) {
    return NextResponse.redirect("/" + "?error=oauth_state_mismatch");
  }

  const redirectUri = env.OAUTH_REDIRECT_URI ?? "/api/oauth/callback";

  try {
    const token = await exchangeCodeForToken({
      code,
      codeVerifier: verifier,
      redirectUri,
    });

    await setSession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: token.token_type,
      scope: token.scope,
      idToken: token.id_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    });

    return NextResponse.redirect(new URL("/", request.url));
  } catch (e) {
    return NextResponse.redirect(new URL("/?error=oauth_token_exchange_failed", request.url));
  }
}


