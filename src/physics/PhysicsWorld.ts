import RAPIER from "@dimforge/rapier3d-compat";
import type {
  LevelDefinition,
  ObstacleSpec,
  ToySpec,
  Vec3,
} from "../game/content/levels";
import type { InputIntent } from "../game/input/PointerInput";

export interface BodySnapshot {
  id: string;
  position: Vec3;
  rotation: { x: number; y: number; z: number; w: number };
}

export interface BumpSnapshot {
  x: number;
  y: number;
  active: boolean;
  height: number;
  direction: -1 | 0 | 1;
  primitive: InputIntent["primitive"];
}

interface ToyRuntime {
  spec: ToySpec;
  body: RAPIER.RigidBody;
}

const FIXED_DT = 1 / 60;
const BUMP_RADIUS = 1.02;
const PLAY_HALF_WIDTH = 3.25;

const moveToward = (value: number, target: number, maxDelta: number): number => {
  const delta = target - value;
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return value + Math.sign(delta) * maxDelta;
};

export class PhysicsWorld {
  private world!: RAPIER.World;
  private bumpBody!: RAPIER.RigidBody;
  private bumpCollider!: RAPIER.Collider;
  private bumpX = -2.2;
  private bumpY = -1.75;
  private bumpWasActive = false;
  private activationProgress = 0;
  private currentLevel!: LevelDefinition;
  private readonly toys = new Map<string, ToyRuntime>();
  private plankAngle = 0;
  private launchFired = false;
  private launchSeparatedFor = 0;

  static async create(): Promise<PhysicsWorld> {
    const initialize = RAPIER.init as unknown as (
      options: Record<string, never>,
    ) => Promise<void>;
    await initialize({});
    return new PhysicsWorld();
  }

  loadLevel(level: LevelDefinition): void {
    if (this.world) {
      this.world.free();
    }

    this.currentLevel = level;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
    this.toys.clear();
    this.bumpX = -2.2;
    this.bumpY = -1.75;
    this.bumpWasActive = false;
    this.activationProgress = 0;
    this.plankAngle = 0;
    this.launchFired = false;
    this.launchSeparatedFor = 0;

    this.createCommonColliders();
    for (const obstacle of level.obstacles) {
      this.createObstacle(obstacle);
    }
    for (const toy of level.toys) {
      this.createToy(toy);
    }
  }

  step(input: InputIntent): void {
    this.updateBump(input);
    this.updatePropRig(input);
    this.updateLaunchImpulse(input);
    this.world.step();
  }

  getSnapshots(): BodySnapshot[] {
    const snapshots: BodySnapshot[] = [];
    for (const [id, runtime] of this.toys) {
      const position = runtime.body.translation();
      const rotation = runtime.body.rotation();
      snapshots.push({
        id,
        position: { x: position.x, y: position.y, z: position.z },
        rotation: {
          x: rotation.x,
          y: rotation.y,
          z: rotation.z,
          w: rotation.w,
        },
      });
    }
    return snapshots;
  }

  getToyPosition(id: string): Vec3 | null {
    const runtime = this.toys.get(id);
    if (!runtime) {
      return null;
    }
    const position = runtime.body.translation();
    return { x: position.x, y: position.y, z: position.z };
  }

  getToySpeed(id: string): number {
    const runtime = this.toys.get(id);
    if (!runtime) {
      return 0;
    }
    const velocity = runtime.body.linvel();
    return Math.hypot(velocity.x, velocity.y, velocity.z);
  }

  getBumpSnapshot(input: InputIntent): BumpSnapshot {
    return {
      x: this.bumpX,
      y: this.bumpY,
      active: input.active || this.bumpY > -1.55,
      height: Math.max(0, this.bumpY + BUMP_RADIUS),
      direction: input.direction,
      primitive: input.primitive,
    };
  }

  freezeToys(): void {
    for (const runtime of this.toys.values()) {
      if (runtime.spec.bodyType !== "dynamic") {
        continue;
      }
      runtime.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      runtime.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      runtime.body.sleep();
    }
  }

  dispose(): void {
    if (this.world) {
      this.world.free();
    }
  }

