import * as THREE from "three";
import type { LevelDefinition, ToySpec } from "../../game/content/levels";
import type { BodySnapshot, BumpSnapshot } from "../../physics/PhysicsWorld";
import { CarpetSurface } from "../objects/CarpetSurface";

interface BurstParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export class GameRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-4, 4, 6, -6, 0.1, 60);
  private readonly stageGroup = new THREE.Group();
  private readonly toyMeshes = new Map<string, THREE.Object3D>();
  private readonly carpet = new CarpetSurface();
  private readonly particles: BurstParticle[] = [];
  private targetMesh: THREE.Mesh | null = null;
  private currentAccent = new THREE.Color(0x76dfc2);
  private readonly lookTarget = new THREE.Vector3(0, 0.72, 0);

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute("aria-label", "Molewave 3D 游戏画面");
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x1d5051);
    this.scene.fog = new THREE.Fog(0x1d5051, 12, 28);
    this.camera.position.set(0, 6.5, 9.2);
    this.camera.lookAt(this.lookTarget);

    this.scene.add(this.stageGroup);
    this.scene.add(this.carpet.group);
    this.createRoom();
    this.createLights();
    this.resize();
    window.addEventListener("resize", this.resize);

    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
    });
  }

  loadLevel(level: LevelDefinition): void {
    this.clearStage();
    this.currentAccent.setHex(level.accent);
    this.createTarget(level);

    for (const obstacle of level.obstacles) {
      const mesh = this.createBoxMesh(obstacle.size, obstacle.color, 0.75);
      mesh.position.set(obstacle.position.x, obstacle.position.y, obstacle.position.z);
      mesh.userData.staticObstacle = true;
      this.stageGroup.add(mesh);
    }

    for (const toy of level.toys) {
      const mesh = this.createToyMesh(toy);
      mesh.position.set(toy.position.x, toy.position.y, toy.position.z);
      this.toyMeshes.set(toy.id, mesh);
      this.stageGroup.add(mesh);
    }

    this.createDirectionMarkers(level);
  }

  syncBodies(snapshots: BodySnapshot[]): void {
    for (const snapshot of snapshots) {
      const mesh = this.toyMeshes.get(snapshot.id);
      if (!mesh) {
        continue;
      }
      mesh.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
      mesh.quaternion.set(
        snapshot.rotation.x,
        snapshot.rotation.y,
        snapshot.rotation.z,
        snapshot.rotation.w,
      );
    }
  }

  render(nowSeconds: number, dt: number, bump: BumpSnapshot): void {
    this.carpet.update(bump);
    if (this.targetMesh) {
      const pulse = 1 + Math.sin(nowSeconds * 3.5) * 0.025;
      this.targetMesh.scale.set(pulse, 1, pulse);
      const material = this.targetMesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.22 + (Math.sin(nowSeconds * 4.2) + 1) * 0.08;
    }
    this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera);
  }

  celebrate(position: { x: number; y: number; z: number }): void {
    const colors = [this.currentAccent.getHex(), 0xffd166, 0xff8e72, 0xf8f1d5];
    for (let index = 0; index < 24; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: colors[index % colors.length],
        transparent: true,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), material);
      mesh.position.set(position.x, Math.max(0.8, position.y + 0.4), position.z);
      this.stageGroup.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3.8,
          2.2 + Math.random() * 2.4,
          (Math.random() - 0.5) * 1.8,
        ),
        life: 0.7 + Math.random() * 0.55,
      });
    }
  }

  dispose(): void {
    window.removeEventListener("resize", this.resize);
    this.clearStage();
    this.carpet.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize = (): void => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    const aspect = width / height;
    let viewWidth: number;
    let viewHeight: number;

    if (aspect < 1) {
      viewWidth = 8.25;
      viewHeight = viewWidth / aspect;
    } else {
      viewHeight = 8.2;
      viewWidth = viewHeight * aspect;
    }

    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  private createRoom(): void {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x2b6765,
      roughness: 0.94,
    });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 0.35), wallMaterial);
    wall.position.set(0, 4.6, -3.35);
    wall.receiveShadow = true;
    this.scene.add(wall);

    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0xb88767,
      roughness: 0.86,
    });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.34, 2.65), platformMaterial);
    platform.position.set(0, -0.34, 0);
    platform.receiveShadow = true;
    platform.castShadow = true;
    this.scene.add(platform);

    const shelfMaterial = new THREE.MeshStandardMaterial({
      color: 0x163e40,
      roughness: 0.8,
    });
    for (const y of [3.6, 6.6]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(13, 0.18, 0.5), shelfMaterial);
      shelf.position.set(0, y, -2.95);
      shelf.receiveShadow = true;
      this.scene.add(shelf);
    }

    const decorColors = [0xff8e72, 0x76dfc2, 0xffd166, 0x72a9ff];
    for (let index = 0; index < 12; index += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: decorColors[index % decorColors.length],
        roughness: 0.78,
      });
      const geometry =
        index % 3 === 0
          ? new THREE.CylinderGeometry(0.24, 0.3, 0.62, 12)
          : new THREE.BoxGeometry(0.52, 0.52 + (index % 2) * 0.2, 0.42);
      const mesh = new THREE.Mesh(geometry, material);
      const side = index < 6 ? -1 : 1;
      const local = index % 6;
      mesh.position.set(side * (4.8 + local * 0.55), local < 3 ? 4 : 7, -2.55);
      mesh.rotation.y = local * 0.28;
      mesh.castShadow = true;
      this.scene.add(mesh);
    }

    const shelfToyColors = [0x79a997, 0xc49378, 0x668c91, 0xb7a768, 0x7f9e82];
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const material = new THREE.MeshStandardMaterial({
          color: shelfToyColors[(row * 2 + column) % shelfToyColors.length],
          roughness: 0.88,
        });
        const geometry =
          (row + column) % 2 === 0
            ? new THREE.BoxGeometry(0.54, 0.68, 0.38)
            : new THREE.CylinderGeometry(0.25, 0.3, 0.68, 12);
        const toy = new THREE.Mesh(geometry, material);
        toy.position.set(-2.35 + column * 1.17, row === 0 ? 4.04 : 7.04, -2.58);
        toy.rotation.y = (column - 2) * 0.1;
        toy.castShadow = true;
        this.scene.add(toy);
      }
    }
  }

  private createLights(): void {
    const hemisphere = new THREE.HemisphereLight(0xc9fff0, 0x173334, 2.35);
    this.scene.add(hemisphere);

    const key = new THREE.DirectionalLight(0xfff0cb, 4.1);
    key.position.set(-4.5, 8.5, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x73d8d3, 1.2);
    fill.position.set(5, 3, 3);
    this.scene.add(fill);
  }

  private createTarget(level: LevelDefinition): void {
    const material = new THREE.MeshStandardMaterial({
      color: level.target.color,
      emissive: level.target.color,
      emissiveIntensity: 0.25,
      roughness: 0.68,
      transparent: true,
      opacity: 0.68,
    });
    const target = new THREE.Mesh(
      new THREE.BoxGeometry(level.target.size.x, level.target.size.y, level.target.size.z),
      material,
    );
    target.position.set(
      level.target.position.x,
      level.target.position.y,
      level.target.position.z,
    );
    target.receiveShadow = true;
    this.targetMesh = target;
    this.stageGroup.add(target);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(target.geometry),
      new THREE.LineBasicMaterial({
        color: 0xfff4d5,
        transparent: true,
        opacity: 0.72,
      }),
    );
    target.add(outline);

    for (const x of [-0.42, 0.42]) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff4d5 }),
      );
      marker.position.set(x * level.target.size.x, 0.1, -level.target.size.z * 0.36);
      target.add(marker);
    }
  }

  private createDirectionMarkers(level: LevelDefinition): void {
    const direction = level.id === 2 ? 1 : 1;
    const startX = level.id === 3 ? -1.55 : level.id === 2 ? -1.05 : -0.95;
    const endX = level.id === 3 ? -0.3 : 1.05;
    const count = 4;
    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1);
      const x = THREE.MathUtils.lerp(startX, endX, t);
      const geometry = new THREE.ConeGeometry(0.11, 0.28, 3);
      const material = new THREE.MeshBasicMaterial({
        color: level.accent,
        transparent: true,
        opacity: 0.38 + t * 0.14,
      });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(x, 0.055, 0.78);
      marker.rotation.z = -direction * Math.PI / 2;
      marker.rotation.x = Math.PI / 2;
      this.stageGroup.add(marker);
    }
  }

  private createToyMesh(spec: ToySpec): THREE.Object3D {
    const material = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.shape === "ball" ? 0.38 : 0.62,
      metalness: 0.02,
    });
    const geometry =
      spec.shape === "ball"
        ? new THREE.SphereGeometry(spec.size.x, 32, 20)
        : new THREE.BoxGeometry(spec.size.x, spec.size.y, spec.size.z, 2, 2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (spec.shape !== "ball") {
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 25),
        new THREE.LineBasicMaterial({
          color: 0x653f37,
          transparent: true,
          opacity: 0.34,
        }),
      );
      mesh.add(outline);
    } else {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(spec.size.x * 0.72, 0.035, 8, 40),
        new THREE.MeshBasicMaterial({ color: 0xfff1ca }),
      );
      stripe.rotation.y = Math.PI / 2;
      mesh.add(stripe);
    }

    return mesh;
  }

  private createBoxMesh(
    size: { x: number; y: number; z: number },
    color: number,
    roughness: number,
  ): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshStandardMaterial({ color, roughness });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x6f4b3b, transparent: true, opacity: 0.34 }),
    );
    mesh.add(outline);
    return mesh;
  }

  private updateParticles(dt: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      particle.velocity.y -= 5.8 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 5;
      particle.mesh.scale.setScalar(Math.max(0.01, Math.min(1, particle.life * 2)));
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, Math.min(1, particle.life * 2));
      if (particle.life <= 0) {
        this.stageGroup.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        material.dispose();
        this.particles.splice(index, 1);
      }
    }
  }

  private clearStage(): void {
    this.targetMesh = null;
    this.toyMeshes.clear();
    this.particles.length = 0;
    for (const child of [...this.stageGroup.children]) {
      this.stageGroup.remove(child);
      child.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            material.dispose();
          }
        }
      });
    }
  }
}
