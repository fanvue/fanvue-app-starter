// Turns the room into one body: chat replies are typed on camera, voice replies are spoken.
// Clothing, props, and pose move one real step per clip so the next frame can continue them.

export type CameraMode = "hold" | "tour" | "pullBack" | "flip" | "walk";

export type InputChannel = "chat" | "voice";

export type ClothesState =
  | "as-photo"
  | "clothed"
  | "top-lifted"
  | "topless"
  | "bottomless"
  | "nude";

export type BodyState = {
  clothes: ClothesState;
  trousers: "on" | "off";
  underwear: "on" | "off";
  pose: "as-photo" | "standing" | "sitting" | "leaning" | "kneeling" | "lying";
  hands: "free" | "on-body" | "holding-toy";
  contact: "none" | "self";
  prop: "none" | "fetching" | "vibrator" | "dildo";
  framing: "medium" | "wider" | "torso";
};

export const DEFAULT_BODY: BodyState = {
  clothes: "clothed",
  trousers: "on",
  underwear: "on",
  pose: "sitting",
  hands: "free",
  contact: "none",
  prop: "none",
  framing: "wider",
};

const CLOTHES: ClothesState[] = [
  "as-photo",
  "clothed",
  "top-lifted",
  "topless",
  "bottomless",
  "nude",
];
const POSES = ["as-photo", "standing", "sitting", "leaning", "kneeling", "lying"] as const;
const HANDS = ["free", "on-body", "holding-toy"] as const;
const CONTACTS = ["none", "self"] as const;
const PROPS = ["none", "fetching", "vibrator", "dildo"] as const;
const FRAMINGS = ["medium", "wider", "torso"] as const;

/** Fixed laptop webcam. Close-ups are what spawn ghost faces and cropped bodies. */
export const CAMERA_RULE =
  "FIXED WEBCAM PLATE: static laptop webcam, no zoom, no push-in, no pan, no drift, no cut, no phone POV. " +
  "Wide shot only — her FULL BODY head-to-feet stays in frame. Desk and laptop lid edge stay visible along the bottom. " +
  "Never a face-only close-up. Never a genital-only extreme close-up. Never a second camera angle. " +
  "Clean photoreal single subject — no double exposure, no ghost faces, no melted limbs, no warped hands.";

export const ANATOMY_LOCK =
  "ANATOMY LOCK: exactly ONE adult woman — same face and body as the first frame. " +
  "One head, two arms, two hands, ten fingers, two legs, two feet. " +
  "NEVER extra limbs, fused limbs, a second body, floating parts, or clothing fused into skin. " +
  "No partner. The viewer is the webcam.";

export const LOOK_LOCK =
  "CRITICAL IDENTITY LOCK: the exact same woman as the reference — same face, age, hair, skin, body, breast size. " +
  "Do NOT beautify, slim, age, or swap her. One person only.";

export const SEATED_LAPTOP_IDLE =
  "Home-base pose: sitting upright in her chair at the desk, facing the laptop webcam, FULL BODY head-to-feet, " +
  "laptop edge at the bottom of the frame. Torso square to the lens. Hands near the off-screen keyboard. " +
  "Not standing, not lying down, not on a phone, not outdoors.";

export const NSFW_BIOLOGY =
  "Wide shot only. Match the body already in the first frame. Do not invent new anatomy.";

// Separate from BODY_PHYSICS and included unconditionally — the outfit-unchanged clip (the common case once she's nude) skips BODY_PHYSICS entirely, which is exactly when the toy kept appearing.
export const NO_UNREQUESTED_PROP =
  "Her hands are empty unless this clip's own instruction names a toy — do not invent a dildo, vibrator, " +
  "or any other object appearing in her hand or on her body.";

export const BODY_PHYSICS =
  "BODY PHYSICS: breasts and ass obey gravity. Cloth slides off with weight; it does not teleport or dissolve. " +
  "Joints only bend the human way. Weight stays in the chair or on both feet. No floating. " +
  "Clothes change only if this clip names one layer coming off, then they stay that way. " +
  `Do not grow a shirt onto a bare chest. No drink, cup, glass, bottle, or phone. ${NO_UNREQUESTED_PROP}`;

export const SCENE_OPTIONS = [
  { id: "bedroom", label: "Bedroom" },
  { id: "office", label: "Home office" },
  { id: "livingRoom", label: "Living room" },
  { id: "kitchen", label: "Kitchen" },
] as const;

export type SceneId = (typeof SCENE_OPTIONS)[number]["id"];

const SCENE_WORLD_LOCKS: Record<SceneId, string> = {
  bedroom:
    "WORLD LOCK: one continuous private bedroom livestream — desk, chair, laptop webcam, and a bed already in this same room. " +
    "Same walls, window, lamp, desk, and laptop forever. Do not invent a street, bridge, second room, or studio. " +
    "Continue from the first frame. Do not replace the room.",
  office:
    "WORLD LOCK: one continuous home-office livestream — desk, chair, laptop webcam, a bookshelf and a closed door behind her. " +
    "Same walls, shelf, desk, and laptop forever. Do not invent a street, bridge, second room, or studio. " +
    "Continue from the first frame. Do not replace the room.",
  livingRoom:
    "WORLD LOCK: one continuous living-room livestream — sofa, coffee table, laptop propped on the table, a window behind her. " +
    "Same walls, sofa, table, and laptop forever. Do not invent a street, bridge, second room, or studio. " +
    "Continue from the first frame. Do not replace the room.",
  kitchen:
    "WORLD LOCK: one continuous kitchen livestream — counter, laptop propped against the backsplash, cabinets behind her. " +
    "Same counter, cabinets, and laptop forever. Do not invent a street, bridge, second room, or studio. " +
    "Continue from the first frame. Do not replace the room.",
};

