<template>
  <div class="midi-interface">
    <!-- Global MIDI Settings -->
    <v-card class="mb-4">
      <v-card-title>
        <div class="d-flex align-center">
          <span>MIDI Interface</span>
          <v-spacer />
          <div class="status-indicators">
            <div class="status-dot" :style="{background: pulseColor}" title="Clock Pulse" />
            <div class="status-dot" :style="{background: paused ? 'gray' : 'green'}" title="Transport Status" />
          </div>
        </div>
      </v-card-title>
      <v-card-text v-if="isInput">
        <div class="global-controls">
          <v-select
            v-model="midiClockInput"
            item-title="name"
            item-value="id"
            :items="midiInputs"
            label="Clock Source"
            density="compact"
          />
          <v-select
            v-model="midiPlaybackInput"
            item-title="name"
            item-value="id"
            :items="midiInputs"
            label="Playback Source"
            density="compact"
          />
          <v-select
            v-model="noteTarget"
            :items="inputTargets"
            label="Note Target"
            density="compact"
          />
          <v-select
            v-model="velocityTarget"
            :items="inputTargets"
            label="Velocity Target"
            density="compact"
          />

        </div>
      </v-card-text>
    </v-card>

    <v-btn v-if="!isInput" @click="addMidiListener" color="primary" prepend-icon="mdi-plus">
      Add MIDI Listener
    </v-btn>
    <!-- MIDI Listeners -->
    <div v-if="!isInput" class="listeners-container">
      <v-card v-for="(listener, id) in listeners" :key="id" class="listener-card mb-4">
        <v-card-title class="listener-header">
          <div class="d-flex align-center w-100">
            <div class="listener-color-indicator" :style="{backgroundColor: listener.color}" />
            <span class="listener-title">Listener {{ id.slice(0, 8) }}</span>
            <v-spacer />
            <div class="listener-actions">
              <v-btn icon size="small" @click="testNote($event, listener)" :disabled="!midiOutput[listener.id]">
                <v-icon>mdi-play</v-icon>
              </v-btn>
              <v-btn icon size="small" @click="removeListenerById($event, listener.id)" color="error">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>
          </div>
        </v-card-title>

        <v-card-text>

            <!-- Creative Controls Tabs -->
            <v-tabs v-model="listener.activeTab" class="mt-4">
              <v-tab value="main">Main</v-tab>
              <v-tab value="channels">Channels</v-tab>
              <v-tab value="scale">Scale</v-tab>
              <v-tab value="lfo">LFO</v-tab>
              <v-tab value="sequencer">Step</v-tab>
              <v-tab value="meta">Meta</v-tab>
              <v-tab value="sampling">Buffer</v-tab>
            </v-tabs>

            <v-tabs-window v-model="listener.activeTab" class="mt-4">
              <v-tabs-window-item value="main">

                <!-- Basic Controls Row -->
                <div class="basic-controls-row">
                  <div class="control-group">
                    <v-select
                      v-model="midiOutput[listener.id]"
                      item-title="name"
                      item-value="id"
                      :items="midiOutputs"
                      label="MIDI Output"
                      density="compact"
                      @change="handleOutputChange($event, listener)"
                    />
                  </div>
                  <div class="control-group">
                    <v-number-input
                      v-model="listener.channel"
                      label="Channel"
                      :max="16"
                      :min="1"
                      density="compact"
                    />
                  </div>
                  <div class="control-group">
                    <v-select
                      v-model="listener.listenerMode"
                      :items="listenerModes"
                      label="Mode"
                      density="compact"
                    />
                  </div>
                </div>

                <!-- Position and Sampling Controls -->
                <div class="position-controls-row">
                  <div class="control-group">
                    <v-number-input
                      v-model="listener.x"
                      label="X Position"
                      :max="innerWidth"
                      :min="0"
                      density="compact"
                    />
                  </div>
                  <div class="control-group">
                    <v-number-input
                      v-model="listener.y"
                      label="Y Position"
                      :max="innerHeight"
                      :min="0"
                      density="compact"
                    />
                  </div>
                  <div class="control-group">
                    <v-number-input
                      v-model="listener.radius"
                      label="Radius"
                      :max="maxRadius"
                      :min="0"
                      density="compact"
                    />
                  </div>
                  <div class="control-group">
                    <v-number-input
                      v-model="listener.noteOnThreshold"
                      label="Threshold"
                      :max="127"
                      :min="1"
                      density="compact"
                    />
                  </div>

                </div>

                <!-- HSLA Signal Display -->
                <div class="signal-display">
                  <div class="signal-frame-main" :style="{background: hslaToCssVar(listener.lastAvg)}" />
                  <div class="signal-bars">
                    <div class="signal-bar hue-bar">
                      <div class="signal-fill" :style="{
                        width: (listener.lastAvg.h / 255 * 100) + '%',
                        backgroundColor: hslaToCssVar({h: listener.lastAvg.h, s: 255, l: 127, a: 255})
                      }" />
                    </div>
                    <div class="signal-bar saturation-bar">
                      <div class="signal-fill" :style="{
                        width: (listener.lastAvg.s / 255 * 100) + '%',
                        backgroundColor: hslaToCssVar({h: 120, s: listener.lastAvg.s, l: 127, a: 255})
                      }" />
                    </div>
                    <div class="signal-bar luminance-bar">
                      <div class="signal-fill" :style="{
                        width: (listener.lastAvg.l / 255 * 100) + '%',
                        backgroundColor: hslaToCssVar({h: 120, s: 255, l: listener.lastAvg.l, a: 255})
                      }" />
                    </div>
                    <div class="signal-bar alpha-bar">
                      <div class="signal-fill" :style="{
                        width: (listener.lastAvg.a / 255 * 100) + '%',
                        backgroundColor: 'purple'
                      }" />
                    </div>
                  </div>
                </div>

              </v-tabs-window-item>

              <v-tabs-window-item value="channels">
                  <div class="control-group">
                    <v-select
                      v-model="listener.noteOnChannel"
                      item-title="title"
                      item-value="value"
                      :items="colorChannels"
                      label="Note Trigger"
                      density="compact"
                    />
                    <v-select
                      v-model="listener.velocityChannel"
                      item-title="title"
                      item-value="value"
                      :items="colorChannels"
                      label="Velocity"
                      density="compact"
                    />
                    <v-select
                      v-model="listener.aftertouchChannel"
                      item-title="title"
                      item-value="value"
                      :items="colorChannels"
                      label="Aftertouch"
                      density="compact"
                    />
                    <v-select
                      v-model="listener.lengthChannel"
                      item-title="title"
                      item-value="value"
                      :items="colorChannels"
                      label="Length"
                      density="compact"
                    />
                    <v-select
                      v-model="listener.pitchChannel"
                      item-title="title"
                      item-value="value"
                      :items="colorChannels"
                      label="Note"
                      density="compact"
                    />
                  </div>
              </v-tabs-window-item>
              
              <v-tabs-window-item value="scale">
                <div class="scale-controls">
                  <v-checkbox v-model="listener.scaleGrid.enabled" label="Enable Scale Grid" />

                  <div v-if="listener.scaleGrid.enabled" class="scale-grid-container">
                    <!-- 12x12 Note Mapping Grid -->
                    <div class="note-mapping-grid">
                      <div class="grid-header">
                        <span>Input Notes (0-127)</span>
                        <v-spacer />
                        <span>Output Notes</span>
                      </div>

                      <div class="mapping-grid">
                        <div
                          v-for="inputNote in 144"
                          :key="inputNote - 1"
                          class="note-cell"
                          :class="{
                            'note-active': isNoteInScale(inputNote - 1, listener),
                            'note-root': (inputNote - 1) % 12 === listener.scaleGrid.rootNote % 12
                          }"
                          @click="toggleNoteInScale(inputNote - 1, listener)"
                        >
                          <span class="note-number">{{ inputNote - 1 }}</span>
                          <span class="note-name">{{ getNoteNameFromMidi(inputNote - 1) }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="scale-presets">
                      <v-select
                        v-model="listener.scaleGrid.scale"
                        :items="Object.keys(scaleDefinitions).map(key => ({ value: key, title: key }))"
                        label="Scale Preset"
                        @update:model-value="applyScalePreset(listener)"
                      />
                      <v-number-input
                        v-model="listener.scaleGrid.rootNote"
                        label="Root Note"
                        :min="0"
                        :max="11"
                      />
                    </div>
                  </div>
                </div>
              </v-tabs-window-item>

              <!-- LFO Tab -->
              <v-tabs-window-item value="lfo">
                <div class="lfo-controls">
                  <div v-for="(lfo, lfoIndex) in listener.lfos" :key="lfoIndex" class="lfo-section">
                    <div class="lfo-header">
                      <v-checkbox v-model="lfo.enabled" :label="`LFO ${lfoIndex + 1}`" />
                      <v-btn
                        v-if="listener.lfos.length > 1"
                        icon="mdi-delete"
                        size="small"
                        @click="removeLFO(listener, lfoIndex)"
                      />
                    </div>

                    <div v-if="lfo.enabled" class="lfo-content">
                      <div class="lfo-params">
                        <v-number-input
                          v-model="lfo.rate"
                          label="Rate (Hz)"
                          :min="0.01"
                          :max="20"
                          :step="0.1"
                          density="compact"
                        />
                        <v-number-input
                          v-model="lfo.depth"
                          label="Depth"
                          :min="0"
                          :max="1"
                          :step="0.01"
                          density="compact"
                        />
                        <v-select
                          v-model="lfo.waveform"
                          :items="lfoWaveforms"
                          label="Waveform"
                          density="compact"
                        />
                        <v-select
                          v-model="lfo.target"
                          :items="lfoTargets"
                          label="Target"
                          density="compact"
                        />
                      </div>

                      <!-- LFO Wave Monitor -->
                      <div class="lfo-monitor">
                        <canvas
                          :ref="`lfoCanvas_${listener.id}_${lfoIndex}`"
                          class="lfo-wave-display"
                          width="200"
                          height="60"
                        />
                      </div>
                    </div>
                  </div>

                  <v-btn @click="addLFO(listener)" prepend-icon="mdi-plus" size="small">
                    Add LFO
                  </v-btn>
                </div>
              </v-tabs-window-item>

              <!-- Step Sequencer Tab -->
              <v-tabs-window-item value="sequencer">
                <div class="sequencer-controls">
                  <v-checkbox v-model="listener.stepSequencer.enabled" label="Enable Step Sequencer" />

                  <div v-if="listener.stepSequencer.enabled" class="sequencer-content">
                    <div class="sequencer-params">
                      <v-number-input
                        v-model="listener.stepSequencer.length"
                        label="Pattern Length"
                        :min="1"
                        :max="32"
                        density="compact"
                      />
                      <v-number-input
                        v-model="listener.stepSequencer.swing"
                        label="Swing"
                        :min="0"
                        :max="1"
                        :step="0.01"
                        density="compact"
                      />
                      <v-checkbox v-model="listener.stepSequencer.hslaMode" label="HSLA Sampling Mode" />
                    </div>

                    <!-- Step Grid -->
                    <div class="step-sequencer-grid">
                      <div class="step-row">
                        <div
                          v-for="(step, stepIndex) in listener.stepSequencer.pattern.slice(0, listener.stepSequencer.length)"
                          :key="stepIndex"
                          class="step-cell"
                          :class="{
                            'step-active': step.active,
                            'step-current': stepSequencerStates[listener.id]?.currentStep === stepIndex,
                            'step-hsla': step.hslaMode
                          }"
                          @click="toggleStep(listener, stepIndex)"
                        >
                          <div class="step-number">{{ stepIndex + 1 }}</div>
                          <div v-if="step.hslaMode" class="step-hsla-preview" :style="{
                            backgroundColor: hslaToCssVar(step.hslaValue || {h: 0, s: 0, l: 0, a: 255})
                          }" />
                          <div v-else class="step-note-preview">{{ step.note }}</div>
                        </div>
                      </div>

                      <!-- Step Parameters -->
                      <div v-if="getSelectedStep(listener)" class="step-params">
                        <h4>Step {{ getSelectedStepIndex(listener) + 1 }}</h4>
                        <div class="step-param-grid">
                          <v-checkbox v-model="getSelectedStep(listener).hslaMode" label="HSLA Mode" />

                          <div v-if="getSelectedStep(listener).hslaMode">
                            <v-btn @click="sampleHSLAForStep(listener, getSelectedStepIndex(listener))" size="small">
                              Sample Current HSLA
                            </v-btn>
                            <div class="hsla-display" v-if="getSelectedStep(listener).hslaValue">
                              H: {{ getSelectedStep(listener).hslaValue.h }}
                              S: {{ getSelectedStep(listener).hslaValue.s }}
                              L: {{ getSelectedStep(listener).hslaValue.l }}
                              A: {{ getSelectedStep(listener).hslaValue.a }}
                            </div>
                          </div>

                          <div v-else>
                            <v-number-input
                              v-model="getSelectedStep(listener).note"
                              label="Note"
                              :min="0"
                              :max="127"
                              density="compact"
                            />
                            <v-number-input
                              v-model="getSelectedStep(listener).velocity"
                              label="Velocity"
                              :min="0"
                              :max="127"
                              density="compact"
                            />
                          </div>

                          <v-number-input
                            v-model="getSelectedStep(listener).probability"
                            label="Probability"
                            :min="0"
                            :max="1"
                            :step="0.01"
                            density="compact"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </v-tabs-window-item>

              <!-- Meta Controls Tab -->
              <v-tabs-window-item value="meta">
                <div class="meta-controls">
                  <v-checkbox v-model="listener.metaControls.enabled" label="Enable Meta Controls" />

                  <div v-if="listener.metaControls.enabled" class="meta-content">
                    <v-select
                      v-model="listener.metaControls.sourceListenerId"
                      :items="Object.keys(listeners).filter(id => id !== listener.id).map(id => ({ value: id, title: `Listener ${id.slice(0, 8)}` }))"
                      label="Source Listener"
                      density="compact"
                    />
                    <v-select
                      v-model="listener.metaControls.sourceParameter"
                      :items="colorChannels"
                      label="Source Parameter"
                      density="compact"
                    />
                    <v-select
                      v-model="listener.metaControls.targetParameter"
                      :items="lfoTargets"
                      label="Target Parameter"
                      density="compact"
                    />
                    <v-select
                      v-model="listener.metaControls.mapping"
                      :items="metaControlMappings"
                      label="Mapping Type"
                      density="compact"
                    />
                  </div>
                </div>
              </v-tabs-window-item>

              <!-- Frame Buffer Sampling Tab -->
              <v-tabs-window-item value="sampling">
                <div class="sampling-controls">
                  <v-checkbox v-model="listener.frameBufferSampling.enabled" label="Enable Advanced Sampling" />

                  <div v-if="listener.frameBufferSampling.enabled" class="sampling-content">
                    <v-checkbox v-model="listener.frameBufferSampling.originTracking" label="Origin Tracking" />
                    <v-number-input
                      v-model="listener.frameBufferSampling.temporalBlending"
                      label="Temporal Blending"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      density="compact"
                    />

                    <!-- Sample Points -->
                    <div class="sample-points">
                      <h4>Sample Points</h4>
                      <div v-for="(point, pointIndex) in listener.frameBufferSampling.samplePoints" :key="pointIndex" class="sample-point-row">
                        <v-number-input
                          v-model="point.x"
                          label="X"
                          :min="-100"
                          :max="100"
                          density="compact"
                        />
                        <v-number-input
                          v-model="point.y"
                          label="Y"
                          :min="-100"
                          :max="100"
                          density="compact"
                        />
                        <v-number-input
                          v-model="point.weight"
                          label="Weight"
                          :min="0"
                          :max="2"
                          :step="0.1"
                          density="compact"
                        />
                        <v-btn
                          icon="mdi-delete"
                          size="small"
                          @click="removeSamplePoint(listener, pointIndex)"
                          :disabled="listener.frameBufferSampling.samplePoints.length <= 1"
                        />
                      </div>
                      <v-btn @click="addSamplePoint(listener)" prepend-icon="mdi-plus" size="small">
                        Add Sample Point
                      </v-btn>
                    </div>
                  </div>
                </div>
              </v-tabs-window-item>

            </v-tabs-window>
        </v-card-text>
      </v-card>
    </div>

    <!-- Listener Position Overlays -->
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
    props: {
      isInput: Boolean,
    },
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
          // Scale Grid Configuration
          scaleGrid: {
            enabled: false,
            rootNote: 60, // C4
            scale: 'major',
            customPattern: [0, 2, 4, 5, 7, 9, 11], // major scale intervals
            octaveRange: 3,
          },
          // LFO Configuration
          lfos: [
            {
              enabled: false,
              rate: 1.0, // Hz
              depth: 0.5,
              waveform: 'sine',
              target: 'pitch',
              phase: 0.0,
              bipolar: true,
            }
          ],
          // Meta Control Configuration
          metaControls: {
            enabled: false,
            sourceListenerId: null,
            sourceParameter: 'h',
            targetParameter: 'noteOffset',
            mapping: 'linear',
            scale: 1.0,
            offset: 0.0,
          },
          // Step Sequencer Configuration
          stepSequencer: {
            enabled: false,
            pattern: Array(16).fill().map(() => ({
              active: false,
              note: 60,
              velocity: 100,
              gate: 1.0,
              probability: 1.0,
              microTiming: 0.0,
              hslaMode: false,
              hslaValue: null,
            })),
            length: 16,
            currentStep: 0,
            selectedStep: 0,
            swing: 0.0,
            humanization: 0.0,
          },
          // Frame Buffer Sampling Configuration
          frameBufferSampling: {
            enabled: false,
            samplePoints: [
              { x: 0, y: 0, weight: 1.0 }
            ],
            historyDepth: 4,
            originTracking: true,
            temporalBlending: 0.5,
          },
        },
        movingListenerId: null,
        initialMouseX: 0,
        initialMouseY: 0,
        initialListenerX: 0,
        initialListenerY: 0,
        // Scale definitions for the scale grid
        scaleDefinitions: {
          major: [0, 2, 4, 5, 7, 9, 11],
          minor: [0, 2, 3, 5, 7, 8, 10],
          dorian: [0, 2, 3, 5, 7, 9, 10],
          phrygian: [0, 1, 3, 5, 7, 8, 10],
          lydian: [0, 2, 4, 6, 7, 9, 11],
          mixolydian: [0, 2, 4, 5, 7, 9, 10],
          locrian: [0, 1, 3, 5, 6, 8, 10],
          pentatonic: [0, 2, 4, 7, 9],
          blues: [0, 3, 5, 6, 7, 10],
          chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          wholeTone: [0, 2, 4, 6, 8, 10],
          diminished: [0, 2, 3, 5, 6, 8, 9, 11],
        },
        // LFO waveform definitions
        lfoWaveforms: [
          { value: 'sine', title: 'Sine' },
          { value: 'triangle', title: 'Triangle' },
          { value: 'square', title: 'Square' },
          { value: 'sawtooth', title: 'Sawtooth' },
          { value: 'random', title: 'Random' },
        ],
        // LFO target parameters
        lfoTargets: [
          { value: 'pitch', title: 'Pitch' },
          { value: 'velocity', title: 'Velocity' },
          { value: 'noteOffset', title: 'Note Offset' },
          { value: 'velocityOffset', title: 'Velocity Offset' },
          { value: 'gate', title: 'Gate' },
          { value: 'cc', title: 'CC Value' },
          { value: 'x', title: 'X Position' },
          { value: 'y', title: 'Y Position' },
          { value: 'radius', title: 'Radius' },
        ],
        // Meta control mapping types
        metaControlMappings: [
          { value: 'linear', title: 'Linear' },
          { value: 'exponential', title: 'Exponential' },
          { value: 'logarithmic', title: 'Logarithmic' },
          { value: 'inverse', title: 'Inverse' },
          { value: 'quantized', title: 'Quantized' },
        ],
        // LFO state tracking
        lfoStates: {},
        // Step sequencer state
        stepSequencerStates: {},
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

      // Start LFO wave monitor updates
      this.startLFOMonitorUpdates();
    },

    updated() {
      // Update LFO wave monitors when listeners change
      this.$nextTick(() => {
        Object.values(this.listeners).forEach(listener => {
          listener.lfos.forEach((lfo, lfoIndex) => {
            if (lfo.enabled) {
              this.drawLFOWave(listener, lfoIndex);
            }
          });
        });
      });
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
          // UI state
          activeTab: 'scale',
          // Initialize creative control properties
          scaleGrid: { ...this.outputDefaults.scaleGrid },
          lfos: this.outputDefaults.lfos.map(lfo => ({ ...lfo })),
          metaControls: { ...this.outputDefaults.metaControls },
          stepSequencer: {
            ...this.outputDefaults.stepSequencer,
            pattern: this.outputDefaults.stepSequencer.pattern.map(step => ({ ...step }))
          },
          frameBufferSampling: {
            ...this.outputDefaults.frameBufferSampling,
            samplePoints: this.outputDefaults.frameBufferSampling.samplePoints.map(point => ({ ...point }))
          },
        };

        // Initialize LFO state for this listener
        this.lfoStates[listener.id] = listener.lfos.map(() => ({
          phase: 0.0,
          lastTime: performance.now(),
          value: 0.0,
        }));

        // Initialize step sequencer state
        this.stepSequencerStates[listener.id] = {
          currentStep: 0,
          lastStepTime: 0,
          isPlaying: false,
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
          // Use enhanced processing with creative controls
          this.processListenerEnhanced(listener, ts, pulses);
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

      // ===== CREATIVE CONTROLS METHODS =====

      // LFO System
      updateLFOs(listener, deltaTime) {
        if (!this.lfoStates[listener.id]) return;

        listener.lfos.forEach((lfo, index) => {
          if (!lfo.enabled) return;

          const lfoState = this.lfoStates[listener.id][index];

          // Update phase based on rate
          lfoState.phase += (lfo.rate * deltaTime) / 1000.0;
          if (lfoState.phase > 1.0) lfoState.phase -= 1.0;

          // Calculate LFO value based on waveform
          let value = 0;
          switch (lfo.waveform) {
            case 'sine':
              value = Math.sin(lfoState.phase * Math.PI * 2);
              break;
            case 'triangle':
              value = lfoState.phase < 0.5
                ? (lfoState.phase * 4) - 1
                : 3 - (lfoState.phase * 4);
              break;
            case 'square':
              value = lfoState.phase < 0.5 ? -1 : 1;
              break;
            case 'sawtooth':
              value = (lfoState.phase * 2) - 1;
              break;
            case 'random':
              if (Math.floor(lfoState.phase * 16) !== Math.floor((lfoState.phase - (lfo.rate * deltaTime) / 1000.0) * 16)) {
                value = (Math.random() * 2) - 1;
              } else {
                value = lfoState.value;
              }
              break;
          }

          // Apply bipolar setting
          if (!lfo.bipolar) {
            value = (value + 1) / 2; // Convert from -1..1 to 0..1
          }

          // Apply depth
          value *= lfo.depth;
          lfoState.value = value;

          // Apply LFO to target parameter
          this.applyLFOToParameter(listener, lfo.target, value);
        });
      },

      applyLFOToParameter(listener, target, value) {
        switch (target) {
          case 'pitch':
            // Modulate pitch within a semitone range
            listener.noteOffset += Math.round(value * 12);
            break;
          case 'velocity':
            listener.velocityOffset += Math.round(value * 64);
            break;
          case 'noteOffset':
            listener.noteOffset += Math.round(value * 24);
            break;
          case 'velocityOffset':
            listener.velocityOffset += Math.round(value * 32);
            break;
          case 'gate':
            listener.gate = Math.max(0.1, Math.min(1.0, listener.gate + (value * 0.5)));
            break;
          case 'cc':
            listener.cc = Math.max(0, Math.min(127, listener.cc + Math.round(value * 64)));
            break;
          case 'x':
            listener.x = Math.max(0, Math.min(this.innerWidth, listener.x + (value * 50)));
            break;
          case 'y':
            listener.y = Math.max(0, Math.min(this.innerHeight, listener.y + (value * 50)));
            break;
          case 'radius':
            listener.radius = Math.max(0, Math.min(this.maxRadius, listener.radius + (value * 10)));
            break;
        }
      },

      // Scale Grid System
      applyScaleGrid(listener, rawNote) {
        if (!listener.scaleGrid.enabled) return rawNote;

        const scale = this.scaleDefinitions[listener.scaleGrid.scale] || listener.scaleGrid.customPattern;
        const rootNote = listener.scaleGrid.rootNote;

        // Simple mapping: if note is in scale, keep it; if not, map to nearest scale note
        const noteInOctave = rawNote % 12;
        const octave = Math.floor(rawNote / 12);
        const relativeNote = (noteInOctave - (rootNote % 12) + 12) % 12;

        // Find the closest note in the scale
        let closestScaleNote = scale[0];
        let minDistance = Math.abs(relativeNote - scale[0]);

        for (const scaleNote of scale) {
          const distance = Math.abs(relativeNote - scaleNote);
          if (distance < minDistance) {
            minDistance = distance;
            closestScaleNote = scaleNote;
          }
        }

        const scaledNote = (rootNote % 12) + closestScaleNote + (octave * 12);
        return Math.max(0, Math.min(127, scaledNote));
      },

      // Step Sequencer System
      updateStepSequencer(listener, pulses) {
        if (!listener.stepSequencer.enabled) return null;

        const sequencerState = this.stepSequencerStates[listener.id];
        if (!sequencerState) return null;

        const pattern = listener.stepSequencer.pattern;
        const length = listener.stepSequencer.length;
        const currentStep = sequencerState.currentStep;

        // Check if we should advance to next step
        const stepPulses = this.getPulsesFor(listener.quantize);
        if (pulses % stepPulses === 0) {
          sequencerState.currentStep = (currentStep + 1) % length;

          const step = pattern[currentStep];
          if (step && step.active) {
            // Check probability
            if (Math.random() <= step.probability) {
              // Apply swing and humanization
              const swingOffset = this.calculateSwingOffset(listener.stepSequencer.swing, currentStep);
              const humanizationOffset = (Math.random() - 0.5) * listener.stepSequencer.humanization;

              let note = step.note;
              let velocity = step.velocity;

              // Handle HSLA mode
              if (step.hslaMode && step.hslaValue) {
                const hsla = step.hslaValue;
                note = Math.min(127, listener.noteOffset + Math.floor((hsla.h / 255) * 48));
                velocity = Math.min(127, Math.floor((hsla.s / 255) * 127) + listener.velocityOffset);
              }

              return {
                note,
                velocity,
                gate: step.gate,
                timing: swingOffset + humanizationOffset,
                hslaMode: step.hslaMode,
              };
            }
          }
        }

        return null;
      },

      calculateSwingOffset(swing, stepIndex) {
        // Apply swing to off-beat steps (odd indices)
        if (stepIndex % 2 === 1) {
          return swing * 0.1; // Swing amount in timing offset
        }
        return 0;
      },

      // Meta Control System
      applyMetaControls(listener) {
        if (!listener.metaControls.enabled || !listener.metaControls.sourceListenerId) return;

        const sourceListener = this.listeners[listener.metaControls.sourceListenerId];
        if (!sourceListener) return;

        const sourceValue = this.getParameterValue(sourceListener, listener.metaControls.sourceParameter);
        const mappedValue = this.mapControlValue(
          sourceValue,
          listener.metaControls.mapping,
          listener.metaControls.scale,
          listener.metaControls.offset
        );

        this.setParameterValue(listener, listener.metaControls.targetParameter, mappedValue);
      },

      getParameterValue(listener, parameter) {
        switch (parameter) {
          case 'h': return listener.lastAvg.h;
          case 's': return listener.lastAvg.s;
          case 'l': return listener.lastAvg.l;
          case 'a': return listener.lastAvg.a;
          case 'noteOffset': return listener.noteOffset;
          case 'velocityOffset': return listener.velocityOffset;
          case 'x': return listener.x;
          case 'y': return listener.y;
          case 'radius': return listener.radius;
          case 'gate': return listener.gate;
          default: return 0;
        }
      },

      setParameterValue(listener, parameter, value) {
        switch (parameter) {
          case 'noteOffset':
            listener.noteOffset = Math.max(-127, Math.min(127, value));
            break;
          case 'velocityOffset':
            listener.velocityOffset = Math.max(-127, Math.min(127, value));
            break;
          case 'x':
            listener.x = Math.max(0, Math.min(this.innerWidth, value));
            break;
          case 'y':
            listener.y = Math.max(0, Math.min(this.innerHeight, value));
            break;
          case 'radius':
            listener.radius = Math.max(0, Math.min(this.maxRadius, value));
            break;
          case 'gate':
            listener.gate = Math.max(0.1, Math.min(1.0, value));
            break;
        }
      },

      mapControlValue(value, mapping, scale, offset) {
        let mappedValue = value;

        switch (mapping) {
          case 'linear':
            mappedValue = value;
            break;
          case 'exponential':
            mappedValue = Math.pow(value / 255, 2) * 255;
            break;
          case 'logarithmic':
            mappedValue = Math.log(1 + (value / 255)) / Math.log(2) * 255;
            break;
          case 'inverse':
            mappedValue = 255 - value;
            break;
          case 'quantized':
            mappedValue = Math.round(value / 32) * 32;
            break;
        }

        return (mappedValue * scale) + offset;
      },

      // Frame Buffer Sampling System
      sampleFrameBufferWithOrigin(listener) {
        if (!listener.frameBufferSampling.enabled) {
          // Fallback to standard sampling
          return this.sample(
            Math.floor(listener.x * this.ca.pixelScale),
            Math.floor(listener.y * this.ca.pixelScale),
            listener.radius
          );
        }

        const sampling = listener.frameBufferSampling;
        let combinedAvg = { h: 0, s: 0, l: 0, a: 0 };
        let combinedVariance = { h: 0, s: 0, l: 0, a: 0 };
        let totalWeight = 0;

        // Sample from multiple points
        sampling.samplePoints.forEach(point => {
          const sampleX = Math.floor((listener.x + point.x) * this.ca.pixelScale);
          const sampleY = Math.floor((listener.y + point.y) * this.ca.pixelScale);

          const { avg, variance } = this.sample(sampleX, sampleY, listener.radius);

          // Weight the samples
          const weight = point.weight;
          combinedAvg.h += avg.h * weight;
          combinedAvg.s += avg.s * weight;
          combinedAvg.l += avg.l * weight;
          combinedAvg.a += avg.a * weight;

          combinedVariance.h += variance.h * weight;
          combinedVariance.s += variance.s * weight;
          combinedVariance.l += variance.l * weight;
          combinedVariance.a += variance.a * weight;

          totalWeight += weight;
        });

        // Normalize by total weight
        if (totalWeight > 0) {
          combinedAvg.h /= totalWeight;
          combinedAvg.s /= totalWeight;
          combinedAvg.l /= totalWeight;
          combinedAvg.a /= totalWeight;

          combinedVariance.h /= totalWeight;
          combinedVariance.s /= totalWeight;
          combinedVariance.l /= totalWeight;
          combinedVariance.a /= totalWeight;
        }

        // Apply temporal blending with history if enabled
        if (sampling.originTracking && listener.lastAvg) {
          const blend = sampling.temporalBlending;
          combinedAvg.h = (combinedAvg.h * (1 - blend)) + (listener.lastAvg.h * blend);
          combinedAvg.s = (combinedAvg.s * (1 - blend)) + (listener.lastAvg.s * blend);
          combinedAvg.l = (combinedAvg.l * (1 - blend)) + (listener.lastAvg.l * blend);
          combinedAvg.a = (combinedAvg.a * (1 - blend)) + (listener.lastAvg.a * blend);
        }

        return { avg: combinedAvg, variance: combinedVariance };
      },

      // Enhanced processListener with creative controls integration
      processListenerEnhanced(listener, ts, pulses) {
        const currentTime = performance.now();
        const deltaTime = currentTime - (this.lfoStates[listener.id]?.[0]?.lastTime || currentTime);

        // Update all LFOs
        this.updateLFOs(listener, deltaTime);

        // Apply meta controls
        this.applyMetaControls(listener);

        // Check step sequencer
        const stepData = this.updateStepSequencer(listener, pulses);

        // Sample frame buffer with enhanced sampling
        const { avg, variance } = this.sampleFrameBufferWithOrigin(listener);

        // Calculate note and velocity with creative controls
        let note = listener.pitchChannel === 'f'
          ? listener.noteOffset
          : Math.min(127, listener.noteOffset + Math.floor((avg[listener.pitchChannel] / 255) * 48));

        // Apply scale grid
        note = this.applyScaleGrid(listener, note);

        // Override with step sequencer if active
        if (stepData) {
          note = stepData.note;
        }

        const velocity = stepData
          ? stepData.velocity
          : Math.min(127, Math.floor((avg[listener.velocityChannel] / 255) * 127) + listener.velocityOffset);

        const cc = Math.floor(variance[listener.noteOnChannel]);

        // Continue with standard MIDI output logic...
        const noteValue = listener.quantize + (listener.dotted || '') + (listener.triplet || '');
        const notePulses = this.getPulsesFor(noteValue);
        const noteMsValue = (this.msPerBeat / 24) * notePulses;

        const output = this.midiOutput[listener.id];
        if (output) {
          const quantizedTs = this.quantizeToClock(performance.now());

          if (listener.listenerMode === 'note' || listener.listenerMode === 'both') {
            if (listener.noteOnThreshold < avg[listener.noteOnChannel] || listener.noteOnChannel === 'f' || stepData) {

              const gate = stepData ? stepData.gate : listener.gate;
              const noteOffTs = this.quantizeToClock(performance.now() + avg[listener.lengthChannel] * (noteMsValue * gate));

              if (pulses % notePulses === 0) {
                output.send([0x80 + listener.channel, note, 0], noteOffTs);
                output.send([0x90 + listener.channel, note, velocity], quantizedTs);

                listener.lastNote = note;
                listener.lastVelocity = velocity;
                listener.lastMessageTime = quantizedTs;

                emit('midi:note', { channel: listener.channel, note, velocity, time: quantizedTs });
              }
            }
          }

          if (listener.listenerMode === 'cc' || listener.listenerMode === 'both') {
            if (listener.cc) {
              emit('midi:cc', { channel: listener.channel, cc: listener.cc, value: cc, time: quantizedTs });
              output.send([0xB0 + listener.channel, listener.cc, cc], quantizedTs);
              listener.lastMessageTime = quantizedTs;
            }
          }
        }

        // Update LFO timing
        if (this.lfoStates[listener.id]) {
          this.lfoStates[listener.id].forEach(lfoState => {
            lfoState.lastTime = currentTime;
          });
        }

        listener.lastAvg = avg;
        listener.lastVariance = variance;
      },

      // ===== UI HELPER METHODS =====

      // LFO Management
      addLFO(listener) {
        listener.lfos.push({
          enabled: false,
          rate: 1.0,
          depth: 0.5,
          waveform: 'sine',
          target: 'pitch',
          phase: 0.0,
          bipolar: true,
        });

        // Initialize LFO state
        if (!this.lfoStates[listener.id]) {
          this.lfoStates[listener.id] = [];
        }
        this.lfoStates[listener.id].push({
          phase: 0.0,
          lastTime: performance.now(),
          value: 0.0,
        });
      },

      // Step Sequencer Management
      toggleStep(listener, stepIndex) {
        const step = listener.stepSequencer.pattern[stepIndex];
        step.active = !step.active;

        // Set as selected step for editing
        listener.stepSequencer.selectedStep = stepIndex;
      },

      getSelectedStep(listener) {
        const selectedIndex = listener.stepSequencer.selectedStep;
        if (selectedIndex !== undefined && selectedIndex >= 0) {
          return listener.stepSequencer.pattern[selectedIndex];
        }
        return null;
      },

      getSelectedStepIndex(listener) {
        return listener.stepSequencer.selectedStep || 0;
      },

      // Frame Buffer Sampling Management
      addSamplePoint(listener) {
        listener.frameBufferSampling.samplePoints.push({
          x: 0,
          y: 0,
          weight: 1.0,
        });
      },

      removeSamplePoint(listener, pointIndex) {
        if (listener.frameBufferSampling.samplePoints.length > 1) {
          listener.frameBufferSampling.samplePoints.splice(pointIndex, 1);
        }
      },

      // ===== NEW UI METHODS =====

      // Scale Grid Methods
      isNoteInScale(note, listener) {
        if (!listener.scaleGrid.enabled) return true;
        const scale = this.scaleDefinitions[listener.scaleGrid.scale] || listener.scaleGrid.customPattern;
        const noteInOctave = note % 12;
        const rootNote = listener.scaleGrid.rootNote % 12;
        const relativeNote = (noteInOctave - rootNote + 12) % 12;
        return scale.includes(relativeNote);
      },

      toggleNoteInScale(note, listener) {
        if (!listener.scaleGrid.customPattern) {
          listener.scaleGrid.customPattern = [...(this.scaleDefinitions[listener.scaleGrid.scale] || [0])];
        }

        const noteInOctave = note % 12;
        const rootNote = listener.scaleGrid.rootNote % 12;
        const relativeNote = (noteInOctave - rootNote + 12) % 12;

        const index = listener.scaleGrid.customPattern.indexOf(relativeNote);
        if (index >= 0) {
          listener.scaleGrid.customPattern.splice(index, 1);
        } else {
          listener.scaleGrid.customPattern.push(relativeNote);
          listener.scaleGrid.customPattern.sort((a, b) => a - b);
        }

        listener.scaleGrid.scale = 'custom';
      },

      applyScalePreset(listener) {
        const scale = this.scaleDefinitions[listener.scaleGrid.scale];
        if (scale) {
          listener.scaleGrid.customPattern = [...scale];
        }
      },

      getNoteNameFromMidi(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const note = noteNames[midiNote % 12];
        return `${note}${octave}`;
      },

      // LFO Methods
      removeLFO(listener, lfoIndex) {
        if (listener.lfos.length > 1) {
          listener.lfos.splice(lfoIndex, 1);
          this.lfoStates[listener.id].splice(lfoIndex, 1);
        }
      },

      // Step Sequencer Methods
      sampleHSLAForStep(listener, stepIndex) {
        const step = listener.stepSequencer.pattern[stepIndex];
        if (step) {
          step.hslaValue = { ...listener.lastAvg };
          step.hslaMode = true;
        }
      },

      // Utility Methods
      hslaToCssVar(hsla) {
        if (!hsla) return 'transparent';
        const h = (hsla.h / 255) * 360;
        const s = (hsla.s / 255) * 100;
        const l = (hsla.l / 255) * 100;
        const a = hsla.a / 255;
        return `hsla(${h}, ${s}%, ${l}%, ${a})`;
      },

      // LFO Wave Monitor
      drawLFOWave(listener, lfoIndex) {
        const canvasRef = this.$refs[`lfoCanvas_${listener.id}_${lfoIndex}`];
        if (!canvasRef || !canvasRef[0]) return;

        const canvas = canvasRef[0];
        const ctx = canvas.getContext('2d');
        const lfo = listener.lfos[lfoIndex];
        const lfoState = this.lfoStates[listener.id]?.[lfoIndex];

        if (!lfo || !lfoState) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        // Horizontal center line
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Vertical grid lines
        for (let i = 0; i <= 4; i++) {
          const x = (i / 4) * canvas.width;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }

        // Draw waveform
        ctx.setLineDash([]);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const points = 200;
        for (let i = 0; i < points; i++) {
          const phase = i / points;
          let value = 0;

          switch (lfo.waveform) {
            case 'sine':
              value = Math.sin(phase * Math.PI * 2);
              break;
            case 'triangle':
              value = phase < 0.5 ? (phase * 4) - 1 : 3 - (phase * 4);
              break;
            case 'square':
              value = phase < 0.5 ? -1 : 1;
              break;
            case 'sawtooth':
              value = (phase * 2) - 1;
              break;
            case 'random':
              value = (Math.random() * 2) - 1;
              break;
          }

          if (!lfo.bipolar) {
            value = (value + 1) / 2;
          }

          value *= lfo.depth;

          const x = (i / points) * canvas.width;
          const y = canvas.height / 2 - (value * canvas.height / 2);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();

        // Draw current position
        const currentX = (lfoState.phase % 1) * canvas.width;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX, canvas.height);
        ctx.stroke();
      },

      // LFO Monitor Updates
      startLFOMonitorUpdates() {
        const updateLFOMonitors = () => {
          Object.values(this.listeners).forEach(listener => {
            listener.lfos.forEach((lfo, lfoIndex) => {
              if (lfo.enabled) {
                this.drawLFOWave(listener, lfoIndex);
              }
            });
          });
          requestAnimationFrame(updateLFOMonitors);
        };
        updateLFOMonitors();
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
    border-width: 1px;
    border-bottom-style: solid;
    border-color: #FFFFFF55
  }

  /* Creative Controls Styles */
  .scale-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .grid-row {
    display: flex;
    gap: 2px;
  }

  .scale-note {
    min-width: 32px !important;
    height: 32px;
    font-size: 10px;
  }

  .scale-note-active {
    background-color: var(--v-theme-primary) !important;
  }

  .lfo-section {
    border: 1px solid #333;
    padding: 12px;
    border-radius: 4px;
  }

  .lfo-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }

  .step-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .step-row {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
  }

  .step-button {
    min-width: 40px !important;
    height: 40px;
    font-size: 12px;
  }

  .step-active {
    background-color: var(--v-theme-success) !important;
  }

  .step-current {
    border: 2px solid var(--v-theme-secondary) !important;
  }

  .step-params {
    border: 1px solid #333;
    padding: 12px;
    border-radius: 4px;
  }

  .sample-point {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
    padding: 8px;
    border: 1px solid #444;
    border-radius: 4px;
  }

  .sample-points {
    border: 1px solid #333;
    padding: 12px;
    border-radius: 4px;
  }

  /* New UI Styles */
  .midi-interface {
    padding: 16px;
  }

  .status-indicators {
    display: flex;
    gap: 8px;
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid #666;
  }

  .global-controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    align-items: end;
  }

  .listener-card {
    border: 1px solid #333;
  }

  .listener-header {
    background: rgba(255, 255, 255, 0.05);
  }

  .listener-color-indicator {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin-right: 12px;
  }

  .listener-title {
    font-weight: 500;
  }

  .listener-actions {
    display: flex;
    gap: 8px;
  }

  .basic-controls-row,
  .position-controls-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .control-group {
    min-width: 0;
  }

  .signal-display {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  .signal-frame-main {
    width: 60px;
    height: 60px;
    border-radius: 4px;
    border: 1px solid #666;
  }

  .signal-bars {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .signal-bar {
    height: 12px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    position: relative;
    overflow: hidden;
  }

  .signal-fill {
    height: 100%;
    transition: width 0.1s ease;
  }

  /* Scale Grid Styles */
  .note-mapping-grid {
    margin: 16px 0;
  }

  .grid-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .mapping-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 2px;
    max-height: 400px;
    overflow-y: auto;
  }

  .note-cell {
    aspect-ratio: 1;
    border: 1px solid #444;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 10px;
    transition: all 0.2s ease;
  }

  .note-cell:hover {
    border-color: #666;
    background: rgba(255, 255, 255, 0.05);
  }

  .note-cell.note-active {
    background: var(--v-theme-primary);
    border-color: var(--v-theme-primary);
  }

  .note-cell.note-root {
    border-color: var(--v-theme-secondary);
    border-width: 2px;
  }

  .note-number {
    font-weight: bold;
  }

  .note-name {
    font-size: 8px;
    opacity: 0.7;
  }

  .scale-presets {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    margin-top: 16px;
  }

  /* LFO Styles */
  .lfo-section {
    border: 1px solid #444;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .lfo-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .lfo-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .lfo-params {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
  }

  .lfo-monitor {
    border: 1px solid #333;
    border-radius: 4px;
    padding: 8px;
    background: #000;
  }

  .lfo-wave-display {
    width: 100%;
    height: 60px;
    border-radius: 2px;
  }

  /* Step Sequencer Styles */
  .sequencer-params {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .step-sequencer-grid {
    border: 1px solid #333;
    border-radius: 4px;
    padding: 12px;
  }

  .step-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
    gap: 4px;
    margin-bottom: 16px;
  }

  .step-cell {
    aspect-ratio: 1;
    border: 1px solid #444;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .step-cell:hover {
    border-color: #666;
  }

  .step-cell.step-active {
    background: var(--v-theme-primary);
    border-color: var(--v-theme-primary);
  }

  .step-cell.step-current {
    border-color: var(--v-theme-secondary);
    border-width: 2px;
    box-shadow: 0 0 8px var(--v-theme-secondary);
  }

  .step-cell.step-hsla {
    border-color: var(--v-theme-accent);
  }

  .step-number {
    font-size: 10px;
    font-weight: bold;
  }

  .step-hsla-preview {
    width: 20px;
    height: 8px;
    border-radius: 2px;
    margin-top: 2px;
  }

  .step-note-preview {
    font-size: 8px;
    margin-top: 2px;
  }

  .step-params {
    border: 1px solid #333;
    border-radius: 4px;
    padding: 12px;
  }

  .step-param-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
    margin-top: 8px;
  }

  .hsla-display {
    font-family: monospace;
    font-size: 12px;
    background: rgba(0, 0, 0, 0.3);
    padding: 8px;
    border-radius: 4px;
    margin-top: 8px;
  }

  /* Meta Controls and Sampling Styles */
  .meta-content,
  .sampling-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .sample-point-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
  }
</style>
