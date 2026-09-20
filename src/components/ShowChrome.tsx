"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

// Ported from eden/src/pagecomponents/AiVideoSpike/ShowChrome.tsx — @fanvue/ui and react-i18next dropped for plain HTML/CSS and inline English strings.

const GOLD_GRADIENT = "linear-gradient(to bottom, #FFD21A, #FFAB00)";
const GOLD_TEXT_ON_GOLD = "#2B1D00";
const GLASS_PILL = "1px solid rgba(255,255,255,0.25)";
const GLASS_BG = "rgba(255,255,255,0.09)";
const COIN_PILL_BORDER = "1.5px solid rgba(255,209,26,0.85)";
const COIN_PILL_BG = "rgba(12,10,4,0.7)";

type ShowLine = {
  id: number;
  role: "you" | "her";
  channel: "chat" | "voice";
  text: string;
};

type SheetName = "tips" | "actions" | "private" | "coins" | "quick" | null;
type ShowMode = "public" | "intro" | "private" | "ended";

type Act = {
  id: string;
  emoji: string;
  price: number;
  privateOnly: boolean;
  prompt: string;
  label: string;
};

const ACTS: Act[] = [
  {
    id: "wave",
    emoji: "👋",
    price: 10,
    privateOnly: false,
    prompt: "wave at me",
    label: "Wave",
  },
  {
    id: "kiss",
    emoji: "😘",
    price: 25,
    privateOnly: false,
    prompt: "blow me a kiss",
    label: "Blow a kiss",
  },
  {
    id: "tongue",
    emoji: "👅",
    price: 30,
    privateOnly: false,
    prompt: "stick your tongue out",
    label: "Tongue",
  },
  {
    id: "spin",
    emoji: "💫",
    price: 40,
    privateOnly: false,
    prompt: "spin around for me",
    label: "Spin",
  },
  {
    id: "dance",
    emoji: "💃",
    price: 50,
    privateOnly: false,
    prompt: "dance for me",
    label: "Dance",
  },
  {
    id: "top",
    emoji: "👕",
    price: 80,
    privateOnly: false,
    prompt: "take your top off",
    label: "Top off",
  },
  {
    id: "tits",
    emoji: "🍒",
    price: 120,
    privateOnly: false,
    prompt: "show me your tits",
    label: "Show tits",
  },
  {
    id: "jiggle",
    emoji: "✨",
    price: 150,
    privateOnly: false,
    prompt: "jiggle your tits",
    label: "Jiggle",
  },
  {
    id: "ass",
    emoji: "🍑",
    price: 180,
    privateOnly: false,
    prompt: "show me your ass",
    label: "Show ass",
  },
  {
    id: "bend",
    emoji: "🫠",
    price: 160,
    privateOnly: false,
    prompt: "bend over",
    label: "Bend over",
  },
  {
    id: "nude",
    emoji: "🔥",
    price: 200,
    privateOnly: false,
    prompt: "get naked",
    label: "Get naked",
  },
  {
    id: "shake",
    emoji: "🍑",
    price: 220,
    privateOnly: true,
    prompt: "shake your ass",
    label: "Ass shake",
  },
  {
    id: "spread",
    emoji: "🦵",
    price: 250,
    privateOnly: true,
    prompt: "spread your legs",
    label: "Spread",
  },
  {
    id: "play",
    emoji: "💧",
    price: 400,
    privateOnly: true,
    prompt: "play with your pussy",
    label: "Play",
  },
  {
    id: "touch",
    emoji: "💦",
    price: 400,
    privateOnly: true,
    prompt: "touch yourself",
    label: "Touch yourself",
  },
  {
    id: "suck",
    emoji: "💋",
    price: 400,
    privateOnly: false,
    prompt: "suck a dildo",
    label: "Suck",
  },
  {
    id: "throat",
    emoji: "👄",
    price: 450,
    privateOnly: true,
    prompt: "deepthroat",
    label: "Deepthroat",
  },
  {
    id: "toy",
    emoji: "🔥",
    price: 500,
    privateOnly: true,
    prompt: "use a dildo",
    label: "Use a toy",
  },
];

