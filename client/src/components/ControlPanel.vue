<template>
  <div v-show="panelVisible" ref="panel" class="control-panel" @mousedown="startDrag">
    <v-card style="max-height: 80vh;">
      <v-tabs v-model="tab">
        <v-tab value="attr">Rule {{ rule }}</v-tab>
        <v-tab value="brush">Brush</v-tab>
        <v-tab value="image">Image</v-tab>
        <v-tab value="midi">MIDI</v-tab>
        <v-tab value="file">File</v-tab>
        <v-tab value="about">About</v-tab>
      </v-tabs>


      <div style="text-align: center;">
        <v-menu>
          <template v-slot:activator="{ props }">
            <v-icon
              v-bind="props"
              class="menu-button"
              size="x-large"
              icon="mdi-menu"
            />
          </template>

          <v-list>
            <v-list-item @click="randomize">
              <v-list-item-title>Random</v-list-item-title>
              <template v-slot:append>
                <v-chip size="x-small" variant="outlined">R</v-chip>
              </template>
            </v-list-item>

            <v-list-item @click="addMidiListener">
              <v-list-item-title>Add MIDI Out</v-list-item-title>
            </v-list-item>

            <v-list-item @click="pause">
              <v-list-item-title>{{ paused ? 'Resume' : 'Pause' }}</v-list-item-title>
              <template v-slot:append>
                <v-chip size="x-small" variant="outlined">Space</v-chip>
              </template>
            </v-list-item>

            <v-list-item @click="step">
              <v-list-item-title>Step</v-list-item-title>
              <template v-slot:append>
                <v-chip size="x-small" variant="outlined">S</v-chip>
              </template>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item @click="clear">
              <v-list-item-title>Clear</v-list-item-title>
              <template v-slot:append>
                <v-chip size="x-small" variant="outlined">C</v-chip>
              </template>
            </v-list-item>

            <v-list-item @click="noise">
              <v-list-item-title>Noise</v-list-item-title>
              <template v-slot:append>
                <v-chip size="x-small" variant="outlined">N</v-chip>
              </template>
            </v-list-item>

            <v-list-item @click="setBackground">
              <v-list-item-title>Set Background</v-list-item-title>
              <template v-slot:append>
                <v-chip size="x-small" variant="outlined">B</v-chip>
              </template>
            </v-list-item>

            <v-divider></v-divider>

            <v-list-item @click="toggleShader">
              <v-list-item-title>
                Switch to {{ useShader ? 'CPU' : 'GPU' }} Mode
              </v-list-item-title>
              <template v-slot:prepend>
                <v-icon :color="useShader ? 'primary' : 'default'">
                  {{ useShader ? 'mdi-gpu' : 'mdi-cpu-64-bit' }}
                </v-icon>
              </template>
              <template v-slot:append>
                <v-chip size="x-small" variant="outlined">G</v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>


      <v-card-text>
        <v-tabs-window v-model="tab">
          <v-tabs-window-item eager value="file">
            <FileManager />
          </v-tabs-window-item>
          <v-tabs-window-item class="attr" eager value="attr">

            <RulePicker v-model="rule" />
            <v-radio-group v-model="lifeChannel" class="mt-5" inline label="Life">
              <v-radio :label="isRGB ? 'Red' : 'Hue'" value="Hue" />
              <v-radio :label="isRGB ? 'Blue' : 'Saturation'" value="Saturation" />
              <v-radio :label="isRGB ? 'Green' : 'Luminance'" value="Luminance" />
              <v-radio v-if="isAlpha" label="Alpha" value="Alpha" />
            </v-radio-group>
            <v-radio-group v-model="colorModel" inline label="Color Model">
              <v-radio label="HSLA" value="HSLA" />
              <v-radio label="RGBA" value="RGBA" />
              <v-radio label="HSL" value="HSL" />
              <v-radio label="RGB" value="RGB" />
            </v-radio-group>
            <v-card-title>Factors</v-card-title>
            <Slider
              v-model="pixelScale"
              label="Scale"
              :max="1"
              :min="0.05"
              :precision="2"
              :step="0.05"
            />
            <Slider
              v-model="decayStep"
              label="Decay"
              :max="255"
              :min="0"
              :precision="0"
              :step="1.0"
            />
            <Slider
              v-model="recoveryStep"
              label="Recovery"
              :max="255"
              :min="0"
              :precision="0"
              :step="1.0"
            />
            <Slider
              v-model="satRecoveryFactor"
              label="Saturation Recovery"
              :max="1.0"
              :min="0.0"
              :precision="2"
              :step="0.01"
            />
            <Slider
              v-model="satDecayFactor"
              label="Saturation Decay"
              :max="1.0"
              :min="0.0"
              :precision="2"
              :step="0.01"
            />
            <Slider
              v-model="lumDecayFactor"
              label="Luminance  Decay"
              :max="1.0"
              :min="0.0"
              :precision="2"
              :step="0.01"
            />
            <Slider
              v-model="lifeDecayFactor"
              label="Life Decay"
              :max="1.0"
              :min="0.0"
              :precision="2"
              :step="0.01"
            />
            <Slider
              v-model="satGhostFactor"
              label="Saturation Ghost"
              :max="1.0"
              :min="0.0"
              :precision="2"
              :step="0.01"
            />
            <Slider
              v-model="hueDriftStrength"
              label="Hue Drift"
              :max="0.2"
              :min="0.0"
              :precision="3"
              :step="0.001"
            />
            <Slider
              v-model="hueLerpFactor"
              label="Hue Interpolation"
              :max="1.0"
              :min="0.0"
              :precision="2"
              :step="0.01"
            />
          </v-tabs-window-item>
          <v-tabs-window-item eager value="brush">
            <Slider
              v-model="brushRadius"
              class="mb-6"
              label="Brush Radius"
              :max="1000"
              :min="1"
              :step="1"
            />
            <v-color-picker
              v-model="brushColor"
              label="Brush Color"
              mode="hexa"
              show-swatches
              style="margin: auto;"
              @mousedown.stop
            />
          </v-tabs-window-item>
          <v-tabs-window-item eager value="image">
            <ImageManager />
          </v-tabs-window-item>
          <v-tabs-window-item eager value="midi">
            <Midi />
          </v-tabs-window-item>
          <v-tabs-window-item eager value="about">
            WASM/GL 32bit HLSA Multichannel Rust Cellular Automata<br>
            by Tony Germaneri<br>
            MIDI Info:<br>
            Last MIDI Time Stamp:{{ midiTimeStamp }} <br>
            MS/Beat:{{ msPerBeat }} <br>
            <i v-if="ca">{{ ca.tickInterval }}</i>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
  import Slider from './Slider.vue';
  import ImageManager from './ImageManager.vue';
  import RulePicker from './RulePicker.vue';
  import Midi from './Midi.vue';
  import FileManager from './FileManager.vue';
  import { getRandomFloatInclusive, getRandomIntInclusive } from '../utils.js';
  export default {
    components: { RulePicker, Slider, ImageManager, FileManager, Midi },
    data () {
      return {
        ca: null,
        pulseColor: '#FF0000FF',
        midiTimeStamp: 0,
        msPerBeat: 0,
        performance: { fps: 0, bpm: 0 },
        panel: null,
        paused: false,
        panelVisible: false,
        isDragging: false,
        tab: null,
        isShape: false,
        offsetX: 0,
        offsetY: 0,
        rule: 6152,
        decayStep: 255,
        recoveryStep: 255,
        satRecoveryFactor: 1.0,
        satDecayFactor: 1.0,
        lumDecayFactor: 0.95,
        lifeDecayFactor: 0.95,
        satGhostFactor: 0.9,
        hueDriftStrength: 0.01,
        hueLerpFactor: 0.1,
        lifeChannel: 'Luminance',
        pixelScale: 1,
        stampOnRandom: true,
        randomizeShape: true,
        brushRadius: 1,
        brushColor: '#FFFFFFFF',
        colorModel: 'HSLA',
        useShader: true,
        channels: [
          'Hue',
          'Saturation',
          'Luminance',
          'Alpha',
        ],
      };
    },
    computed: {
      isAlpha () {
        return /...A$/i.test(this.colorModel);
      },
      isRGB () {
        return /RGBA?$/i.test(this.colorModel);
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
          this.colorModel,
          this.pixelScale,
          this.useShader,
        ]
      },
    },
    watch: {
      brushRadius () {
        emit('brush:radius', this.brushRadius);
      },
      brushColor () {
        emit('brush:color', this.brushColor);
      },
      parameters () {
        console.log('control-panel: emit ca:set-parameters')
        emit('ca:set-parameters', {
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
          pixelScale: this.pixelScale,
          useAlpha: this.isAlpha,
          useRGB: this.isRGB,
          useShader: this.useShader,
        })
      },
    },
    mounted () {
      listen('midi:clock-quarter-note-pulse', this.quarterNotePulse);
      listen('ca:performance', this.updatePerformance);
      listen('control-panel:set-parameters', this.setParameters);
      listen('ca:init', e => this.ca = e.detail);
      listen('ca:pause', this.pauseWatch);
      listen('image:stamp-on-random', this.setStampOnRandom);
      listen('image:randomize-shape-on-random', this.setRandomizeShape);
      this.panel = this.$refs.panel;
      listen('mousemove', this.onDrag);
      listen('mouseup', this.stopDrag);
      listen('mouseleave', this.stopDrag);
      listen('keydown', this.keyHandler);
      listen('image:background-set', e => this.isShape = e.detail.isShape);
      emit('image:set-random-shape');
    },
    beforeUnmount () {
      removeListener('mousemove', this.onDrag);
      removeListener('mouseup', this.stopDrag);
      removeListener('mouseleave', this.stopDrag);
    },
    methods: {
      addMidiListener () {
        emit('midi:add-listener');
      },
      pauseWatch (e) {
        this.paused = e.detail;
      },
      quarterNotePulse (e){
        this.midiTimeStamp = e.detail.midiTimeStamp;
        this.msPerBeat = e.detail.msPerBeat;
        this.pulseColor = '#FFFFFFFF';
        setTimeout(() => {
          this.pulseColor = '#FF0000FF';
        }, 100);
      },
      updatePerformance (e) {
        this.performance = e.detail;
      },
      setRandomizeShape (e) {
        this.randomizeShape = e.detail;
      },
      setStampOnRandom (e) {
        this.stampOnRandom = e.detail;
      },
      setParameters (e) {
        const parameters = JSON.parse(JSON.stringify(e.detail));
        Object.keys(parameters).forEach(key => {
          this[key] = parameters[key];
        });
      },
      keyHandler (e) {
        switch (e.key.toLowerCase()) {
          case 'arrowup': e.preventDefault(); this.rule += 1; break;
          case 'arrowdown': e.preventDefault(); this.rule -= 1; break;
          case 'c': this.clear(); break;
          case 'b': this.setBackground(); break;
          case 'n': this.noise(); break;
          case 'r': this.randomize(); break;
          case 'h': this.panelVisible = !this.panelVisible; break;
          case 'p': this.pause(); break;
          case 's': this.step(); break;
          case 'g': this.useShader = !this.useShader; break;
          case ']': this.brushRadius += 1; break;
          case '[': this.brushRadius -= 1; break;
          default:
            return; // quit for keys we don’t handle
        }
      },
      getRandomLifeChannel () {
        const index = Math.floor(Math.random() * this.channels.length);
        return this.channels[index];
      },
      randomize () {
        this.rule = getRandomIntInclusive(0, 262143);
        this.decayStep = Math.random() > 0.5 ? 1 : getRandomIntInclusive(0, 500);
        this.recoveryStep = getRandomIntInclusive(1, 255);
        this.satRecoveryFactor = getRandomFloatInclusive(0.00, 1.0);
        this.satDecayFactor = getRandomFloatInclusive(0.00, 1.0);
        this.lumDecayFactor = getRandomFloatInclusive(0.00, 1.0);
        this.lifeDecayFactor = getRandomFloatInclusive(0.00, 1.0);
        this.satGhostFactor = getRandomFloatInclusive(0.00, 1.0);
        this.hueDriftStrength = getRandomFloatInclusive(0.000, 0.200);
        this.hueLerpFactor = getRandomFloatInclusive(0.00, 1.00);
        this.lifeChannel = Math.random() > 0.5 ? 'Alpha' : this.getRandomLifeChannel();
        this.colorModel = Math.random() > 0.9 ? 'RGBA' : 'HSLA';
        if (this.isShape) {
          emit('image:set-random-shape');
        }
        setTimeout(() => {
          this.clear();
          setTimeout(() => {
            this.setBackground();
          }, 10);
        }, 10);
      },
      setBackground () {
        emit('image:set-background');
      },
      clear () {
        emit('ca:clear');
      },
      pause () {
        this.paused = !this.paused;
        emit('ca:pause', this.paused);
      },
      step () {
        emit('ca:step');
      },
      noise () {
        emit('ca:noise');
      },
      toggleShader () {
        this.useShader = !this.useShader;
      },
      startDrag (e) {
        e.stopPropagation();
        this.isDragging = true;
        this.offsetX = e.clientX - this.panel.offsetLeft;
        this.offsetY = e.clientY - this.panel.offsetTop;
      },
      onDrag (e) {
        if (!this.isDragging) { return; }
        e.stopPropagation();
        this.panel.style.left = `${e.clientX - this.offsetX}px`;
        this.panel.style.top = `${e.clientY - this.offsetY}px`;

      },
      stopDrag () {
        this.isDragging = false;
      },
    },
  };
</script>

<style>
.control-panel {
  top: 20px;
  right: 20px;
  position: absolute;
  width: 700px;
  cursor: move;
  user-select: none;
  z-index: 2;
}
.attr {
  height: 450px;
  overflow: scroll;
}
.menu-button {
  position: absolute;
  right: 14px;
  top: 6px;
}
</style>
