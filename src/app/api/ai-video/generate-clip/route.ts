import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/fanvue";
import { generateClip } from "@/lib/aiVideo/spikeBusinessLogic";

const bodySchema = z.object({
  promptText: z.string().min(1).max(2000).nullable(),
  sceneContext: z.string().max(4000).nullable(),
  surroundings: z.string().max(1000).nullable(),
  liveState: z.string().max(400).nullable(),
  worldState: z.string().max(450).nullable(),
  callElapsedSec: z
    .number()
    .int()
    .min(0)
    .max(60 * 60)
    .optional()
    .default(0),
  referenceImageUrl: z.url(),
  originalReferenceImageUrl: z.url().optional(),
  clipKind: z
    .enum(["auto", "fillerSip", "greeting", "checkIn"])
    .optional()
    .default("auto"),
  inputChannel: z.enum(["chat", "voice"]).optional().default("voice"),
  scriptedPhysical: z.string().max(4000).nullable().optional(),
  scriptedDuration: z.number().int().min(5).max(15).nullable().optional(),
  scriptedLiveState: z.string().max(400).nullable().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await generateClip(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Clip generation failed",
      },
      { status: 502 },
    );
  }
}