export const sceneLockFor = (sceneId: string | null | undefined): string =>
  SCENE_WORLD_LOCKS[sceneId as SceneId] ?? SCENE_WORLD_LOCKS.bedroom;

export const formatBodyState = (body: BodyState) =>
  `clothes=${body.clothes} | trousers=${body.trousers} | underwear=${body.underwear} | pose=${body.pose} | hands=${body.hands} | contact=${body.contact} | prop=${body.prop} | framing=${body.framing}`;

const pick = <T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T => {
  const found = allowed.find((item) => item === value);
  return found ?? fallback;
};

const layersFor = (clothes: ClothesState): Pick<BodyState, "trousers" | "underwear"> => {
  if (clothes === "nude") {
    return { trousers: "off", underwear: "off" };
  }
  if (clothes === "bottomless") {
    return { trousers: "off", underwear: "on" };
  }
  return { trousers: "on", underwear: "on" };
};

export const parseBodyState = (raw: string | null | undefined): BodyState => {
  if (!raw?.includes("clothes=")) {
    return { ...DEFAULT_BODY };
  }
  const read = (key: string) => raw.match(new RegExp(`${key}=([^|]+)`))?.[1]?.trim();
  const clothes = pick(read("clothes"), CLOTHES, "clothed");
  const inferred = layersFor(clothes);
  return {
    clothes,
    trousers: pick(read("trousers"), ["on", "off"] as const, inferred.trousers),
    underwear: pick(read("underwear"), ["on", "off"] as const, inferred.underwear),
    pose: pick(read("pose"), POSES, "sitting"),
    hands: pick(read("hands"), HANDS, "free"),
    contact: pick(read("contact"), CONTACTS, "none"),
    prop: pick(read("prop"), PROPS, "none"),
    framing: pick(read("framing"), FRAMINGS, "medium"),
  };
};

export const wardrobeLine = (body: BodyState) => {
  if (body.clothes === "nude") {
    return (
      "She is bare in the first frame. Stay bare for every single frame, start to finish — the last " +
      "frame must show her exactly as bare as the first. No garment of any kind grows back onto her " +
      "body at any point during this clip, even briefly."
    );
  }
  if (body.clothes === "topless") {
    return (
      "Her top is already off in the first frame. It stays off for every single frame, start to finish " +
      "— the last frame must show her exactly as topless as the first. No top, shirt, or other garment " +
      "reappears on her chest at any point during this clip, even briefly. Bottoms stay as in the first frame."
    );
  }
  if (body.clothes === "bottomless" || body.trousers === "off") {
    if (body.underwear === "off") {
      return (
        "Trousers and panties are already off in the first frame. They stay off for every single frame — " +
        "nothing regrows on her lower body at any point, even briefly. The top stays as in the first frame."
      );
    }
    return (
      "Trousers are already off in the first frame. They stay off for every single frame — no trousers " +
      "or shorts reappear at any point, even briefly. Panties stay exactly as in the first frame."
    );
  }
  if (body.clothes === "top-lifted") {
    return "Her top stays lifted exactly as in the first frame for the whole clip, even briefly. Bottoms stay on.";
  }
  return (
    "Copy the exact clothes in the first frame. Do not add or remove a garment. " +
    "She stays fully clothed for every single frame, start to finish — the last frame must show " +
    "the exact same clothes as the first. She does not become topless, bottomless, or nude at any " +
    "point during this clip, even briefly."
  );
};

/** Opening clip may dress her. Every later clip must copy the frame and not flicker. */
export const dressLock = (body: BodyState, opening = false) => {
  if (opening) {
    return (
      "OPENING WARDROBE: opaque, fully-covering top and opaque bottoms, with panties underneath. Three layers, " +
      "none of it see-through, lingerie, or swimwear. Whatever she is wearing in the photo — a bra and panties, " +
      "a bikini, partial clothing, or nothing — replace it with this opaque outfit before she moves. Do not carry " +
      "over the photo's actual garment. Hands empty. No flicker."
    );
  }
  return `WARDROBE FREEZE: ${wardrobeLine(body)}`;
};

export const typingLeadSecFor = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Long enough to actually read as her typing a reply before the act starts, not a blink-and-miss-it beat.
  const seconds = 1.2 + Math.min(6, Math.max(1, words)) * 0.25;
  return Math.round(Math.min(3.5, Math.max(1.5, seconds)) * 10) / 10;
};

export const clipDurationFor = (
  channel: InputChannel,
  typingLeadSec: number,
  cameraMode: CameraMode
) => {
  const spoken = channel === "chat" ? typingLeadSec + 4 : cameraMode === "walk" ? 12 : 10;
  // Never shorter than a generation. A clip that ends first leaves the stream with nothing to play.
  return Math.min(15, Math.max(10, Math.ceil(spoken)));
};

const bareEnough = (clothes: ClothesState) => clothes === "topless" || clothes === "nude";

// These are cosmetic gestures, not a layer coming off — clothesStep must not treat them as the
// generic "tease" phrase (which lifts the top's hem) or they lose their own distinct visual.
const isBraStrapTease = (fanSaid: string) =>
  /\b(bra strap|strap tease|shoulder strap)\b/i.test(fanSaid);
