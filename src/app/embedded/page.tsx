"use client";

import { useState } from "react";
import { useAuth, useEmbeddedAuth } from "@fanvue/auth/react";

const FANVUE_GREEN = "#49f264";

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border-2 border-white/20 border-t-[#49f264]"
    />
  );
}

function Card(props: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="w-full rounded-xl border border-white/10 bg-white/[.04] p-5">
      <h2 className="font-semibold text-base text-white">{props.title}</h2>
      {props.description ? (
        <p className="mt-1 text-sm leading-relaxed text-white/60">{props.description}</p>
      ) : null}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function ActionButton(props: {
  onClick: () => void | Promise<void>;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.busy}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[#49f264] px-5 text-sm font-medium text-black transition-colors hover:bg-[#6ef786] disabled:cursor-default disabled:opacity-60"
    >
      {props.busy ? <Spinner /> : null}
      {props.children}
    </button>
  );
}

function ResultBlock(props: { value: unknown }) {
  if (props.value == null) return null;
  return (
    <pre className="mt-4 max-h-80 overflow-auto rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-[#9be8a8]">
      {JSON.stringify(props.value, null, 2)}
    </pre>
  );
}

function CenteredNotice(props: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center text-white/80">
        {props.children}
      </div>
    </div>
  );
}

export default function EmbeddedPage() {
  const { status, error } = useEmbeddedAuth();
  const { authFetch } = useAuth();
  const [profile, setProfile] = useState<unknown>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [offlineResult, setOfflineResult] = useState<unknown>(null);
  const [offlineBusy, setOfflineBusy] = useState(false);

  if (status === "exchanging" || status === "idle") {
    return (
      <CenteredNotice>
        {status === "exchanging" ? (
          <>
            <Spinner />
            <p className="text-sm">Connecting to Fanvue…</p>
          </>
        ) : (
          <>
            <span className="text-3xl">🧩</span>
            <p className="text-sm">Open this app from the Fanvue App Store to authenticate.</p>
          </>
        )}
      </CenteredNotice>
    );
  }

  if (status === "error") {
    return (
      <CenteredNotice>
        <span className="text-3xl">⚠️</span>
        <h1 className="text-lg font-semibold text-white">Authentication failed</h1>
        <p className="text-sm">
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-red-300">
            {error}
          </code>
          {error === "consent_required" &&
            " — approve the app on the Fanvue consent screen, then reopen it."}
          {error === "invalid_session_token" &&
            " — the session token expired (~60s). Reopen the app from Fanvue."}
        </p>
      </CenteredNotice>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-10 font-sans">
      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-lg font-bold text-black"
            style={{ backgroundColor: FANVUE_GREEN }}
            aria-hidden
          >
            F
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">Fanvue Embedded App</h1>
            <p className="text-sm text-white/50">
              SDK demo —{" "}
              <span className="inline-flex items-center gap-1.5 text-[#49f264]">
                <span className="size-1.5 rounded-full bg-[#49f264]" aria-hidden />
                authenticated
              </span>
            </p>
          </div>
        </header>

        <Card
          title="Online flow"
          description="Calls your backend with the session JWT; the backend calls the Fanvue API as the creator."
        >
          <ActionButton
            busy={profileBusy}
            onClick={async () => {
              setProfileBusy(true);
              try {
                const res = await authFetch("/api/me");
                setProfile(await res.json());
              } finally {
                setProfileBusy(false);
              }
            }}
          >
            Load my profile
          </ActionButton>
          <ResultBlock value={profile} />
        </Card>

        <Card
          title="Offline flow"
          description="Runs a refresh_token grant and calls the API with the new access token — no session token involved, exactly as a background job would."
        >
          <ActionButton
            busy={offlineBusy}
            onClick={async () => {
              setOfflineBusy(true);
              try {
                const res = await authFetch("/api/offline-test", { method: "POST" });
                setOfflineResult(await res.json());
              } finally {
                setOfflineBusy(false);
              }
            }}
          >
            Test offline refresh
          </ActionButton>
          <ResultBlock value={offlineResult} />
        </Card>

        <footer className="text-center text-xs text-white/30">
          Powered by{" "}
          <code className="font-mono text-white/50">@fanvue/auth</code>
        </footer>
      </main>
    </div>
  );
}
