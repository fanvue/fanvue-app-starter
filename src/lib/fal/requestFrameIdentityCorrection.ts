import {
  falService,
  pollFalQueueUntilComplete,
  type FalQueueSubmitResponse,
} from "./client";
import {
  identityCorrectionRequestSchema,
  identityCorrectionResultSchema,
} from "./schemas";

const NANO_BANANA_EDIT_MODEL_PATH = "fal-ai/nano-banana-2/edit";

const IDENTITY_CORRECTION_PROMPT =
  "Restore the exact face, hair, skin tone, and body of the FIRST reference image onto the SECOND image. " +
  "Keep the second image's pose, clothing, framing, background, and camera angle completely unchanged — " +
  "only correct her identity and likeness back to the first reference image. Photoreal, single subject, no extra limbs.";

// Spike-only: counters gradual likeness drift from chaining H3 Max off its own last frame by
// periodically re-grounding the current frame against the original reference photo.
export const correctFrameIdentityDrift = async (
  referencePhotoUrl: string,
  driftedFrameUrl: string,
  timeoutMs = 30_000,
): Promise<string> => {
  const body = identityCorrectionRequestSchema.parse({
    prompt: IDENTITY_CORRECTION_PROMPT,
    image_urls: [referencePhotoUrl, driftedFrameUrl],
  });

  const submitted = await falService.post<FalQueueSubmitResponse>(
    `/${NANO_BANANA_EDIT_MODEL_PATH}`,
    body,
  );

  const result = await pollFalQueueUntilComplete<unknown>({
    statusUrl: submitted.status_url,
    responseUrl: submitted.response_url,
    timeoutMs,
  });
  const [image] = identityCorrectionResultSchema.parse(result).images;
  if (!image) {
    throw new Error("Identity correction returned no image");
  }
  return image.url;
};