const isPantyTease = (fanSaid: string) =>
  /\b(panty tease|tease .{0,20}panties|waistband (tease|snap|pull)|flash (your |ur )?panties)\b/i.test(
    fanSaid
  );

const clothesStep = (from: ClothesState, fanSaid: string): ClothesState => {
  if (isBraStrapTease(fanSaid) || isPantyTease(fanSaid)) {
    return from;
  }
  const dress = /\b(put .{0,20}back|get dressed|cover up|shirt back|top back)\b/i.test(fanSaid);
  if (dress) {
    if (from === "nude") {
      return "topless";
    }
    if (from === "topless" || from === "bottomless" || from === "top-lifted") {
      return "clothed";
    }
    return from;
  }

  const nude = /\b(naked|nude|get naked|strip|everything off|all off|nothing on)\b/i.test(fanSaid);
  // Bare mentions of body-part nouns ("nice tits") used to trigger undressing on their own —
  // require a removal/reveal verb near the noun so a compliment doesn't strip her.
  const top =
    /\b(top off|shirt off|bra off|take (your |the )?(top|shirt|bra|tee)|topless)\b/i.test(
      fanSaid
    ) ||
    /\b(show|take off|pull down|whip out|flash|get)\b.{0,20}\b(tits|boobs|titties|breasts|nipples)\b/i.test(
      fanSaid
    );
  const tease = /\b(tease|lift your|flash|peek)\b/i.test(fanSaid);
  const showAss = /\b(show (me )?(your |ur |her )?ass|show (your |ur )?booty|from behind)\b/i.test(
    fanSaid
  );
  const panties =
    /\b(panties|thong|underwear|knickers)\b/i.test(fanSaid) &&
    /\b(off|down|remove)\b/i.test(fanSaid);
  const bottom =
    !showAss &&
    /\b(pants off|shorts off|skirt off|bottoms off|take (your |the )?(pants|shorts|skirt|bottoms))\b/i.test(
      fanSaid
    );

  if (tease && !top && (from === "as-photo" || from === "clothed")) {
    return "top-lifted";
  }
  if (top && !bareEnough(from) && from !== "bottomless") {
    return "topless";
  }
  if (top && from === "bottomless") {
    return "topless";
  }
  if ((bottom || panties) && from !== "bottomless" && from !== "nude" && from !== "topless") {
    return "bottomless";
  }
  if (nude) {
    if (from === "topless" || from === "bottomless") {
      return "nude";
    }
    if (from === "top-lifted") {
      return "topless";
    }
    if (from === "nude") {
      return "nude";
    }
    return "topless";
  }
  return from;
};

// Unfilled dead air in a 10-15s clip made the model re-dress and strip again on its own.
const HOLD_AFTER_STRIP =
  "This is the only clothing change in the clip. Once the garment is off, freeze in that undressed " +
  "state for the rest of the clip — small breathing motion only, no clothing reappears, the motion is not repeated.";

const clothesLine = (from: ClothesState, to: ClothesState) => {
  if (from === to) {
    if (bareEnough(from)) {
      return "Her chest is already bare in the first frame. Do not grow clothing onto her. A small shift so the camera sees the same body.";
    }
    return null;
  }
  if (to === "top-lifted") {
    return "She lifts the hem of the top she is already wearing a few inches, holds it, and lets it rest higher. The top stays on. Bottoms stay on. She holds it at that height for the rest of the clip.";
  }
  if (to === "topless") {
    return (
      "STRIP TEASE, one piece. Both hands take the hem of the exact top visible in the first frame — same color, same fabric, same style, no substitute garment. " +
      "She lifts it slowly, pauses under her chest, then pulls it up and off over her head. " +
      "The top drops below the frame. Hair and chest follow the arm raise and gravity. " +
      `Trousers and panties stay on, exactly as they already appear. Only the top comes off. Fabric is not erased and nothing new is invented. ${HOLD_AFTER_STRIP}`
    );
  }
  if (to === "bottomless") {
    return (
      "STRIP TEASE, one piece. She hooks her thumbs in the waistband of the exact bottoms visible in the first frame — same color, same fabric, same style, no substitute garment — and pushes them down over her hips, then her thighs. " +
      `She steps out, one foot at a time. They leave the frame. Panties stay on exactly as they already appear. Her top stays as it was. Fabric has weight. Nothing new is invented. ${HOLD_AFTER_STRIP}`
    );
  }
  if (to === "nude") {
    return (
      "STRIP TEASE, the last piece only. She slides that exact last garment off slowly, the one already visible, and drops it below the frame. " +
      `She stays on the same spot. Nothing new appears on her body. Fabric is not erased and no garment is invented in its place. ${HOLD_AFTER_STRIP}`
    );
  }
  if (to === "clothed") {
    return "She pulls the nearest piece of her own clothing back into place. No new outfit appears. She holds that clothed state for the rest of the clip and does not undress again.";
  }
  return null;
};

/** Face the lens this turn — wins over any earlier rear / show-ass pose. */
const facesCamera = (fanSaid: string) => {
  if (
    /\b(face me|face (the )?(camera|webcam|lens)|look at me|toward me|towards me|missionary|on your back)\b/i.test(
      fanSaid
    )
  ) {
    return true;
  }
  // Bed without a rear ask means front orientation (e.g. missionary / lie down).
  if (
    /\b(lie on|lay on|on the bed)\b/i.test(fanSaid) &&
    !/\b(ass|doggy\w*|from behind|all fours|booty)\b/i.test(fanSaid)
  ) {
    return true;
  }
  return false;
};

