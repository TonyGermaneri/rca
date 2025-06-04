<template>
  <canvas ref="canvas" class="unselectable" />
</template>
<script>
  import init, { LifeChannel, Universe } from '@ca/ca';
  import glSetup from './glSetup.js';
  import CAShader from './caShader.js';
  export default {
    data () {
      return {
        lastTime: performance.now(),
        lastFpsTime: performance.now(),
        tickInterval: 1000 / 60,
        animationFrameId: 0,
        frameCount: 0,
        fps: 0,
        bpm: 0,
        syncToMidi: false,
        rca: null,
        canvas: null,
        universe: null,
        buffer: null,
        drawBuffer: null,
        caShader: null,
        useShader: false,
        mouse: { x: 0, y: 0 },
        paused: false,
        devicePixelRatio: 1,
        pixelScale: 1,
        rule: 770,
        decayStep: 1,
        recoveryStep: 60,
        satRecoveryFactor: 0.8,
        satDecayFactor: 0.6,
        lumDecayFactor: 0.95,
        lifeDecayFactor: 0.95,
        satGhostFactor: 0.9,
        hueDriftStrength: 0.01,
        hueLerpFactor: 0.1,
        useAlpha: true,
        useRGB: false,
        lifeChannel: LifeChannel.Alpha,
        parameterKeys: [
          'rule',
          'decayStep',
          'recoveryStep',
          'satRecoveryFactor',
          'satDecayFactor',
          'lumDecayFactor',
          'lifeDecayFactor',
          'satGhostFactor',
          'hueDriftStrength',
          'hueLerpFactor',
          'lifeChannel',
          'pixelScale',
          'useAlpha',
          'useRGB',
          'useShader',
          'tickInterval',
        ],
      }
    },
    computed: {
      width () {
        return Math.floor(innerWidth * this.pixelScale);
      },
      height () {
        return Math.floor(innerHeight * this.pixelScale);
      },
      parameters () {
        return [
          this.rule,
          this.decayStep,
          this.recoveryStep,
          this.satRecoveryFactor,
          this.satDecayFactor,
          this.lumDecayFactor,
          this.lifeDecayFactor,
          this.satGhostFactor,
          this.hueDriftStrength,
          this.hueLerpFactor,
          this.lifeChannel,
          this.useRGB,
          this.useAlpha,
          this.useShader,
          this.tickInterval,
          this.syncToMidi,
        ]
      },
    },
    watch: {
      pixelScale () {
        this.resize();
      },
      parameters () {
        this.setParameters();
      },
      useShader (newVal) {
        if (newVal && this.caShader) {
          // Switching to shader mode - sync state from CPU to shader
          this.syncCpuToShader();
          this.caShader.show();
        } else if (this.caShader) {
          // Switching to CPU mode
          this.caShader.hide();
        }
      },
    },
    async mounted () {
      this.rca = await init();
      this.canvas = this.$refs.canvas;
      this.universe = new Universe(this.width, this.height);
      emit('ca:init', this);
      listen('resize', this.resize);
      listen('mousemove', this.mousemove);
      listen('ca:set-parameters', this.setParameters);
      listen('ca:draw-stamp', this.drawStamp)
      listen('ca:clear', this.clear);
      listen('ca:pause', this.pause);
      listen('ca:step', this.step);
      listen('ca:noise', this.noise);
      listen('ca:set-tick-interval', this.setTickInterval);
      listen('ca:load-buffer', this.setBuffer);
      this.setCanvasSize();
      this.drawBuffer = glSetup(this.canvas);

      // Initialize shader version (creates its own canvas)
      try {
        this.caShader = new CAShader(this.canvas);
        this.caShader.resize(this.width, this.height);
        console.log('WebGL2 shader initialized successfully');
        this.useShader = true;
      } catch (error) {
        console.warn('WebGL2 shader not available, falling back to CPU version:', error);
        this.useShader = false;
        this.caShader = null;
      }

      this.updateBufferPtr();
      this.setParameters();
      this.startRender();
    },
    beforeUnmount() {
      if (this.caShader) {
        this.caShader.dispose();
      }
    },
    methods: {
      mousemove (e) {
        // Use the appropriate canvas for coordinate calculation
        const targetCanvas = (this.useShader && this.caShader) ? this.caShader.canvas : this.canvas;
        const rect = targetCanvas.getBoundingClientRect();
        const scaleX = targetCanvas.width / rect.width;
        const scaleY = targetCanvas.height / rect.height;
        this.mouse.x = Math.floor((e.clientX - rect.left) * scaleX / this.devicePixelRatio);
        this.mouse.y = Math.floor((e.clientY - rect.top) * scaleY / this.devicePixelRatio);
        emit('ca:mouse', this.mouse);
      },
      setTickInterval (e) {
        this.tickInterval = e.detail;
      },
      setParameters (e) {
        if (e) {
          this.parameterKeys.forEach(parameterKey => {
            if (parameterKey === 'lifeChannel') {
              this.lifeChannel = {
                Hue: LifeChannel.Hue,
                Saturation: LifeChannel.Saturation,
                Luminance: LifeChannel.Luminance,
                Alpha: LifeChannel.Alpha,
              }[e.detail[parameterKey]];
            } else {
              this[parameterKey] = e.detail[parameterKey];
            }
          });
        }
        this.universe.set_params(
          this.rule,
          this.decayStep,
          this.recoveryStep,
          this.satRecoveryFactor,
          this.satDecayFactor,
          this.lumDecayFactor,
          this.lifeDecayFactor,
          this.satGhostFactor,
          this.hueDriftStrength,
          this.hueLerpFactor,
          this.lifeChannel,
        );

        // Update shader parameters if available
        if (this.caShader) {
          this.caShader.setParams(
            this.rule,
            this.decayStep,
            this.recoveryStep,
            this.satRecoveryFactor,
            this.satDecayFactor,
            this.lumDecayFactor,
            this.lifeDecayFactor,
            this.satGhostFactor,
            this.hueDriftStrength,
            this.hueLerpFactor,
            this.lifeChannel,
          );
        }
        const newParameters = {
          rule: this.rule,
          decayStep: this.decayStep,
          recoveryStep: this.recoveryStep,
          satRecoveryFactor: this.satRecoveryFactor,
          satDecayFactor: this.satDecayFactor,
          lumDecayFactor: this.lumDecayFactor,
          lifeDecayFactor: this.lifeDecayFactor,
          satGhostFactor: this.satGhostFactor,
          hueDriftStrength: this.hueDriftStrength,
          hueLerpFactor: this.hueLerpFactor,
          lifeChannel: this.lifeChannel,
          tickInterval: this.tickInterval,
          pixelScale: this.pixelScale,
          useAlpha: this.useAlpha,
          useRGB: this.useRGB,
          useShader: this.useShader,
        };
        emit('ca:parameters-set', newParameters);
      },
      setCanvasSize () {
        this.devicePixelRatio = devicePixelRatio || 1;
        this.canvas.width = this.universe.width() * this.devicePixelRatio;
        this.canvas.height = this.universe.height() * this.devicePixelRatio;
        this.canvas.style.width = `${this.universe.width() / this.pixelScale}px`;
        this.canvas.style.height = `${this.universe.height() / this.pixelScale}px`;
      },
      resize () {
        const newW = Math.floor(innerWidth * this.pixelScale);
        const newH = Math.floor(innerHeight * this.pixelScale);
        this.universe.resize(newW, newH);

        // Resize shader if available
        if (this.caShader) {
          this.caShader.resize(newW, newH);
        }

        this.updateBufferPtr();
        this.setCanvasSize();
        emit('ca:resize', this);
      },
      setBuffer (e) {
        const { width, height, buffer } = e.detail;

        if (this.useShader && this.caShader) {
          this.caShader.clear();
          this.caShader.drawStampAt(Math.floor(width / 2), Math.floor(height / 2), width, height, buffer);
        } else {
          this.universe.clear();
          this.universe.draw_stamp_at(Math.floor(width / 2), Math.floor(height / 2), width, height, buffer);
          this.updateBufferPtr();
        }
      },
      updateBufferPtr () {
        const ptr = this.universe.cells_ptr();
        const len = this.universe.cells_len();
        this.buffer = new Uint8Array(this.rca.memory.buffer, ptr, len);
      },
      startRender () {
        this.stopRender();
        this.render();
      },
      stopRender () {
        cancelAnimationFrame(this.animationFrameId);
      },
      render () {
        const now = performance.now();
        const elapsed = now - this.lastTime;
        if (elapsed >= this.tickInterval || !this.syncToMidi) {
          if (!this.paused) {
            emit('ca:tick', this);

            if (this.useShader && this.caShader) {
              // Use shader version
              this.caShader.tick();
            } else {
              // Use CPU version
              this.universe.tick();
            }
          }
          this.lastTime = now;
        }

        if (this.useShader && this.caShader) {
          // Render using shader
          this.caShader.render(this.useAlpha, this.useRGB);
        } else {
          // Render using CPU version
          this.drawBuffer(
            this.universe.width(),
            this.universe.height(),
            this.universe.width() * this.devicePixelRatio,
            this.universe.height() * this.devicePixelRatio,
            this.useAlpha,
            this.useRGB,
            this.buffer
          );
          this.updateBufferPtr();
        }

        this.animationFrameId = requestAnimationFrame(this.render);
        emit('ca:render', this);
      },
      clear () {
        this.universe.clear();
        if (this.caShader) {
          this.caShader.clear();
        }
      },
      pause (e) {
        this.paused = e.detail;
        console.log('Pause', this.paused);
      },
      step () {
        if (this.useShader && this.caShader) {
          this.caShader.tick();
        } else {
          this.universe.tick();
        }
      },
      noise () {
        this.universe.randomize();
        if (this.caShader) {
          this.caShader.randomize();
        }
      },
      drawStamp (e) {
        //{x: cx, y: cy, width: imageData.width, height: imageData.height, image: data}
        const args = e.detail;

        if (this.useShader && this.caShader) {
          this.caShader.drawStampAt(args.x, args.y, args.width, args.height, args.image);
        } else {
          this.universe.draw_stamp_at(args.x, args.y, args.width, args.height, args.image);
          this.updateBufferPtr();
        }
      },
      syncCpuToShader () {
        if (!this.caShader || !this.buffer) return;

        // Copy current CPU state to shader
        this.caShader.loadFromBuffer(this.buffer, this.universe.width(), this.universe.height());
      },
    },
  }
</script>
<style>
.unselectable {
  user-select: none;
  -webkit-user-select: none;  /* Safari */
  -moz-user-select: none;     /* Firefox */
  -ms-user-select: none;      /* Internet Explorer/Edge */
}
</style>
