/**
 * Flora Air Canvas - Ultra High-Performance Botanical Engine
 * Hardware-Accelerated Cached Celestial Lotus Sprites & Cinematic 3D Petal Burst System
 * Delivers breathtaking aesthetic floral animations with rock-solid 60-120 FPS.
 */

class FlowerEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: false });

    // Active elements
    this.flowers = [];
    this.burstPetals = [];
    this.stardustParticles = []; // Glowing trails from flying petals
    this.dissolveParticles = [];
    this.vines = [];

    // Locked constant settings from user specification
    this.currentPaletteKey = 'celestial';
    this.baseFlowerSize = 40; // 40px constant
    this.eraserRadius = 65;   // 65px constant
    this.minFlowerDistance = 21; // Garland density constant

    this.currentStroke = null;
    this.lastFlowerPos = null;
    this.shockwaves = [];

    // Pre-rendered Celestial Lotus Sprites for 120 FPS GPU blitting
    this.spriteVariants = [];
    this.initSpriteCache();

    this.lastTime = performance.now();
  }

  /**
   * Pre-renders high-definition Celestial Lotus blossoms onto offscreen canvases.
   * Eliminates real-time vector path re-calculation for maximum 120 FPS performance.
   */
  initSpriteCache() {
    if (typeof document === 'undefined') return;

    const spriteSize = 160;
    const colorSchemes = [
      { outer: '#00E5FF', inner: '#7C4DFF', center: '#FFFFFF', core: '#EEFF41' },
      { outer: '#00B0FF', inner: '#651FFF', center: '#FFFFFF', core: '#69F0AE' },
      { outer: '#7C4DFF', inner: '#00E5FF', center: '#FFFFFF', core: '#FFFF00' },
      { outer: '#E040FB', inner: '#00E5FF', center: '#FFFFFF', core: '#00E5FF' }
    ];

    this.spriteVariants = colorSchemes.map(scheme => {
      const off = document.createElement('canvas');
      off.width = spriteSize;
      off.height = spriteSize;
      const oCtx = off.getContext('2d');
      const cx = spriteSize / 2;
      const cy = spriteSize / 2;
      const r = spriteSize * 0.42;

      // Soft ambient aura glow
      const glowGrad = oCtx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.15);
      glowGrad.addColorStop(0, 'rgba(0, 229, 255, 0.45)');
      glowGrad.addColorStop(0.6, 'rgba(124, 77, 255, 0.2)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      oCtx.fillStyle = glowGrad;
      oCtx.beginPath();
      oCtx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
      oCtx.fill();

      // Outer tier: 8 radiant pointed lotus petals
      for (let i = 0; i < 8; i++) {
        oCtx.save();
        oCtx.translate(cx, cy);
        oCtx.rotate((i * Math.PI * 2) / 8);

        const grad = oCtx.createLinearGradient(0, 0, 0, -r);
        grad.addColorStop(0, scheme.inner);
        grad.addColorStop(0.6, scheme.outer);
        grad.addColorStop(1, '#FFFFFF');

        oCtx.fillStyle = grad;
        oCtx.beginPath();
        oCtx.moveTo(0, 0);
        oCtx.quadraticCurveTo(-r * 0.38, -r * 0.45, 0, -r);
        oCtx.quadraticCurveTo(r * 0.38, -r * 0.45, 0, 0);
        oCtx.fill();

        oCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        oCtx.lineWidth = 1.2;
        oCtx.stroke();

        oCtx.restore();
      }

      // Inner tier: 8 offset glowing petals
      for (let i = 0; i < 8; i++) {
        oCtx.save();
        oCtx.translate(cx, cy);
        oCtx.rotate(((i + 0.5) * Math.PI * 2) / 8);

        const inGrad = oCtx.createLinearGradient(0, 0, 0, -r * 0.75);
        inGrad.addColorStop(0, scheme.outer);
        inGrad.addColorStop(0.5, '#FFFFFF');
        inGrad.addColorStop(1, '#FFFFFF');

        oCtx.fillStyle = inGrad;
        oCtx.beginPath();
        oCtx.moveTo(0, 0);
        oCtx.quadraticCurveTo(-r * 0.25, -r * 0.32, 0, -r * 0.72);
        oCtx.quadraticCurveTo(r * 0.25, -r * 0.32, 0, 0);
        oCtx.fill();

        oCtx.restore();
      }

      // Central glowing core
      const centerR = r * 0.24;
      const cGrad = oCtx.createRadialGradient(cx, cy, 0, cx, cy, centerR);
      cGrad.addColorStop(0, '#FFFFFF');
      cGrad.addColorStop(0.4, scheme.core);
      cGrad.addColorStop(1, scheme.inner);

      oCtx.fillStyle = cGrad;
      oCtx.beginPath();
      oCtx.arc(cx, cy, centerR, 0, Math.PI * 2);
      oCtx.fill();

      // Core pollen dots
      oCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let p = 0; p < 6; p++) {
        const ang = (p * Math.PI * 2) / 6;
        const pd = centerR * 0.55;
        oCtx.beginPath();
        oCtx.arc(cx + Math.cos(ang) * pd, cy + Math.sin(ang) * pd, 2.0, 0, Math.PI * 2);
        oCtx.fill();
      }

      return off;
    });
  }

  setPalette(key) {
    this.currentPaletteKey = key;
  }

  setFlowerSize(size) {
    this.baseFlowerSize = Math.max(16, Math.min(60, size));
  }

  setDensity(density) {
    this.minFlowerDistance = Math.max(14, 35 - density * 4.5);
  }

  setEraserRadius(r) {
    this.eraserRadius = Math.max(30, Math.min(150, r));
  }

  addPoint(x, y, onFlowerSpawn) {
    if (!this.lastFlowerPos) {
      this.lastFlowerPos = { x, y };
      this.spawnFlower(x, y, onFlowerSpawn);
      this.currentStroke = [{ x, y }];
      return;
    }

    const dx = x - this.lastFlowerPos.x;
    const dy = y - this.lastFlowerPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= this.minFlowerDistance) {
      const steps = Math.min(4, Math.floor(dist / this.minFlowerDistance));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ix = this.lastFlowerPos.x + dx * t;
        const iy = this.lastFlowerPos.y + dy * t;
        this.spawnFlower(ix, iy, onFlowerSpawn);
      }

      this.lastFlowerPos = { x, y };
      if (!this.currentStroke) this.currentStroke = [];
      this.currentStroke.push({ x, y });
    }
  }

  spawnFlower(x, y, onFlowerSpawn) {
    const size = this.baseFlowerSize * (0.85 + Math.random() * 0.35);
    const spriteIdx = Math.floor(Math.random() * (this.spriteVariants.length || 1));

    const flower = {
      x,
      y,
      size,
      currentScale: 0.05,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.006,
      bloomProgress: 0.0,
      bloomSpeed: 0.065,
      spriteIdx,
      phase: Math.random() * Math.PI * 2,
      swaySpeed: 0.002
    };

    this.flowers.push(flower);

    if (typeof onFlowerSpawn === 'function') {
      const xPct = Math.max(0, Math.min(1, x / this.canvas.width));
      onFlowerSpawn(xPct);
    }
  }

  endStroke() {
    this.lastFlowerPos = null;
    if (this.currentStroke && this.currentStroke.length > 1) {
      this.vines.push([...this.currentStroke]);
      if (this.vines.length > 40) {
        this.vines.shift();
      }
    }
    this.currentStroke = null;
  }

  eraseAt(ex, ey) {
    const r2 = this.eraserRadius * this.eraserRadius;
    const surviving = [];
    let erasedCount = 0;

    for (let i = 0; i < this.flowers.length; i++) {
      const f = this.flowers[i];
      const dx = f.x - ex;
      const dy = f.y - ey;
      if (dx * dx + dy * dy <= r2) {
        this.spawnDissolveParticles(f.x, f.y, f.size);
        erasedCount++;
      } else {
        surviving.push(f);
      }
    }

    this.flowers = surviving;
    return erasedCount;
  }

  spawnDissolveParticles(x, y, size) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.0;
      this.dissolveParticles.push({
        x: x + (Math.random() - 0.5) * size * 0.4,
        y: y + (Math.random() - 0.5) * size * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.6,
        radius: 2 + Math.random() * 2.5,
        color: Math.random() > 0.5 ? '#00E5FF' : '#7C4DFF',
        alpha: 0.9,
        decay: 0.04
      });
    }
  }

  /**
   * High-End Cinematic Botanical Burst & Scatter Animation
   * Creates 3D tumbling silk petals, sparkling stardust streamers, and dual chromatic shockwaves.
   */
  burstAndScatterAll(epicenter) {
    if (this.flowers.length === 0) return;

    const epicX = epicenter ? epicenter.x : this.canvas.width / 2;
    const epicY = epicenter ? epicenter.y : this.canvas.height / 2;

    // 1. Dual Chromatic Refraction Shockwaves
    this.shockwaves.push({
      x: epicX,
      y: epicY,
      radius: 12,
      maxRadius: Math.max(this.canvas.width, this.canvas.height) * 0.95,
      alpha: 1.0,
      color: '#00E5FF',
      secondaryColor: '#7C4DFF',
      width: 4.5
    });

    // 2. Transform every flower into elegant 3D tumbling petals + golden core embers
    for (let f of this.flowers) {
      const dx = f.x - epicX;
      const dy = f.y - epicY;
      const dist = Math.hypot(dx, dy) + 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const impulse = 3.5 + Math.random() * 5.5;

      // 6 to 8 Sculpted 3D Lotus Petals per blossom
      const numPetals = 7;
      for (let p = 0; p < numPetals; p++) {
        const pAng = (p / numPetals) * Math.PI * 2 + Math.random() * 0.4;
        const radialSpeed = 2.5 + Math.random() * 5.0;

        this.burstPetals.push({
          x: f.x,
          y: f.y,
          vx: nx * impulse + Math.cos(pAng) * radialSpeed,
          vy: ny * impulse + Math.sin(pAng) * radialSpeed - 2.8, // Initial upward lift
          colorStart: Math.random() > 0.4 ? '#00E5FF' : '#00B0FF',
          colorEnd: Math.random() > 0.5 ? '#7C4DFF' : '#E040FB',
          size: f.size * (0.35 + Math.random() * 0.25),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.12,
          rotX: Math.random() * Math.PI * 2,
          rotXSpeed: 0.04 + Math.random() * 0.08, // 3D pitch/flip rate
          swayAmp: 1.2 + Math.random() * 2.0,
          swayFreq: 0.003 + Math.random() * 0.003,
          phase: Math.random() * Math.PI * 2,
          alpha: 1.0,
          gravity: 0.065 + Math.random() * 0.04,
          friction: 0.982,
          decay: 0.008 + Math.random() * 0.005, // Floats poetically for ~2.5s
          frameCounter: 0
        });
      }

      // Golden core stamen disintegration (celestial fireflies)
      for (let s = 0; s < 5; s++) {
        const sAng = Math.random() * Math.PI * 2;
        const sSpeed = 1.8 + Math.random() * 4.5;
        this.dissolveParticles.push({
          x: f.x,
          y: f.y,
          vx: Math.cos(sAng) * sSpeed,
          vy: Math.sin(sAng) * sSpeed - 1.2,
          radius: 1.5 + Math.random() * 2.5,
          color: Math.random() > 0.4 ? '#FFE082' : '#FFFFFF',
          alpha: 1.0,
          decay: 0.02 + Math.random() * 0.015
        });
      }
    }

    this.flowers = [];
    this.vines = [];
    this.lastFlowerPos = null;
    this.currentStroke = null;
  }

  clearAll() {
    this.burstAndScatterAll({ x: this.canvas.width / 2, y: this.canvas.height / 2 });
  }

  /**
   * Main 60-120 FPS hardware-accelerated render loop
   */
  render() {
    const ctx = this.ctx;
    const now = performance.now();
    this.lastTime = now;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Render organic vines
    this.renderVines(ctx);

    // 2. Render all Celestial Lotus flowers using GPU sprite blitting
    for (let f of this.flowers) {
      this.drawCachedFlower(ctx, f, now);
    }

    // 3. Render 3D tumbling burst petals & stardust streamers
    this.renderBurstPetals(ctx, now);

    // 4. Render stardust pollen trails
    this.renderStardust(ctx);

    // 5. Render golden dissolve particles
    this.renderParticles(ctx);

    // 6. Render cinematic dual chromatic shockwaves
    this.renderShockwaves(ctx);
  }

  renderVines(ctx) {
    if (this.vines.length === 0 && (!this.currentStroke || this.currentStroke.length < 2)) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allVines = [...this.vines];
    if (this.currentStroke && this.currentStroke.length >= 2) {
      allVines.push(this.currentStroke);
    }

    for (let pts of allVines) {
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  drawCachedFlower(ctx, f, now) {
    if (f.bloomProgress < 1.0) {
      f.bloomProgress = Math.min(1.0, f.bloomProgress + f.bloomSpeed);
      const t = f.bloomProgress;
      f.currentScale = Math.sin((t * Math.PI) / 2) * (1.0 + Math.sin(t * Math.PI) * 0.15);
    } else {
      f.currentScale = 1.0;
    }

    f.rotation += f.rotationSpeed;
    const sway = Math.sin(now * f.swaySpeed + f.phase) * 0.05;

    const sprite = this.spriteVariants[f.spriteIdx] || this.spriteVariants[0];
    const drawSize = f.size * f.currentScale;

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation + sway);
    if (sprite) {
      ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    }
    ctx.restore();
  }

  /**
   * Renders 3D tumbling silk petals with aerodynamic air flutter and glowing gradients
   */
  renderBurstPetals(ctx, now) {
    const surviving = [];
    for (let p of this.burstPetals) {
      p.frameCounter++;

      // Aerodynamic physics update
      p.x += p.vx;
      p.y += p.vy;

      p.vx *= p.friction;
      p.vy = p.vy * p.friction + p.gravity;

      // Gentle horizontal air drift sway
      p.x += Math.sin(now * p.swayFreq + p.phase) * p.swayAmp;

      // 3D rotations
      p.rotation += p.rotSpeed;
      p.rotX += p.rotXSpeed;

      // Opacity decay
      p.alpha -= p.decay;

      // Spawn stardust sparkling trail every 2 frames
      if (p.frameCounter % 2 === 0 && p.alpha > 0.25) {
        this.stardustParticles.push({
          x: p.x + (Math.random() - 0.5) * 6,
          y: p.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -0.4 - Math.random() * 0.6,
          radius: 1.0 + Math.random() * 1.6,
          color: Math.random() > 0.5 ? '#00E5FF' : '#FFE082',
          alpha: p.alpha * 0.85,
          decay: 0.035
        });
      }

      if (p.alpha > 0.015 && p.y < this.canvas.height + 60 && p.x > -60 && p.x < this.canvas.width + 60) {
        surviving.push(p);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // 3D perspective pitch flip
        const flip = Math.sin(p.rotX);
        ctx.scale(1.0, Math.max(0.12, Math.abs(flip)));

        ctx.globalAlpha = p.alpha;

        // Gradient petal fill
        const pr = p.size;
        const grad = ctx.createLinearGradient(0, -pr, 0, pr);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.4, p.colorStart);
        grad.addColorStop(1, p.colorEnd);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -pr);
        ctx.bezierCurveTo(pr * 0.6, -pr * 0.6, pr * 0.65, pr * 0.4, 0, pr);
        ctx.bezierCurveTo(-pr * 0.65, pr * 0.4, -pr * 0.6, -pr * 0.6, 0, -pr);
        ctx.fill();

        // Delicate luminous rim
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.restore();
      }
    }
    this.burstPetals = surviving;
  }

  renderStardust(ctx) {
    const surviving = [];
    for (let s of this.stardustParticles) {
      s.x += s.vx;
      s.y += s.vy;
      s.alpha -= s.decay;

      if (s.alpha > 0.01) {
        surviving.push(s);
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    this.stardustParticles = surviving;
  }

  renderParticles(ctx) {
    const surviving = [];
    for (let pt of this.dissolveParticles) {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= 0.95;
      pt.vy *= 0.95;
      pt.alpha -= pt.decay;

      if (pt.alpha > 0.015) {
        surviving.push(pt);
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    this.dissolveParticles = surviving;
  }

  /**
   * Renders cinematic dual chromatic shockwave rings
   */
  renderShockwaves(ctx) {
    const surviving = [];
    for (let sw of this.shockwaves) {
      sw.radius += 26;
      sw.alpha -= 0.024;

      if (sw.alpha > 0.01 && sw.radius < sw.maxRadius) {
        surviving.push(sw);

        ctx.save();
        // Inner luminous cyan ring
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 4.0 * sw.alpha;
        ctx.globalAlpha = sw.alpha;
        ctx.stroke();

        // Outer soft violet refraction ring
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, Math.max(1, sw.radius - 12), 0, Math.PI * 2);
        ctx.strokeStyle = sw.secondaryColor;
        ctx.lineWidth = 2.5 * sw.alpha;
        ctx.globalAlpha = sw.alpha * 0.7;
        ctx.stroke();

        ctx.restore();
      }
    }
    this.shockwaves = surviving;
  }
}

if (typeof window !== 'undefined') {
  window.FlowerEngine = FlowerEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlowerEngine;
}