const TIP_AMOUNTS = [10, 25, 50, 100, 250, 500];
const COIN_PACKS = [
  { id: "40", coins: 40, price: "$3.99" },
  { id: "100", coins: 100, price: "$9.99" },
  { id: "275", coins: 275, price: "$24.99" },
  { id: "575", coins: 575, price: "$49.99", tag: "popular" },
  { id: "1200", coins: 1200, price: "$99.99" },
  { id: "2500", coins: 2500, price: "$199.99", tag: "value" },
];
const PRIVATE_RATE = 24;
const PRIVATE_MIN_MINUTES = 3;
const ROOM_NAMES = ["quiet36", "marc91", "steve_k", "jay_22", "leo44"];
const ROOM_LINES = [
  "hey",
  "you look amazing",
  "finally caught you live",
  "that smile tho",
];
const NAME_COLORS = ["#c7d2fe", "#fde68a", "#a7f3d0", "#ddd6fe", "#bae6fd"];

const discounted = (price: number, offerOn: boolean) =>
  offerOn ? Math.max(1, Math.round(price * 0.85)) : price;

const formatClock = (totalSeconds: number) => {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const nameColor = (name: string) => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return NAME_COLORS[hash % NAME_COLORS.length];
};

const outfitLabel = (value: string) => {
  switch (value) {
    case "topless":
      return "Topless";
    case "top-lifted":
      return "Top lifted";
    case "bottomless":
      return "Bottomless";
    case "nude":
      return "Nude";
    default:
      return "Clothed";
  }
};

type ShowChromeProps = {
  lines: ShowLine[];
  herTyping: boolean;
  error: string | null;
  micArmed: boolean;
  needsSoundTap: boolean;
  meta: string;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  onSend: (text: string) => void;
  onToggleSound: () => void;
  soundOn: boolean;
  outfit: string;
  onMicDown: () => void;
  onExit: () => void;
  onSoundTap: () => void;
};