const wantsRearView = (fanSaid: string) => {
  if (facesCamera(fanSaid)) {
    return false;
  }
  return /\b(show (me )?(your |ur |her )?ass|shake (your |ur )?ass|ass shake|booty|from behind|turn your back|face away|doggy\w*|all fours)\b/i.test(
    fanSaid
  );
};

const poseStep = (fanSaid: string, pose: BodyState["pose"]): BodyState["pose"] => {
  if (facesCamera(fanSaid) && /\b(bed|missionary|lie|lay|on your back)\b/i.test(fanSaid)) {
    return "lying";
  }
  if (/\b(lie|lay down|on your back|on the floor)\b/i.test(fanSaid)) {
    return "lying";
  }
  if (/\b(kneel|on your knees|get on your knees)\b/i.test(fanSaid) && !facesCamera(fanSaid)) {
    return "kneeling";
  }
  if (/\b(sit|sit down)\b/i.test(fanSaid)) {
    return "sitting";
  }
  if (/\b(lean back|lean)\b/i.test(fanSaid)) {
    return "leaning";
  }
  if (wantsRearView(fanSaid) || (/\bturn around\b/i.test(fanSaid) && !facesCamera(fanSaid))) {
    return "standing";
  }
  if (/\b(stand up|get up|on your feet)\b/i.test(fanSaid)) {
    return "standing";
  }
  return pose;
};

const lyingSurface = (fanSaid: string, sceneHasBed: boolean) => {
  const wantsFloor = /\bfloor\b/i.test(fanSaid);
  const wantsBed = /\bbed\b/i.test(fanSaid);
  return wantsBed || (sceneHasBed && !wantsFloor) ? "the bed" : "the floor";
};

const poseLine = (
  from: BodyState["pose"],
  to: BodyState["pose"],
  fanSaid: string,
  sceneHasBed: boolean
) => {
  if (from === to) {
    return null;
  }
  if (to === "standing") {
    return (
      "She stands up from the chair into a full-body standing pose in front of the same laptop webcam. " +
      "Head to feet stay in frame. The camera does not move or zoom."
    );
  }
  if (to === "sitting" || to === "as-photo") {
    return `She sits back down in the chair at the desk. ${SEATED_LAPTOP_IDLE}`;
  }
  if (to === "lying") {
    const surface = lyingSurface(fanSaid, sceneHasBed);
    return (
      `She moves from where she is onto ${surface} in this same room and lies back. The desk webcam stays fixed and does not follow her. ` +
      "She does not leave the room."
    );
  }
  if (to === "kneeling") {
    const surface = sceneHasBed ? "the bed" : "the floor";
    return (
      `She gets onto her hands and knees on ${surface} if she is already down, otherwise she bends over the chair. ` +
      "Ass toward the webcam. The webcam stays fixed. She does not leave the room."
    );
  }
  return (
    `She shifts from ${from} toward ${to}, still in this room. ` +
    "The laptop webcam does not move, zoom, or follow her. She does not leave the room."
  );
};

const gestureLine = (fanSaid: string) => {
  if (isBraStrapTease(fanSaid)) {
    return "She slides one bra strap off her shoulder with one finger, holds it there a moment, then lets it snap back into place. Top and bottoms stay fully on. The camera stays fixed.";
  }
  if (isPantyTease(fanSaid)) {
    return "She hooks a thumb in the waistband of her panties, tugs it out and lets it snap back against her hip, teasing without removing anything. She stays fully clothed. The camera stays fixed.";
  }
  if (/\btipp?ed\b|\btip of\b|\bsent (you )?a tip\b/i.test(fanSaid)) {
    return "She sees the tip, looks into the webcam, smiles, and blows one kiss. Same clothes, still in the chair. The camera does not zoom.";
  }
  if (/\bwave\b/i.test(fanSaid)) {
    return "She raises one hand, waves at the webcam, and lowers it. Same clothes. The camera stays fixed.";
  }
  if (/\b(blow .{0,16}kiss|\bkiss\b)/i.test(fanSaid)) {
    return "She blows one kiss toward the webcam. Same clothes. The camera stays fixed.";
  }
  if (/\btongue\b/i.test(fanSaid)) {
    return "She sticks her tongue out at the webcam, then smiles. Same clothes. The camera stays fixed.";
  }
  if (/\bspin\b/i.test(fanSaid)) {
    return "She stands, turns once in place, and sits back down. Full body stays in frame. The camera does not move.";
  }
  if (/\bdance\b/i.test(fanSaid)) {
    return "She stands and sways her hips for the webcam, then sits. Full body stays in frame. The camera does not move.";
  }
  if (/\bjiggle\b/i.test(fanSaid)) {
    return "She gives her chest one natural bounce and settles. The camera stays wide. Do not zoom. Do not remove clothing to do it.";
  }
  if (facesCamera(fanSaid)) {
    return null;
  }
  if (
    wantsRearView(fanSaid) ||
    /\b(show (me )?(your |ur |her )?ass|shake (your |ur )?ass|ass shake|booty|from behind)\b/i.test(
      fanSaid
    )
  ) {
    return (
      `${FACE_AWAY} She stands, turns her back fully to the webcam, and bends so her ass is toward the lens. ` +
      "She looks back over one shoulder and holds it. Do not take any clothes off. The webcam does not move."
    );
  }
  if (/\b(turn around|turn your back|face away)\b/i.test(fanSaid)) {
    return (
      `${FACE_AWAY} She stands, turns her back fully to the webcam, and looks back over one shoulder. She holds the turn. ` +
      "Do not take clothes off. The webcam does not move. This turn is the whole clip."
    );
  }
  if (/\bbend over\b/i.test(fanSaid)) {
    return "She bends over and holds it. She does not stand back up. The webcam does not move.";
  }
  return null;
};

