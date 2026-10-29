/**
 * Flora Air Canvas - Advanced Gesture Recognizer
 * 
 * Mathematically analyzes 21 MediaPipe hand landmarks in an invariant palm
 * coordinate frame. Accurately and responsively classifies the 4 distinct user gestures:
 * 
 * 1. IDLE / STANDBY (Image 1):
 *    Hand upright facing camera, all fingers extended and held CLOSE TOGETHER (adducted).
 *    -> Does nothing on canvas, tracks hand cleanly.
 * 
 * 2. DRAW FLORA (Image 2):
 *    Index finger pointing up, other fingers (middle, ring, pinky) tightly curled in fist.
 *    -> Paints continuous 3D blooming botanical flowers along the index tip.
 * 
 * 3. LOCAL ERASER (Image 3):
 *    Closed fist (fingers curled into fist, side/angled view).
 *    -> Erases flowers locally under the fist with soft dissolve particle puffs.
 * 
 * 4. BURST SCATTER CLEAR (Image 4):
 *    Open hand with all 5 fingers spread WIDE APART (abducted).
 *    -> Triggers full-screen cosmic burst scattering all flowers into 3D fluttering petals.
 */

class GestureRecognizer {
  constructor() {
    this.currentGesture = 'NONE'; // 'NONE' | 'IDLE' | 'DRAW' | 'ERASE' | 'BURST_CLEAR'
    this.gestureConfidence = 0.0;

    // Smoothed interaction coordinates
    this.drawPoint = { x: 0, y: 0 };
    this.eraseCenter = { x: 0, y: 0 };
    this.palmCenter = { x: 0, y: 0 };
    this.smoothingAlpha = 0.65; // High responsiveness

    // Telemetry & metrics for HUD
    this.metrics = {
      handScale: 1.0,
      fingerStates: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      divergenceRatio: 1.0,
      spreadRatio: 1.0,
      burstCharge: 0.0,
      cooldownRemaining: 0
    };

    // Fast responsive 3 frames (~90ms hold) for instantaneous burst activation
    this.burstHoldFrames = 0;
    this.burstRequiredFrames = 3;
    this.burstCooldown = 0; // Cooldown frames

    this.onBurstTrigger = null;

    // Locked constant setting: 1.2x sensitivity (from user spec)
    this.sensitivity = 1.2;

  }

  setSensitivity(val) {
    this.sensitivity = Math.max(0.6, Math.min(1.5, val));
  }

