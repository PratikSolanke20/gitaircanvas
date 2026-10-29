/**
 * Air Canvas v2.4 - Cyber Hacker Terminal Controller
 * Developer: Pratik Solanke
 * 
 * Minimal, distraction-free spatial vision interface.
 * Locked Configuration:
 * - Floral Archetype: Celestial Lotus (lotus)
 * - Size: 40px
 * - Density: Garland (3)
 * - Eraser: 65px
 * - Sensitivity: 1.2x
 */

class FloraAirCanvasApp {
  constructor() {
    this.video = document.getElementById('webcam-video');
    this.canvas = document.getElementById('draw-canvas');
    this.overlayCanvas = document.getElementById('overlay-canvas');
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    // Core engines
    this.soundEngine = new SoundEngine();
    this.gestureRecognizer = new GestureRecognizer();
    this.flowerEngine = new FlowerEngine(this.canvas);

    // Camera & Vision pipeline
    this.hands = null;
    this.mediaStream = null;
    this.isCameraRunning = false;
    this.isProcessingFrame = false;
    this.mirrored = true;

    // History for Undo
    this.historyStack = [];
    this.wasErasing = false;

    // Connect burst event callback
    this.gestureRecognizer.onBurstTrigger = (data) => {
      this.triggerBurstClear(data.epicenter);
    };

    this.init();
  }

  async init() {
    this.setupResizeHandler();
    await this.initVisionAndCamera();
    this.startRenderLoop();
  }

  setupResizeHandler() {
    const resize = () => {
      const container = document.getElementById('canvas-container');
      const w = container ? container.clientWidth : window.innerWidth;
      const h = container ? container.clientHeight : window.innerHeight;

      if (this.canvas.width !== w || this.canvas.height !== h) {
        const oldFlowers = this.flowerEngine ? [...this.flowerEngine.flowers] : [];
        this.canvas.width = w;
        this.canvas.height = h;
        this.overlayCanvas.width = w;
        this.overlayCanvas.height = h;
        if (this.flowerEngine) {
          this.flowerEngine.flowers = oldFlowers;
        }
      }
    };

    window.addEventListener('resize', resize);
    resize();
  }

  /**
   * Initializes Vision neural network and starts webcam stream
   */
  async initVisionAndCamera() {
    const loadingBadge = document.getElementById('loading-indicator');
    const statusText = document.getElementById('terminal-status-text');

    try {
      if (statusText) statusText.textContent = 'BOOT // LOADING_VISION_SYSTEM...';

      if (typeof Hands === 'undefined') {
        await this.waitForGlobal('Hands', 8000);
      }

      this.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.60,
        minTrackingConfidence: 0.60
      });

      this.hands.onResults((results) => this.onHandResults(results));

      if (statusText) statusText.textContent = 'CORE // COMPILING_WEIGHTS...';
      if (typeof this.hands.initialize === 'function') {
        await this.hands.initialize();
      }

      if (statusText) statusText.textContent = 'OPTICAL // ENGAGING_CAMERA_SENSOR...';
      await this.startCamera();

      this.startVisionProcessingLoop();

