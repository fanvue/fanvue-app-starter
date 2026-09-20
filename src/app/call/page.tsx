"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShowChrome } from "@/components/ShowChrome";

// Ported from eden/src/pages/dev/ai-video-spike.tsx — @fanvue/ui, react-i18next, and tRPC dropped for plain HTML/CSS and fetch calls to /api/ai-video/*.

type RoomLine = {
  id: number;
  role: "you" | "her";
  channel: "chat" | "voice";
  text: string;
};

type PendingTurn = {
  text: string;
  channel: "chat" | "voice";
};

type SceneId = "bedroom" | "office" | "livingRoom" | "kitchen";

const SCENE_CHOICES = [
  { id: "bedroom", label: "Bedroom" },
  { id: "office", label: "Home office" },
  { id: "livingRoom", label: "Living room" },
  { id: "kitchen", label: "Kitchen" },
] as const satisfies { id: SceneId; label: string }[];

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

const UTTERANCE_COMMIT_MS = 700;

const collapseRepeatedTranscript = (text: string): string => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return cleaned;
  }
  const words = cleaned.split(" ");
  if (words.length >= 4 && words.length % 2 === 0) {
    const half = words.length / 2;
    const first = words.slice(0, half).join(" ");
    const second = words.slice(half).join(" ");
    if (first.toLowerCase() === second.toLowerCase()) {
      return first;
    }
  }
  const lower = cleaned.toLowerCase();
  for (let size = Math.floor(words.length / 2); size >= 2; size -= 1) {
    const phrase = words.slice(0, size).join(" ");
    if (lower === `${phrase.toLowerCase()} ${phrase.toLowerCase()}`) {
      return phrase;
    }
  }
  return cleaned;
};

const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const readFileAsBase64 = (
  file: File,
): Promise<{ base64: string; contentType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(",");
      const contentType = header.match(/data:([^;]+);/)?.[1] ?? file.type;
      resolve({ base64, contentType });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const waitForEvent = (
  target: HTMLVideoElement,
  event: string,
  timeoutMs = 8000,
): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    target.addEventListener(
      event,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

type GenerateClipResponse = {
  videoUrl: string;
  lastFrameUrl: string;
  generationMs: number;
  costUsd: number;
  replyBrief: string | null;
  replyChannel: "chat" | "voice" | null;
  typingLeadSec: number;
  liveState: string;
  worldState: string;
  followUps: { physical: string; durationSec: number; liveState: string }[];
  commitFrame?: boolean;
};

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok || !data) {
    throw new Error(data?.error ?? `Request to ${url} failed (${res.status})`);
  }
  return data;
};

