import { z } from "zod";

// Ported from fanguard/src/services/fal/schemas.ts, trimmed to schemas the spike uses.

// SPIKE: minimax/h3-max-turbo/image-to-video. Duration must be >= 5 (fal 422 otherwise).
export const h3MaxVideoRequestSchema = z.object({
  prompt: z.string(),
  image_url: z.url(),
  end_image_url: z.url().optional(),
  duration: z.number().int().min(5).max(15).default(10),
  resolution: z
    .union([z.literal("480P"), z.literal("768P"), z.literal("1080P")])
    .default("480P"),
  prompt_expansion_mode: z
    .union([z.literal("disabled"), z.literal("balanced"), z.literal("quality")])
    .default("disabled"),
  // Fal defaults this to true. The spike must send false or adult prompts 422.
  enable_safety_checker: z.literal(false).default(false),
});

const h3MaxVideoResultPayloadSchema = z.object({
  video: z.object({
    url: z.url(),
    content_type: z.string().optional(),
    file_name: z.string().optional(),
    file_size: z.number().optional(),
  }),
  seed: z.number().optional(),
});

export const h3MaxVideoResultSchema = h3MaxVideoResultPayloadSchema;

// SPIKE: minimax/h3-max/reference-to-video. Native multi-image character grounding —
// combined reference_image_urls + reference_video_urls + reference_audio_urls count must be <=12.
export const h3MaxReferenceVideoRequestSchema = z.object({
  prompt: z.string(),
  reference_image_urls: z.array(z.url()).min(1).max(12),
  reference_video_urls: z.array(z.url()).max(12).optional(),
  duration: z.number().int().min(5).max(15).default(10),
  resolution: z
    .union([z.literal("480P"), z.literal("768P"), z.literal("1080P")])
    .default("480P"),
  aspect_ratio: z
    .union([
      z.literal("adaptive"),
      z.literal("21:9"),
      z.literal("16:9"),
      z.literal("4:3"),
      z.literal("1:1"),
      z.literal("3:4"),
      z.literal("9:16"),
    ])
    .default("adaptive"),
  prompt_expansion_mode: z
    .union([z.literal("disabled"), z.literal("balanced"), z.literal("quality")])
    .default("disabled"),
  // Fal defaults this to true. The spike must send false or adult prompts 422.
  enable_safety_checker: z.literal(false).default(false),
});

// Same video-file-object shape as h3-max-turbo/image-to-video per the fal docs.
export const h3MaxReferenceVideoResultSchema = h3MaxVideoResultPayloadSchema;

// fal-ai/nano-banana-2/edit — used for periodic identity-drift correction.
export const identityCorrectionRequestSchema = z.object({
  prompt: z.string(),
  image_urls: z.array(z.url()).length(2),
  num_images: z.literal(1).default(1),
  output_format: z.literal("jpeg").default("jpeg"),
});

export const identityCorrectionResultSchema = z.object({
  images: z.array(z.object({ url: z.url() })).min(1),
});

// fal-ai/ffmpeg-api/extract-frame: serverless replacement for local-ffmpeg last-frame extraction (see BLOCKED notes in the port report).
export const extractFrameRequestSchema = z.object({
  video_url: z.url(),
  frame_type: z
    .union([z.literal("first"), z.literal("middle"), z.literal("last")])
    .default("last"),
});

export const extractFrameResultSchema = z.object({
  images: z.array(z.object({ url: z.url() })).min(1),
});
