import { describe, expect, it } from "vitest";
import {
  BODY_PHYSICS,
  type BodyState,
  NO_UNREQUESTED_PROP,
  chatClipDirection,
  clipDurationFor,
  formatBodyState,
  idleDirection,
  parseBodyState,
  planPhysicalBeat,
  typingLeadSecFor,
} from "./spikeTurnPlan";

const clothed: BodyState = {
  clothes: "clothed",
  trousers: "on",
  underwear: "on",
  pose: "standing",
  hands: "free",
  contact: "none",
  prop: "none",
  framing: "medium",
};

describe("planPhysicalBeat", () => {
  it("starts clothed and only removes one layer when asked", () => {
    const hello = planPhysicalBeat("hey I'm here", clothed, false);
    expect(hello.nextBody.clothes).toBe("clothed");
    expect(hello.physical).not.toMatch(/off over her head/i);

    const beat = planPhysicalBeat("take your top off", clothed, false);
    expect(beat.nextBody.clothes).toBe("topless");
  });

  it("does not grow a shirt back onto a bare chest", () => {
    const beat = planPhysicalBeat(
      "show me your tits",
      { ...clothed, clothes: "topless" },
      false,
    );
    expect(beat.nextBody.clothes).toBe("topless");
    expect(beat.physical).toMatch(/already bare/i);
    expect(beat.physical).toMatch(/do not grow clothing/i);
  });

  it("fetches a toy before it can appear in her hand", () => {
    const first = planPhysicalBeat("use a vibrator", clothed, true);
    expect(first.nextBody.prop).toBe("fetching");
    expect(first.physical).toMatch(/no toy is visible/i);

    const second = planPhysicalBeat("use the vibrator", first.nextBody, true);
    expect(second.nextBody.prop).toBe("vibrator");
    expect(second.nextBody.hands).toBe("holding-toy");
    expect(second.physical).toMatch(/mouth/i);
  });

  it("puts a held toy away once the next request has nothing to do with it", () => {
    const holdingToy: BodyState = {
      ...clothed,
      pose: "sitting",
      hands: "holding-toy",
      contact: "self",
      prop: "dildo",
    };
    const beat = planPhysicalBeat("spread ur legs for me", holdingToy, false);
    expect(beat.nextBody.prop).toBe("none");
  });

  it("tolerates a doubled-letter typo on spread", () => {
    const beat = planPhysicalBeat("sspread ur legs", clothed, false);
    expect(beat.nextBody.hands).toBe("on-body");
    expect(beat.nextBody.contact).toBe("self");
  });

  it("keeps her at the desk webcam instead of following an outdoor photo", () => {
    const beat = planPhysicalBeat("lie on the bed", clothed, true);
    expect(beat.cameraMode).toBe("hold");
    expect(beat.nextBody.framing).toBe("wider");
    expect(beat.physical).toMatch(/desk webcam/i);
    expect(beat.physical).toMatch(/does not leave the room/i);
  });

  it("keeps a pose request in the clothes she already has", () => {
    const turn = planPhysicalBeat("turn around", clothed, false);
    expect(turn.nextBody.clothes).toBe("clothed");
    expect(turn.physical).toMatch(/OUTFIT FREEZE/i);
    expect(turn.physical).toMatch(/back fully to the webcam/i);

    const ass = planPhysicalBeat("show me your ass", clothed, false);
    expect(ass.nextBody.clothes).toBe("clothed");
    expect(ass.nextBody.trousers).toBe("on");
    expect(ass.nextBody.underwear).toBe("on");
    expect(ass.physical).toMatch(/OUTFIT FREEZE/i);
    expect(ass.physical).toMatch(/Do not take any clothes off/i);
    expect(ass.physical).toMatch(/back fully to the webcam/i);

    const tits = planPhysicalBeat("show me your tits", clothed, false);
    expect(tits.nextBody.clothes).toBe("topless");
    expect(tits.nextBody.trousers).toBe("on");
    expect(tits.nextBody.underwear).toBe("on");
    expect(tits.physical).toMatch(/Only the top comes off/i);

    const bend = planPhysicalBeat("bend over", clothed, false);
    expect(bend.nextBody.clothes).toBe("clothed");

    const naked = planPhysicalBeat("get naked", clothed, false);
    expect(naked.nextBody.clothes).toBe("topless");
    expect(naked.physical).toMatch(/ONE GARMENT ONLY/i);
  });

  it("sucks a dildo, then puts it down so the next clip is clear", () => {
    const beat = planPhysicalBeat("suck a dildo", clothed, false);
    expect(beat.nextBody.prop).toBe("none");
    expect(beat.nextBody.hands).toBe("free");
    expect(beat.physical).toMatch(/no toy is visible/i);
    expect(beat.physical).toMatch(/sets the toy down/i);
    expect(beat.followUp).toBeNull();
    expect(beat.nextBody.clothes).toBe("clothed");
  });

  it("redirects an anal/vaginal toy insertion ask to mouth-only use, never inserted", () => {
    const beat = planPhysicalBeat(
      "bend over and put the dildo in my ass doggy style",
      clothed,
      false,
    );
    expect(beat.nextBody.prop).toBe("none");
    expect(beat.nextBody.hands).toBe("free");
    expect(beat.physical).toMatch(/mouth/i);
    expect(beat.physical).not.toMatch(/presses (it|the toy) in/i);
    expect(beat.followUp).toBeNull();
  });

  it("spreads from the pose she is already in", () => {
    const chair = planPhysicalBeat(
      "spread your legs",
      { ...clothed, pose: "sitting" },
      false,
    );
    expect(chair.physical).toMatch(/REORIENT/i);
    expect(chair.physical).toMatch(/opens her knees|thighs toward/i);
    expect(chair.physical).not.toMatch(/ass toward/i);
    expect(chair.followUp).toBeNull();

    const bed = planPhysicalBeat(
      "spread your legs",
      { ...clothed, pose: "lying" },
      false,
    );
    expect(bed.physical).toMatch(/REORIENT|thighs toward|opens her knees/i);
  });

  it("faces the camera when asked after a rear pose, and ignores leftover turn-around wording", () => {
    const afterAss: BodyState = {
      ...clothed,
      pose: "standing",
      clothes: "nude",
      trousers: "off",
      underwear: "off",
    };
    const face = planPhysicalBeat(
      "face me and spread ur legs i want to see ur pussy",
      afterAss,
      false,
    );
    expect(face.nextBody.pose).toBe("sitting");
    expect(face.physical).toMatch(/REORIENT/i);
    expect(face.physical).toMatch(/faces the webcam fully/i);
    expect(face.physical).not.toMatch(/back fully to the webcam/i);
    expect(face.physical).not.toMatch(/ass toward the lens/i);

    const missionary = planPhysicalBeat(
      "turn around and spread ur legs on the bed in missionary style",
      afterAss,
      false,
    );
    expect(missionary.nextBody.pose).toBe("lying");
    expect(missionary.physical).toMatch(/on her back on the bed/i);
    expect(missionary.physical).toMatch(/REORIENT/i);
    expect(missionary.physical).not.toMatch(/back fully to the webcam/i);
  });

  it("reacts to a tip on camera without moving the webcam", () => {
    const beat = planPhysicalBeat("tipped you 50 coins", clothed, false);
    expect(beat.cameraMode).toBe("hold");
    expect(beat.physical).toMatch(/tip/i);
    expect(beat.physical).toMatch(/kiss/i);
    expect(beat.nextBody.clothes).toBe("clothed");
  });

  it("round-trips body state", () => {
    const raw = formatBodyState(clothed);
    expect(parseBodyState(raw)).toEqual(clothed);
    expect(parseBodyState("hands free")).toMatchObject({
      clothes: "clothed",
      pose: "sitting",
    });
  });

  it("recognizes masturbate instead of falling back to a static hold", () => {
    const beat = planPhysicalBeat(
      "masturbate",
      { ...clothed, pose: "lying" },
      false,
    );
    expect(beat.physical).not.toMatch(
      /hold the pose already in the first frame/i,
    );
    expect(beat.nextBody.hands).toBe("on-body");
    expect(beat.nextBody.contact).toBe("self");
  });

  it("recognizes play with your pussy as a self-touch request", () => {
    const beat = planPhysicalBeat(
      "play with your pussy",
      { ...clothed, pose: "lying" },
      false,
    );
    expect(beat.physical).not.toMatch(
      /hold the pose already in the first frame/i,
    );
    expect(beat.nextBody.contact).toBe("self");
  });

  it("lies on the floor, not a bed, in a scene with no bed", () => {
    const beat = planPhysicalBeat("lie on the floor", clothed, false, false);
    expect(beat.physical).toMatch(/floor/i);
    expect(beat.physical).not.toMatch(/\bbed\b/i);
  });

  it("still uses the bed by default in the bedroom scene", () => {
    const beat = planPhysicalBeat("lie down", clothed, false, true);
    expect(beat.physical).toMatch(/\bbed\b/i);
  });

  it("recognizes doggystyle on its own, not just with an anal/toy mention", () => {
    const beat = planPhysicalBeat(
      "doggystyle",
      { ...clothed, pose: "sitting" },
      false,
    );
    expect(beat.physical).not.toMatch(
      /hold the pose already in the first frame/i,
    );
  });

  it("puts doggystyle on hands and knees, not the standing bend-over that a plain ass-view gets", () => {
    const beat = planPhysicalBeat(
      "doggystyle",
      { ...clothed, pose: "sitting" },
      false,
    );
    expect(beat.nextBody.pose).toBe("kneeling");
    expect(beat.physical).toMatch(/hands and knees/i);
    expect(beat.physical).not.toMatch(/she stands, turns her back/i);
  });

  it("holds the doggystyle position on a repeat request instead of standing her back up", () => {
    const beat = planPhysicalBeat(
      "do doggystyle again",
      { ...clothed, pose: "kneeling" },
      false,
    );
    expect(beat.nextBody.pose).toBe("kneeling");
    expect(beat.physical).toMatch(/stays on her hands and knees/i);
  });

  it("keeps a toy from fusing into her body once it's in her hand", () => {
    const beat = planPhysicalBeat(
      "use the dildo",
      { ...clothed, prop: "fetching" },
      false,
    );
    expect(beat.physical).toMatch(/TOY RULE/i);
    expect(beat.physical).toMatch(/never fused to her skin/i);
  });

  it("does not undress her for an unrelated mundane request like drinking coffee", () => {
    const beat = planPhysicalBeat("drink your coffee", clothed, false);
    expect(beat.nextBody.clothes).toBe("clothed");
    expect(beat.physical).toMatch(/do not add, remove, or shift any garment/i);
  });

  it("explicitly bans undressing when nothing in the request maps to a known action", () => {
    const beat = planPhysicalBeat("what's your favorite color", clothed, false);
    expect(beat.nextBody.clothes).toBe("clothed");
    expect(beat.physical).toMatch(/do not remove or add any clothing/i);
  });

  it("teases a bra strap without removing the top", () => {
    const beat = planPhysicalBeat("do a bra strap tease", clothed, false);
    expect(beat.nextBody.clothes).toBe("clothed");
    expect(beat.physical).toMatch(/bra strap/i);
  });

  it("teases the panty waistband while staying fully clothed", () => {
    const beat = planPhysicalBeat("give me a panty tease", clothed, false);
    expect(beat.nextBody.clothes).toBe("clothed");
    expect(beat.physical).toMatch(/waistband/i);
  });

  it("recognizes JOI as a self-touch request", () => {
    const beat = planPhysicalBeat(
      "give me joi",
      { ...clothed, pose: "lying" },
      false,
    );
    expect(beat.physical).not.toMatch(
      /hold the pose already in the first frame/i,
    );
    expect(beat.nextBody.contact).toBe("self");
  });

  it("does not undress her for a passive compliment mentioning a body part", () => {
    const beat = planPhysicalBeat("nice tits", clothed, false);
    expect(beat.nextBody.clothes).toBe("clothed");
    const beat2 = planPhysicalBeat("your boobs look amazing", clothed, false);
    expect(beat2.nextBody.clothes).toBe("clothed");
  });
});