      if (loadingBadge) loadingBadge.style.display = 'none';
      this.updateGestureStatusUI('NONE', 0);
    } catch (err) {
      console.error('Vision startup error:', err);
      if (loadingBadge) {
        loadingBadge.innerHTML = `
          <div style="text-align: center; max-width: 360px;">
            <div style="font-size: 14px; font-weight: 800; color: #FF4081;">⚠️ [CAMERA ACCESS NEEDED]</div>
            <p style="margin: 10px 0; font-family: monospace; font-size: 12px; color: #E2E8F0; line-height: 1.4;">
              ${err.message || 'Please permit camera access in your browser to engage the air canvas.'}
            </p>
            <button onclick="location.reload()" style="margin-top: 8px; background: rgba(0, 229, 255, 0.2); border: 1px solid #00E5FF; color: #00E5FF; padding: 8px 16px; border-radius: 4px; font-family: inherit; font-weight: 700; cursor: pointer;">
              [ RETRY_CAMERA ]
            </button>
          </div>
        `;
      }
    }
  }

  waitForGlobal(name, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (window[name]) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error(`Module ${name} load timeout`));
        }
      }, 50);
    });
  }

  async startCamera(deviceId = null) {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
    }

    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        deviceId: deviceId ? { exact: deviceId } : undefined
      },
      audio: false
    };

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.mediaStream;

      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(resolve).catch(resolve);
        };
      });

      this.isCameraRunning = true;
    } catch (e) {
      console.error('getUserMedia error:', e);
      throw e;
    }
  }

  startVisionProcessingLoop() {
    const loop = async () => {
      if (this.isCameraRunning && this.video && this.video.readyState >= 2 && !this.isProcessingFrame) {
        this.isProcessingFrame = true;
        try {
          if (this.hands) {
            await this.hands.send({ image: this.video });
          }
        } catch (_) {
        } finally {
          this.isProcessingFrame = false;
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  onHandResults(results) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const vW = this.video.videoWidth || 1280;
    const vH = this.video.videoHeight || 720;

    this.overlayCtx.clearRect(0, 0, w, h);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const gestureData = this.gestureRecognizer.process(landmarks, w, h, vW, vH, this.mirrored);

      if (gestureData) {
        this.handleGestureAction(gestureData);
        this.renderOverlayVisuals(gestureData);
      }
    } else {
      this.gestureRecognizer.process(null, w, h, vW, vH, this.mirrored);
      this.updateGestureStatusUI('NONE', 0);
      this.flowerEngine.endStroke();
      if (this.wasErasing) {
        this.soundEngine.stopEraseSound();
        this.wasErasing = false;
      }
    }
  }

  handleGestureAction(data) {
    const { gesture, confidence, drawPoint, eraseCenter } = data;
    this.updateGestureStatusUI(gesture, confidence);

    switch (gesture) {
      case 'DRAW':
        if (this.wasErasing) {
          this.soundEngine.stopEraseSound();
          this.wasErasing = false;
        }
        if (!this.flowerEngine.currentStroke) {
          this.saveHistoryState();
        }
        this.flowerEngine.addPoint(drawPoint.x, drawPoint.y, (xPct) => {
          this.soundEngine.playBloom(xPct);
        });
        break;

      case 'ERASE':
        this.flowerEngine.endStroke();
        if (!this.wasErasing) {
          this.soundEngine.startEraseSound();
          this.wasErasing = true;
          this.saveHistoryState();
        }
        this.flowerEngine.eraseAt(eraseCenter.x, eraseCenter.y);
        break;

      case 'BURST_CLEAR':
        this.flowerEngine.endStroke();
        if (this.wasErasing) {
          this.soundEngine.stopEraseSound();
          this.wasErasing = false;
        }
        break;

      case 'IDLE':
      case 'NONE':
      default:
        this.flowerEngine.endStroke();
        if (this.wasErasing) {
          this.soundEngine.stopEraseSound();
          this.wasErasing = false;
        }
        break;
    }
  }

  triggerBurstClear(epicenter) {
    this.saveHistoryState();
    this.flowerEngine.burstAndScatterAll(epicenter);
    this.soundEngine.playBurstEffect();

    const banner = document.getElementById('burst-banner');
    if (banner) {
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 1800);
    }
  }

  /**
   * Cyber stylus & reticle HUD overlays
   */
  renderOverlayVisuals(data) {
    const ctx = this.overlayCtx;
    const { gesture, drawPoint, eraseCenter, palmCenter, metrics, landmarks } = data;

    // 1. Sleek Cyber Skeleton Tracking Nodes
    if (landmarks) {
      ctx.save();
      const tipIndices = [4, 8, 12, 16, 20];
      for (let idx of tipIndices) {
        const p = landmarks[idx];
        ctx.beginPath();
        ctx.arc(p.x, p.y, idx === 8 ? 5.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = idx === 8 ? '#00E5FF' : '#00FF88';
        ctx.shadowColor = idx === 8 ? '#00E5FF' : '#00FF88';
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. DRAW Mode: High-Tech Cyber Stylus Reticle
    if (gesture === 'DRAW') {
      ctx.save();
      const r = 16 + Math.sin(performance.now() * 0.012) * 3;

      // Cyan neon targeting ring
      ctx.beginPath();
      ctx.arc(drawPoint.x, drawPoint.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00E5FF';
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Sharp central stylus dot
      ctx.beginPath();
      ctx.arc(drawPoint.x, drawPoint.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Crosshair ticks
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 1.5;
      [-1, 1].forEach(dir => {
        ctx.beginPath();
        ctx.moveTo(drawPoint.x + dir * (r - 2), drawPoint.y);
        ctx.lineTo(drawPoint.x + dir * (r + 6), drawPoint.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(drawPoint.x, drawPoint.y + dir * (r - 2));
        ctx.lineTo(drawPoint.x, drawPoint.y + dir * (r + 6));
        ctx.stroke();
      });

      ctx.restore();
    }

    // 3. ERASE Mode: Rotating purge vortex around fist
    if (gesture === 'ERASE') {
      ctx.save();
      const r = this.flowerEngine.eraserRadius;
      const angle = (performance.now() * 0.004) % (Math.PI * 2);

      // Neon purple dashed boundary
      ctx.beginPath();
      ctx.arc(eraseCenter.x, eraseCenter.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#7C4DFF';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -angle * 25;
      ctx.shadowColor = '#7C4DFF';
      ctx.shadowBlur = 14;
      ctx.stroke();

      // Translucent inner vortex
      ctx.beginPath();
      ctx.arc(eraseCenter.x, eraseCenter.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(124, 77, 255, 0.12)';
      ctx.fill();

      // Label
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#7C4DFF';
      ctx.textAlign = 'center';
      ctx.fillText('[PURGE_VORTEX]', eraseCenter.x, eraseCenter.y - r - 8);

      ctx.restore();
    }

    // 4. BURST Mode: Solar charging ring
    if (metrics.burstCharge > 0) {
      ctx.save();
      const chargeRadius = metrics.handScale * 0.7;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * metrics.burstCharge);

      ctx.beginPath();
      ctx.arc(palmCenter.x, palmCenter.y, chargeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(palmCenter.x, palmCenter.y, chargeRadius, startAngle, endAngle);
      ctx.strokeStyle = '#00FF88';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#00FF88';
      ctx.shadowBlur = 15;
      ctx.stroke();

      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#00FF88';
      ctx.textAlign = 'center';
      ctx.fillText(`BURST_${Math.round(metrics.burstCharge * 100)}%`, palmCenter.x, palmCenter.y);

      ctx.restore();
    }
  }

  /**
   * Updates only the top central hand recognition status badge
   */
  updateGestureStatusUI(gesture, confidence) {
    const badge = document.getElementById('terminal-status');
    const text = document.getElementById('status-text');
    if (!badge || !text) return;

    badge.className = `gesture-status-badge state-${gesture.toLowerCase()}`;
    switch (gesture) {
      case 'DRAW':
        text.textContent = `● [ DRAWING FLORA ]`;
        break;
      case 'ERASE':
        text.textContent = `● [ PURGE / ERASE ]`;
        break;
      case 'BURST_CLEAR':
        text.textContent = `● [ BURST SCATTER ]`;
        break;
      case 'IDLE':
        text.textContent = `● [ STANDBY // READY ]`;
        break;
      case 'NONE':
      default:
        text.textContent = `◌ [ SEARCHING_FOR_HAND... ]`;
        break;
    }
  }

  startRenderLoop() {
    const loop = () => {
      this.flowerEngine.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  saveHistoryState() {
    if (this.historyStack.length > 20) {
      this.historyStack.shift();
    }
    this.historyStack.push({
      flowers: JSON.parse(JSON.stringify(this.flowerEngine.flowers)),
      vines: JSON.parse(JSON.stringify(this.flowerEngine.vines))
    });
  }

  undo() {
    if (this.historyStack.length === 0) return;
    const lastState = this.historyStack.pop();
    this.flowerEngine.flowers = lastState.flowers;
    this.flowerEngine.vines = lastState.vines;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new FloraAirCanvasApp();
});
