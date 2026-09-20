import { z } from "zod";
import {
  falService,
  pollFalQueueUntilComplete,
  type FalQueueSubmitResponse,
} from "./client";
import {
  h3MaxReferenceVideoRequestSchema,
  h3MaxReferenceVideoResultSchema,
} from "./schemas";

const H3_MAX_REFERENCE_MODEL_PATH = "minimax/h3-max/reference-to-video";

export const submitH3MaxReferenceVideoGeneration = async (
  payload: z.infer<typeof h3MaxReferenceVideoRequestSchema>,
) => {
  const body = h3MaxReferenceVideoRequestSchema.parse({
    ...payload,
    enable_safety_checker: false,
  });
  return falService.post<FalQueueSubmitResponse>(
    `/${H3_MAX_REFERENCE_MODEL_PATH}`,
    body,
  );
};

export const pollH3MaxReferenceVideoUntilComplete = async (args: {
  statusUrl: string;
  responseUrl: string;
  timeoutMs?: number;
}) => {
  const result = await pollFalQueueUntilComplete<unknown>(args);
  return h3MaxReferenceVideoResultSchema.parse(result);
};