export const ShowChrome = ({
  lines,
  herTyping,
  error,
  micArmed,
  needsSoundTap,
  meta,
  localVideoRef,
  onSend,
  onToggleSound,
  soundOn,
  outfit,
  onMicDown,
  onExit,
  onSoundTap,
}: ShowChromeProps) => {
  const [mode, setMode] = useState<ShowMode>("public");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [coins, setCoins] = useState(80);
  const [boughtOnce, setBoughtOnce] = useState(false);
  const [packId, setPackId] = useState("575");
  const [viewers, setViewers] = useState(550);
  const [goal, setGoal] = useState(300);
  const [selfTips, setSelfTips] = useState(0);
  const [room, setRoom] = useState<
    { id: string; name: string; text: string }[]
  >([]);
  const [toast, setToast] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [privateLeft, setPrivateLeft] = useState(PRIVATE_MIN_MINUTES * 60);
  const [showAllActs, setShowAllActs] = useState(false);
  const [offerEndsAt] = useState(() => Date.now() + 10 * 60 * 1000);
  const [now, setNow] = useState(() => Date.now());
  const feedRef = useRef<HTMLOListElement>(null);
  const lineId = useRef(0);
  const tipSeq = useRef(0);

  const offerOn = now < offerEndsAt;
  const offerLeft = formatClock(Math.ceil((offerEndsAt - now) / 1000));
  const privateCost = discounted(PRIVATE_RATE * PRIVATE_MIN_MINUTES, offerOn);
  const extendCost = discounted(PRIVATE_RATE, offerOn);
  const rate = discounted(PRIVATE_RATE, offerOn);
  const menu = ACTS.filter((item) => mode === "private" || !item.privateOnly);
  const privateMenu = ACTS;
  const leader = [
    { name: "steve_k", coins: 240 },
    { name: "marc91", coins: 180 },
    { name: "You", coins: selfTips },
  ].sort((a, b) => b.coins - a.coins);
  const top = leader[0];

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (mode !== "public") {
      return;
    }
    const viewersId = window.setInterval(() => {
      setViewers((current) =>
        Math.max(
          480,
          Math.min(640, current + Math.round((Math.random() - 0.5) * 14)),
        ),
      );
    }, 1200);
    let chatTimer = 0;
    const queueChat = () => {
      chatTimer = window.setTimeout(
        () => {
          const name =
            ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)] ?? "fan";
          const text =
            ROOM_LINES[Math.floor(Math.random() * ROOM_LINES.length)] ?? "hey";
          lineId.current += 1;
          setRoom((prev) => [
            ...prev.slice(-16),
            { id: `room-${lineId.current}`, name, text },
          ]);
          queueChat();
        },
        2200 + Math.random() * 2800,
      );
    };
    queueChat();
    return () => {
      window.clearInterval(viewersId);
      window.clearTimeout(chatTimer);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "private") {
      return;
    }
    const id = window.setInterval(() => {
      setPrivateLeft((left) => {
        if (left <= 1) {
          setMode("ended");
          setSheet(null);
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [mode]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [room, lines, herTyping]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const spend = (amount: number, label: string) => {
    if (coins < amount) {
      setToast(`Need ${amount - coins} more coins`);
      setSheet("coins");
      return false;
    }
    setCoins((current) => current - amount);
    setSelfTips((current) => current + amount);
    setGoal((current) => current + amount);
    setToast(label);
    return true;
  };

  const sendTip = (amount: number) => {
    const price = discounted(amount, offerOn);
    if (!spend(price, `Tipped ${price}`)) {
      return;
    }
    tipSeq.current += 1;
    setSheet(null);
    onSend(`tipped you ${price} coins`);
  };

  const requestAct = (act: Act) => {
    const price = mode === "private" ? 0 : discounted(act.price, offerOn);
    if (price > 0 && !spend(price, `Tipped ${price}`)) {
      return;
    }
    setSheet(null);
    onSend(act.prompt);
  };

  const startPrivate = () => {
    if (!spend(privateCost, "Private show started")) {
      return;
    }
    setSheet(null);
    setLeaveOpen(false);
    setPrivateLeft(PRIVATE_MIN_MINUTES * 60);
    setMode("intro");
    window.setTimeout(() => setMode("private"), 1800);
    onSend("we're private now, it's just us");
  };

  const buyPack = () => {
    const pack = COIN_PACKS.find((item) => item.id === packId) ?? COIN_PACKS[0];
    if (!pack) {
      return;
    }
    const grant = boughtOnce ? pack.coins : pack.coins * 2;
    setCoins((current) => current + grant);
    setBoughtOnce(true);
    setToast(`+${grant} coins`);
    setSheet(null);
  };

  const pill = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    border: GLASS_PILL,
    background: GLASS_BG,
    backdropFilter: "blur(12px)",
    borderRadius: 9999,
    ...extra,
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        color: "white",
        pointerEvents: "none",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          pointerEvents: "auto",
          position: "absolute",
          left: 12,
          right: 12,
          top: 12,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 8 }}
        >
          <div
            style={{
              display: "grid",
              width: 40,
              height: 40,
              flexShrink: 0,
              placeItems: "center",
              overflow: "hidden",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.3)",
            }}
          >
            <video
              ref={localVideoRef}
              playsInline
              muted
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Her
            </p>
            {mode === "public" || mode === "ended" ? (
              <p
                style={{
                  margin: "2px 0 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    borderRadius: 4,
                    background: "#E5192D",
                    padding: "2px 6px",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Live
                </span>
                <span style={{ fontSize: 11 }}>👥 {viewers} viewers</span>
              </p>
            ) : (
              <p
                style={{
                  margin: "2px 0 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    borderRadius: 4,
                    background: "#F5B800",
                    padding: "2px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#3A2A00",
                  }}
                >
                  Private show
                </span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>
                  {formatClock(privateLeft)}
                </span>
              </p>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            alignItems: "center",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setSheet("coins")}
            style={{
              ...pill({ border: COIN_PILL_BORDER, background: COIN_PILL_BG }),
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              fontSize: 15,
              fontWeight: 800,
              color: "white",
              cursor: "pointer",
            }}
          >
            🪙 {coins}
            <span
              style={{
                display: "grid",
                width: 16,
                height: 16,
                placeItems: "center",
                borderRadius: "50%",
                fontSize: 12,
                background: GOLD_GRADIENT,
                color: GOLD_TEXT_ON_GOLD,
              }}
            >
              +
            </span>
          </button>
          {mode === "public" ? (
            <button
              type="button"
              aria-label="Send a tip"
              onClick={() => setSheet("quick")}
              style={{
                display: "grid",
                width: 48,
                height: 48,
                placeItems: "center",
                borderRadius: "50%",
                background: GOLD_GRADIENT,
                color: GOLD_TEXT_ON_GOLD,
                border: "none",
                cursor: "pointer",
              }}
            >
              👑
            </button>
          ) : null}
          <button
            type="button"
            aria-label="End call"
            onClick={() => {
              if (mode === "private" || mode === "intro") {
                setLeaveOpen(true);
                return;
              }
              onExit();
            }}
            style={{
              ...pill(),
              display: "grid",
              width: 40,
              height: 40,
              placeItems: "center",
              color: "white",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      </header>

      {mode === "public" ? (
        <div
          style={{
            pointerEvents: "auto",
            position: "absolute",
            left: 12,
            right: 64,
            top: 68,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              borderRadius: 16,
              background: "rgba(0,0,0,0.35)",
              padding: "8px 12px",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                marginBottom: 4,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 600 }}>💛 Tip goal</span>
              {offerOn ? (
                <span style={{ fontWeight: 600, color: "#FFD21A" }}>
                  15% off · {offerLeft}
                </span>
              ) : null}
            </div>
            <div
              style={{
                height: 6,
                width: "100%",
                overflow: "hidden",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.2)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 9999,
                  background: GOLD_GRADIENT,
                  width: `${Math.min(100, (goal / 500) * 100)}%`,
                }}
              />
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12 }}>
              {Math.min(goal, 500)} / 500
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheet("quick")}
            style={{
              ...pill({
                border: "1px solid rgba(255,210,26,0.45)",
                background: "rgba(0,0,0,0.28)",
              }),
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 12,
              color: "white",
              cursor: "pointer",
            }}
          >
            👑 <span>{top?.name}</span>{" "}
            <span style={{ fontWeight: 600, color: "#FFD21A" }}>
              {top?.coins}
            </span>
          </button>
        </div>
      ) : null}

      <div
        style={{
          pointerEvents: "auto",
          position: "absolute",
          right: 12,
          top: 128,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          type="button"
          aria-label={soundOn ? "Mute" : "Unmute"}
          onClick={onToggleSound}
          style={{
            display: "grid",
            width: 40,
            height: 40,
            placeItems: "center",
            borderRadius: "50%",
            cursor: "pointer",
            border: soundOn ? "none" : GLASS_PILL,
            background: soundOn ? GOLD_GRADIENT : GLASS_BG,
            color: soundOn ? GOLD_TEXT_ON_GOLD : "white",
          }}
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
        <button
          type="button"
          aria-label="Turn mic on"
          onPointerDown={onMicDown}
          onClick={onMicDown}
          style={{
            display: "grid",
            width: 40,
            height: 40,
            placeItems: "center",
            borderRadius: "50%",
            cursor: "pointer",
            border: micArmed ? "none" : GLASS_PILL,
            background: micArmed ? GOLD_GRADIENT : GLASS_BG,
            color: micArmed ? GOLD_TEXT_ON_GOLD : "white",
          }}
        >
          🎙️
        </button>
        <button
          type="button"
          aria-label={outfitLabel(outfit)}
          aria-expanded={infoOpen}
          onClick={() => setInfoOpen((open) => !open)}
          style={{
            ...pill(),
            display: "grid",
            width: 40,
            height: 40,
            placeItems: "center",
            color: "white",
            cursor: "pointer",
          }}
        >
          ℹ️
        </button>
      </div>

      {infoOpen ? (
        <div
          style={{
            position: "absolute",
            right: 64,
            top: 128,
            borderRadius: 16,
            background: "rgba(0,0,0,0.6)",
            padding: "8px 12px",
            fontSize: 12,
            backdropFilter: "blur(8px)",
          }}
        >
          <p style={{ margin: 0 }}>{outfitLabel(outfit)}</p>
          <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.6)" }}>
            {meta}
          </p>
        </div>
      ) : null}

      {mode === "private" && privateLeft <= 30 ? (
        <div
          style={{
            pointerEvents: "auto",
            position: "absolute",
            left: 12,
            right: 12,
            top: 112,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            borderRadius: 16,
            background: "rgba(0,0,0,0.55)",
            padding: "8px 12px",
            fontSize: 14,
            backdropFilter: "blur(8px)",
          }}
        >
          <span>{privateLeft}s left</span>
          <button
            type="button"
            onClick={() => {
              if (spend(extendCost, "Added a minute")) {
                setPrivateLeft((left) => left + 60);
              }
            }}
            style={{
              borderRadius: 9999,
              padding: "8px 14px",
              fontSize: 13.5,
              fontWeight: 700,
              background: GOLD_GRADIENT,
              color: GOLD_TEXT_ON_GOLD,
              border: "none",
              cursor: "pointer",
            }}
          >
            +1 min · {extendCost}
          </button>
        </div>
      ) : null}

      <div
        style={{
          pointerEvents: "auto",
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "0 12px max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <ol
          ref={feedRef}
          style={{
            margin: 0,
            marginBottom: 8,
            display: "flex",
            maxHeight: 144,
            flexDirection: "column",
            gap: 4,
            overflowY: "auto",
            paddingRight: 56,
            paddingLeft: 0,
            fontSize: 13,
            listStyle: "none",
          }}
        >
          {mode === "public"
            ? room.map((line) => (
                <li key={line.id}>
                  <span style={{ color: nameColor(line.name) }}>
                    {line.name}
                  </span>{" "}
                  {line.text}
                </li>
              ))
            : null}
          {lines.map((line) => (
            <li key={line.id}>
              <span
                style={{ color: line.role === "her" ? "#FF5FA2" : "#7dd3fc" }}
              >
                {line.role === "her" ? "Her" : "You"}
              </span>{" "}
              {line.channel === "voice" ? "said " : ""}
              {line.text}
            </li>
          ))}
          {herTyping ? (
            <li style={{ color: "#FF5FA2" }} aria-live="polite">
              Her typing…
            </li>
          ) : null}
        </ol>

        {needsSoundTap ? (
          <button
            type="button"
            onClick={onSoundTap}
            style={{
              marginBottom: 8,
              width: "100%",
              borderRadius: 9999,
              background: "white",
              padding: "12px 0",
              fontSize: 15,
              fontWeight: 600,
              color: "black",
              border: "none",
              cursor: "pointer",
            }}
          >
            Tap for sound
          </button>
        ) : null}

        <form
          style={{
            ...pill(),
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 6px 4px 20px",
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const text = draftText.trim();
            if (text.length < 2) {
              return;
            }
            onSend(text);
            setDraftText("");
          }}
        >
          <input
            type="text"
            value={draftText}
            maxLength={300}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder="Type to her…"
            style={{
              minWidth: 0,
              flex: 1,
              background: "transparent",
              padding: "10px 0",
              fontSize: 15,
              color: "white",
              border: "none",
              outline: "none",
            }}
          />
          <button
            type="submit"
            aria-label="Send"
            style={{
              display: "grid",
              width: 36,
              height: 36,
              flexShrink: 0,
              placeItems: "center",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.28)",
              background: "rgba(255,255,255,0.14)",
              color: "white",
              cursor: "pointer",
            }}
          >
            ➤
          </button>
        </form>

        {mode === "public" ? (
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setSheet("tips")}
              style={{
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "transparent",
                padding: "12px 0",
                fontSize: 15,
                fontWeight: 600,
                color: "white",
                cursor: "pointer",
              }}
            >
              Tip menu
            </button>
            <button
              type="button"
              onClick={() => setSheet("private")}
              style={{
                borderRadius: 9999,
                padding: "12px 0",
                fontSize: 15,
                fontWeight: 700,
                background: GOLD_GRADIENT,
                color: GOLD_TEXT_ON_GOLD,
                border: "none",
                cursor: "pointer",
              }}
            >
              Start private
            </button>
          </div>
        ) : mode === "private" ? (
          <button
            type="button"
            onClick={() => setSheet("actions")}
            style={{
              marginTop: 8,
              width: "100%",
              borderRadius: 9999,
              background: "white",
              padding: "12px 0",
              fontSize: 15,
              fontWeight: 600,
              color: "black",
              border: "none",
              cursor: "pointer",
            }}
          >
            Request actions
          </button>
        ) : null}
      </div>

      {toast || error ? (
        <p
          role="status"
          style={{
            pointerEvents: "none",
            position: "absolute",
            left: "50%",
            top: "33%",
            zIndex: 30,
            transform: "translateX(-50%)",
            borderRadius: 9999,
            background: "rgba(0,0,0,0.7)",
            padding: "6px 12px",
            fontSize: 14,
            margin: 0,
          }}
        >
          {error ?? toast}
        </p>
      ) : null}

      {sheet === "tips" || sheet === "actions" ? (
        <Sheet
          onClose={() => setSheet(null)}
          title={sheet === "tips" ? "Tip menu" : "Request actions"}
        >
          {sheet === "actions" ? (
            <p
              style={{
                padding: "0 16px 8px",
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Included in your private show. She still does it live.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px 8px",
                fontSize: 14,
              }}
            >
              <span>
                Balance 🪙 <strong>{coins}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSheet("coins")}
                style={linkButtonStyle}
              >
                Get coins
              </button>
            </div>
          )}
          <ul
            style={{
              margin: 0,
              listStyle: "none",
              minHeight: 0,
              flex: 1,
              overflowY: "auto",
              padding: "0 8px",
            }}
          >
            {menu.map((item) => {
              const price =
                mode === "private" ? 0 : discounted(item.price, offerOn);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => requestAct(item)}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: 12,
                      borderRadius: 12,
                      padding: "10px 12px",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 18 }}>
                      {item.emoji}
                    </span>
                    <span style={{ flex: 1, fontSize: 14 }}>{item.label}</span>
                    {price > 0 ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        🪙 {price}
                      </span>
                    ) : (
                      <span
                        style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}
                      >
                        Included
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      ) : null}

      {sheet === "private" ? (
        <Sheet onClose={() => setSheet(null)} title="Start private">
          <div style={{ padding: "0 16px 20px" }}>
            <button
              type="button"
              onClick={startPrivate}
              style={primaryButtonStyle}
            >
              🪙 Start {rate}/min
            </button>
            <p
              style={{
                marginTop: 8,
                textAlign: "center",
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Minimum {PRIVATE_MIN_MINUTES} minutes · {privateCost} coins
            </p>
            <p
              style={{
                marginTop: 12,
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Every action is included. She chats only with you, and she answers
              live.
            </p>
            <p
              style={{
                marginTop: 8,
                fontSize: 14,
                color: "rgba(255,255,255,0.7)",
                display: showAllActs ? "block" : "-webkit-box",
                WebkitLineClamp: showAllActs ? undefined : 2,
                WebkitBoxOrient: "vertical",
                overflow: showAllActs ? "visible" : "hidden",
              }}
            >
              {privateMenu.map((item) => item.label).join(", ")}
            </p>
            <button
              type="button"
              onClick={() => setShowAllActs((open) => !open)}
              style={{ ...linkButtonStyle, marginTop: 4 }}
            >
              {showAllActs ? "Show less" : "Show more"}
            </button>
          </div>
        </Sheet>
      ) : null}

      {sheet === "quick" ? (
        <Sheet onClose={() => setSheet(null)} title="🪙 Send a tip">
          <div style={{ padding: "0 16px 20px" }}>
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
              }}
            >
              <span>
                Balance 🪙 <strong>{coins}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSheet("coins")}
                style={linkButtonStyle}
              >
                Get coins
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {TIP_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => sendTip(amount)}
                  style={{
                    borderRadius: 9999,
                    border: "1px solid rgba(255,255,255,0.3)",
                    background: "transparent",
                    padding: "8px 0",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  🪙 {discounted(amount, offerOn)}
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      ) : null}

      {sheet === "coins" ? (
        <Sheet onClose={() => setSheet(null)} title="Get coins">
          <div style={{ padding: "0 16px 16px" }}>
            <p
              style={{
                marginBottom: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 14,
              }}
            >
              Balance 🪙 <strong>{coins}</strong>
            </p>
            {!boughtOnce ? (
              <p
                style={{
                  marginBottom: 12,
                  borderRadius: 12,
                  background: "rgba(255,171,0,0.15)",
                  padding: "8px 12px",
                  fontSize: 14,
                }}
              >
                First recharge doubles any pack. Demo only — no card is charged.
              </p>
            ) : null}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {COIN_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPackId(pack.id)}
                  style={{
                    borderRadius: 16,
                    border:
                      packId === pack.id
                        ? "1px solid #FFAB00"
                        : "1px solid rgba(255,255,255,0.2)",
                    padding: 12,
                    textAlign: "left",
                    background: "transparent",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {pack.tag ? (
                    <span
                      style={{
                        marginBottom: 4,
                        display: "block",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        color: "#FFAB00",
                      }}
                    >
                      {pack.tag === "popular" ? "Most popular" : "Best value"}
                    </span>
                  ) : null}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: 600,
                    }}
                  >
                    🪙 {boughtOnce ? pack.coins : pack.coins * 2}
                  </span>
                  <span
                    style={{
                      marginTop: 4,
                      display: "block",
                      fontSize: 12,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {pack.price}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            <button type="button" onClick={buyPack} style={primaryButtonStyle}>
              Add coins
            </button>
            <p
              style={{
                marginTop: 8,
                textAlign: "center",
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Demo balance only · no card is charged
            </p>
          </div>
        </Sheet>
      ) : null}

      {mode === "intro" ? (
        <div
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            zIndex: 40,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            background: "rgba(0,0,0,0.7)",
          }}
        >
          <div>
            <p style={{ fontSize: 14 }}>Private show</p>
            <p style={{ marginTop: 4, fontSize: 20, fontWeight: 600 }}>
              Just you and her
            </p>
          </div>
        </div>
      ) : null}

      {mode === "ended" ? (
        <Modal>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Private show ended
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
            Go private again, or stay in the room and keep talking.
          </p>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => {
              setMode("public");
              setSheet("private");
            }}
          >
            Go private again
          </button>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setMode("public")}
          >
            Back to the room
          </button>
        </Modal>
      ) : null}

      {leaveOpen ? (
        <Modal>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Leave the private show?
          </h2>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => setLeaveOpen(false)}
          >
            Stay with her
          </button>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => {
              setLeaveOpen(false);
              setMode("ended");
            }}
          >
            Leave anyway
          </button>
        </Modal>
      ) : null}
    </div>
  );
};

const linkButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#FFAB00",
  fontSize: 13,
  cursor: "pointer",
  padding: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 9999,
  padding: "12px 0",
  fontSize: 15,
  fontWeight: 600,
  background: "white",
  color: "black",
  border: "none",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  marginTop: 8,
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.35)",
};

const Sheet = ({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div
    style={{
      pointerEvents: "auto",
      position: "fixed",
      inset: 0,
      zIndex: 50,
      display: "flex",
      alignItems: "flex-end",
      background: "rgba(0,0,0,0.5)",
    }}
    onClick={onClose}
  >
    <div
      style={{
        display: "flex",
        maxHeight: "80vh",
        width: "100%",
        flexDirection: "column",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        background: "#181818",
        paddingTop: 8,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Modal = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      pointerEvents: "auto",
      position: "fixed",
      inset: 0,
      zIndex: 60,
      display: "grid",
      placeItems: "center",
      background: "rgba(0,0,0,0.6)",
    }}
  >
    <div
      style={{
        display: "flex",
        width: "min(90vw, 360px)",
        flexDirection: "column",
        gap: 12,
        borderRadius: 16,
        background: "#181818",
        padding: 20,
      }}
    >
      {children}
    </div>
  </div>
);