describe("chat timing", () => {
  it("gives a short text a short typing lead and a clip long enough to finish the action", () => {
    const lead = typingLeadSecFor("okay watch");
    expect(lead).toBeGreaterThanOrEqual(1.5);
    expect(lead).toBeLessThanOrEqual(3.5);
    const duration = clipDurationFor("chat", lead, "hold");
    expect(duration).toBeGreaterThan(lead);
    expect(duration).toBeGreaterThanOrEqual(10);
    expect(duration).toBeLessThanOrEqual(15);

    // Only a short reaction gesture gets a typing lead-in — a real action needs the whole clip now.
    const direction = chatClipDirection(
      lead,
      "She raises one hand, waves at the webcam, and lowers it.",
      clothed,
    );
    expect(direction).toContain(`first ${lead} seconds`);
    expect(direction).toContain("Mouth closed");
    expect(direction).toContain("OFF-SCREEN keyboard");
    expect(direction).not.toContain("second phone");
  });

  it("gives a real action the whole clip instead of a typing lead-in", () => {
    const lead = typingLeadSecFor("masturbate for me");
    const direction = chatClipDirection(
      lead,
      "One hand moves onto her own body and stays there.",
      clothed,
    );
    expect(direction).not.toContain("seconds she glances at chat");
    expect(direction).toContain("Do not type first");
    expect(direction).toContain("Mouth closed");
  });
});

