<template>
  <div>
    <v-card>
      <v-card-text>
        <div class="d-inline-block" :style="{width: '10px', height: '10px', background: pulseColor}" />
        <div class="d-inline-block" :style="{width: '10px', height: '10px', background: paused ? 'gray' : 'green'}" />

        <v-select
          v-model="midiClockInput"
          item-title="name"
          item-value="id"
          :items="midiInputs"
          label="Clock Source"
          @change="handleOutputChange($event, listener)"
        />
        <v-select
          v-model="midiPlaybackInput"
          item-title="name"
          item-value="id"
          :items="midiInputs"
          label="Playback Source"
          @change="handleOutputChange($event, listener)"
        />
        <v-select
          v-model="noteTarget"
          :items="inputTargets"
          label="Note Target"
        />
        <v-select
          v-model="velocityTarget"
          :items="inputTargets"
          label="Velocity Target"
        />
        <v-btn class="mb-2" @click="addMidiListener">Add MIDI Out</v-btn>
        <div class="flex-container">
          <div v-for="(listener, id) in listeners" :key="id">
            <v-dialog max-width="500">
              <template #activator="{ props: activatorProps }">
                <v-icon class="action-icons" icon="mdi-delete" @click="removeListenerById($event, listener.id)" />
                <v-icon class="action-icons" :disabled="!midiOutput" icon="mdi-play" @click="testNote($event, listener)" />
                <v-icon v-bind="activatorProps" class="action-icons" icon="mdi-cog" />
              </template>
              <template #default="{ isActive }">
                <v-card title="MIDI Configuration">
                  <v-card-text>
                    <v-select
                      v-model="midiOutput[listener.id]"
                      item-title="name"
                      item-value="id"
                      :items="midiOutputs"
                      label="MIDI Output"
                      @change="handleOutputChange($event, listener)"
                    />
                    <div :ref="'track_' + id" class="flex-row" :style="{backgroundColor: listener.color}">
                      <div class="flex-item">
                        <v-number-input
                          v-model="listener.channel"
                          control-variant="stacked"
                          label="Channel"
                          :max="16"
                          :min="1"
                        />
                      </div>
                    </div>
                    <v-btn class="mt-4" :disabled="!midiOutput" @click="testNote($event, listener)">
                      <v-icon class="mr-2" icon="mdi-music-note" />
                      Play Test Note
                    </v-btn>
                    <v-btn class="mt-4 float-right" @click="isActive.value = false">
                      OK
                    </v-btn>
                  </v-card-text>
                </v-card>
              </template>
            </v-dialog>
            <div :ref="'track_' + id" class="flex-row" :style="{backgroundColor: listener.color}">
              <div class="flex-item signal-frame" :style="{background: hslaToCssVar(listener.lastAvg)}" />
              <div class="flex-item signal-frame">
                <v-progress-linear
                  :buffer-value="listener.lastVariance.h"
                  :color="hslaToCssVar({h: listener.lastAvg.h, s: 255, l: 127, a: 255,})"
                  height="11"
                  :max="255"
                  :model-value="listener.lastAvg.h"
                />
                <v-progress-linear
                  :buffer-value="listener.lastVariance.s"
                  :color="hslaToCssVar({h: 120, s: listener.lastAvg.s, l: 127, a: 255,})"
                  height="11"
                  :max="255"
                  :model-value="listener.lastAvg.s"
                />
                <v-progress-linear
                  :buffer-value="listener.lastVariance.l"
                  :color="hslaToCssVar({h: 120, s: 255, l: listener.lastAvg.l, a: 255,})"
                  height="11"
                  :max="255"
                  :model-value="listener.lastAvg.l"
                />
                <v-progress-linear
                  :buffer-value="listener.lastVariance.a / 255"
                  color="purple"
                  height="11"
                  :max="255"
                  :model-value="listener.lastAvg.a"
                />
                <v-progress-linear
                  :buffer-value="listener.noteOnThreshold"
                  color="red"
                  height="11"
                  :max="127"
                  :model-value="listener.lastVelocity - (pnow() - listener.lastMessageTime)"
                />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.x"
                  control-variant="stacked"
                  label="x"
                  :max="innerWidth"
                  :min="0"
                />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.y"
                  control-variant="stacked"
                  label="y"
                  :max="innerHeight"
                  :min="0"
                />
              </div>
              <div class="flex-item">
                <v-select v-model="listener.listenerMode" :items="listenerModes" label="Mode" />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.velocityOffset"
                  control-variant="stacked"
                  label="Velocity Offset"
                  :max="127"
                  :min="-127"
                />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.noteOffset"
                  control-variant="stacked"
                  label="Note Offset"
                  :max="127"
                  :min="-127"
                />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.note"
                  control-variant="stacked"
                  label="Note"
                  :max="127"
                  :min="0"
                />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.cc"
                  control-variant="stacked"
                  label="CC"
                  :max="127"
                  :min="0"
                />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.noteOnThreshold"
                  control-variant="stacked"
                  label="Threshold"
                  :max="127"
                  :min="1"
                />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.radius"
                  control-variant="stacked"
                  label="Radius"
                  :max="maxRadius"
                  :min="0"
                />
              </div>
              <div class="flex-item">
                <v-select v-model="listener.velocityChannel" :items="colorChannels" label="Velocity" />
              </div>
              <div class="flex-item">
                <v-select v-model="listener.pitchChannel" :items="colorChannels" label="Pitch" />
              </div>
              <div class="flex-item">
                <v-select v-model="listener.aftertouchChannel" :items="colorChannels" label="Aftertouch" />
              </div>
              <div class="flex-item">
                <v-select v-model="listener.noteOnChannel" :items="colorChannels" label="Note On" />
              </div>
              <div class="flex-item">
                <v-select v-model="listener.quantize" :items="quantizeItems" label="Rate" />
              </div>
              <div class="flex-item">
                <v-checkbox v-model="listener.dotted" label="Dotted" @change="checkQuanta($event, listener, 'dotted')" />
              </div>
              <div class="flex-item">
                <v-checkbox v-model="listener.triplet" label="Triplet" @change="checkQuanta($event, listener, 'dotted')" />
              </div>
              <div class="flex-item">
                <v-number-input
                  v-model="listener.gate"
                  label="Gate"
                  :max="1"
                  :min="0"
                  :step="0.01"
                />
              </div>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
    <!-- out of layout -->
    <teleport to="#app">

      <div v-for="(listener, id) in listeners" :key="id" :style="listenerStyle(listener)">

        <v-progress-circular
          :ref="'sampler_h_' + id"
          class="listener-meter"
          color="red"
          :model-value="listener.lastAvg.h"
          :style="{scale: 0.5, translate: '10px'}"
          width="2"
          @mousedown.stop="startListenerMove($event, id)"
        />
        <v-progress-circular
          :ref="'sampler_s_' + id"
          class="listener-meter"
          color="green"
          :model-value="listener.lastAvg.s"
          :style="{scale: 0.6, translate: '10px'}"
          width="2"
          @mousedown.stop="startListenerMove($event, id)"
        />
        <v-progress-circular
          :ref="'sampler_l_' + id"
          class="listener-meter"
          color="blue"
          :model-value="listener.lastAvg.l"
          :style="{scale: 0.7, translate: '10px'}"
          width="2"
          @mousedown.stop="startListenerMove($event, id)"
        />
        <v-progress-circular
          :ref="'sampler_a_' + id"
          class="listener-meter"
          color="purple"
          :model-value="listener.lastAvg.a"
          :style="{scale: 0.8, translate: '10px'}"
          width="2"
          @mousedown.stop="startListenerMove($event, id)"
        />
      </div>

    </teleport>


  </div>