  private createCommonColliders(): void {
    const floor = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.16, 0),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(3.8, 0.16, 1.04).setFriction(0.92),
      floor,
    );

    const leftWall = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(-3.78, 0.85, 0),
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.08, 1.1, 1.02), leftWall);

    const rightWall = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(3.78, 0.85, 0),
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.08, 1.1, 1.02), rightWall);

    for (const z of [-1.08, 1.08]) {
      const rail = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0.5, z),
      );
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(3.8, 0.65, 0.06), rail);
    }

    this.bumpBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.bumpX, this.bumpY, 0),
    );
    this.bumpCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(BUMP_RADIUS).setFriction(0.96).setRestitution(0),
      this.bumpBody,
    );
    if (this.currentLevel.propRig) {
      this.bumpCollider.setEnabled(false);
    }
  }

  private createObstacle(spec: ObstacleSpec): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        spec.position.x,
        spec.position.y,
        spec.position.z,
      ),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(spec.size.x / 2, spec.size.y / 2, spec.size.z / 2)
        .setFriction(0.85)
        .setRestitution(0.02),
      body,
    );
  }

  private createToy(spec: ToySpec): void {
    const bodyDesc =
      spec.bodyType === "dynamic"
        ? RAPIER.RigidBodyDesc.dynamic()
        : RAPIER.RigidBodyDesc.kinematicPositionBased();

    bodyDesc
      .setTranslation(spec.position.x, spec.position.y, spec.position.z)
      .setLinearDamping(spec.shape === "ball" ? 0.16 : 0.72)
      .setAngularDamping(spec.shape === "ball" ? 0.22 : 0.88)
      .setCcdEnabled(Boolean(spec.launchable));

    const body = this.world.createRigidBody(bodyDesc);
    if (spec.bodyType === "dynamic") {
      body.setEnabledTranslations(true, true, false, true);
      body.setEnabledRotations(false, false, true, true);
    }

    const collider =
      spec.shape === "ball"
        ? RAPIER.ColliderDesc.ball(spec.size.x)
        : RAPIER.ColliderDesc.cuboid(spec.size.x / 2, spec.size.y / 2, spec.size.z / 2);

    collider
      .setDensity(spec.density)
      .setFriction(spec.friction)
      .setRestitution(spec.restitution);
    this.world.createCollider(collider, body);
    this.toys.set(spec.id, { spec, body });
  }

  private updateBump(input: InputIntent): void {
    if (input.active && !this.bumpWasActive) {
      this.bumpX = input.xNorm * PLAY_HALF_WIDTH;
      this.bumpY = -0.83;
      this.activationProgress = 1;
    }

    let desiredY = -1.72;
    if (input.active) {
      this.activationProgress = Math.min(1, this.activationProgress + FIXED_DT / 0.11);
      const eased = this.activationProgress * this.activationProgress * (3 - 2 * this.activationProgress);
      const activeY = -0.92 + input.height * 0.9;
      desiredY = -1.58 + (activeY + 1.58) * eased;
      const desiredX = input.xNorm * PLAY_HALF_WIDTH;
      this.bumpX = moveToward(this.bumpX, desiredX, 13.5 * FIXED_DT);
    } else {
      this.activationProgress = 0;
    }

    const verticalSpeed = input.active ? 4.2 : 7.5;
    this.bumpY = moveToward(this.bumpY, desiredY, verticalSpeed * FIXED_DT);
    this.bumpBody.setNextKinematicTranslation({ x: this.bumpX, y: this.bumpY, z: 0 });
    this.bumpWasActive = input.active;
  }

  private updatePropRig(input: InputIntent): void {
    const rig = this.currentLevel.propRig;
    if (!rig) {
      return;
    }
    const plank = this.toys.get(rig.toyId);
    if (!plank) {
      return;
    }

    const nearSupport = input.active && Math.abs(this.bumpX - rig.activationX) < 0.92;
    const lift = nearSupport ? Math.max(0, Math.min(1, (input.height - 0.18) / 0.72)) : 0;
    const targetAngle = rig.maxAngle * lift;
    this.plankAngle = moveToward(this.plankAngle, targetAngle, 0.46 * FIXED_DT);

    const centerX = rig.pivot.x - Math.cos(this.plankAngle) * rig.halfLength;
    const centerY = rig.pivot.y - Math.sin(this.plankAngle) * rig.halfLength;
    plank.body.setNextKinematicTranslation({ x: centerX, y: centerY, z: 0 });
    plank.body.setNextKinematicRotation({
      x: 0,
      y: 0,
      z: Math.sin(this.plankAngle / 2),
      w: Math.cos(this.plankAngle / 2),
    });
  }

  private updateLaunchImpulse(input: InputIntent): void {
    const launchables = [...this.toys.values()].filter((runtime) => runtime.spec.launchable);
    if (launchables.length === 0) {
      return;
    }

    let separated = true;
    for (const runtime of launchables) {
      const position = runtime.body.translation();
      const distance = Math.abs(position.x - this.bumpX);
      if (distance < 1.35) {
        separated = false;
      }

      if (
        input.active &&
        input.primitive === "launch" &&
        input.direction !== 0 &&
        !this.launchFired &&
        distance < 1.02 &&
        position.y < 1.45
      ) {
        const mass = Math.max(0.2, runtime.body.mass());
        runtime.body.applyImpulse(
          {
            x: input.direction * mass * 3.35,
            y: mass * 4.9,
            z: 0,
          },
          true,
        );
        this.launchFired = true;
        this.launchSeparatedFor = 0;
      }
    }

    if (!input.active) {
      this.launchFired = false;
      this.launchSeparatedFor = 0;
    } else if (separated) {
      this.launchSeparatedFor += FIXED_DT;
      if (this.launchSeparatedFor >= 0.1) {
        this.launchFired = false;
      }
    } else {
      this.launchSeparatedFor = 0;
    }
  }
}
