/**
 * Flora Air Canvas - Procedural Spatial Audio Engine
 * Uses Web Audio API to create responsive, soothing organic soundscapes
 * for drawing, erasing, and canvas burst events without external asset dependencies.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastBloomTime = 0;
    this.bloomNoteIndex = 0;
    this.eraseNoiseNode = null;
    this.eraseGainNode = null;
    this.isErasingAudioActive = false;

    // Pentatonic scale frequencies in Hz (C major / A minor pentatonic: C5 to A6)
    this.scale = [
      523.25, 587.33, 659.25, 783.99, 880.00,
      1046.50, 1174.66, 1318.51, 1567.98, 1760.00
    ];
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.init();
    } else {
      this.stopEraseSound();
    }
    return this.enabled;
  }

  /**
   * Delicate crystal bell / chime when a new flower blossoms
   */
  playBloom(xPercent = 0.5) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (now - this.lastBloomTime < 0.14) return; // Smooth throttled audio playback
    this.lastBloomTime = now;


    // Map horizontal position to pentatonic note index with gentle cycling
    const baseIndex = Math.floor(xPercent * (this.scale.length - 3));
    const noteIdx = (baseIndex + (this.bloomNoteIndex++ % 3)) % this.scale.length;
    const freq = this.scale[noteIdx];

    // Primary bell oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Soft overtone oscillator
    const overtone = this.ctx.createOscillator();
    const overtoneGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(freq * 2.01, now);

    // Envelope
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    overtoneGain.gain.setValueAtTime(0.001, now);
    overtoneGain.gain.linearRampToValueAtTime(0.04, now + 0.01);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    // Stereo panning based on X position
    let panner = null;
    if (this.ctx.createStereoPanner) {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime((xPercent - 0.5) * 1.6, now);
      gain.connect(panner);
      overtoneGain.connect(panner);
      panner.connect(this.ctx.destination);
    } else {
      gain.connect(this.ctx.destination);
      overtoneGain.connect(this.ctx.destination);
    }

    osc.connect(gain);
    overtone.connect(overtoneGain);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.5);
    overtone.stop(now + 0.3);
  }

  /**
   * Whispering wind / gentle vacuum swoosh during local fist erasing
   */
  startEraseSound() {
    if (!this.enabled || this.isErasingAudioActive) return;
    this.init();
    if (!this.ctx) return;

    try {
      this.isErasingAudioActive = true;
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.eraseNoiseNode = this.ctx.createBufferSource();
      this.eraseNoiseNode.buffer = buffer;
      this.eraseNoiseNode.loop = true;

      // Soft bandpass filter to sound like gentle breeze / eraser sweep
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.eraseGainNode = this.ctx.createGain();
      this.eraseGainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.eraseGainNode.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 0.1);

      this.eraseNoiseNode.connect(filter);
      filter.connect(this.eraseGainNode);
      this.eraseGainNode.connect(this.ctx.destination);

      this.eraseNoiseNode.start();
    } catch (e) {
      console.warn('Audio erase start err:', e);
    }
  }

  stopEraseSound() {
    if (!this.isErasingAudioActive || !this.ctx || !this.eraseGainNode) {
      this.isErasingAudioActive = false;
      return;
    }
    try {
      const now = this.ctx.currentTime;
      this.eraseGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.15);
      setTimeout(() => {
        if (this.eraseNoiseNode) {
          try { this.eraseNoiseNode.stop(); } catch (_) {}
          this.eraseNoiseNode.disconnect();
          this.eraseNoiseNode = null;
        }
        this.isErasingAudioActive = false;
      }, 160);
    } catch (e) {
      this.isErasingAudioActive = false;
    }
  }

  /**
   * Crystalline celestial harp cascade & ethereal atmospheric burst
   */
  playBurstEffect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Upward ascending celestial harp chord (pentatonic crystal cascade)
    const chord = [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98, 2093.00];
    chord.forEach((freq, idx) => {
      const delay = idx * 0.035;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.linearRampToValueAtTime(0.12 - idx * 0.008, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 1.3);
    });

    // Atmospheric airy shimmer whoosh
    try {
      const duration = 1.4;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.45));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(350, now + duration);
      filter.Q.setValueAtTime(2.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
    } catch (_) {}
  }

}

if (typeof window !== 'undefined') {
  window.SoundEngine = SoundEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundEngine;
}

