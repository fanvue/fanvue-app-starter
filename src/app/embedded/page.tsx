"use client";

import { useState } from "react";
import { useAuth, useEmbeddedAuth } from "@andytango/fv-auth/react";

export default function EmbeddedPage() {
  const { status, error } = useEmbeddedAuth();
  const { authFetch } = useAuth();
  const [profile, setProfile] = useState<unknown>(null);

  if (status === "exchanging") {
    return <p>Connecting to Fanvue…</p>;
  }

  if (status === "error") {
    return (
      <div>
        <h1>Authentication failed</h1>
        <p>
          <code>{error}</code>
          {error === "consent_required" &&
            " — approve the app on the Fanvue consent screen, then reopen it."}
          {error === "invalid_session_token" &&
            " — the session token expired (~60s). Reopen the app from Fanvue."}
        </p>
      </div>
    );
  }

  if (status === "idle") {
    return <p>Open this app from the Fanvue App Store to authenticate.</p>;
  }

  return (
    <div>
      <h1>Fanvue Embedded App — SDK Demo</h1>
      <button
        onClick={async () => {
          const res = await authFetch("/api/me");
          setProfile(await res.json());
        }}
      >
        Load my profile
      </button>
      {profile != null && <pre>{JSON.stringify(profile, null, 2)}</pre>}
    </div>
  );
}
