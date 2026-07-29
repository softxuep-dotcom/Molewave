export class PerfMonitor {
  private frames = 0;
  private elapsed = 0;
  private fps = 60;

  update(dt: number): number {
    this.frames += 1;
    this.elapsed += dt;
    if (this.elapsed >= 0.5) {
      this.fps = Math.round(this.frames / this.elapsed);
      this.frames = 0;
      this.elapsed = 0;
    }
    return this.fps;
  }
}
