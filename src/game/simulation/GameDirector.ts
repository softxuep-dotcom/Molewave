import { levels, type LevelDefinition } from "../content/levels";

export type DirectorEvent =
  | { type: "success"; levelIndex: number }
  | { type: "load"; levelIndex: number }
  | { type: "failure"; levelIndex: number }
  | { type: "complete"; levelIndex: number };

export interface WorldProbe {
  getToyPosition(id: string): { x: number; y: number; z: number } | null;
  getToySpeed(id: string): number;
}

type DirectorStatus = "playing" | "success" | "failure" | "complete";

export class GameDirector {
  private levelIndex = 0;
  private status: DirectorStatus = "playing";
  private stableFor = 0;
  private transitionRemaining = 0;

  get currentLevel(): LevelDefinition {
    return levels[this.levelIndex];
  }

  get currentLevelIndex(): number {
    return this.levelIndex;
  }

  get acceptsInput(): boolean {
    return this.status === "playing";
  }

  get isComplete(): boolean {
    return this.status === "complete";
  }

  update(dt: number, world: WorldProbe): DirectorEvent | null {
    if (this.status === "success") {
      this.transitionRemaining -= dt;
      if (this.transitionRemaining > 0) {
        return null;
      }

      if (this.levelIndex >= levels.length - 1) {
        this.status = "complete";
        return { type: "complete", levelIndex: this.levelIndex };
      }

      this.levelIndex += 1;
      this.status = "playing";
      this.stableFor = 0;
      return { type: "load", levelIndex: this.levelIndex };
    }

    if (this.status === "failure") {
      this.transitionRemaining -= dt;
      if (this.transitionRemaining > 0) {
        return null;
      }
      this.status = "playing";
      this.stableFor = 0;
      return { type: "load", levelIndex: this.levelIndex };
    }

    if (this.status !== "playing") {
      return null;
    }

    const success = this.currentLevel.success;
    const position = world.getToyPosition(success.toyId);
    if (!position) {
      return null;
    }

    const insideTarget =
      position.x >= success.minX &&
      position.x <= success.maxX &&
      position.y <= success.maxY &&
      Math.abs(position.z) < 0.75;
    const calmEnough = world.getToySpeed(success.toyId) < 1.65;

    if (insideTarget && calmEnough) {
      this.stableFor += dt;
      if (this.stableFor >= success.stableSeconds) {
        this.status = "success";
        this.transitionRemaining = 1.05;
        return { type: "success", levelIndex: this.levelIndex };
      }
    } else {
      this.stableFor = Math.max(0, this.stableFor - dt * 1.8);
    }

    if (position.y < -1.8 || Math.abs(position.x) > 4.3 || Math.abs(position.z) > 2.2) {
      this.status = "failure";
      this.transitionRemaining = 0.7;
      return { type: "failure", levelIndex: this.levelIndex };
    }

    return null;
  }

  resetCurrent(): void {
    this.status = "playing";
    this.stableFor = 0;
    this.transitionRemaining = 0;
  }

  restart(): void {
    this.levelIndex = 0;
    this.resetCurrent();
  }
}