  /**
   * Processes 21 MediaPipe normalized landmarks with pixel-perfect viewport mapping
   */
  process(landmarks, canvasWidth, canvasHeight, videoWidth, videoHeight, mirrored = true) {
    if (!landmarks || landmarks.length < 21) {
      this.currentGesture = 'NONE';
      this.gestureConfidence = 0;
      this.metrics.burstCharge = 0;
      return null;
    }

    // Calculate aspect-ratio correction matching CSS object-fit: cover
    const vW = videoWidth || 1280;
    const vH = videoHeight || 720;
    const videoAspect = vW / vH;
    const canvasAspect = canvasWidth / canvasHeight;

    let renderW, renderH, offsetX, offsetY;
    if (canvasAspect > videoAspect) {
      renderW = canvasWidth;
      renderH = canvasWidth / videoAspect;
      offsetX = 0;
      offsetY = (canvasHeight - renderH) / 2;
    } else {
      renderH = canvasHeight;
      renderW = canvasHeight * videoAspect;
      offsetX = (canvasWidth - renderW) / 2;
      offsetY = 0;
    }

    // Map landmarks to exact canvas screen pixels
    const pts = landmarks.map(lm => {
      const normX = mirrored ? (1.0 - lm.x) : lm.x;
      return {
        x: offsetX + normX * renderW,
        y: offsetY + lm.y * renderH,
        z: lm.z * renderW,
        rawX: lm.x,
        rawY: lm.y,
        rawZ: lm.z
      };
    });

    // 1. Establish Invariant Palm Coordinate Frame
    // Vector from Wrist (0) to Middle MCP (9) represents the longitudinal palm axis
    const wrist = pts[0];
    const indexMcp = pts[5];
    const middleMcp = pts[9];
    const ringMcp = pts[13];
    const pinkyMcp = pts[17];

    const vPalmX = middleMcp.x - wrist.x;
    const vPalmY = middleMcp.y - wrist.y;
    const palmLength = Math.max(15, Math.hypot(vPalmX, vPalmY));

    // Unit vectors for palm orientation
    const uY = { x: vPalmX / palmLength, y: vPalmY / palmLength }; // Longitudinal (wrist -> knuckles)
    const uX = { x: -uY.y, y: uY.x }; // Transverse (across palm)

    const palmWidth = Math.max(15, this.dist(indexMcp, pinkyMcp));
    const handScale = (palmLength + palmWidth * 1.1) / 2;
    this.metrics.handScale = handScale;

    // Palm centroid
    const rawPalmX = (wrist.x + indexMcp.x + middleMcp.x + pinkyMcp.x) / 4;
    const rawPalmY = (wrist.y + indexMcp.y + middleMcp.y + pinkyMcp.y) / 4;
    this.palmCenter.x = this.lerp(this.palmCenter.x, rawPalmX, 0.4);
    this.palmCenter.y = this.lerp(this.palmCenter.y, rawPalmY, 0.4);

    // Helper: Project point into palm longitudinal axis (relative Y)
    const relY = (p) => (p.x - wrist.x) * uY.x + (p.y - wrist.y) * uY.y;

    // 2. Anatomical Finger Extension & Curl Detection
    // Index (5, 6, 7, 8)
    const indexTip = pts[8], indexDip = pts[7], indexPip = pts[6];
    const indexMcpDist = this.dist(indexTip, indexMcp);
    const isIndexExtended = (relY(indexTip) > relY(indexPip) + handScale * 0.12) && (indexMcpDist > handScale * 0.65);
    const isIndexCurled = (relY(indexTip) < relY(indexPip) + handScale * 0.08) || (indexMcpDist < handScale * 0.58);

    // Middle (9, 10, 11, 12)
    const middleTip = pts[12], middleDip = pts[11], middlePip = pts[10];
    const middleMcpDist = this.dist(middleTip, middleMcp);
    const isMiddleExtended = (relY(middleTip) > relY(middlePip) + handScale * 0.12) && (middleMcpDist > handScale * 0.65);
    const isMiddleCurled = (relY(middleTip) < relY(middlePip) + handScale * 0.08) || (middleMcpDist < handScale * 0.58);

    // Ring (13, 14, 15, 16)
    const ringTip = pts[16], ringDip = pts[15], ringPip = pts[14];
    const ringMcpDist = this.dist(ringTip, ringMcp);
    const isRingExtended = (relY(ringTip) > relY(ringPip) + handScale * 0.10) && (ringMcpDist > handScale * 0.60);
    const isRingCurled = (relY(ringTip) < relY(ringPip) + handScale * 0.08) || (ringMcpDist < handScale * 0.55);

    // Pinky (17, 18, 19, 20)
    const pinkyTip = pts[20], pinkyDip = pts[19], pinkyPip = pts[18];
    const pinkyMcpDist = this.dist(pinkyTip, pinkyMcp);
    const isPinkyExtended = (relY(pinkyTip) > relY(pinkyPip) + handScale * 0.10) && (pinkyMcpDist > handScale * 0.55);
    const isPinkyCurled = (relY(pinkyTip) < relY(pinkyPip) + handScale * 0.08) || (pinkyMcpDist < handScale * 0.52);

    // Thumb (1, 2, 3, 4)
    const thumbTip = pts[4];
    const thumbDistToPinky = this.dist(thumbTip, pinkyMcp);
    const isThumbExtended = thumbDistToPinky > handScale * 0.75;

    this.metrics.fingerStates = {
      thumb: isThumbExtended,
      index: isIndexExtended,
      middle: isMiddleExtended,
      ring: isRingExtended,
      pinky: isPinkyExtended
    };

    // 3. Finger Spread & Abduction Metrics
    const tipSpreadSum = this.dist(indexTip, middleTip) + this.dist(middleTip, ringTip) + this.dist(ringTip, pinkyTip);
    const baseSpreadSum = Math.max(10, this.dist(indexMcp, middleMcp) + this.dist(middleMcp, ringMcp) + this.dist(ringMcp, pinkyMcp));
    const divergenceRatio = tipSpreadSum / baseSpreadSum;
    const thumbSpread = this.dist(thumbTip, indexTip) / handScale;

    this.metrics.divergenceRatio = divergenceRatio;
    this.metrics.spreadRatio = tipSpreadSum / handScale;

    // Decrement burst cooldown
    if (this.burstCooldown > 0) {
      this.burstCooldown--;
      this.metrics.cooldownRemaining = this.burstCooldown;
    }

    // 4. Gesture Classification Logic
    let classified = 'NONE';
    let confidence = 0.85;

    // --- GESTURE 2: DRAW FLORA (Image 2) ---
    // Index extended pointing up, middle & ring curled into palm
    // Index tip is distinctly more extended than middle tip along palm axis
    const isPointingUp = isIndexExtended && (relY(indexTip) > relY(middleTip) + handScale * 0.2);
    const isOtherFingersCurled = isMiddleCurled && isRingCurled;

    if (isPointingUp && isOtherFingersCurled) {
      classified = 'DRAW';
      confidence = 0.96;

      // Smooth index tip for silky fluid flower trails
      const rawX = indexTip.x;
      const rawY = indexTip.y;
      if (this.drawPoint.x === 0 && this.drawPoint.y === 0) {
        this.drawPoint.x = rawX;
        this.drawPoint.y = rawY;
      } else {
        this.drawPoint.x = this.lerp(this.drawPoint.x, rawX, this.smoothingAlpha);
        this.drawPoint.y = this.lerp(this.drawPoint.y, rawY, this.smoothingAlpha);
      }
    }
    // --- GESTURE 3: LOCAL ERASER / FIST (Image 3) ---
    // All fingers curled in a fist (or side-view fist). No finger extended.
    else {
      const curledCount = [isIndexCurled, isMiddleCurled, isRingCurled, isPinkyCurled].filter(Boolean).length;
      const maxFingertipDistFromWrist = Math.max(
        this.dist(indexTip, wrist),
        this.dist(middleTip, wrist),
        this.dist(ringTip, wrist),
        this.dist(pinkyTip, wrist)
      );

      // In a fist, all fingertips are compact and close to the palm
      const isFistCompact = maxFingertipDistFromWrist < handScale * 1.35;
      const isFistCurled = curledCount >= 3 && !isIndexExtended && !isMiddleExtended;

      if (isFistCurled && isFistCompact) {
        classified = 'ERASE';
        confidence = 0.94;

        // Fist centroid
        const rawEraseX = (wrist.x + indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 5;
        const rawEraseY = (wrist.y + indexMcp.y + middleMcp.y + ringMcp.y + pinkyMcp.y) / 5;

        if (this.eraseCenter.x === 0 && this.eraseCenter.y === 0) {
          this.eraseCenter.x = rawEraseX;
          this.eraseCenter.y = rawEraseY;
        } else {
          this.eraseCenter.x = this.lerp(this.eraseCenter.x, rawEraseX, this.smoothingAlpha);
          this.eraseCenter.y = this.lerp(this.eraseCenter.y, rawEraseY, this.smoothingAlpha);
        }
      }
      // --- GESTURES 1 & 4: Open Palm ---
      else if (isIndexExtended && isMiddleExtended && isRingExtended) {
        // Individual normalized tip gaps
        const gapIndexMiddle = this.dist(indexTip, middleTip) / handScale;
        const gapMiddleRing = this.dist(middleTip, ringTip) / handScale;
        const gapRingPinky = this.dist(ringTip, pinkyTip) / handScale;
        const avgTipGap = (gapIndexMiddle + gapMiddleRing + gapRingPinky) / 3;

        // Condition A: Fingers aside / apart from each other -> BURST SCATTER
        // Triggers naturally when fingers separate/fan out
        const isFingersAside = (divergenceRatio >= 1.28 || avgTipGap >= 0.26 || thumbSpread > 0.42);

        // Condition B: Fingers closed to each other (adducted, touching or parallel) -> IDLE / STANDBY
        const isFingersClosedTogether = (divergenceRatio < 1.24 && avgTipGap < 0.24);

        if (isFingersAside && !isFingersClosedTogether) {
          classified = 'BURST_CLEAR';
          confidence = Math.min(0.99, (divergenceRatio / 1.8) * 0.95);
        } else {
          // Fingers closed to each other: Standby / Idle
          classified = 'IDLE';
          confidence = 0.96;
        }
      }

      // Default: partial hand / transition pose
      else {
        const extCount = [isIndexExtended, isMiddleExtended, isRingExtended, isPinkyExtended].filter(Boolean).length;
        if (extCount >= 2) {
          classified = 'IDLE';
          confidence = 0.65;
        } else {
          classified = 'NONE';
          confidence = 0.4;
        }
      }
    }

    // 5. Burst Clear Trigger Mechanics (Swift 5-frame confirmation)
    if (classified === 'BURST_CLEAR') {
      if (this.burstCooldown <= 0) {
        this.burstHoldFrames++;
        const charge = Math.min(1.0, this.burstHoldFrames / this.burstRequiredFrames);
        this.metrics.burstCharge = charge;

        if (charge >= 1.0) {
          // Fire the burst event!
          if (typeof this.onBurstTrigger === 'function') {
            this.onBurstTrigger({
              epicenter: { x: this.palmCenter.x, y: this.palmCenter.y },
              handScale: this.metrics.handScale
            });
          }
          this.burstCooldown = 65; // ~2 seconds cooldown
          this.burstHoldFrames = 0;
          this.metrics.burstCharge = 0;
        }
      } else {
        this.metrics.burstCharge = 0;
      }
    } else {
      // Fast decay of charge if gesture released
      this.burstHoldFrames = Math.max(0, this.burstHoldFrames - 2);
      this.metrics.burstCharge = Math.min(1.0, this.burstHoldFrames / this.burstRequiredFrames);
    }

    this.currentGesture = classified;
    this.gestureConfidence = confidence;

    return {
      gesture: this.currentGesture,
      confidence: this.gestureConfidence,
      drawPoint: { ...this.drawPoint },
      eraseCenter: { ...this.eraseCenter },
      palmCenter: { ...this.palmCenter },
      metrics: { ...this.metrics },
      landmarks: pts
    };
  }

  dist(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }
}

if (typeof window !== 'undefined') {
  window.GestureRecognizer = GestureRecognizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GestureRecognizer;
}
