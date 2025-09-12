"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type InitiateResponse = { media_uuid: string; uploadId: string };
type FinaliseResponse = { processed_url: string; status: 3|4|5 };

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

export default function MediaUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [processedUrl, setProcessedUrl] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const chunks = useMemo(() => {
    if (!file) return [] as Array<{ start: number; end: number; partNumber: number }>;
    const size = file.size;
    const parts: Array<{ start: number; end: number; partNumber: number }> = [];
    let partNumber = 1;
    for (let start = 0; start < size; start += DEFAULT_CHUNK_SIZE) {
      const end = Math.min(start + DEFAULT_CHUNK_SIZE, size);
      parts.push({ start, end, partNumber: partNumber++ });
    }
    return parts;
  }, [file]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setStatus("");
    setProcessedUrl("");
  }, []);

  const upload = useCallback(async () => {
    if (!file) return;
    setStatus("Initiating...");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const initiateRes = await fetch("/api/media/multipart/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mediaType: "image" }),
        signal: controller.signal,
      });
      if (!initiateRes.ok) throw new Error(await initiateRes.text());
      const { media_uuid, uploadId } = (await initiateRes.json()) as InitiateResponse;

      const uploadedParts: Array<{ ETag?: string; PartNumber: number }> = [];

      for (const part of chunks) {
        setStatus(`Requesting URL for part ${part.partNumber}/${chunks.length}...`);
        const urlRes = await fetch("/api/media/multipart/part-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_uuid, uploadId, partNumber: part.partNumber }),
          signal: controller.signal,
        });
        if (!urlRes.ok) throw new Error(await urlRes.text());
        const signedUrl = await urlRes.text();

        setStatus(`Uploading part ${part.partNumber}/${chunks.length}...`);
        const blob = file.slice(part.start, part.end);
        const put = await fetch(signedUrl, {
          method: "PUT",
          body: blob,
          // S3 returns ETag header (often quoted). Keep raw; backend can handle quotes.
          signal: controller.signal,
        });
        if (!put.ok) throw new Error(`Failed to upload part ${part.partNumber}: ${await put.text()}`);
        const eTag = put.headers.get("ETag") ?? undefined;
        uploadedParts.push({ ETag: eTag ?? undefined, PartNumber: part.partNumber });
      }

      setStatus("Finalising...");
      const finaliseRes = await fetch("/api/media/multipart/finalise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUuid: media_uuid, uploadId, parts: uploadedParts }),
        signal: controller.signal,
      });
      if (!finaliseRes.ok) throw new Error(await finaliseRes.text());
      const finalised = (await finaliseRes.json()) as FinaliseResponse;
      setProcessedUrl(finalised.processed_url);
      setStatus(`Completed (status: ${finalised.status})`);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setStatus("Upload cancelled");
      } else {
        setStatus(String(err?.message ?? err ?? "Upload failed"));
      }
    } finally {
      abortRef.current = null;
    }
  }, [file, chunks]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div className="mt-4 flex flex-col gap-3 w-full">
      <div className="flex items-center gap-3">
        <input type="file" onChange={onFileChange} />
        <button
          className="rounded-full border border-solid border-transparent transition-colors bg-[#49f264ff] hover:bg-[#49f26433] text-black hover:text-white px-4 h-10 flex items-center gap-2 cursor-pointer disabled:opacity-60"
          onClick={upload}
          disabled={!file}
        >
          Upload
        </button>
        <button
          className="rounded-full border border-solid border-transparent transition-colors px-4 h-10 flex items-center gap-2 cursor-pointer"
          onClick={cancel}
          disabled={!abortRef.current}
        >
          Cancel
        </button>
      </div>
      {status ? <div className="text-sm opacity-80">{status}</div> : null}
      {processedUrl ? (
        <div className="text-sm break-all">
          Processed URL: <a className="underline" href={processedUrl} target="_blank" rel="noreferrer">{processedUrl}</a>
        </div>
      ) : null}
    </div>
  );
}


