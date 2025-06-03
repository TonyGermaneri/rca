<template>
  <canvas ref="canvas" class="unselectable" />
</template>
<script>
  import init, { LifeChannel, Universe } from '@ca/ca';
  import glSetup from './glSetup.js';
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
      this.updateBufferPtr();
      this.setParameters();
      this.startRender();
    },
    methods: {
      mousemove (e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
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
        this.updateBufferPtr();
        this.setCanvasSize();
        emit('ca:resize', this);
      },
      setBuffer (e) {
        const { width, height, buffer } = e.detail;
        this.universe.clear();
        this.universe.draw_stamp_at(Math.floor(width / 2), Math.floor(height / 2), width, height, buffer);
        this.updateBufferPtr();
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
            this.universe.tick();
          }
          this.lastTime = now;
        }
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
        this.animationFrameId = requestAnimationFrame(this.render);
        emit('ca:render', this);
      },
      clear () {
        this.universe.clear();
      },
      pause (e) {
        this.paused = e.detail;
        console.log('Pause', this.paused);
      },
      step () {
        // const now = performance.now();
        // const elapsed = now - this.lastTime;
        // this.lastTime = now - (elapsed % this.tickInterval);
        this.universe.tick();
      },
      noise () {
        this.universe.randomize();
      },
      drawStamp (e) {
        //{x: cx, y: cy, width: imageData.width, height: imageData.height, image: data}
        const args = e.detail;
        this.universe.draw_stamp_at(args.x, args.y, args.width, args.height, args.image);
        this.updateBufferPtr();
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
