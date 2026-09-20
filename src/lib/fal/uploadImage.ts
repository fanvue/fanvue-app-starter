import { fal } from "@fal-ai/client";
import { env } from "@/env";

let configured = false;
const ensureConfigured = () => {
  if (!configured) {
    fal.config({ credentials: env.FAL_KEY });
    configured = true;
  }
};

// Serverless replacement for the pandora monorepo's saveFile (S3) + getDurableRawMediaSignedUrl
// upload of the fan's chosen reference photo — see the port report's BLOCKED notes.
export const uploadReferenceImageToFal = async (
  buffer: Buffer,
  contentType: "image/jpeg" | "image/png",
): Promise<string> => {
  ensureConfigured();
  const extension = contentType === "image/png" ? "png" : "jpg";
  const file = new File(
    [new Uint8Array(buffer)],
    `reference-${Date.now()}.${extension}`,
    {
      type: contentType,
    },
  );
  return fal.storage.upload(file);
};
