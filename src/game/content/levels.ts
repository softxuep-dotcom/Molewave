export type Primitive = "push" | "prop" | "launch";
export type ToyShape = "box" | "ball" | "plank";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ToySpec {
  id: string;
  shape: ToyShape;
  position: Vec3;
  size: Vec3;
  color: number;
  density: number;
  friction: number;
  restitution: number;
  bodyType: "dynamic" | "kinematic";
  launchable?: boolean;
}

export interface ObstacleSpec {
  id: string;
  position: Vec3;
  size: Vec3;
  color: number;
}

export interface TargetSpec {
  position: Vec3;
  size: Vec3;
  color: number;
}

export interface PropRig {
  toyId: string;
  pivot: { x: number; y: number };
  halfLength: number;
  activationX: number;
  maxAngle: number;
}

export interface SuccessSpec {
  toyId: string;
  minX: number;
  maxX: number;
  maxY: number;
  stableSeconds: number;
}

export interface LevelDefinition {
  id: number;
  slug: "push-home" | "prop-ramp" | "launch-wall";
  accent: number;
  expectedPrimitive: Primitive;
  target: TargetSpec;
  toys: ToySpec[];
  obstacles: ObstacleSpec[];
  propRig?: PropRig;
  success: SuccessSpec;
}

const sharedWallColor = 0xf0c6a5;

export const levels: LevelDefinition[] = [
  {
    id: 1,
    slug: "push-home",
    accent: 0x76dfc2,
    expectedPrimitive: "push",
    target: {
      position: { x: 2.35, y: 0.025, z: 0 },
      size: { x: 1.45, y: 0.05, z: 1.35 },
      color: 0x76dfc2,
    },
    toys: [
      {
        id: "box",
        shape: "box",
        position: { x: -2.25, y: 0.48, z: 0 },
        size: { x: 0.9, y: 0.9, z: 0.9 },
        color: 0xff8e72,
        density: 3.8,
        friction: 0.92,
        restitution: 0.02,
        bodyType: "dynamic",
      },
    ],
    obstacles: [],
    success: {
      toyId: "box",
      minX: 1.72,
      maxX: 3.15,
      maxY: 1.25,
      stableSeconds: 0.38,
    },
  },
  {
    id: 2,
    slug: "prop-ramp",
    accent: 0xffd166,
    expectedPrimitive: "prop",
    target: {
      position: { x: 2.75, y: 0.025, z: 0 },
      size: { x: 1.05, y: 0.05, z: 1.35 },
      color: 0xffd166,
    },
    toys: [
      {
        id: "plank",
        shape: "plank",
        position: { x: -0.2, y: 0.27, z: 0 },
        size: { x: 4.8, y: 0.18, z: 1.05 },
        color: 0xe4a85f,
        density: 2,
        friction: 0.78,
        restitution: 0,
        bodyType: "kinematic",
      },
      {
        id: "ball",
        shape: "ball",
        position: { x: -0.92, y: 0.82, z: 0 },
        size: { x: 0.46, y: 0.46, z: 0.46 },
        color: 0x70a8ff,
        density: 1,
        friction: 0.58,
        restitution: 0.04,
        bodyType: "dynamic",
      },
    ],
    obstacles: [
      {
        id: "cup-back",
        position: { x: 3.36, y: 0.6, z: 0 },
        size: { x: 0.18, y: 1.2, z: 1.18 },
        color: sharedWallColor,
      },
      {
        id: "cup-lip",
        position: { x: 2.2, y: 0.18, z: 0 },
        size: { x: 0.12, y: 0.36, z: 1.18 },
        color: sharedWallColor,
      },
    ],
    propRig: {
      toyId: "plank",
      pivot: { x: 2.16, y: 0.34 },
      halfLength: 2.4,
      activationX: -1.48,
      maxAngle: -0.34,
    },
    success: {
      toyId: "ball",
      minX: 2.25,
      maxX: 3.28,
      maxY: 1.2,
      stableSeconds: 0.42,
    },
  },
  {
    id: 3,
    slug: "launch-wall",
    accent: 0xff7b70,
    expectedPrimitive: "launch",
    target: {
      position: { x: 2.45, y: 0.025, z: 0 },
      size: { x: 1.55, y: 0.05, z: 1.35 },
      color: 0xff7b70,
    },
    toys: [
      {
        id: "ball",
        shape: "ball",
        position: { x: -2.35, y: 0.5, z: 0 },
        size: { x: 0.48, y: 0.48, z: 0.48 },
        color: 0xffcf5c,
        density: 0.9,
        friction: 0.55,
        restitution: 0.12,
        bodyType: "dynamic",
        launchable: true,
      },
    ],
    obstacles: [
      {
        id: "launch-wall",
        position: { x: 0.15, y: 0.72, z: 0 },
        size: { x: 0.28, y: 1.44, z: 1.3 },
        color: 0xdb8d69,
      },
      {
        id: "catch-wall",
        position: { x: 3.42, y: 0.65, z: 0 },
        size: { x: 0.18, y: 1.3, z: 1.25 },
        color: sharedWallColor,
      },
    ],
    success: {
      toyId: "ball",
      minX: 1.7,
      maxX: 3.3,
      maxY: 1.2,
      stableSeconds: 0.42,
    },
  },
];