const towardCamera = (fanSaid: string) =>
  /\b(fuck me|blow ?job|blow me|suck|deepthroat|ride me|inside me|have sex|sex with)\b/i.test(
    fanSaid
  );

export type PlannedBeat = {
  physical: string;
  nextBody: BodyState;
  cameraMode: CameraMode;
  durationSec: number;
  followUp: { physical: string; nextBody: BodyState; durationSec: number } | null;
};

// A one-off action (a strip, a spread, a toy beat) only takes 3-4s — padding it to the old 10-15s
// floor left dead air the model filled by re-dressing, undressing again, or inventing a prop.
const ACTION_BEAT_DURATION_SEC = 8;
const fitDuration = (seconds: number) => Math.min(15, Math.max(7, Math.round(seconds)));

const packBeat = (
  from: BodyState,
  next: BodyState,
  lines: string[],
  seconds: number,
  outdoor: boolean
): PlannedBeat => {
  const changed =
    next.clothes !== from.clothes ||
    next.trousers !== from.trousers ||
    next.underwear !== from.underwear;
  return {
    physical: [
      changed
        ? "ONE GARMENT ONLY. Slow strip tease of that one piece. Fabric has weight."
        : "OUTFIT FREEZE: copy the first frame's clothes. Do not add or remove a garment.",
      outdoor
        ? "The photo may be outdoors. Ignore that background. She stays in this room at the desk webcam."
        : "",
      "Continue from the first frame. Same woman, same room, same webcam.",
      ...lines,
    ]
      .filter(Boolean)
      .join(" "),
    nextBody: next,
    cameraMode: "hold",
    durationSec: fitDuration(seconds),
    followUp: null,
  };
};

const FACE_FORWARD =
  "REORIENT: she faces the webcam fully — face, chest, and hips all toward the lens. " +
  "If the first frame shows her back or ass, she turns around first until she faces the lens. " +
  "One coherent body only. Never show her front and her back at the same time.";

/** Symmetric to FACE_FORWARD — wins over any earlier face-camera pose, e.g. after missionary. */
const FACE_AWAY =
  "REORIENT: she turns her back fully to the webcam — back, ass, and shoulders toward the lens, " +
  "face turned away or looking back over one shoulder only. If the first frame shows her facing the lens, " +
  "she turns around first until her back is to the camera. One coherent body only. Never show her front and her back at the same time.";

const spreadFacingLine = (pose: BodyState["pose"], sceneHasBed: boolean) => {
  if (pose === "lying") {
    const surface = sceneHasBed ? "the bed" : "the floor";
    const headRest = sceneHasBed
      ? "head toward the pillows if needed"
      : "head resting back if needed";
    return (
      `${FACE_FORWARD} She lies on her back on ${surface} in this same room, ${headRest} so her face stays toward the webcam. ` +
      "She bends her knees, plants her feet, and opens her thighs toward the lens. She holds that open pose. The webcam stays fixed."
    );
  }
  return (
    `${FACE_FORWARD} She sits facing the webcam on the chair or the edge of where she is. ` +
    "She slides her hips forward, opens her knees wide toward the lens, and holds them open. The webcam stays fixed."
  );
};

const spreadRearLine = (pose: BodyState["pose"]) => {
  if (pose === "kneeling" || pose === "lying") {
    return `${FACE_AWAY} She stays facing away, spreads her knees, and holds her ass toward the webcam. The webcam stays fixed.`;
  }
  return `${FACE_AWAY} She stays turned away, bends a little, spreads her stance, and holds her ass toward the webcam. The webcam stays fixed.`;
};

export const TOY_RULE =
  "TOY RULE: any toy is a separate handheld object with its own weight, never fused to her skin, never sprouting straps " +
  "or a harness, never worn like a strap-on, never merging into or growing out of her body. Her hand is visibly the thing " +
  "holding and controlling it the entire time it is in use.";

// Toys only appear when the action asks. Always start empty, reach off-screen, then put down.
const toyReachThen = (use: string) =>
  `First frame: her hands are empty and no toy is visible. One hand reaches below the frame and comes back holding one small toy with weight. ${TOY_RULE} ${use} Her fingers stay on it. Then she sets the toy down out of frame. Last frame: both hands empty, no toy visible.`;

const pantiesLine =
  "STRIP TEASE, one piece. She hooks her thumbs in the waistband of the exact panties visible in the first frame — same color, same fabric, same style, no substitute garment — and slides them down slowly, one leg at a time, fabric dragging against skin with real weight. " +
  `She steps out and they leave the frame. Nothing else comes off. Nothing is invented and nothing vanishes mid-motion. ${HOLD_AFTER_STRIP}`;

