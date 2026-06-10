import { type NextRequest } from "next/server";
import {
  createConfig,
  createSessionExchangeHandler,
} from "@andytango/fv-auth/nextjs/embedded-app";

// Deferred so createConfig() validates env vars at request time, not build time.
let _handler: ReturnType<typeof createSessionExchangeHandler> | undefined;
function handler() {
  _handler ??= createSessionExchangeHandler(createConfig(), {
    // Persist the refresh token per creator here if your app needs to act on
    // their behalf after the iframe closes, e.g.:
    // onTokens: async ({ tokens, user }) => {
    //   await db.saveRefreshToken(user.uuid, tokens.refresh_token);
    // },
  });
  return _handler;
}

export async function POST(req: NextRequest) {
  return handler().POST(req);
}
