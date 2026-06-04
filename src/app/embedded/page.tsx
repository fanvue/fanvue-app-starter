import { decodeJwtClaims, exchangeAssertionForToken } from "@/lib/embedded";

export const dynamic = "force-dynamic";

/**
 * Embedded creator-surface entry point. Fanvue renders this inside an iframe
 * and injects a short-lived online session-token assertion as `?token=`. We
 * exchange it for a Hydra access token (RFC 7523 jwt-bearer) and show the
 * result — the spike's "App Home" proof.
 */
export default async function EmbeddedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  let result:
    | { ok: true; accessClaims: Record<string, unknown> | null; scope?: string; hasRefresh: boolean }
    | { ok: false; error: string }
    | null = null;

  if (token) {
    try {
      const exchanged = await exchangeAssertionForToken(token);
      result = {
        ok: true,
        accessClaims: decodeJwtClaims(exchanged.access_token),
        scope: exchanged.scope,
        hasRefresh: !!exchanged.refresh_token,
      };
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Embedded 3P app — online session</h1>
      <p style={{ color: "#666" }}>
        Assertion received: {token ? `${token.slice(0, 24)}… (${token.length} chars)` : "none"}
      </p>

      {result === null && <p>Waiting for a session token (open via the Fanvue app store).</p>}

      {result?.ok === false && (
        <pre style={{ color: "#b00", whiteSpace: "pre-wrap" }}>Exchange failed: {result.error}</pre>
      )}

      {result?.ok === true && (
        <div>
          <p style={{ color: "green", fontWeight: 600 }}>✓ Exchanged for an online access token</p>
          <p>
            sub: <code>{String(result.accessClaims?.sub ?? "?")}</code>
          </p>
          <p>
            scope: <code>{result.scope ?? String(result.accessClaims?.scp ?? "?")}</code>
          </p>
          <p>
            refresh token returned: <code>{result.hasRefresh ? "YES (unexpected)" : "no ✓"}</code>
          </p>
          <details>
            <summary>access-token claims</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result.accessClaims, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
