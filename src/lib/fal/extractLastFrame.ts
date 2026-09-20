import {
  falService,
  pollFalQueueUntilComplete,
  type FalQueueSubmitResponse,
} from "./client";
import { extractFrameRequestSchema, extractFrameResultSchema } from "./schemas";

const FFMPEG_EXTRACT_FRAME_MODEL_PATH = "fal-ai/ffmpeg-api/extract-frame";

// Serverless replacement for the pandora monorepo's local-ffmpeg + sharp + S3 last-frame
// extraction (extractFrameToBuffer.ts) — see the port report's BLOCKED section for why.
export const extractLastFrameUrl = async (
  videoUrl: string,
  timeoutMs = 15_000,
): Promise<string> => {
  const body = extractFrameRequestSchema.parse({
    video_url: videoUrl,
    frame_type: "last",
  });

  const submitted = await falService.post<FalQueueSubmitResponse>(
    `/${FFMPEG_EXTRACT_FRAME_MODEL_PATH}`,
    body,
  );

  const result = await pollFalQueueUntilComplete<unknown>({
    statusUrl: submitted.status_url,
    responseUrl: submitted.response_url,
    timeoutMs,
  });
  const [image] = extractFrameResultSchema.parse(result).images;
  if (!image) {
    throw new Error("Frame extraction returned no image");
  }
  return image.url;
};