export default function AiVideoCallPage() {
  const [phase, setPhase] = useState<"setup" | "call">("setup");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [micArmed, setMicArmed] = useState(false);
  const [statusKey, setStatusKey] = useState<
    "connecting" | "listening" | "hearing" | "answering"
  >("connecting");
  const [draft, setDraft] = useState<string | null>(null);
  const [needsSoundTap, setNeedsSoundTap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spentUsd, setSpentUsd] = useState(0);
  const [activeSlot, setActiveSlot] = useState<"a" | "b">("a");
  const [roomLines, setRoomLines] = useState<RoomLine[]>([]);
  const [herTyping, setHerTyping] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [outfit, setOutfit] = useState("clothed");
  const [sceneId, setSceneId] = useState<SceneId>("bedroom");
  const [useReferenceModel, setUseReferenceModel] = useState(false);

  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeSlotRef = useRef<"a" | "b">("a");
  const lastFrameUrlRef = useRef<string | null>(null);
  const referenceImageUrlRef = useRef<string | null>(null);
  const surroundingsRef = useRef("");
  const liveStateRef = useRef("");
  const worldStateRef = useRef("");
  const initialLiveStateRef = useRef("");
  const initialWorldStateRef = useRef("");
  const originalUploadUrlRef = useRef<string | null>(null);
  const callStartedAtRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUtteranceRef = useRef<string | null>(null);
  const turnQueueRef = useRef<PendingTurn[]>([]);
  const lastChannelRef = useRef<"chat" | "voice">("voice");
  const lineIdRef = useRef(0);
  const revealTokenRef = useRef(0);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneContextRef = useRef("");
  const callActiveRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const acceptSpeechRef = useRef(false);
  const generationIdRef = useRef(0);
  const draftTextRef = useRef("");
  const speechBufferRef = useRef("");
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLoopRef = useRef<(() => void) | null>(null);
  const idleUrlRef = useRef<string | null>(null);
  const idleNextUrlRef = useRef<string | null>(null);
  const sceneEpochRef = useRef(0);
  const fillerEpochRef = useRef(0);
  const fillerInflightRef = useRef<Promise<GenerateClipResponse | null> | null>(
    null,
  );
  const fillerReadyRef = useRef<GenerateClipResponse | null>(null);
  const lastCommittedRef = useRef("");
  const motionTokenRef = useRef(0);
  const useReferenceModelRef = useRef(useReferenceModel);
  useReferenceModelRef.current = useReferenceModel;

  const generateClip = useCallback(
    async (body: Record<string, unknown>): Promise<GenerateClipResponse> => {
      const endpoint = useReferenceModelRef.current
        ? "/api/ai-video/generate-clip-reference"
        : "/api/ai-video/generate-clip";
      return postJson<GenerateClipResponse>(endpoint, body);
    },
    [],
  );

  const wakeLoop = useCallback(() => {
    wakeLoopRef.current?.();
  }, []);

  const setActiveMuted = useCallback((muted: boolean) => {
    const active =
      activeSlotRef.current === "a" ? videoARef.current : videoBRef.current;
    if (active) {
      active.muted = muted;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    acceptSpeechRef.current = false;
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    draftTextRef.current = "";
    speechBufferRef.current = "";
    setDraft(null);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setMicArmed(false);
  }, []);

  const pushLine = useCallback(
    (role: RoomLine["role"], channel: RoomLine["channel"], text: string) => {
      const id = ++lineIdRef.current;
      setRoomLines((prev) => [...prev, { id, role, channel, text }].slice(-40));
    },
    [],
  );

  const revealReply = useCallback(
    (
      reply: {
        replyBrief: string | null;
        replyChannel: "chat" | "voice" | null;
        typingLeadSec: number;
      } | null,
    ) => {
      if (!reply?.replyBrief || !reply.replyChannel || !callActiveRef.current) {
        return;
      }
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }
      const token = ++revealTokenRef.current;
      if (reply.replyChannel === "chat") {
        setHerTyping(true);
        const text = reply.replyBrief;
        revealTimerRef.current = setTimeout(
          () => {
            if (token !== revealTokenRef.current || !callActiveRef.current) {
              return;
            }
            setHerTyping(false);
            pushLine("her", "chat", text);
          },
          Math.round((reply.typingLeadSec || 2) * 1000),
        );
        return;
      }
      setHerTyping(false);
      pushLine("her", "voice", reply.replyBrief);
    },
    [pushLine],
  );

  const enqueueUtterance = useCallback(
    (text: string, channel: "chat" | "voice" = "voice") => {
      const cleaned = collapseRepeatedTranscript(text);
      if (cleaned.length < 2 || !callActiveRef.current) {
        return;
      }
      if (channel === "voice" && cleaned === lastCommittedRef.current) {
        return;
      }
      if (
        turnQueueRef.current.some(
          (turn) => turn.text === cleaned && turn.channel === channel,
        )
      ) {
        return;
      }
      lastCommittedRef.current = cleaned;
      turnQueueRef.current.push({ text: cleaned, channel });
      pendingUtteranceRef.current = turnQueueRef.current[0]?.text ?? null;
      lastChannelRef.current = channel;
      draftTextRef.current = "";
      speechBufferRef.current = "";
      setDraft(null);
      pushLine("you", channel, cleaned);
      if (channel === "voice") {
        setStatusKey("hearing");
        setActiveMuted(true);
      }
      wakeLoop();
    },
    [pushLine, setActiveMuted, wakeLoop],
  );

  const scheduleUtteranceCommit = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      const combined = [speechBufferRef.current, draftTextRef.current]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      speechBufferRef.current = "";
      draftTextRef.current = "";
      if (combined) {
        enqueueUtterance(combined);
      }
    }, UTTERANCE_COMMIT_MS);
  }, [enqueueUtterance]);

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("This browser can't use the mic. Type below instead.");
      return;
    }
    if (recognitionRef.current) {
      acceptSpeechRef.current = true;
      setMicArmed(true);
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      if (!acceptSpeechRef.current || !callActiveRef.current) {
        return;
      }

      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript?.trim();
        if (!piece) {
          continue;
        }
        if (result.isFinal) {
          finalText = finalText ? `${finalText} ${piece}` : piece;
        } else {
          interim = interim ? `${interim} ${piece}` : piece;
        }
      }

      if (finalText) {
        speechBufferRef.current = [speechBufferRef.current, finalText]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        draftTextRef.current = "";
        setDraft(speechBufferRef.current);
        setStatusKey("hearing");
        scheduleUtteranceCommit();
      }

      if (interim) {
        draftTextRef.current = interim;
        setDraft(
          [speechBufferRef.current, interim]
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " "),
        );
        setStatusKey("hearing");
        scheduleUtteranceCommit();
      }
    };
    recognition.onerror = (event) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setError("Mic blocked — type a message below instead.");
        setMicArmed(false);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition && callActiveRef.current) {
        try {
          recognition.start();
        } catch {
          // Already running.
        }
      }
    };

    recognitionRef.current = recognition;
    acceptSpeechRef.current = true;
    try {
      recognition.start();
      setMicArmed(true);
    } catch {
      setMicArmed(false);
      setError("Mic blocked — type a message below instead.");
    }
  }, [scheduleUtteranceCommit]);

  const openEar = useCallback(() => {
    lastCommittedRef.current = "";
    speechBufferRef.current = "";
    draftTextRef.current = "";
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    startRecognition();
    setStatusKey((current) =>
      current === "answering" ? current : "listening",
    );
  }, [startRecognition]);

  const closeEar = useCallback(() => {
    acceptSpeechRef.current = false;
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    draftTextRef.current = "";
    speechBufferRef.current = "";
    setDraft(null);
    setMicArmed(false);
  }, []);

  const swapInClip = useCallback(
    async (videoUrl: string, loop: boolean, withSound: boolean) => {
      const currentSlot = activeSlotRef.current;
      const inactiveEl = (currentSlot === "a" ? videoBRef : videoARef).current;
      const outgoingEl = (currentSlot === "a" ? videoARef : videoBRef).current;
      if (!inactiveEl) {
        return;
      }

      inactiveEl.src = videoUrl;
      inactiveEl.loop = loop;
      inactiveEl.muted = !withSound;
      inactiveEl.volume = withSound ? 0 : 1;
      inactiveEl.load();
      await waitForEvent(inactiveEl, "loadeddata");
      if (inactiveEl.duration && inactiveEl.duration > 0.2) {
        inactiveEl.currentTime = Math.min(0.03, inactiveEl.duration - 0.08);
      }

      try {
        await inactiveEl.play();
        setNeedsSoundTap(false);
        if (withSound) {
          inactiveEl.volume = 0;
          const start = performance.now();
          const ramp = () => {
            const elapsed = performance.now() - start;
            const level =
              elapsed < 1100 ? 0 : Math.min(1, (elapsed - 1100) / 280);
            inactiveEl.volume = level;
            if (level < 1) {
              requestAnimationFrame(ramp);
            }
          };
          requestAnimationFrame(ramp);
        }
      } catch {
        setNeedsSoundTap(true);
      }

      const nextSlot = currentSlot === "a" ? "b" : "a";
      activeSlotRef.current = nextSlot;
      setActiveSlot(nextSlot);
      window.setTimeout(() => {
        outgoingEl?.pause();
        if (outgoingEl) {
          outgoingEl.volume = 1;
        }
      }, 720);
    },
    [],
  );

  const waitForActiveEnded = useCallback(() => {
    return new Promise<void>((resolve) => {
      const active =
        activeSlotRef.current === "a" ? videoARef.current : videoBRef.current;
      if (!active) {
        resolve();
        return;
      }
      if (
        active.ended ||
        (active.duration > 0 && active.currentTime >= active.duration - 0.05)
      ) {
        resolve();
        return;
      }
      const done = () => {
        active.removeEventListener("ended", done);
        resolve();
      };
      active.addEventListener("ended", done);
      window.setTimeout(done, 35_000);
    });
  }, []);

  const requestClip = useCallback(
    async (
      promptText: string | null,
      options?: {
        clipKind?: "auto" | "fillerSip" | "greeting" | "checkIn";
        inputChannel?: "chat" | "voice";
        scriptedPhysical?: string;
        scriptedDuration?: number;
        scriptedLiveState?: string;
      },
    ) => {
      const generationId = generationIdRef.current;
      const clipKind = options?.clipKind ?? "auto";
      const inputChannel = options?.inputChannel ?? "voice";
      const isFillerSip = clipKind === "fillerSip";
      const isGreeting = clipKind === "greeting";
      const isCheckIn = clipKind === "checkIn";
      const isScripted = Boolean(options?.scriptedPhysical);
      const epochAtStart = isFillerSip
        ? fillerEpochRef.current
        : sceneEpochRef.current;
      const imageUrl = lastFrameUrlRef.current ?? referenceImageUrlRef.current;
      if (!imageUrl) {
        throw new Error("Missing reference image");
      }

      try {
        const result = await generateClip({
          promptText,
          sceneContext: sceneContextRef.current || null,
          surroundings: surroundingsRef.current || null,
          liveState: liveStateRef.current || null,
          worldState: worldStateRef.current || null,
          callElapsedSec: callStartedAtRef.current
            ? Math.max(
                0,
                Math.floor((Date.now() - callStartedAtRef.current) / 1000),
              )
            : 0,
          referenceImageUrl: imageUrl,
          originalReferenceImageUrl: referenceImageUrlRef.current ?? imageUrl,
          clipKind,
          inputChannel,
          scriptedPhysical: options?.scriptedPhysical ?? null,
          scriptedDuration: options?.scriptedDuration ?? null,
          scriptedLiveState: options?.scriptedLiveState ?? null,
        });

        if (
          generationId !== generationIdRef.current ||
          !callActiveRef.current
        ) {
          return null;
        }

        console.debug(
          `[ai-video-call] ${useReferenceModelRef.current ? "reference" : "turbo"} ${clipKind} generation: ${result.generationMs}ms`,
        );

        const stale =
          epochAtStart !==
          (isFillerSip ? fillerEpochRef.current : sceneEpochRef.current);
        const commitsScene =
          Boolean(promptText) ||
          isGreeting ||
          isScripted ||
          Boolean(result.commitFrame);
        setSpentUsd((total) => total + result.costUsd);

        if (stale) {
          return null;
        }

        if (!isFillerSip && commitsScene) {
          lastFrameUrlRef.current = result.lastFrameUrl;
          if (isGreeting) {
            referenceImageUrlRef.current = result.lastFrameUrl;
          }
          if (result.liveState) {
            liveStateRef.current = result.liveState;
            const clothes = result.liveState
              .match(/clothes=([^|]+)/)?.[1]
              ?.trim();
            if (clothes) {
              setOutfit(clothes);
            }
          }
          if (result.worldState) {
            worldStateRef.current = result.worldState;
          }
        } else if (isCheckIn && result.worldState) {
          worldStateRef.current = result.worldState;
        }

        if (promptText || isGreeting || isCheckIn) {
          sceneContextRef.current = [
            sceneContextRef.current,
            promptText
              ? `Fan ${inputChannel === "chat" ? "typed" : "said"}: ${promptText}`
              : null,
            result.replyBrief
              ? `Her ${result.replyChannel === "chat" ? "typed" : "said"}: ${result.replyBrief}`
              : null,
          ]
            .filter(Boolean)
            .join("\n")
            .slice(-3500);
        } else if (result.videoUrl) {
          idleUrlRef.current = result.videoUrl;
          idleNextUrlRef.current = null;
        }

        if (!result.videoUrl) {
          if (promptText || isGreeting) {
            setError("The call hit a problem. It's still up.");
          }
          return null;
        }
        return result;
      } catch (e) {
        if (generationId === generationIdRef.current && callActiveRef.current) {
          setError(
            e instanceof Error
              ? e.message
              : "The call hit a problem. It's still up.",
          );
        }
        return null;
      }
    },
    [generateClip],
  );

  const runCallLoop = useCallback(async () => {
    const showClip = async (
      clip: { videoUrl: string; lastFrameUrl: string },
      withSound: boolean,
      commitFrame = true,
    ) => {
      if (commitFrame) {
        lastFrameUrlRef.current = clip.lastFrameUrl;
      }
      await swapInClip(clip.videoUrl, false, withSound);
    };

    const ensureFiller = () => {
      if (fillerReadyRef.current) {
        return Promise.resolve(fillerReadyRef.current);
      }
      if (fillerInflightRef.current) {
        return fillerInflightRef.current;
      }
      if (turnQueueRef.current.length > 0) {
        return Promise.resolve(null);
      }
      const epoch = fillerEpochRef.current;
      const job = requestClip(null, { clipKind: "fillerSip" }).then((clip) => {
        if (fillerInflightRef.current === job) {
          fillerInflightRef.current = null;
        }
        if (!clip?.videoUrl || epoch !== fillerEpochRef.current) {
          return null;
        }
        fillerReadyRef.current = clip;
        return clip;
      });
      fillerInflightRef.current = job;
      return job;
    };

    const takeFiller = async () => {
      const clip = await ensureFiller();
      if (clip && fillerReadyRef.current === clip) {
        fillerReadyRef.current = null;
      }
      return clip;
    };

    const watchSpeech = () => {
      let cancel = () => {};
      const promise = new Promise<"speech" | "end">((resolve) => {
        let settled = false;
        const finish = (reason: "speech" | "end") => {
          if (settled) {
            return;
          }
          settled = true;
          if (wakeLoopRef.current === onWake) {
            wakeLoopRef.current = null;
          }
          resolve(reason);
        };
        const onWake = () => {
          if (!callActiveRef.current) {
            finish("end");
            return;
          }
          if (turnQueueRef.current.length > 0) {
            finish("speech");
          }
        };
        cancel = () => finish("end");
        if (!callActiveRef.current) {
          finish("end");
          return;
        }
        if (turnQueueRef.current.length > 0) {
          finish("speech");
          return;
        }
        wakeLoopRef.current = onWake;
      });
      return { promise, cancel };
    };

    const invalidateScene = () => {
      sceneEpochRef.current += 1;
    };

    const invalidateFiller = () => {
      fillerEpochRef.current += 1;
      fillerInflightRef.current = null;
      fillerReadyRef.current = null;
    };

    const waitForActiveEndedOrTurn = () => {
      return new Promise<"ended" | "turn">((resolve) => {
        const active =
          activeSlotRef.current === "a" ? videoARef.current : videoBRef.current;
        let settled = false;
        const finish = (reason: "ended" | "turn") => {
          if (settled) {
            return;
          }
          settled = true;
          active?.removeEventListener("ended", onEnd);
          window.clearInterval(poll);
          window.clearTimeout(cap);
          resolve(reason);
        };
        const onEnd = () => finish("ended");
        const poll = window.setInterval(() => {
          if (turnQueueRef.current.length > 0) {
            finish("turn");
          }
        }, 200);
        const cap = window.setTimeout(() => finish("ended"), 35_000);
        if (
          !active ||
          active.ended ||
          (active.duration > 0 && active.currentTime >= active.duration - 0.05)
        ) {
          finish("ended");
          return;
        }
        active.addEventListener("ended", onEnd);
      });
    };

    const playUntilReady = async <T,>(job: Promise<T>): Promise<T> => {
      let settled = false;
      while (!settled && callActiveRef.current) {
        const winner = await Promise.race([
          job.then(() => "ready" as const),
          waitForActiveEnded().then(() => "ended" as const),
        ]);
        settled = winner === "ready";
        if (settled) {
          break;
        }
        const cover = await Promise.race([takeFiller(), job.then(() => null)]);
        settled = !callActiveRef.current;
        if (settled || !cover?.videoUrl) {
          break;
        }
        await showClip(cover, false, false);
      }
      return job;
    };

    const drainQueueAsOneRequest = (): {
      text: string;
      channel: "chat" | "voice";
    } | null => {
      if (turnQueueRef.current.length === 0) {
        return null;
      }
      const drained = turnQueueRef.current.splice(0);
      return {
        text: drained.map((item) => item.text).join(" then "),
        channel: drained[drained.length - 1].channel,
      };
    };

    const playAnswer = async (
      clip: GenerateClipResponse & {
        followUp?: {
          physical: string;
          durationSec: number;
          liveState: string;
        } | null;
      },
      channel: "chat" | "voice",
    ) => {
      let series = clip.followUps?.length
        ? [...clip.followUps]
        : clip.followUp
          ? [clip.followUp]
          : [];
      let activeChannel = channel;
      lastFrameUrlRef.current = clip.lastFrameUrl;
      if (series.length === 0 && turnQueueRef.current.length === 0) {
        ensureFiller();
      }
      await showClip(clip, activeChannel === "voice");
      revealReply(clip);
      while (callActiveRef.current) {
        if (series.length === 0) {
          const drained = drainQueueAsOneRequest();
          if (!drained) {
            break;
          }
          activeChannel = drained.channel;
          invalidateFiller();
          const continued = await requestClip(drained.text, {
            inputChannel: activeChannel,
          });
          if (!continued?.videoUrl || !callActiveRef.current) {
            break;
          }
          series = continued.followUps?.length ? [...continued.followUps] : [];
          lastFrameUrlRef.current = continued.lastFrameUrl;
          if (series.length === 0 && turnQueueRef.current.length === 0) {
            ensureFiller();
          }
          await showClip(continued, activeChannel === "voice");
          revealReply(continued);
          continue;
        }
        const step = series.shift();
        if (!step) {
          continue;
        }
        // Cover with filler if generation runs past the current clip's end, same as every other request — otherwise the screen freezes on the last frame.
        const next = await playUntilReady(
          requestClip(null, {
            inputChannel: activeChannel,
            scriptedPhysical: step.physical,
            scriptedDuration: step.durationSec,
            scriptedLiveState: step.liveState,
          }),
        );
        if (!next?.videoUrl || !callActiveRef.current) {
          return;
        }
        lastFrameUrlRef.current = next.lastFrameUrl;
        if (series.length === 0 && turnQueueRef.current.length === 0) {
          ensureFiller();
        }
        await showClip(next, activeChannel === "voice");
      }
      await waitForActiveEnded();
    };

    try {
      setStatusKey("connecting");
      const hello = await requestClip(null, {
        clipKind: "greeting",
        inputChannel: "voice",
      }).catch(() => null);
      if (!callActiveRef.current) {
        return;
      }

      if (hello?.videoUrl) {
        ensureFiller();
        await showClip(hello, true);
        revealReply(hello);
        await waitForActiveEndedOrTurn();
      }

      if (!callActiveRef.current) {
        return;
      }

      openEar();
      setStatusKey("listening");
      let quietSince = Date.now();

      while (callActiveRef.current) {
        const turn = drainQueueAsOneRequest();
        pendingUtteranceRef.current = null;
        if (turn) {
          quietSince = Date.now();
          invalidateScene();
          closeEar();
          setStatusKey("answering");
          if (revealTimerRef.current) {
            clearTimeout(revealTimerRef.current);
            revealTimerRef.current = null;
            revealTokenRef.current += 1;
          }
          setHerTyping(turn.channel === "chat");
          const reply = await playUntilReady(
            requestClip(turn.text, { inputChannel: turn.channel }),
          );
          invalidateFiller();
          if (!reply?.videoUrl || !callActiveRef.current) {
            setHerTyping(false);
            openEar();
            setStatusKey("listening");
            continue;
          }
          await playAnswer(reply, turn.channel);
          if (!callActiveRef.current) {
            break;
          }
          openEar();
          setStatusKey("listening");
          continue;
        }

        if (Date.now() - quietSince > 45_000) {
          quietSince = Date.now();
          invalidateScene();
          closeEar();
          setStatusKey("answering");
          const channel = lastChannelRef.current;
          const checkIn = await playUntilReady(
            requestClip(null, { clipKind: "checkIn", inputChannel: channel }),
          );
          invalidateFiller();
          if (checkIn?.videoUrl && callActiveRef.current) {
            await playAnswer(checkIn, channel);
          }
          if (!callActiveRef.current) {
            break;
          }
          openEar();
          setStatusKey("listening");
          continue;
        }

        const filler = await takeFiller();
        if (!callActiveRef.current) {
          break;
        }
        if (turnQueueRef.current.length > 0 || !filler?.videoUrl) {
          if (!filler?.videoUrl) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, 500);
            });
          }
          continue;
        }

        await showClip(filler, false, Boolean(filler.commitFrame));
        if (turnQueueRef.current.length === 0) {
          ensureFiller();
        }
        const speech = watchSpeech();
        const winner = await Promise.race([
          speech.promise,
          waitForActiveEnded().then(() => "ended" as const),
        ]);
        speech.cancel();
        if (winner === "end" || !callActiveRef.current) {
          break;
        }
      }
    } catch (e) {
      if (callActiveRef.current) {
        setError(
          e instanceof Error
            ? e.message
            : "The call hit a problem. It's still up.",
        );
      }
      callActiveRef.current = false;
      setPhase("setup");
    }
  }, [
    closeEar,
    openEar,
    requestClip,
    revealReply,
    swapInClip,
    waitForActiveEnded,
  ]);

  const endCall = useCallback(() => {
    callActiveRef.current = false;
    generationIdRef.current += 1;
    wakeLoop();
    stopRecognition();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    pendingUtteranceRef.current = null;
    turnQueueRef.current = [];
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
    }
    revealTokenRef.current += 1;
    setHerTyping(false);
    setRoomLines([]);
    sceneContextRef.current = "";
    liveStateRef.current = initialLiveStateRef.current;
    worldStateRef.current = initialWorldStateRef.current;
    idleUrlRef.current = null;
    idleNextUrlRef.current = null;
    sceneEpochRef.current += 1;
    fillerEpochRef.current += 1;
    fillerInflightRef.current = null;
    fillerReadyRef.current = null;
    motionTokenRef.current += 1;
    callStartedAtRef.current = null;
    videoARef.current?.pause();
    videoBRef.current?.pause();
    setPhase("setup");
    setStatusKey("connecting");
    setOutfit("clothed");
    setDraft(null);
    setNeedsSoundTap(false);
  }, [stopRecognition, wakeLoop]);

  const startCall = useCallback(() => {
    if (!originalUploadUrlRef.current || callActiveRef.current) {
      return;
    }
    referenceImageUrlRef.current = originalUploadUrlRef.current;
    lastFrameUrlRef.current = originalUploadUrlRef.current;
    callActiveRef.current = true;
    callStartedAtRef.current = Date.now();
    generationIdRef.current += 1;
    pendingUtteranceRef.current = null;
    turnQueueRef.current = [];
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
    }
    revealTokenRef.current += 1;
    setHerTyping(false);
    setRoomLines([]);
    draftTextRef.current = "";
    sceneContextRef.current = [
      surroundingsRef.current ? `Place: ${surroundingsRef.current}` : null,
      initialWorldStateRef.current
        ? `World: ${initialWorldStateRef.current}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    idleUrlRef.current = null;
    idleNextUrlRef.current = null;
    sceneEpochRef.current += 1;
    fillerEpochRef.current += 1;
    fillerInflightRef.current = null;
    fillerReadyRef.current = null;
    motionTokenRef.current += 1;
    liveStateRef.current = initialLiveStateRef.current;
    worldStateRef.current = initialWorldStateRef.current;
    activeSlotRef.current = "a";
    setActiveSlot("a");
    setPhase("call");
    setError(null);
    setSpentUsd(0);
    setDraft(null);
    setStatusKey("connecting");
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (!callActiveRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play();
        }
      } catch {
        // Preview is optional — call still works without it.
      }
    })();
    void runCallLoop();
  }, [runCallLoop]);

  useEffect(() => {
    if (phase !== "call") {
      return;
    }
    const el = localVideoRef.current;
    const stream = localStreamRef.current;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      void el.play();
    }
  }, [phase]);

  const handleImagePicked = useCallback(
    async (file: File) => {
      setError(null);
      setPhotoReady(false);
      setUploading(true);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setPosterUrl(previewUrl);

      try {
        const { base64, contentType } = await readFileAsBase64(file);
        if (contentType !== "image/jpeg" && contentType !== "image/png") {
          setError("Use a JPEG or PNG photo.");
          return;
        }
        const { imageUrl, surroundings, liveState, worldState } =
          await postJson<{
            imageUrl: string;
            surroundings: string;
            liveState: string;
            worldState: string;
          }>("/api/ai-video/upload-reference-image", {
            imageBase64: base64,
            contentType,
            sceneId,
          });
        referenceImageUrlRef.current = imageUrl;
        originalUploadUrlRef.current = imageUrl;
        lastFrameUrlRef.current = imageUrl;
        surroundingsRef.current = surroundings ?? "";
        liveStateRef.current = liveState ?? "";
        setOutfit("clothed");
        worldStateRef.current = worldState ?? "";
        initialLiveStateRef.current = liveState ?? "";
        initialWorldStateRef.current = worldState ?? "";
        sceneContextRef.current = [
          surroundings ? `Place: ${surroundings}` : null,
          worldState ? `World: ${worldState}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        setPhotoReady(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn't upload that photo.",
        );
      } finally {
        setUploading(false);
      }
    },
    [sceneId],
  );

  useEffect(
    () => () => {
      callActiveRef.current = false;
      stopRecognition();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    [stopRecognition],
  );

  const retrySound = () => {
    const active =
      activeSlotRef.current === "a" ? videoARef.current : videoBRef.current;
    if (!active) {
      return;
    }
    active.muted = false;
    void active.play().then(() => setNeedsSoundTap(false));
  };

  const onMicDown = () => {
    if (!callActiveRef.current) {
      return;
    }
    setActiveMuted(true);
    generationIdRef.current += 1;
    revealTokenRef.current += 1;
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
    }
    setHerTyping(false);
    openEar();
    setStatusKey("hearing");
  };

  if (phase === "setup") {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            maxWidth: 420,
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: "white",
              }}
            >
              Video call
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "#aaa" }}>
              She&apos;s live. Type and she types back on camera. Talk and she
              answers out loud.
            </p>
          </div>

          {posterUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt=""
              style={{
                aspectRatio: "3 / 4",
                width: "100%",
                borderRadius: 12,
                objectFit: "cover",
              }}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImagePicked(file);
              }
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "white",
              }}
            >
              Choose her scene
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SCENE_CHOICES.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => setSceneId(scene.id)}
                  style={{
                    borderRadius: 9999,
                    padding: "8px 16px",
                    fontSize: 14,
                    cursor: "pointer",
                    border: sceneId === scene.id ? "none" : "1px solid #444",
                    background: sceneId === scene.id ? "white" : "transparent",
                    color: sceneId === scene.id ? "black" : "white",
                  }}
                >
                  {scene.label}
                </button>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
              Just her face and body come from the photo — the room is up to
              you.
            </p>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#888",
            }}
          >
            <input
              type="checkbox"
              checked={useReferenceModel}
              onChange={(event) => setUseReferenceModel(event.target.checked)}
            />
            DEV: use h3-max/reference-to-video (experimental)
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                borderRadius: 9999,
                border: "1px solid #444",
                background: "transparent",
                padding: "14px 0",
                fontSize: 15,
                fontWeight: 600,
                color: "white",
                cursor: uploading ? "wait" : "pointer",
              }}
            >
              {uploading ? "Uploading…" : "Choose a photo"}
            </button>
            <p style={{ margin: 0, fontSize: 13, color: "#888" }}>
              JPEG or PNG. This is who answers.
            </p>
            <button
              type="button"
              disabled={!photoReady || uploading}
              onClick={startCall}
              style={{
                width: "100%",
                borderRadius: 9999,
                border: "none",
                padding: "14px 0",
                fontSize: 15,
                fontWeight: 600,
                color: "black",
                background: !photoReady || uploading ? "#555" : "white",
                cursor: !photoReady || uploading ? "not-allowed" : "pointer",
              }}
            >
              Enter the room
            </button>
          </div>

          {error && (
            <div
              style={{
                borderRadius: 12,
                background: "rgba(220,38,38,0.15)",
                padding: 12,
                fontSize: 14,
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        alignItems: "center",
        justifyContent: "center",
        background: "black",
        color: "white",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          height: "100dvh",
          width: "100%",
          maxWidth: 420,
          flexDirection: "column",
          overflow: "hidden",
          background: "black",
        }}
      >
        <div
          style={{
            position: "relative",
            minHeight: 0,
            flex: 1,
            background: "black",
          }}
        >
          {posterUrl && statusKey === "connecting" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt=""
              style={{
                pointerEvents: "none",
                position: "absolute",
                inset: 0,
                height: "100%",
                width: "100%",
                objectFit: "cover",
              }}
            />
          )}
          <video
            ref={videoARef}
            playsInline
            disablePictureInPicture
            controls={false}
            style={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
              objectFit: "cover",
              transition: "opacity 700ms ease-in-out",
              opacity: activeSlot === "a" ? 1 : 0,
            }}
          />
          <video
            ref={videoBRef}
            playsInline
            disablePictureInPicture
            controls={false}
            style={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              height: "100%",
              width: "100%",
              objectFit: "cover",
              transition: "opacity 700ms ease-in-out",
              opacity: activeSlot === "b" ? 1 : 0,
            }}
          />
          <ShowChrome
            lines={roomLines}
            herTyping={herTyping}
            error={error}
            micArmed={micArmed}
            needsSoundTap={needsSoundTap}
            meta={`Spent $${spentUsd.toFixed(2)}`}
            localVideoRef={localVideoRef}
            soundOn={soundOn}
            outfit={outfit}
            onSend={(text) => enqueueUtterance(text, "chat")}
            onToggleSound={() => {
              const next = !soundOn;
              setSoundOn(next);
              if (next) {
                retrySound();
              } else {
                setActiveMuted(true);
              }
            }}
            onMicDown={onMicDown}
            onExit={endCall}
            onSoundTap={retrySound}
          />
        </div>
      </div>
    </div>
  );
}
