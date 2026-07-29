import * as THREE from "three";
import type { BumpSnapshot } from "../../physics/PhysicsWorld";

const verbColors: Record<BumpSnapshot["primitive"], THREE.Color> = {
  push: new THREE.Color(0x84dfc4),
  prop: new THREE.Color(0xffd166),
  launch: new THREE.Color(0xff7b70),
};

export class CarpetSurface {
  readonly group = new THREE.Group();

  private readonly geometry = new THREE.PlaneGeometry(7.62, 2.14, 54, 12);
  private readonly material: THREE.MeshStandardMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly basePositions: Float32Array;
  private readonly eyes = new THREE.Group();
  private readonly contactShadow: THREE.Mesh;

  constructor() {
    const texture = this.createGridTexture();
    this.material = new THREE.MeshStandardMaterial({
      color: 0xd8f0d4,
      map: texture,
      roughness: 0.92,
      metalness: 0,
      emissive: 0x102e2d,
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.015;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    const shadowTexture = this.createContactShadowTexture();
    this.contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({
        color: 0x123f3d,
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.025;
    this.contactShadow.renderOrder = 1;
    this.group.add(this.contactShadow);

    const positions = this.geometry.attributes.position.array;
    this.basePositions = new Float32Array(positions.length);
    this.basePositions.set(positions);

    this.createMoleFace();
    this.group.add(this.eyes);
  }

  update(bump: BumpSnapshot): void {
    const positions = this.geometry.attributes.position;
    const array = positions.array as Float32Array;
    const physicalAmplitude = Math.max(0, bump.height);
    const amplitude = bump.active
      ? Math.max(0.18, physicalAmplitude * 1.22)
      : physicalAmplitude;
    const width =
      bump.primitive === "push" ? 1.12 : bump.primitive === "prop" ? 1.02 : 0.9;
    const depthScale = bump.primitive === "push" ? 0.61 : 0.72;
    const centerX = bump.x;

    for (let index = 0; index < array.length; index += 3) {
      const x = this.basePositions[index];
      const localY = this.basePositions[index + 1];
      const dx = x - centerX;
      const ellipticalDistance = Math.sqrt(dx * dx + (localY / depthScale) ** 2);
      let lift = 0;
      if (ellipticalDistance < width && amplitude > 0.001) {
        const t = ellipticalDistance / width;
        const bell = Math.cos((t * Math.PI) / 2);
        lift = amplitude * bell * bell;
        if (bump.primitive === "launch" && bump.direction !== 0) {
          lift *= 1 + Math.max(-0.12, Math.min(0.12, dx * -bump.direction * 0.16));
        }
      }
      array[index + 2] = lift;
    }

    positions.needsUpdate = true;
    this.geometry.computeVertexNormals();

    const targetColor = verbColors[bump.primitive];
    this.material.emissive.lerp(targetColor, bump.active ? 0.045 : 0.018);
    this.material.emissiveIntensity = bump.active ? 0.18 : 0.08;

    const shadowMaterial = this.contactShadow.material as THREE.MeshBasicMaterial;
    shadowMaterial.opacity = bump.active ? Math.min(0.72, 0.24 + amplitude * 0.4) : 0;
    this.contactShadow.visible = bump.active;
    this.contactShadow.position.x = bump.x;
    this.contactShadow.scale.set(width * 1.24, depthScale * 1.16, 1);

    this.eyes.visible = bump.active && amplitude > 0.08;
    this.eyes.position.set(bump.x, Math.max(0.07, amplitude * 0.62), 0.74);
    this.eyes.rotation.z =
      bump.primitive === "launch" ? -bump.direction * 0.08 : bump.direction * -0.025;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.map?.dispose();
    this.material.dispose();
    this.contactShadow.geometry.dispose();
    (this.contactShadow.material as THREE.MeshBasicMaterial).map?.dispose();
    (this.contactShadow.material as THREE.MeshBasicMaterial).dispose();
  }

  private createGridTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }

    context.fillStyle = "#c9e9c9";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cell = 32;
    for (let y = 0; y < canvas.height / cell; y += 1) {
      for (let x = 0; x < canvas.width / cell; x += 1) {
        context.fillStyle = (x + y) % 2 === 0 ? "#dff2d5" : "#aadbc4";
        context.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    context.strokeStyle = "rgba(24, 89, 81, 0.16)";
    context.lineWidth = 2;
    for (let x = 0; x <= canvas.width; x += cell) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= canvas.height; y += cell) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.5, 1.4);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  private createContactShadowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }

    const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    gradient.addColorStop(0.48, "rgba(255, 255, 255, 0.45)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private createMoleFace(): void {
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b2523,
      roughness: 0.48,
    });
    const glintMaterial = new THREE.MeshBasicMaterial({ color: 0xfff9dc });
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0xa85d5c,
      roughness: 0.65,
    });

    for (const x of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 18, 12), eyeMaterial);
      eye.position.set(x, 0, 0);
      eye.castShadow = true;
      this.eyes.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), glintMaterial);
      glint.position.set(x + 0.026, 0.035, 0.086);
      this.eyes.add(glint);
    }

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), noseMaterial);
    nose.scale.set(1.15, 0.85, 0.8);
    nose.position.set(0, -0.1, 0.04);
    this.eyes.add(nose);
  }
}
