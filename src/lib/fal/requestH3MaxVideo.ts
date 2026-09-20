import { z } from "zod";
import {
  falService,
  pollFalQueueUntilComplete,
  type FalQueueSubmitResponse,
} from "./client";
import { h3MaxVideoRequestSchema, h3MaxVideoResultSchema } from "./schemas";

const H3_MAX_MODEL_PATH = "minimax/h3-max-turbo/image-to-video";

export const submitH3MaxVideoGeneration = async (
  payload: z.infer<typeof h3MaxVideoRequestSchema>,
) => {
  const body = h3MaxVideoRequestSchema.parse({
    ...payload,
    enable_safety_checker: false,
  });
  return falService.post<FalQueueSubmitResponse>(`/${H3_MAX_MODEL_PATH}`, body);
};

export const pollH3MaxVideoUntilComplete = async (args: {
  statusUrl: string;
  responseUrl: string;
  timeoutMs?: number;
}) => {
  const result = await pollFalQueueUntilComplete<unknown>(args);
  return h3MaxVideoResultSchema.parse(result);
};