export const planPhysicalBeat = (
  fanSaid: string,
  incomingBody: BodyState,
  outdoor: boolean,
  sceneHasBed = true
): PlannedBeat => {
  // A toy set in BODY STATE by an earlier request otherwise never clears — every later,
  // unrelated request (and idle's "continue the exact act" logic) keeps reintroducing it.
  const continuesToy = /\b(dildo|vibrator|vibe|wand|toy|fuck yourself|suck|deepthroat)\b/i.test(
    fanSaid
  );
  const body: BodyState =
    incomingBody.prop !== "none" && !continuesToy
      ? {
          ...incomingBody,
          prop: "none",
          hands: incomingBody.hands === "holding-toy" ? "free" : incomingBody.hands,
          contact: incomingBody.hands === "holding-toy" ? "none" : incomingBody.contact,
        }
      : incomingBody;

  // Policy: any toy use is mouth-only, never vaginal or anal — however the fan phrases the ask.
  const inAss = /\b(in (her |your |my |the )?ass|anal|butt)\b/i.test(fanSaid);
  const inPussy = /\b(in|inside) (her |your |my |the )?(pussy|cunt)\b/i.test(fanSaid);
  const mentionsToy = /\bdildo|toy\b/i.test(fanSaid);
  const insertAsk =
    ((inAss || inPussy) && /\b(dildo|toy|put|insert|stick)\b/i.test(fanSaid)) ||
    (/\b(doggy\w*|all fours|hands and knees)\b/i.test(fanSaid) && mentionsToy);
  const sucking = /\b(suck|deepthroat)\b/i.test(fanSaid) || insertAsk;
  if (sucking) {
    const next: BodyState = {
      ...body,
      framing: "wider",
      pose: body.pose === "kneeling" ? "kneeling" : "sitting",
      prop: "none",
      hands: "free",
      contact: "none",
    };
    return packBeat(
      body,
      next,
      [
        toyReachThen(
          "She brings it to her mouth and sucks it for a few seconds, eyes on the webcam, still in the pose from the first frame."
        ),
      ],
      ACTION_BEAT_DURATION_SEC,
      outdoor
    );
  }

  if (
    /\bs*spread\b/i.test(fanSaid) ||
    (facesCamera(fanSaid) && /\b(legs|pussy|open)\b/i.test(fanSaid))
  ) {
    const rear = wantsRearView(fanSaid);
    const onBed = /\b(bed|missionary|lie|lay|on your back)\b/i.test(fanSaid);
    const nextPose: BodyState["pose"] = rear
      ? body.pose === "standing"
        ? "standing"
        : body.pose
      : onBed
        ? "lying"
        : body.pose === "standing" || body.pose === "kneeling"
          ? "sitting"
          : body.pose;
    const next: BodyState = {
      ...body,
      framing: "wider",
      pose: nextPose,
      hands: "on-body",
      contact: "self",
    };
    const line = rear ? spreadRearLine(nextPose) : spreadFacingLine(nextPose, sceneHasBed);
    return packBeat(body, next, [line], ACTION_BEAT_DURATION_SEC, outdoor);
  }

  const wantsFullyNude = /\b(naked|nude|get naked|strip|everything off|all off|nothing on)\b/i.test(
    fanSaid
  );
  if (
    wantsFullyNude &&
    (body.clothes === "clothed" || body.clothes === "as-photo" || body.clothes === "top-lifted")
  ) {
    const mid: BodyState = { ...body, framing: "wider", clothes: "topless" };
    const end: BodyState = { ...mid, clothes: "bottomless", trousers: "off", underwear: "on" };
    const first = packBeat(
      body,
      mid,
      [clothesLine(body.clothes, "topless") ?? ""],
      ACTION_BEAT_DURATION_SEC,
      outdoor
    );
    const second = packBeat(
      mid,
      end,
      [clothesLine("topless", "bottomless") ?? ""],
      ACTION_BEAT_DURATION_SEC,
      outdoor
    );
    return {
      ...first,
      followUp: {
        physical: second.physical,
        nextBody: second.nextBody,
        durationSec: second.durationSec,
      },
    };
  }

  const next: BodyState = { ...body, framing: "wider" };
  const lines: string[] = [];
  const cameraMode: CameraMode = "hold";
  if (outdoor) {
    lines.push(
      "The photo may be outdoors. Ignore that background. She is indoors at the desk webcam."
    );
  }

  const clothes = clothesStep(body.clothes, fanSaid);
  const pantiesOff =
    /\b(panties|thong|underwear|knickers)\b/i.test(fanSaid) &&
    /\b(off|down|remove)\b/i.test(fanSaid);
  const clothing = clothesLine(body.clothes, clothes);
  if (clothing) {
    lines.push(clothing);
    next.clothes = clothes;
    if (clothes === "topless" || clothes === "top-lifted") {
      next.trousers = body.trousers;
      next.underwear = body.underwear;
    } else if (clothes === "bottomless") {
      next.trousers = "off";
      next.underwear = pantiesOff && body.trousers === "off" ? "off" : "on";
    } else if (clothes === "nude") {
      next.trousers = "off";
      next.underwear = "off";
    } else if (clothes === "clothed") {
      next.trousers = "on";
      next.underwear = "on";
    }
  }

  const bottomAsk =
    !/\b(show (me )?(your |ur |her )?ass|show (your |ur )?booty|from behind)\b/i.test(fanSaid) &&
    /\b(pants off|shorts off|skirt off|bottoms off|take (your |the )?(pants|shorts|skirt|bottoms))\b/i.test(
      fanSaid
    );
  if (bottomAsk && body.clothes === "topless" && body.trousers === "on") {
    lines.push(clothesLine("clothed", "bottomless") ?? "");
    next.trousers = "off";
    next.underwear = "on";
  }
  if (pantiesOff && body.trousers === "off" && body.underwear === "on" && next.underwear === "on") {
    lines.push(pantiesLine);
    next.underwear = "off";
    if (body.clothes === "topless") {
      next.clothes = "nude";
    }
  }

  const pose = poseStep(fanSaid, body.pose);
  const posing = poseLine(body.pose, pose, fanSaid, sceneHasBed);
  if (posing) {
    lines.push(posing);
    next.pose = pose;
  }

  const wantsToy = /\b(dildo|vibrator|vibe|wand|toy|fuck yourself)\b/i.test(fanSaid);
  const changedClothes = next.clothes !== body.clothes;
  if (!changedClothes && wantsToy && body.prop === "none") {
    next.prop = "fetching";
    next.hands = "free";
    lines.push(
      "One hand reaches below the frame to pick something up. No toy is visible yet. Do not spawn an object in her hand."
    );
  } else if (wantsToy && (body.prop === "fetching" || body.prop === "none")) {
    next.prop = /\bdildo\b/i.test(fanSaid) ? "dildo" : "vibrator";
    next.hands = "holding-toy";
    next.contact = "self";
    lines.push(
      `The same hand comes back into frame holding one small toy. She brings it to her mouth and uses it there — mouth only, never lower. Only one toy. ${TOY_RULE}`
    );
  } else if (wantsToy) {
    next.hands = "holding-toy";
    next.contact = "self";
    lines.push(
      `She keeps the same toy already in her hand and uses it on her mouth — mouth only, never lower. ${TOY_RULE}`
    );
  }

  const wantsTouch =
    /\b(touch yourself|masturbat\w*|finger\w* yourself|play with (?:yourself|herself|your |her |my )?\s*(?:pussy|clit|cunt|it)?|rub your|spread|touch your|joi|jerk[\s-]?off instructions?)\b/i.test(
      fanSaid
    );
  if (wantsTouch && !wantsToy) {
    next.hands = "on-body";
    next.contact = "self";
    lines.push(
      "One hand moves onto her own body and stays there. Fingers stay attached. The other arm supports her. No second person."
    );
  }

  if (towardCamera(fanSaid)) {
    lines.push(
      "She aims the act at the lens with her own mouth or hands. Do not add another person, another set of hands, or genitals that are not hers."
    );
    if (next.hands === "free") {
      next.hands = "on-body";
      next.contact = "self";
    }
  }

  const gesture = gestureLine(fanSaid);
  if (gesture) {
    lines.push(gesture);
  }

  if (lines.length === 0) {
    const asked =
      /\b(show|take|put|bend|spread|turn|suck|touch|play|get|sit|lie|kneel|open|pull|strip|ass|legs|masturbat\w*|orgasm|climax|cum|drink\w*|coffee|tea|eat\w*|snack|smoke|vape|yawn|stretch|wave|laugh|smile|talk|dance)\b/i.test(
        fanSaid
      );
    lines.push(
      asked
        ? `She does exactly this, one clear action, and holds it: ${fanSaid}. Continue from the first frame. ` +
            "This request is not about clothing — do not add, remove, or shift any garment while she does it."
        : `Hold the pose already in the first frame (${body.pose}). Small weight shift, real breathing, eyes on the lens. ` +
            "Do not remove or add any clothing. Do not start any new act."
    );
  }

  lines.unshift(
    next.clothes === body.clothes &&
      next.trousers === body.trousers &&
      next.underwear === body.underwear
      ? "OUTFIT FREEZE: copy the first frame's clothes. Do not add or remove a garment."
      : "ONE GARMENT ONLY. Slow strip tease of that one piece. Fabric has weight."
  );

  const beat: PlannedBeat = {
    physical: lines.join(" "),
    nextBody: next,
    cameraMode,
    durationSec: ACTION_BEAT_DURATION_SEC,
    followUp: null,
  };
  if (pantiesOff && body.trousers === "on" && next.trousers === "off" && next.underwear === "on") {
    const after: BodyState = {
      ...next,
      underwear: "off",
      clothes: next.clothes === "topless" ? "nude" : next.clothes,
    };
    const second = packBeat(next, after, [pantiesLine], ACTION_BEAT_DURATION_SEC, outdoor);
    beat.followUp = { physical: second.physical, nextBody: after, durationSec: second.durationSec };
  }
  return beat;
};

