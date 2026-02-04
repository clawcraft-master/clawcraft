/**
 * Simplex-like noise for terrain generation
 * Ported to work in Convex runtime
 */

export class SimplexNoise {
  private perm: Uint8Array;

  constructor(seed: number = 0) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    
    // Shuffle based on seed
    let n = seed;
    for (let i = 255; i > 0; i--) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      const j = n % (i + 1);
      const tmp = p[i] as number;
      p[i] = p[j] as number;
      p[j] = tmp;
    }
    
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255] as number;
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }

  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = (this.perm[X] as number) + Y;
    const B = (this.perm[X + 1] as number) + Y;
    
    return this.lerp(
      this.lerp(this.grad(this.perm[A] as number, x, y), this.grad(this.perm[B] as number, x - 1, y), u),
      this.lerp(this.grad(this.perm[A + 1] as number, x, y - 1), this.grad(this.perm[B + 1] as number, x - 1, y - 1), u),
      v
    );
  }

  fbm(x: number, y: number, octaves: number = 4, lacunarity: number = 2, persistence: number = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }
}
