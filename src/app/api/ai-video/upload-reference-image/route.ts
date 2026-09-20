import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/fanvue";
import { uploadReferenceImageToFal } from "@/lib/fal/uploadImage";
import {
  DEFAULT_BODY,
  SCENE_OPTIONS,
  formatBodyState,
  sceneLockFor,
  type SceneId,
} from "@/lib/aiVideo/spikeTurnPlan";

const SCENE_ID_VALUES = SCENE_OPTIONS.map((option) => option.id) as [
  SceneId,
  ...SceneId[],
];

const bodySchema = z.object({
  imageBase64: z.string().min(1),
  contentType: z.union([z.literal("image/jpeg"), z.literal("image/png")]),
  sceneId: z.enum(SCENE_ID_VALUES),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { imageBase64, contentType, sceneId } = parsed.data;

  const imageUrl = await uploadReferenceImageToFal(
    Buffer.from(imageBase64, "base64"),
    contentType,
  );
  // The photo is only the character reference (face/body) — the room comes from the creator's
  // own scene pick, not a guess at what's behind her in the photo.
  const worldLock = sceneLockFor(sceneId);

  return NextResponse.json({
    imageUrl,
    surroundings: worldLock,
    liveState: formatBodyState(DEFAULT_BODY),
    worldState: worldLock,
  });
}
