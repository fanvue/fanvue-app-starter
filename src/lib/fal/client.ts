import { env } from "@/env";

const FAL_QUEUE_BASE_URL = "https://queue.fal.run";

// Ported from fanguard/src/services/fal/service.ts (createAxiosService wrapper) — rewritten
// as a plain fetch client since this standalone app has no axios/@pandora dependency.
const falRequest = async <T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    searchParams?: Record<string, string>;
  } = {},
): Promise<T> => {
  const url = new URL(
    path.startsWith("http") ? path : `${FAL_QUEUE_BASE_URL}${path}`,
  );
  if (init.searchParams) {
    for (const [key, value] of Object.entries(init.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: {
      Authorization: `Key ${env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const data = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? (data as { detail: unknown }).detail
        : data;
    const text = typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Error(`Fal request failed (${res.status}): ${text}`);
  }

  return data as T;
};

export const falService = {
  post: <T>(path: string, body: unknown) =>
    falRequest<T>(path, { method: "POST", body }),
  get: <T>(path: string, searchParams?: Record<string, string>) =>
    falRequest<T>(path, { method: "GET", searchParams }),
};

export type FalQueueSubmitResponse = {
  status: "IN_QUEUE";
  request_id: string;
  response_url: string;
  status_url: string;
  cancel_url: string;
};

export type FalQueueStatusResponse = {
  status?: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  detail?: unknown;
  error?: unknown;
};

// Spike-only: production fal usage elsewhere goes through webhooks, not polling.
export const pollFalQueueUntilComplete = async <T>({
  statusUrl,
  responseUrl,
  timeoutMs = 120_000,
  pollIntervalMs = 400,
}: {
  statusUrl: string;
  responseUrl: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<T> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await falService.get<FalQueueStatusResponse>(statusUrl, {
      logs: "1",
    });

    if (status?.status === "COMPLETED") {
      return await falService.get<T>(responseUrl);
    }

    if (status?.status !== "IN_QUEUE" && status?.status !== "IN_PROGRESS") {
      const detail = status?.detail ?? status?.error ?? status;
      throw new Error(`Fal generation rejected: ${JSON.stringify(detail)}`);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, pollIntervalMs);
    });
  }

  throw new Error(`Fal generation timed out after ${timeoutMs}ms`);
};
