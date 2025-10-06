import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/env";
import { exchangeCodeForToken } from "@/lib/oauth";
import { setSession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const providerErrorDescription = url.searchParams.get("error_description");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const verifier = cookieStore.get("oauth_verifier")?.value;

  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_verifier");

  if (providerError) {
    const search = new URLSearchParams();
    search.set("error", providerError);
    if (providerErrorDescription) search.set("error_description", providerErrorDescription);
    return NextResponse.redirect(new URL(`${env.BASE_URL}/?${search.toString()}`, request.url));
  }

  if (!code || !state || !storedState || !verifier || state !== storedState) {
    return NextResponse.redirect(new URL(`${env.BASE_URL}/?error=oauth_state_mismatch`, request.url));
  }

  const redirectUri = env.OAUTH_REDIRECT_URI;

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

    return NextResponse.redirect(new URL(`${env.BASE_URL}/`, request.url));
  } catch (e) {
    return NextResponse.redirect(new URL(`${env.BASE_URL}/?error=oauth_token_exchange_failed`, request.url));
  }
}

export async function POST(request: Request) {
  const form = await request.formData();
  const code = form.get("code") as string | null;
  const state = form.get("state") as string | null;
  const error = form.get("error") as string | null;
  const errorDescription = form.get("error_description") as string | null;

  const url = new URL(request.url);
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const verifier = cookieStore.get("oauth_verifier")?.value;

  cookieStore.delete("oauth_state");
  cookieStore.delete("oauth_verifier");

  if (error) {
    const search = new URLSearchParams();
    search.set("error", error);
    if (errorDescription) search.set("error_description", errorDescription);
    return NextResponse.redirect(new URL(`${env.BASE_URL}/?${search.toString()}`, request.url));
  }

  if (!code || !state || !storedState || !verifier || state !== storedState) {
    return NextResponse.redirect(new URL(`${env.BASE_URL}/?error=oauth_state_mismatch`, request.url));
  }

  const redirectUri = env.OAUTH_REDIRECT_URI ?? `${url.origin}/api/oauth/callback`;
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
    return NextResponse.redirect(new URL(`${env.BASE_URL}/`, request.url));
  } catch (e) {
    return NextResponse.redirect(new URL(`${env.BASE_URL}/?error=oauth_token_exchange_failed`, request.url));
  }
}
