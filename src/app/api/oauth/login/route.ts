import { NextResponse } from "next/server";
import { generatePkce, getAuthorizeUrl } from "@/lib/oauth";
import { cookies } from "next/headers";

export async function GET() {
  const { verifier, challenge } = generatePkce();
  const state = crypto.randomUUID();

  const authUrl = getAuthorizeUrl({
    state,
    codeChallenge: challenge,
  });

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set("oauth_state", state, { httpOnly: true, path: "/", sameSite: "lax", secure, maxAge: 600 });
  cookieStore.set("oauth_verifier", verifier, { httpOnly: true, path: "/", sameSite: "lax", secure, maxAge: 600 });

  return NextResponse.redirect(authUrl);
}
