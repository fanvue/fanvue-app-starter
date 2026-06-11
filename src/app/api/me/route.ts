import { NextResponse } from "next/server";
import { HEADER_UPDATED_SESSION } from "@fanvue/auth";
import {
  createConfig,
  getAuthenticatedClient,
} from "@fanvue/auth/nextjs/embedded-app";

export async function GET() {
  const config = createConfig();
  const auth = await getAuthenticatedClient({
    sessionSecret: config.sessionSecret,
    config,
  });
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await auth.client.getCurrentUser();
  if (user.isErr()) {
    return NextResponse.json({ error: user.error.code }, { status: 502 });
  }

  const res = NextResponse.json(user.value);
  if (auth.refreshedJwt) {
    res.headers.set(HEADER_UPDATED_SESSION, auth.refreshedJwt);
  }
  return res;
}
