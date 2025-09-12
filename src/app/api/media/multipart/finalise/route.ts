import { NextResponse } from "next/server";
import { env } from "@/env";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  console.log("media/finalise POST: incoming", { method: request.method });
  const session = await getSession();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Authorization": `Bearer ${session.accessToken}`,
  };
  if (env.FANVUE_API_VERSION) headers["X-Fanvue-API-Version"] = env.FANVUE_API_VERSION;

  const res = await fetch(`${env.API_BASE_URL}/media/multipart/finalise`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "manual",
    cache: "no-store",
  });

  console.log("media/finalise upstream", {
    status: res.status,
    redirected: res.redirected,
    url: res.url,
    location: res.headers.get("location") ?? null,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || "Upstream error" }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}