const flattenBeat = (beat: PlannedBeat): PlannedBeat[] => {
  if (!beat.followUp) {
    return [beat];
  }
  return [
    { ...beat, followUp: null },
    {
      physical: beat.followUp.physical,
      nextBody: beat.followUp.nextBody,
      cameraMode: "hold",
      durationSec: beat.followUp.durationSec,
      followUp: null,
    },
  ];
};

export const planTurn = (
  fanSaid: string,
  body: BodyState,
  outdoor: boolean,
  sceneHasBed = true
) => {
  // Fans phrase a sequence as "X then Y", "X, then Y", "X and then Y", or "X, Y" — split on all of them
  // so a multi-step request queued as one message chains just like separate messages do.
  const steps = fanSaid
    .split(/\s*,?\s*\band\s+then\b\s*|\s*,?\s*\bthen\b\s*|\s*,\s+/i)
    .map((part) => part.replace(/^(and|also)\s+/i, "").trim())
    .filter(Boolean)
    .slice(0, 6);
  const clauses = steps.length > 0 ? steps : [fanSaid];
  let state = body;
  const clips: PlannedBeat[] = [];
  for (const clause of clauses) {
    const flat = flattenBeat(planPhysicalBeat(clause, state, outdoor, sceneHasBed));
    clips.push(...flat);
    state = flat[flat.length - 1]?.nextBody ?? state;
  }
  const [first, ...rest] = clips;
  return {
    ...(first ?? planPhysicalBeat(fanSaid, body, outdoor, sceneHasBed)),
    followUps: rest.map((clip) => ({
      physical: clip.physical,
      nextBody: clip.nextBody,
      durationSec: clip.durationSec,
    })),
  };
};

