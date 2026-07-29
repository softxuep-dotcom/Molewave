import type { LevelDefinition, Primitive } from "../game/content/levels";

interface HudCallbacks {
  onReset: () => void;
  onPauseToggle: () => void;
  onResume: () => void;
  onRestartAll: () => void;
}

const primitiveMeta: Record<Primitive, { symbol: string; label: string }> = {
  push: { symbol: "↔", label: "滑推" },
  prop: { symbol: "◆", label: "顶撑" },
  launch: { symbol: "↗", label: "掀射" },
};

const requireElement = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }
  return element;
};

export class Hud {
  private readonly levelLabel = requireElement<HTMLSpanElement>("#level-label");
  private readonly missionTitle = requireElement<HTMLSpanElement>("#mission-title");
  private readonly missionCopy = requireElement<HTMLParagraphElement>("#mission-copy");
  private readonly pips = [...document.querySelectorAll<HTMLElement>(".pip")];
  private readonly verbChip = requireElement<HTMLDivElement>("#verb-chip");
  private readonly verbSymbol = requireElement<HTMLSpanElement>("#verb-symbol");
  private readonly verbLabel = requireElement<HTMLSpanElement>("#verb-label");
  private readonly feedback = requireElement<HTMLDivElement>("#feedback");
  private readonly ghostGuide = requireElement<HTMLDivElement>("#ghost-guide");
  private readonly diagnostics = requireElement<HTMLElement>("#diagnostics");
  private readonly diagFps = requireElement<HTMLSpanElement>("#diag-fps");
  private readonly diagInput = requireElement<HTMLSpanElement>("#diag-input");
  private readonly overlay = requireElement<HTMLDivElement>("#pause-overlay");
  private readonly overlayTitle = requireElement<HTMLHeadingElement>("#overlay-title");
  private readonly overlayCopy = requireElement<HTMLParagraphElement>("#overlay-copy");
  private readonly resumeButton = requireElement<HTMLButtonElement>("#resume-button");
  private readonly restartButton = requireElement<HTMLButtonElement>("#restart-button");
  private feedbackTimer: number | null = null;
  private diagnosticsVisible = false;

  constructor(callbacks: HudCallbacks) {
    requireElement<HTMLButtonElement>("#reset-button").addEventListener("click", callbacks.onReset);
    requireElement<HTMLButtonElement>("#pause-button").addEventListener(
      "click",
      callbacks.onPauseToggle,
    );
    this.resumeButton.addEventListener("click", callbacks.onResume);
    this.restartButton.addEventListener("click", callbacks.onRestartAll);

    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyD") {
        this.diagnosticsVisible = !this.diagnosticsVisible;
        this.diagnostics.hidden = !this.diagnosticsVisible;
      }
    });
  }

  setLevel(index: number, total: number): void {
    this.levelLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    this.pips.forEach((pip, pipIndex) => {
      pip.classList.toggle("active", pipIndex === index);
      pip.classList.toggle("done", pipIndex < index);
    });
  }

  setMission(level: LevelDefinition): void {
    this.missionTitle.textContent = level.instruction.title;
    this.missionCopy.textContent = level.instruction.copy;
  }

  setPrimitive(primitive: Primitive, active: boolean): void {
    const meta = primitiveMeta[primitive];
    this.verbChip.dataset.verb = primitive;
    this.verbSymbol.textContent = meta.symbol;
    this.verbLabel.textContent = `识别：${meta.label}`;
    this.verbChip.classList.toggle("visible", active);
  }

  setGhostVisible(visible: boolean): void {
    this.ghostGuide.classList.toggle("visible", visible);
  }

  showSuccess(finalLevel: boolean): void {
    this.showFeedback(finalLevel ? "三种波形，都掌握了" : "✓ 很稳");
  }

  showFailure(): void {
    this.showFeedback("落回地毯，再来一次");
  }

  setPaused(paused: boolean): void {
    if (paused) {
      this.overlayTitle.textContent = "暂停";
      this.overlayCopy.textContent = "地毯下的小家伙正在等你。";
      this.resumeButton.hidden = false;
      this.restartButton.hidden = true;
      this.overlay.hidden = false;
      requestAnimationFrame(() => this.resumeButton.focus());
    } else {
      this.overlay.hidden = true;
    }
  }

  showComplete(): void {
    this.overlayTitle.textContent = "灰盒通过";
    this.overlayCopy.textContent = "滑推、顶撑、掀射——一块地毯，三种玩法。";
    this.resumeButton.hidden = true;
    this.restartButton.hidden = false;
    this.overlay.hidden = false;
    requestAnimationFrame(() => this.restartButton.focus());
  }

  updateDiagnostics(fps: number, velocityWps: number, height: number): void {
    if (!this.diagnosticsVisible) {
      return;
    }
    this.diagFps.textContent = `${fps} FPS`;
    this.diagInput.textContent = `vx ${velocityWps.toFixed(2)} W/s · h ${height.toFixed(2)}`;
  }

  private showFeedback(message: string): void {
    if (this.feedbackTimer !== null) {
      window.clearTimeout(this.feedbackTimer);
    }
    this.feedback.textContent = message;
    this.feedback.classList.add("visible");
    this.feedbackTimer = window.setTimeout(() => {
      this.feedback.classList.remove("visible");
      this.feedbackTimer = null;
    }, 1150);
  }
}
