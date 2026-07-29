import "./styles.css";
import { AutoPilot } from "./diagnostics/AutoPilot";
import { PerfMonitor } from "./diagnostics/PerfMonitor";
import { levels } from "./game/content/levels";
import { PointerInput, type InputIntent } from "./game/input/PointerInput";
import { GameDirector, type DirectorEvent } from "./game/simulation/GameDirector";
import { PhysicsWorld } from "./physics/PhysicsWorld";
import { GameRenderer } from "./render/app/GameRenderer";
import { Hud } from "./ui/Hud";

const FIXED_DT = 1 / 60;
const inactiveIntent: InputIntent = {
  active: false,
  xNorm: -0.65,
  height: 0.12,
  velocityWps: 0,
  direction: 0,
  holdMs: 0,
  primitive: "push",
};

const requireElement = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
};

async function bootstrap(): Promise<void> {
  const host = requireElement<HTMLDivElement>("#canvas-host");
  const gestureZone = requireElement<HTMLDivElement>("#gesture-zone");
  const director = new GameDirector();
  const physics = await PhysicsWorld.create();
  const gameRenderer = new GameRenderer(host);
  const perf = new PerfMonitor();
  const gameShell = requireElement<HTMLElement>("#game-shell");
  const autoPilot = new URLSearchParams(window.location.search).get("autoplay") === "1"
    ? new AutoPilot()
    : null;
  gameShell.dataset.autoplay = autoPilot ? "on" : "off";

  let paused = false;
  let hasInteracted = false;
  let accumulator = 0;
  let lastFrameAt = performance.now();
  let hud!: Hud;

  const input = new PointerInput(gestureZone, () => {
    hasInteracted = true;
    hud.setGhostVisible(false);
  });

  const loadCurrentLevel = (): void => {
    const level = director.currentLevel;
    physics.loadLevel(level);
    gameRenderer.loadLevel(level);
    hud.setLevel(director.currentLevelIndex, levels.length);
    input.setEnabled(!paused && director.acceptsInput);
  };

  const resetCurrent = (): void => {
    if (director.isComplete) {
      return;
    }
    director.resetCurrent();
    input.cancel();
    loadCurrentLevel();
  };

  const setPaused = (nextPaused: boolean): void => {
    if (director.isComplete) {
      return;
    }
    paused = nextPaused;
    input.setEnabled(!paused && director.acceptsInput);
    hud.setPaused(paused);
    lastFrameAt = performance.now();
    accumulator = 0;
  };

  const restartAll = (): void => {
    director.restart();
    paused = false;
    hasInteracted = false;
    hud.setPaused(false);
    loadCurrentLevel();
  };

  hud = new Hud({
    onReset: resetCurrent,
    onPauseToggle: () => setPaused(!paused),
    onResume: () => setPaused(false),
    onRestartAll: restartAll,
  });

  const handleDirectorEvent = (event: DirectorEvent): void => {
    if (event.type === "success") {
      input.setEnabled(false);
      physics.freezeToys();
      const targetId = director.currentLevel.success.toyId;
      const position = physics.getToyPosition(targetId) ?? director.currentLevel.target.position;
      gameRenderer.celebrate(position);
      hud.showSuccess(event.levelIndex === levels.length - 1);
      return;
    }

    if (event.type === "failure") {
      input.setEnabled(false);
      hud.showFailure();
      return;
    }

    if (event.type === "load") {
      loadCurrentLevel();
      return;
    }

    input.setEnabled(false);
    hud.showComplete();
  };

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      event.preventDefault();
      setPaused(!paused);
    } else if (event.code === "KeyR" && !event.repeat) {
      event.preventDefault();
      resetCurrent();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      setPaused(true);
    }
  });
  window.addEventListener("orientationchange", () => setPaused(true));

  loadCurrentLevel();

  const frame = (now: number): void => {
    const elapsed = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1000));
    lastFrameAt = now;
    const manualIntent = input.snapshot(now);
    const trackedPosition = physics.getToyPosition(director.currentLevel.success.toyId);
    const intent =
      autoPilot?.sample(director.currentLevelIndex, now, trackedPosition?.x) ?? manualIntent;

    if (!paused && !director.isComplete) {
      accumulator += elapsed;
      while (accumulator >= FIXED_DT) {
        const fixedIntent = director.acceptsInput ? intent : inactiveIntent;
        physics.step(fixedIntent);
        const event = director.update(FIXED_DT, physics);
        if (event) {
          handleDirectorEvent(event);
        }
        accumulator -= FIXED_DT;
      }
    }

    const displayIntent = director.acceptsInput && !paused ? intent : inactiveIntent;
    const bump = physics.getBumpSnapshot(displayIntent);
    const snapshots = physics.getSnapshots();
    gameRenderer.syncBodies(snapshots);
    gameRenderer.render(now / 1000, elapsed, bump);
    const trackedToy = snapshots.find(
      (snapshot) => snapshot.id === director.currentLevel.success.toyId,
    );
    gameShell.dataset.level = String(director.currentLevelIndex + 1);
    gameShell.dataset.toyX = trackedToy?.position.x.toFixed(3) ?? "";
    gameShell.dataset.toyY = trackedToy?.position.y.toFixed(3) ?? "";
    const plankSnapshot = snapshots.find((snapshot) => snapshot.id === "plank");
    gameShell.dataset.plankAngle = plankSnapshot
      ? (2 * Math.atan2(plankSnapshot.rotation.z, plankSnapshot.rotation.w)).toFixed(3)
      : "";

    const fps = perf.update(elapsed);
    hud.setPrimitive(intent.primitive, intent.active && director.acceptsInput && !paused);
    hud.updateDiagnostics(fps, intent.velocityWps, intent.height);
    hud.setGhostVisible(
      !paused &&
        director.currentLevelIndex === 0 &&
        director.acceptsInput &&
        !hasInteracted &&
        !autoPilot &&
        input.idleMs > 3000,
    );

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);

  window.addEventListener("beforeunload", () => {
    input.destroy();
    physics.dispose();
    gameRenderer.dispose();
  });
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  const overlay = requireElement<HTMLDivElement>("#pause-overlay");
  const title = requireElement<HTMLHeadingElement>("#overlay-title");
  const copy = requireElement<HTMLParagraphElement>("#overlay-copy");
  const resume = requireElement<HTMLButtonElement>("#resume-button");
  title.textContent = "原型启动失败";
  copy.textContent = error instanceof Error ? error.message : "未知错误";
  resume.hidden = true;
  overlay.hidden = false;
});