describe("idleDirection never advances an act", () => {
  it("never tells filler to continue, even mid-act", () => {
    // This is the exact bug: filler used to say "CONTINUE... keep going... do not stop or reset",
    // which is what turned a single "show me your tits" into an unrequested toy/nude escalation.
    const touching: BodyState = {
      ...clothed,
      contact: "self",
      hands: "on-body",
    };
    const direction = idleDirection(touching, 10);
    expect(direction).toContain("WAITING");
    expect(direction).not.toMatch(
      /keep going|do not stop or reset|same rhythm/i,
    );
    expect(direction).toMatch(
      /do not start, continue, or finish any sexual act/i,
    );
  });

  it("settles a busy hand to a paused rest instead of holding the act frozen", () => {
    const touching: BodyState = {
      ...clothed,
      contact: "self",
      hands: "on-body",
    };
    expect(idleDirection(touching, 0)).toMatch(/eased off|paused/i);
  });

  it("puts a held toy away instead of leaving it in frame", () => {
    const holdingToy: BodyState = {
      ...clothed,
      hands: "holding-toy",
      prop: "dildo",
    };
    expect(idleDirection(holdingToy, 0)).toMatch(/set down|empty/i);
  });
});

describe("BODY_PHYSICS", () => {
  it("bans an unrequested toy from appearing on its own", () => {
    expect(BODY_PHYSICS).toMatch(/do not invent a dildo/i);
  });

  it("keeps the no-unrequested-prop line standalone so it survives outside BODY_PHYSICS", () => {
    expect(NO_UNREQUESTED_PROP).toMatch(/do not invent a dildo/i);
    expect(BODY_PHYSICS).toContain(NO_UNREQUESTED_PROP);
  });
});
