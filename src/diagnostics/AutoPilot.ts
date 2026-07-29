import type { InputIntent } from "../game/input/PointerInput";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export class AutoPilot {
  private levelIndex = -1;
  private levelStartedAt = 0;

  sample(levelIndex: number, now: number, trackedToyX?: number): InputIntent {
    if (this.levelIndex !== levelIndex) {
      this.levelIndex = levelIndex;
      this.levelStartedAt = now;
    }

    const elapsed = (now - this.levelStartedAt) / 1000;
    if (levelIndex === 0) {
      return this.pushSequence(elapsed, trackedToyX ?? -2.25);
    }
    if (levelIndex === 1) {
      return this.propSequence(elapsed);
    }
    return this.launchSequence(elapsed);
  }

  private pushSequence(elapsed: number, toyX: number): InputIntent {
    if (elapsed < 0.25) {
      return this.intent(true, -0.86, 0.18, 0, "push", elapsed);
    }
    if (elapsed < 9 && toyX < 1.5) {
      const followX = Math.min(0.67, Math.max(-0.8, (toyX - 0.52) / 4.08));
      return this.intent(true, followX, 0.18, 0.22, "push", elapsed);
    }
    return this.inactive();
  }

  private propSequence(elapsed: number): InputIntent {
    if (elapsed < 0.3) {
      return this.intent(true, -0.46, 0.22, 0, "push", elapsed);
    }
    if (elapsed < 6.5) {
      const lift = 0.22 + clamp01((elapsed - 0.3) / 0.55) * 0.58;
      return this.intent(true, -0.46, lift, 0, "prop", elapsed);
    }
    return this.inactive();
  }

  private launchSequence(elapsed: number): InputIntent {
    if (elapsed < 0.45) {
      return this.intent(true, -0.93, 0.72, 0, "prop", elapsed);
    }
    if (elapsed < 0.92) {
      const t = clamp01((elapsed - 0.45) / 0.47);
      return this.intent(true, -0.93 + t * 1.42, 0.72, 1.51, "launch", elapsed);
    }
    return this.inactive();
  }

  private intent(
    active: boolean,
    xNorm: number,
    height: number,
    velocityWps: number,
    primitive: InputIntent["primitive"],
    elapsed: number,
  ): InputIntent {
    return {
      active,
      xNorm,
      xWorld: xNorm * 4.08,
      height,
      velocityWps,
      direction: velocityWps > 0 ? 1 : velocityWps < 0 ? -1 : 0,
      holdMs: elapsed * 1000,
      primitive,
    };
  }

  private inactive(): InputIntent {
    return {
      active: false,
      xNorm: 0,
      xWorld: 0,
      height: 0.12,
      velocityWps: 0,
      direction: 0,
      holdMs: 0,
      primitive: "push",
    };
  }
}
