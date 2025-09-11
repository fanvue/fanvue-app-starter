import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    OAUTH_CLIENT_ID: z.string().min(1),
    OAUTH_CLIENT_SECRET: z.string().min(1),
    OAUTH_ISSUER_BASE_URL: z
      .url()
      .default("https://auth.fanvue.com"),
    OAUTH_REDIRECT_URI: z.url().optional(),
    OAUTH_SCOPES: z
      .string(),
    SESSION_COOKIE_NAME: z.string().default("fanvue_oauth"),
    SESSION_SECRET: z
      .string()
      .min(16, { message: "SESSION_SECRET must be at least 32 characters" }),
    API_BASE_URL: z.url().default("https://api.fanvue.com"),
  },
  runtimeEnv: {
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET,
    OAUTH_ISSUER_BASE_URL: process.env.OAUTH_ISSUER_BASE_URL,
    OAUTH_REDIRECT_URI: process.env.OAUTH_REDIRECT_URI,
    OAUTH_SCOPES: process.env.OAUTH_SCOPES,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
    SESSION_SECRET: process.env.SESSION_SECRET,
    API_BASE_URL: process.env.API_BASE_URL,
  },
  emptyStringAsUndefined: true,
});

export const oauthConfig = {
  issuerBaseURL: env.OAUTH_ISSUER_BASE_URL,
  clientId: env.OAUTH_CLIENT_ID,
  clientSecret: env.OAUTH_CLIENT_SECRET,
  redirectUri: env.OAUTH_REDIRECT_URI,
};