const typingHands = (body: BodyState) =>
  body.hands === "free"
    ? "Both hands dip below the frame onto the keyboard."
    : "The busy hand stays where BODY STATE puts it. The other hand types on the keyboard below the frame.";

// Only short reaction gestures get a typing lead-in — everything else needs the whole clip now.
const MINOR_GESTURE =
  /blows one kiss|sticks her tongue out|raises one hand, waves|turns once in place|sways her hips for the webcam|gives her chest one natural bounce|sees the tip, looks into the webcam/i;

export const chatClipDirection = (leadSec: number, physical: string, body: BodyState) => {
  if (!MINOR_GESTURE.test(physical)) {
    return (
      `From the first frame, do this and hold the result. Do not type first. ` +
      `Do not stay face-on if this says to turn. ${physical} ` +
      `Mouth closed the entire clip. MUTE SILENT. The webcam stays fixed.`
    );
  }
  return (
    `TIMED, from the first frame. For the first ${leadSec} seconds she glances at chat and types on the OFF-SCREEN keyboard. ${typingHands(body)} No phone. ` +
    `Then the action starts. Do not spend the clip typing. For the rest of the clip, do only this, then hold the result: ${physical} ` +
    `Mouth closed the entire clip. MUTE SILENT. No speech, no lip movement. The words exist only as the chat she just sent. ${CAMERA_RULE}`
  );
};

export const voiceClipDirection = (physical: string) => {
  if (/back fully to the webcam/i.test(physical)) {
    return (
      `From the first second she turns, then talks over her shoulder: ${physical} ` +
      `She is not typing. No phone. ${CAMERA_RULE}`
    );
  }
  if (
    /back fully to the webcam|sets the toy down|presses it|STRIP TEASE|no toy is visible/i.test(
      physical
    )
  ) {
    return `From the first second she does this: ${physical} She is not typing. No phone. ${CAMERA_RULE}`;
  }
  return (
    `She looks into the webcam and talks while doing this, from the first second: ${physical} ` +
    `She is not typing. No phone. No chat UI in the picture. ${CAMERA_RULE}`
  );
};

const FILLER_BEATS = [
  "She glances at the laptop chat, then looks back into the webcam.",
  "She blinks, breathes, and keeps her eyes on the lens.",
  "She tucks her hair with one hand, then puts that hand back down, away from her clothes.",
  "She gives a small closed-mouth smile and holds the same pose.",
];

// Filler never advances an act — multi-clip acts go through beat.followUps instead, which stop exactly where planned.
export const idleDirection = (body: BodyState, callElapsedSec = 0) => {
  const pause =
    body.hands === "holding-toy"
      ? "The toy is already set down out of frame — her hands are empty and resting. "
      : body.contact === "self" || body.hands === "on-body"
        ? "Her hand has already eased off her body and rests naturally at her side or on her leg — she has paused. "
        : "";
  const beat = FILLER_BEATS[Math.floor(Math.max(0, callElapsedSec) / 8) % FILLER_BEATS.length];
  return (
    `WAITING, between requests — whatever she was just asked to do is already finished. ` +
    `Continue the exact place and clothes in the first frame. ${wardrobeLine(body)} ${pause}` +
    `Do not introduce any new object. Do not add or remove clothing. Do not start, continue, or finish any sexual act. ` +
    `${beat} Tiny idle motion only, eyes on the lens or the chat. This is a pause to chat and tease, not to perform. Silent. Mouth closed.`
  );
};

// Only used when the LLM call itself fails — several worded variants so a repeated
// fallback within one call doesn't read as the same canned line twice.
const CHAT_FALLBACK_TOY = ["one sec, getting it", "hold on, grabbing it for you", "mm, one sec"];
const CHAT_FALLBACK_REVEAL = ["okay watch", "mmm watch this", "here you go, watch"];
const CHAT_FALLBACK_TIP = ["thank you baby", "mmm thank you", "you're so sweet, thank you"];
const CHAT_FALLBACK_DEFAULT = [
  "mmm i heard you, watch",
  "ohh someone's needy today",
  "mm giving you what you want",
];
const VOICE_FALLBACK_REVEAL = [
  "Okay, watch — I'm taking this off for you.",
  "Mm, you asked so nicely — watch.",
];
const VOICE_FALLBACK_DEFAULT = [
  "Yeah, I'm right here. Tell me how you want it.",
  "Mm, I'm all yours right now — what do you want next?",
  "I'm listening. Say it again and I'll do it.",
];

const pickVariant = (pool: string[], seed: number): string => {
  const index = ((seed % pool.length) + pool.length) % pool.length;
  return pool[index] ?? pool[0] ?? "";
};

export const fallbackLine = (channel: InputChannel, physical: string, seed = 0) => {
  if (channel === "chat") {
    if (/toy|reach/i.test(physical)) {
      return pickVariant(CHAT_FALLBACK_TOY, seed);
    }
    if (/off over her head|bottoms|last piece|hem/i.test(physical)) {
      return pickVariant(CHAT_FALLBACK_REVEAL, seed);
    }
    if (/tip|kiss|wave/i.test(physical)) {
      return pickVariant(CHAT_FALLBACK_TIP, seed);
    }
    return pickVariant(CHAT_FALLBACK_DEFAULT, seed);
  }
  if (/off over her head|hem/i.test(physical)) {
    return pickVariant(VOICE_FALLBACK_REVEAL, seed);
  }
  return pickVariant(VOICE_FALLBACK_DEFAULT, seed);
};