</template>
<script>
  import { getRandomColor, getRandomIntInclusive, hexToHslaU8, newId } from '../utils.js';
  import Slider from './Slider.vue';
  import glSetup from './glSetup.js';
  export default {
    components: { Slider },
    data () {
      return {
        ca: null,
        buffer: null,
        midiAccess: null,
        midiOutputs: [],
        pulseColor: '#FF0000FF',
        noteTarget: 'x',
        velocityTarget: 'y',
        midiClockInput: null,
        midiPlaybackInput: null,
        midiInputs: [],
        paused: false,
        activeBrushes : new Map(), // note-driven brush sessions
        nextSessionId : 0n, // monotonically increasing BigInt
        listeners: {},
        innerWidth: 0,
        innerHeight: 0,
        signalFrameSize: 50,
        drawBuffers: {},
        selectedOutputId: null,
        selectedInputId: null,
        midiOutput: {},
        midiInput: {},
        midiTimeStamp: 0,
        midiClock: null,
        requestAnimationFrameId: null,
        inputTargets: [
          'x',
          'y',
          'hue',
          'saturation',
          'luminance',
          'alpha',
        ],
        quantizeItems: [
          '1/1',
          '1/2',
          '1/4',
          '1/8',
          '1/16',
          '1/32',
          '1/64',
          '1/128',
        ],
        pause: false,
        lastBeatTime   : 0, // filled in handleClock()
        msPerBeat      : 0, // ts of most-recent beat edge (pulseCount === 0)
        lastClockTime  : null, // DOMHighResTimeStamp of previous 0xF8 pulse
        pulseCount     : 0, // counts 0‥23 (24 ppqn)
        accumTime      : 0, // ΣΔt for one beat
        bpm            : 0,
        subdivision    : 6, // 24 pulses ÷ 4 = 16th-note granularity
        tickInterval   : 0,
        colorChannels: [
          { value: 'h', title: 'Hue' },
          { value: 's', title: 'Saturation' },
          { value: 'l', title: 'Luminance' },
          { value: 'a', title: 'Alpha' },
          { value: 'f', title: 'Fixed' },
        ],
        listenerModes: [
          { value: 'note', title: 'Note' },
          { value: 'cc', title: 'CC' },
          { value: 'both', title: 'Both' },
        ],
        outputDefaults: {
          radius: 0,
          listenerMode: 'note',
          channel: 1,
          noteOffset: 32,
          velocityOffset: 16,
          noteOnThreshold: 16,
          noteOnChannel: 'l',
          velocityChannel: 's',
          aftertouchChannel: 'l',
          lengthChannel: 'l',
          pitchChannel: 'h',
          cc: 1,
          gate: 1,
          quantize: '1/4',
        },
        movingListenerId: null,
        initialMouseX: 0,
        initialMouseY: 0,
        initialListenerX: 0,
        initialListenerY: 0,
      };
    },
    computed: {
      maxRadius () {
        return Math.max(this.innerWidth, this.innerHeight);
      },
      listenerStyle () {
        return listener => {
          return {
            position: 'absolute',
            height: '10px',
            width: '10px',
            left: (listener.x - 5) + 'px',
            top: (listener.y - 5) + 'px',
            zIndex: 1,
            borderRadius: '10px',
            border: 'solid 1px #FFFFFFFF',
          }
        };
      },
      hslaToCssVar () {
        return ({ h, s, l, a }) => {
          const hue = (h / 255) * 360;
          const sat = (s / 255) * 100;
          const lig = (l / 255) * 100;
          const alpha = (a / 255).toFixed(3);
          return `hsla(${hue.toFixed(1)}, ${sat.toFixed(1)}%, ${lig.toFixed(1)}%, ${alpha})`;
        }
      },
      listenerOpacity () {
        return listener => {
          const now = performance.now();
          const delta = now - listener.lastMessageTime;

          const falloff = 1000; // ms before fade starts to become noticeable
          const maxDelta = 10000; // ms after which it's nearly invisible

          if (delta < 0) return 1.0; // future timestamp? treat as fully visible
          if (delta < falloff) return 1.0;

          // Use logarithmic falloff
          const opacity = Math.max(0, 1 - Math.log(delta - falloff + 1) / Math.log(maxDelta - falloff + 1));

          return opacity;
        }
      },
    },
    watch: {
      listeners: {
        handler () {
          emit('midi:update-listeners', this);
        },
        deep: true,
      },
      pause () {
        emit('ca:pause', this.pause);
      },
      tickInterval () {
        emit('ca:set-tick-interval', this.tickInterval);
      },
    },
    async mounted () {
      listen('resize', this.resize);
      listen('mousedown', this.mousedown);
      listen('mouseup', this.mouseup);
      listen('mouseleave', this.mouseup);
      listen('ca:mouse', this.mousemove);
      listen('ca:init', e => this.ca = e.detail);
      listen('ca:set-parameters', e => this.pixelScale = e.detail.pixelScale);
      listen('midi:add-listener', this.addMidiListener);
      listen('midi:clock-quarter-note-pulse', this.quarterNotePulse);
      emit('ca:tempo', this.bpm);
      this.resize();
      setTimeout(async () => {
        await this.initMIDI();
      }, 100);

    },
    methods: {
      quarterNotePulse (e){
        this.midiTimeStamp = e.detail.midiTimeStamp;
        this.msPerBeat = e.detail.msPerBeat;
        this.pulseColor = '#FFFFFFFF';
        setTimeout(() => {
          this.pulseColor = '#FF0000FF';
        }, 100);
      },
      checkQuanta (e, listener, field) {
        if (listener.dotted && listener.triplet) {
          listener[field] = true;
          listener[field === 'dotted' ? 'triplet' : 'dotted'] = false;
        }
      },
      pnow () {
        return performance.now();
      },
      getPulsesFor (note) {
        const P = 24; // pulses per quarter-note (MIDI spec)

        if (note === undefined || note === null)
          return this.subdivision; // use the default grid already in state

        if (typeof note === 'number' && Number.isInteger(note) && note > 0)
          return note; // caller supplied the pulse-count directly

        if (typeof note === 'string') {
          const dotted = note.endsWith('.');
          const triplet = note.endsWith('T');
          const core = note.replace(/[\.T]/g, ''); // strip suffixes
          const match = core.match(/^1\/(\d+)$/); // "1/4", "1/8" …

          if (match) {
            const denom = parseInt(match[1], 10); // 4, 8, 16, …
            let pulses = P * 4 / denom; // quarter-note → 24, etc.

            if (triplet) pulses = pulses * 2 / 3; // ⅔ length
            if (dotted) pulses = pulses * 3 / 2; // 1½ length

            if (Number.isInteger(pulses)) // only keep clean values
              return pulses;
          }
        }

        // fallback
        return this.subdivision;
      },

      // /*  ───────── Quantize an arbitrary time-stamp to the next grid edge ───────── */
      // quantizeToClock(ts, noteValue) {
      //   const q = this.getPulsesFor(noteValue);           // pulses per grid division
      //   const msPerPulse   = this.msPerBeat / 24;         // constant from clock sync

      //   const pulsesIntoBeat = this.pulseCount % 24;      // where are we in this beat?

      //   let nextCell = Math.ceil(pulsesIntoBeat / q) * q; // next division inside beat
      //   if (nextCell === pulsesIntoBeat) nextCell += q;   // never “right now”

      //   /* crosses the beat boundary? */
      //   if (nextCell >= 24) {
      //     const beatsAhead = Math.floor(nextCell / 24);
      //     return this.lastBeatTime                      // start of current beat
      //          + beatsAhead * this.msPerBeat            // skip whole beats
      //          + (nextCell % 24) * msPerPulse;          // plus the remainder
      //   }

      //   /* still inside current beat */
      //   return this.lastBeatTime + nextCell * msPerPulse;
      // },

      quantizeToClock (ts) {
        // Duration of one MIDI clock pulse (24 ppqn)
        const msPerPulse = this.msPerBeat / 24;

        // How far into the current beat we are (0–23)
        const pulsesIntoBeat = this.pulseCount % 24;

        // Pulses per desired grid cell (6 ⇒ four cells/beat)
        const q = this.subdivision;

        // Index of next grid cell (0-based)
        let nextCell = Math.ceil(pulsesIntoBeat / q) * q;
        if (nextCell === pulsesIntoBeat) nextCell += q; // avoid “right-now”

        // Absolute DOMHighResTimeStamp of that cell
        return this.lastBeatTime + nextCell * msPerPulse;
      },


      processListener (listener, ts, pulses) {

        const noteValue = listener.quantize + (listener.dotted || '') + (listener.triplet || '');
        const notePulses = this.getPulsesFor(noteValue);
        const noteMsValue = (this.msPerBeat / 24) * notePulses;

        const { avg, variance } = this.sample(
          Math.floor(listener.x * this.ca.pixelScale),
          Math.floor(listener.y * this.ca.pixelScale),
          listener.radius
        );

        // ΔA = change in alpha (life intensity)
        const deltaA = Math.abs(avg.a - listener.lastAvg.a);

        const note = listener.pitchChannel === 'f'
          ? listener.noteOffset
          : Math.min(127, listener.noteOffset + Math.floor((avg[listener.pitchChannel] / 255) * 48));
        const velocity = Math.min(127, Math.floor((avg[listener.velocityChannel] / 255) * 127) + listener.velocityOffset);
        const cc = Math.floor(variance[listener.noteOnChannel]);

        const output = this.midiOutput[listener.id];
        if (output) {
          /* —— Compute the target time only once —— */
          const ts = this.quantizeToClock(performance.now());

          if (listener.listenerMode === 'note' || listener.listenerMode === 'both') {
            if (listener.noteOnThreshold < avg[listener.noteOnChannel] || listener.noteOnChannel === 'f') {

              const noteOffTs = this.quantizeToClock(performance.now() + avg[listener.lengthChannel] * (noteMsValue * listener.gate));

              if (pulses % notePulses === 0) {
                // console.log("queue note off", Math.round(performance.now() - noteOffTs), notePulses);

                output.send([0x80 + listener.channel, listener.lastNote, 0], noteOffTs);

                // schedule note-on on that edge
                output.send([0x90 + listener.channel, note, velocity], ts);
                listener.lastNote = note;
                listener.lastVelocity = velocity;
                listener.lastMessageTime = ts;

                emit('midi:note', { channel: listener.channel, note, velocity, time: ts });


              // console.log("queued note", Math.round(performance.now() - ts), notePulses);
              }
            }
          } else if (listener.listenerMode === 'cc' || listener.listenerMode === 'both') {
            if (listener.cc) {
              emit('midi:cc', { channel: listener.channel, cc: listener.cc, value: cc, time: ts });
              output.send([0xB0 + listener.channel, listener.cc, cc], ts);
              listener.lastMessageTime = ts;
              console.log('queued cc');
            }
          }
        }

        listener.lastAvg = avg;
        listener.lastVariance = variance;
      },
      index (row, col, width) {
        return (row * width + col);
      },
      sample (x, y, radius) {
        // Use shader version if available and active
        if (this.ca.useShader && this.ca.caShader) {
          return this.ca.caShader.sampleRegion(x, y, radius);
        }

        // Fallback to CPU version
        const cells = this.ca.buffer;
        const width = this.ca.universe.width();
        const height = this.ca.universe.height();
        const hsla = [];
        const sum = { h: 0, s: 0, l: 0, a: 0 };

        const centerX = x;
        const centerY = y;
        const startX = Math.max(0, centerX - radius);
        const endX = Math.min(width, centerX + radius + 1);
        const startY = Math.max(0, centerY - radius);
        const endY = Math.min(height, centerY + radius + 1);

        for (let row = startY; row < endY; row++) {
          for (let col = startX; col < endX; col++) {
            // Check if pixel is within circular radius (matching shader version)
            const dx = col - centerX;
            const dy = row - centerY;
            if (dx * dx + dy * dy <= radius * radius) {
              const idx = this.index(row, col, this.ca.universe.width()) * 4;

              const h = cells[idx];
              const s = cells[idx + 1];
              const l = cells[idx + 2];
              const a = cells[idx + 3];
              hsla.push({ h, s, l, a });
              sum.h += h;
              sum.s += s;
              sum.l += l;
              sum.a += a;
            }
          }
        }

        const count = hsla.length;
        if (count === 0) {
          return { avg: { h: 0, s: 0, l: 0, a: 0 }, variance: { h: 0, s: 0, l: 0, a: 0 } };
        }

        const avg = {
          h: sum.h / count,
          s: sum.s / count,
          l: sum.l / count,
          a: sum.a / count,
        };

        const variance = { h: 0, s: 0, l: 0, a: 0 };
        for (const cell of hsla) {
          variance.h += (cell.h - avg.h) ** 2;
          variance.s += (cell.s - avg.s) ** 2;
          variance.l += (cell.l - avg.l) ** 2;
          variance.a += (cell.a - avg.a) ** 2;
        }
        for (const k in variance) variance[k] = Math.sqrt(variance[k] / count);

        return { avg, variance };
      },
      updateBufferPtr () {
        const ptr = this.universe.cells_ptr();
        const len = this.universe.cells_len();
        this.buffer = new Uint8Array(this.rca.memory.buffer, ptr, len);
      },
      startListenerMove (event, id) {
        this.movingListenerId = id;
        this.initialMouseX = event.clientX;
        this.initialMouseY = event.clientY;

        const listener = this.listeners[id];
        this.initialListenerX = listener.x;
        this.initialListenerY = listener.y;

        listen('mousemove', this.mousemove);
        listen('mouseup', this.mouseup);
        listen('mouseleave', this.mouseup);
      },
      mousemove (event) {
        if (this.movingListenerId === null) return;

        const dx = event.clientX - this.initialMouseX;
        const dy = event.clientY - this.initialMouseY;

        const updatedX = this.initialListenerX + dx;
        const updatedY = this.initialListenerY + dy;

        this.listeners[this.movingListenerId].x = Math.min(innerWidth, Math.max(0, updatedX));
        this.listeners[this.movingListenerId].y = Math.min(innerHeight, Math.max(0, updatedY));
      },
      mouseup () {
        this.movingListenerId = null;
        removeListener('mousemove', this.mousemove);
        removeListener('mouseup', this.mouseup);
        removeListener('mouseleave', this.mouseup);
      },
      removeListenerById (e, id) {
        delete this.listeners[id];
      },
      addMidiListener () {
        const listener = {
          id: newId(),
          version: '1.0.0',
          x: this.innerWidth / 2 - this.outputDefaults.radius / 2,
          y: this.innerHeight / 2 - this.outputDefaults.radius / 2,
          color: getRandomColor(),
          // radius: this.outputDefaults.radius,
          radius: 0,
          channel: this.outputDefaults.channel,
          listenerMode: this.outputDefaults.listenerMode,
          noteOffset: this.outputDefaults.noteOffset,
          noteOnThreshold: this.outputDefaults.noteOnThreshold,
          noteOnChannel: this.outputDefaults.noteOnChannel,
          velocityChannel: this.outputDefaults.velocityChannel,
          aftertouchChannel: this.outputDefaults.aftertouchChannel,
          velocityOffset: this.outputDefaults.velocityOffset,
          pitchChannel: this.outputDefaults.pitchChannel,
          quantize: this.outputDefaults.quantize,
          cc: this.outputDefaults.cc,
          gate: this.outputDefaults.gate,
          lastMessageTime: 0,
          lastCC: 0,
          lastVelocity: 0,
          lastNote: null,
          lastAvg: { h: 0, s: 0, l: 0, a: 0 },
          lastVariance: { h: 0, s: 0, l: 0, a: 0 },
        };
        this.midiOutput[listener.id] = this.midiOutputs[0];
        this.listeners[listener.id] = listener;
      },
      hslaToMidi ({ h, s, l, a }) {
        return {
          note: 21 + Math.floor((l / 255) * 87), // MIDI Note 21–108
          velocity: Math.floor((a / 255) * 127), // Use Alpha as velocity
          cc1: Math.floor((s / 255) * 127), // Saturation → CC1
          cc2: Math.floor((l / 255) * 127), // Luminance → CC2
        };
      },
      async initMIDI () {
        try {

          // console.info("MIDI Init Started");

          this.midiAccess = await navigator.requestMIDIAccess();
          this.midiOutputs = Array.from(this.midiAccess.outputs.values());
          this.midiInputs = Array.from(this.midiAccess.inputs.values());

          const input0 = [...this.midiAccess.inputs.values()][0];
          this.midiClockInput = input0.id;
          this.midiPlaybackInput = input0.id;
          input0.addEventListener('midimessage', this.handleMIDI);
        // console.info("MIDI Initialized.", this.midiClockInput.name);

        } catch (err) {
          console.error('MIDI Initialization Error:', err);
        }
      },

      /* ───────────────────────────── */
      /* 2.  Dispatch incoming bytes   */
      /* ───────────────────────────── */
      handleMIDI (ev) {
        // console.log('ev', ev);
        const [status, data1, data2] = ev.data; // raw bytes
        /* ── 1. real-time clock & transport ────────────────────────────────── */
        switch (status) {
          case 0xF8: this.handleClock(ev.timeStamp); return; // clock
          case 0xFA: this.resetClock(); this.pause = false; return; // start
          case 0xFB: this.pause = false; return; // continue
          case 0xFC: this.pause = true; return; // stop
        }

        /* ── 2. channel-voice messages (note on / off) ─────────────────────── */
        const type = status & 0xF0; // top nibble ⇒ message family
        const chanNum = (status & 0x0F) + 1; // 1-based channel for convenience

        if (type === 0x90 || type === 0x80) { // 0x90..9F = note-on, 0x80..8F = off
          const isNoteOn = (type === 0x90 && data2 !== 0);
          const norm = {
            type     : isNoteOn ? 'on' : 'off',
            channel  : chanNum, // 1–16
            note     : data1, // 0–127
            velocity : isNoteOn ? data2 / 127 : 0, // 0–1 float
            time     : ev.timeStamp, // same epoch as performance.now()
          };
          this.handleIncomingNote(norm);
          return;
        }

      /* add more message families here if you need them */
      },

      newId () { return this.nextSessionId++; },

      /* maps a 0-127 MIDI value into the requested drawing parameter -------- */
      mapValue (target, v) {
        const w = this.ca.universe.width();
        const h = this.ca.universe.height();
        const maxR = this.maxBrushRadius ?? 64; // choose a sensible default

        switch (target) {
          case 'x' : return (v / 127) * w;
          case 'y' : return (v / 127) * h;
          case 'hue' : return (v / 127) * 360;
          case 'saturation' : return (v / 127) * 100;
          case 'luminance' : return (v / 127) * 100;
          case 'alpha' : return v / 127;
          case 'radius' : return 1 + (v / 127) * maxR;
          case 'add' : return v > 63; // boolean
          default : return undefined;
        }
      },


      /* unified note handler ------------------------------------------------- */
      handleIncomingNote ({ type, channel, note, velocity /* 0-1 */, time }) {
        const key = `${channel}-${note}`; // e.g. "3-64"

        if (type === 'on') {
          /* —— create a new drawing session —— */
          const id = this.newId();


          /* … then overwrite the two targets */
          const noteVal = this.mapValue(this.noteTarget , note);
          const velVal = this.mapValue(this.velocityTarget , Math.round(velocity * 127));

          /* start with current tool settings … */
          const params = {
            x          : 0,
            y          : 0,
            radius     : this.mapValue('radius', velVal),
            add        : 'add',
            hue        : this.mapValue('hue', noteVal),
            saturation : this.mapValue('saturation', velVal),
            luminance  : this.mapValue('luminance', velVal),
          };

          const apply = (target, val) => {
            if (val === undefined) return;
            switch (target) {
              case 'x' : params.x = val; break;
              case 'y' : params.y = val; break;
              case 'hue' : params.hue = val; break;
              case 'saturation' : params.saturation = val; break;
              case 'luminance' : params.luminance = val; break;
              case 'alpha' : params.alpha = val; break;
              case 'radius' : params.radius = val; break;
              case 'add' : params.add = val; break;
            }
          };

          apply(this.noteTarget , noteVal);
          apply(this.velocityTarget, velVal);

          /* issue the draw call immediately (or quantise its ts if you prefer) */
          if (this.ca.useShader && this.ca.caShader) {
            // Use shader version
            this.ca.caShader.drawBrush(
              params.x,
              params.y,
              params.radius,
              params.add === 'add',
              params.hue,
              params.saturation,
              params.luminance,
              id
            );
            // Immediately render the changes
            this.ca.caShader.render(this.ca.useAlpha, this.ca.useRGB);
          } else {
            // Use CPU version
            this.ca.universe.draw_brush(
              params.x,
              params.y,
              params.radius,
              params.add === 'add',
              params.hue,
              params.saturation,
              params.luminance,
              id
            );
          }

          this.activeBrushes.set(key, { id, params });
        }

        else /* type === "off" */ {
          const session = this.activeBrushes.get(key);
          if (session) {
            /* send a zero-radius draw to ‘erase’ / stop the brush */
            this.ca.universe.draw_brush(
              session.params.x,
              session.params.y,
              0, // radius zero ⇒ turn brush off
              session.params.add,
              session.params.hue,
              session.params.saturation,
              session.params.luminance,
              session.id
            );
            this.activeBrushes.delete(key);
          }
        }
      },

      processListeners (ts, pulses) {
        Object.values(this.listeners).forEach(listener => {
          this.processListener(listener, ts, pulses);
        });
      },
      /* ───────────────────────────── */
      /* 3.  Process a 0xF8 pulse      */
      /* ───────────────────────────── */
      handleClock (ts) {
        this.midiTimeStamp = ts;
        if (this.lastClockTime !== null) {
          const delta = ts - this.lastClockTime; // ms since previous pulse
          this.pulseCount += 1;
          this.accumTime += delta;
          emit('midi:clock-pulse', {
            midiTimeStamp: this.midiTimeStamp,
            bpm: this.bpm,
            pulseCount: this.pulseCount,
            accumulatedTime: this.accumTime,
            delta,
          });
          this.processListeners(ts, this.pulseCount);
          /* One complete quarter-note (24 pulses) received */
          if (this.pulseCount === 24) {
            this.msPerBeat = this.accumTime;
            this.bpm = 60000 / this.msPerBeat;
            /* ‘tickInterval’ now equals the chosen subdivision of that beat */
            this.tickInterval = this.msPerBeat / this.subdivision;
            /* restart measurement window */
            this.pulseCount = 0;
            this.accumTime = 0;
            emit('midi:clock-quarter-note-pulse', { midiTimeStamp: this.midiTimeStamp, msPerBeat: this.msPerBeat });
          }
        }
        this.lastClockTime = ts;
      },

      resetClock () {
        this.lastClockTime = null;
        this.pulseCount = 0;
        this.accumTime = 0;
      },

      handleInputChange (e, listener) {
        const selected = this.midiInputs.find(
          input => input.id === listener.inputId
        );
        if (selected) {
          this.midiInput[listener.id] = selected;
        }
      },
      handleOutputChange (e, listener) {
        const selected = this.midiOutputs.find(
          output => output.id === listener.outputId
        );
        if (selected) {
          this.midiOutput[listener.id] = selected;
        }
      },
      testNote (e, listener) {
        if (this.midiOutput[listener.id]) {
          this.midiOutput[listener.id].send([0x90, 60, 100]); // Note On
          setTimeout(() => this.midiOutput[listener.id].send([0x80, 60, 0]), 300); // Note Off
        }
      },
      resize () {
        this.innerWidth = innerWidth;
        this.innerHeight = innerHeight;
      },
    },
    unmount () {
      this.midiOutputs.forEach(o => o.close());
      this.midiInputs.forEach(i => {
        i.removeEventListener('midimessage', this.handleMIDI);
        i.close()
      });
      this.midiOutputs = [];
      this.midiInputs = [];

    },
  }
</script>
<style>
  .listener-meter {
    position: absolute;
    left: -22px;
    top: -12px;
  }
  .action-icons {
    margin-bottom: -100px;
    margin-left: 3px;
    opacity: 0.7;
  }
  .flex-container {
    display: flex;
    flex-direction: column; /* Stack the rows vertically */
    height: 500px;
    overflow: scroll;
  }

  .flex-row {
    display: flex;
    flex-wrap: wrap; /* Allow the items to wrap */
    justify-content: space-between; /* Distribute space between items */
    background: #00000055;
  }

  .flex-item {
    flex: 1 1 120px; /* Grow, shrink, and set a base size for each item */
    height: 56px;
    margin: 0; /* Add spacing between items */
    box-sizing: border-box; /* Include padding/border in the item's size */
  }
  .activity {
    background: green;
    border-radius: 10px;
    height: 10px;
    width: 10px;
  }
  .signal-frame {
    height: 56px;
    width: 26px;
    background: #000;
    overflow: hidden;
    border-size: 1px;
    border-bottom-style: solid;
    border-color: #FFFFFF55
  }
</style>
