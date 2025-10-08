import { env } from "@/env";
import { getSession, setSession } from "@/lib/session";
import { refreshAccessToken } from "@/lib/oauth";

export async function getCurrentUser() {
  let session = await getSession();
  if (!session) return null;

  if (Date.now() >= session.expiresAt - 30_000 && session.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(session.refreshToken);
      session = {
        ...session,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? session.refreshToken,
        tokenType: refreshed.token_type,
        scope: refreshed.scope ?? session.scope,
        idToken: refreshed.id_token ?? session.idToken,
        expiresAt: Date.now() + refreshed.expires_in * 1000,
      };
      await setSession(session);
    } catch {}
  }

  try {
    const res = await fetch(`${env.API_BASE_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.log("error", error);
    return null;
  }
}
