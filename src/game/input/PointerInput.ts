import type { Primitive } from "../content/levels";

export interface InputIntent {
  active: boolean;
  xNorm: number;
  height: number;
  velocityWps: number;
  direction: -1 | 0 | 1;
  holdMs: number;
  primitive: Primitive;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export class PointerInput {
  private active = false;
  private enabled = true;
  private pointerId: number | null = null;
  private xNorm = -0.65;
  private height = 0.12;
  private filteredVelocity = 0;
  private lastSampleX = 0;
  private lastSampleAt = 0;
  private startedAt = 0;
  private startY = 0;
  private primitive: Primitive = "push";
  private lastSpecialPrimitive: Primitive = "push";
  private lastSpecialAt = 0;
  private lastActivity = performance.now();

  constructor(
    private readonly element: HTMLElement,
    private readonly onActivity: () => void,
  ) {
    element.addEventListener("pointerdown", this.handlePointerDown);
    element.addEventListener("pointermove", this.handlePointerMove);
    element.addEventListener("pointerup", this.handlePointerUp);
    element.addEventListener("pointercancel", this.handlePointerUp);
    element.addEventListener("lostpointercapture", this.handlePointerUp);
    element.addEventListener("contextmenu", (event) => event.preventDefault());
    element.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
      },
      { passive: false },
    );
  }

  get idleMs(): number {
    return performance.now() - this.lastActivity;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  snapshot(now = performance.now()): InputIntent {
    const holdMs = this.active ? now - this.startedAt : 0;
    const speed = Math.abs(this.filteredVelocity);

    let candidate: Primitive = "push";
    if (this.active && this.height >= 0.3 && speed > 0.78) {
      candidate = "launch";
    } else if (this.active && this.height >= 0.29 && speed < 0.16 && holdMs > 140) {
      candidate = "prop";
    }

    if (candidate !== "push") {
      this.lastSpecialPrimitive = candidate;
      this.lastSpecialAt = now;
      this.primitive = candidate;
    } else if (this.active && now - this.lastSpecialAt < 260) {
      // Preserve a recognised lift or flick long enough for players to see it.
      this.primitive = this.lastSpecialPrimitive;
    } else {
      this.primitive = "push";
    }

    const direction: -1 | 0 | 1 =
      Math.abs(this.filteredVelocity) < 0.05 ? 0 : this.filteredVelocity > 0 ? 1 : -1;

    return {
      active: this.active,
      xNorm: this.xNorm,
      height: this.height,
      velocityWps: this.filteredVelocity,
      direction,
      holdMs,
      primitive: this.primitive,
    };
  }

  cancel(): void {
    const capturedId = this.pointerId;
    this.pointerId = null;
    if (capturedId !== null && this.element.hasPointerCapture(capturedId)) {
      this.element.releasePointerCapture(capturedId);
    }
    this.active = false;
    this.filteredVelocity = 0;
    this.height = 0.12;
    this.lastSpecialPrimitive = "push";
  }

  destroy(): void {
    this.element.removeEventListener("pointerdown", this.handlePointerDown);
    this.element.removeEventListener("pointermove", this.handlePointerMove);
    this.element.removeEventListener("pointerup", this.handlePointerUp);
    this.element.removeEventListener("pointercancel", this.handlePointerUp);
    this.element.removeEventListener("lostpointercapture", this.handlePointerUp);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || !event.isPrimary) {
      return;
    }

    event.preventDefault();
    this.pointerId = event.pointerId;
    this.element.setPointerCapture(event.pointerId);
    this.active = true;
    this.startedAt = performance.now();
    this.lastSampleAt = this.startedAt;
    this.startY = event.clientY;
    this.filteredVelocity = 0;
    this.updatePosition(event.clientX, event.clientY);
    this.lastSampleX = this.xNorm;
    this.markActivity();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.active || event.pointerId !== this.pointerId) {
      return;
    }

    event.preventDefault();
    const now = performance.now();
    const previousX = this.xNorm;
    this.updatePosition(event.clientX, event.clientY);

    const dt = Math.max(0.008, (now - this.lastSampleAt) / 1000);
    const instantaneous = (this.xNorm - this.lastSampleX) / 2 / dt;
    const deltaPixels = Math.abs(this.xNorm - previousX) * this.element.clientWidth * 0.5;
    if (deltaPixels > 3) {
      this.filteredVelocity += (instantaneous - this.filteredVelocity) * 0.48;
      this.lastSampleX = this.xNorm;
      this.lastSampleAt = now;
      this.markActivity();
    } else {
      this.filteredVelocity *= 0.88;
    }
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) {
      return;
    }

    event.preventDefault();
    this.cancel();
    this.markActivity();
  };

  private updatePosition(clientX: number, clientY: number): void {
    const bounds = this.element.getBoundingClientRect();
    const x01 = clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    this.xNorm = x01 * 2 - 1;

    const liftRange = Math.max(130, Math.min(280, bounds.height * 0.86));
    const upwardTravel = Math.max(0, this.startY - clientY);
    this.height = clamp(0.12 + upwardTravel / liftRange, 0.12, 1);
  }

  private markActivity(): void {
    this.lastActivity = performance.now();
    this.onActivity();
  }
}
