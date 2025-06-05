import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the utils
vi.mock('../../utils.js', () => ({
  getRandomColor: () => '#ff0000',
  getRandomIntInclusive: (min, max) => min,
  hexToHslaU8: () => ({ h: 0, s: 0, l: 0, a: 255 }),
  newId: () => 'test-id-123'
}))

// Mock global functions
global.emit = vi.fn()
global.listen = vi.fn()
global.removeListener = vi.fn()
global.innerWidth = 1920
global.innerHeight = 1080

// Mock performance.now
global.performance = {
  now: vi.fn(() => 1000)
}

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16))

// Create a mock MIDI component class for testing
class MockMidiComponent {
  constructor() {
    this.listeners = {}
    this.midiOutputs = []
    this.lfoStates = {}
    this.stepSequencerStates = {}
    this.innerWidth = 1920
    this.innerHeight = 1080
    this.maxRadius = 100

    this.outputDefaults = {
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
      scaleGrid: {
        enabled: false,
        rootNote: 60,
        scale: 'major',
        customPattern: [0, 2, 4, 5, 7, 9, 11],
        octaveRange: 3,
      },
      lfos: [
        {
          enabled: false,
          rate: 1.0,
          depth: 0.5,
          waveform: 'sine',
          target: 'pitch',
          phase: 0.0,
          bipolar: true,
        }
      ],
      metaControls: {
        enabled: false,
        sourceListenerId: null,
        sourceParameter: 'h',
        targetParameter: 'noteOffset',
        mapping: 'linear',
        scale: 1.0,
        offset: 0.0,
      },
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
      frameBufferSampling: {
        enabled: false,
        samplePoints: [
          { x: 0, y: 0, weight: 1.0 }
        ],
        historyDepth: 4,
        originTracking: true,
        temporalBlending: 0.5,
      },
    }

    this.scaleDefinitions = {
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
    }

    this.ca = {
      pixelScale: 1,
      buffer: new Uint8Array(1000),
      universe: {
        width: () => 100,
        height: () => 100
      },
      useShader: false,
      caShader: null
    }
  }
}

describe('Midi Component Core Functionality', () => {
  let midiComponent

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    midiComponent = new MockMidiComponent()
  })

  describe('Basic Functionality', () => {
    it('should initialize with default data', () => {
      expect(midiComponent.listeners).toEqual({})
      expect(midiComponent.midiOutputs).toEqual([])
      expect(midiComponent.lfoStates).toEqual({})
      expect(midiComponent.stepSequencerStates).toEqual({})
    })

    it('should have correct output defaults', () => {
      const defaults = midiComponent.outputDefaults
      expect(defaults.channel).toBe(1)
      expect(defaults.noteOffset).toBe(32)
      expect(defaults.velocityOffset).toBe(16)
      expect(defaults.scaleGrid.enabled).toBe(false)
      expect(defaults.lfos).toHaveLength(1)
      expect(defaults.stepSequencer.enabled).toBe(false)
    })
  })

  // Add the core methods to the mock component
  beforeEach(() => {
    // Add MIDI listener management methods
    midiComponent.addMidiListener = function() {
      const listener = {
        id: 'test-id-123',
        version: '1.0.0',
        x: this.innerWidth / 2,
        y: this.innerHeight / 2,
        color: '#ff0000',
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
        activeTab: 'scale',
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
      }

      this.lfoStates[listener.id] = listener.lfos.map(() => ({
        phase: 0.0,
        lastTime: performance.now(),
        value: 0.0,
      }))

      this.stepSequencerStates[listener.id] = {
        currentStep: 0,
        lastStepTime: 0,
        isPlaying: false,
      }

      this.listeners[listener.id] = listener
      return listener
    }

    midiComponent.removeListenerById = function(event, id) {
      delete this.listeners[id]
      delete this.lfoStates[id]
      delete this.stepSequencerStates[id]
    }

    // Scale Grid Methods
    midiComponent.isNoteInScale = function(note, listener) {
      if (!listener.scaleGrid.enabled) return true
      const scale = this.scaleDefinitions[listener.scaleGrid.scale] || listener.scaleGrid.customPattern
      const noteInOctave = note % 12
      const rootNote = listener.scaleGrid.rootNote % 12
      const relativeNote = (noteInOctave - rootNote + 12) % 12
      return scale.includes(relativeNote)
    }

    midiComponent.toggleNoteInScale = function(note, listener) {
      if (!listener.scaleGrid.customPattern) {
        listener.scaleGrid.customPattern = [...(this.scaleDefinitions[listener.scaleGrid.scale] || [0])]
      }

      const noteInOctave = note % 12
      const rootNote = listener.scaleGrid.rootNote % 12
      const relativeNote = (noteInOctave - rootNote + 12) % 12

      const index = listener.scaleGrid.customPattern.indexOf(relativeNote)
      if (index >= 0) {
        listener.scaleGrid.customPattern.splice(index, 1)
      } else {
        listener.scaleGrid.customPattern.push(relativeNote)
        listener.scaleGrid.customPattern.sort((a, b) => a - b)
      }

      listener.scaleGrid.scale = 'custom'
    }

    midiComponent.applyScalePreset = function(listener) {
      const scale = this.scaleDefinitions[listener.scaleGrid.scale]
      if (scale) {
        listener.scaleGrid.customPattern = [...scale]
      }
    }

    midiComponent.applyScaleGrid = function(listener, rawNote) {
      if (!listener.scaleGrid.enabled) return rawNote
      const scale = this.scaleDefinitions[listener.scaleGrid.scale] || listener.scaleGrid.customPattern
      const rootNote = listener.scaleGrid.rootNote

      // Simple mapping: if note is in scale, keep it; if not, map to nearest scale note
      const noteInOctave = rawNote % 12
      const octave = Math.floor(rawNote / 12)
      const relativeNote = (noteInOctave - (rootNote % 12) + 12) % 12

      // Find the closest note in the scale
      let closestScaleNote = scale[0]
      let minDistance = Math.abs(relativeNote - scale[0])

      for (const scaleNote of scale) {
        const distance = Math.abs(relativeNote - scaleNote)
        if (distance < minDistance) {
          minDistance = distance
          closestScaleNote = scaleNote
        }
      }

      const scaledNote = (rootNote % 12) + closestScaleNote + (octave * 12)
      return Math.max(0, Math.min(127, scaledNote))
    }

    midiComponent.getNoteNameFromMidi = function(midiNote) {
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
      const octave = Math.floor(midiNote / 12) - 1
      const note = noteNames[midiNote % 12]
      return `${note}${octave}`
    }

    // LFO Methods
    midiComponent.updateLFOs = function(listener, deltaTime) {
      if (!this.lfoStates[listener.id]) return

      listener.lfos.forEach((lfo, index) => {
        if (!lfo.enabled) return

        const lfoState = this.lfoStates[listener.id][index]

        lfoState.phase += (lfo.rate * deltaTime) / 1000.0
        if (lfoState.phase > 1.0) lfoState.phase -= 1.0

        let value = 0
        switch (lfo.waveform) {
          case 'sine':
            value = Math.sin(lfoState.phase * Math.PI * 2)
            break
          case 'triangle':
            value = lfoState.phase < 0.5
              ? (lfoState.phase * 4) - 1
              : 3 - (lfoState.phase * 4)
            break
          case 'square':
            value = lfoState.phase < 0.5 ? -1 : 1
            break
          case 'sawtooth':
            value = (lfoState.phase * 2) - 1
            break
          case 'random':
            if (Math.floor(lfoState.phase * 16) !== Math.floor((lfoState.phase - (lfo.rate * deltaTime) / 1000.0) * 16)) {
              value = (Math.random() * 2) - 1
            } else {
              value = lfoState.value
            }
            break
        }

        if (!lfo.bipolar) {
          value = (value + 1) / 2
        }

        value *= lfo.depth
        lfoState.value = value
      })
    }

    midiComponent.addLFO = function(listener) {
      listener.lfos.push({
        enabled: false,
        rate: 1.0,
        depth: 0.5,
        waveform: 'sine',
        target: 'pitch',
        phase: 0.0,
        bipolar: true,
      })

      if (!this.lfoStates[listener.id]) {
        this.lfoStates[listener.id] = []
      }
      this.lfoStates[listener.id].push({
        phase: 0.0,
        lastTime: performance.now(),
        value: 0.0,
      })
    }

    midiComponent.removeLFO = function(listener, lfoIndex) {
      if (listener.lfos.length > 1) {
        listener.lfos.splice(lfoIndex, 1)
        this.lfoStates[listener.id].splice(lfoIndex, 1)
      }
    }
  })

  describe('Listener Management', () => {
    it('should add a new MIDI listener', () => {
      const initialCount = Object.keys(midiComponent.listeners).length
      const listener = midiComponent.addMidiListener()

      expect(Object.keys(midiComponent.listeners)).toHaveLength(initialCount + 1)

      expect(listener.id).toBe('test-id-123')
      expect(listener.channel).toBe(1)
      expect(listener.activeTab).toBe('scale')
      expect(listener.scaleGrid).toBeDefined()
      expect(listener.lfos).toHaveLength(1)
      expect(listener.stepSequencer).toBeDefined()
    })

    it('should remove a MIDI listener', () => {
      const listener = midiComponent.addMidiListener()
      const listenerId = listener.id

      midiComponent.removeListenerById(null, listenerId)

      expect(midiComponent.listeners[listenerId]).toBeUndefined()
    })

    it('should initialize LFO and step sequencer states when adding listener', () => {
      const listener = midiComponent.addMidiListener()
      const listenerId = listener.id

      expect(midiComponent.lfoStates[listenerId]).toBeDefined()
      expect(midiComponent.lfoStates[listenerId]).toHaveLength(1)
      expect(midiComponent.stepSequencerStates[listenerId]).toBeDefined()
    })
  })

  describe('Scale Grid System', () => {
    let listener

    beforeEach(() => {
      listener = midiComponent.addMidiListener()
      listener.scaleGrid.enabled = true
      listener.scaleGrid.scale = 'major'
      listener.scaleGrid.rootNote = 0 // C
    })

    it('should check if note is in scale', () => {
      expect(midiComponent.isNoteInScale(0, listener)).toBe(true) // C
      expect(midiComponent.isNoteInScale(2, listener)).toBe(true) // D
      expect(midiComponent.isNoteInScale(1, listener)).toBe(false) // C#
      expect(midiComponent.isNoteInScale(3, listener)).toBe(false) // D#
    })

    it('should toggle note in custom scale', () => {
      midiComponent.toggleNoteInScale(1, listener) // Add C#

      expect(listener.scaleGrid.customPattern).toContain(1)
      expect(listener.scaleGrid.scale).toBe('custom')

      midiComponent.toggleNoteInScale(1, listener) // Remove C#
      expect(listener.scaleGrid.customPattern).not.toContain(1)
    })

    it('should apply scale preset', () => {
      listener.scaleGrid.scale = 'minor'
      midiComponent.applyScalePreset(listener)

      expect(listener.scaleGrid.customPattern).toEqual([0, 2, 3, 5, 7, 8, 10])
    })

    it('should apply scale grid to notes', () => {
      const scaledNote = midiComponent.applyScaleGrid(listener, 1) // C# -> should map to D
      expect(scaledNote).not.toBe(1)

      const unscaledNote = midiComponent.applyScaleGrid(listener, 2) // D -> should stay D
      expect(unscaledNote).toBe(2)
    })

    it('should get correct note name from MIDI', () => {
      expect(midiComponent.getNoteNameFromMidi(60)).toBe('C4')
      expect(midiComponent.getNoteNameFromMidi(61)).toBe('C#4')
      expect(midiComponent.getNoteNameFromMidi(72)).toBe('C5')
    })
  })

  describe('LFO System', () => {
    let listener

    beforeEach(() => {
      listener = midiComponent.addMidiListener()
      listener.lfos[0].enabled = true
      listener.lfos[0].rate = 1.0
      listener.lfos[0].depth = 0.5
      listener.lfos[0].waveform = 'sine'
      listener.lfos[0].target = 'pitch'
    })

    it('should update LFO values', () => {
      const deltaTime = 100 // 100ms
      const initialPhase = midiComponent.lfoStates[listener.id][0].phase

      midiComponent.updateLFOs(listener, deltaTime)

      const newPhase = midiComponent.lfoStates[listener.id][0].phase
      expect(newPhase).toBeGreaterThan(initialPhase)
    })

    it('should generate correct waveform values', () => {
      const lfoState = midiComponent.lfoStates[listener.id][0]

      // Test sine wave at phase 0
      lfoState.phase = 0
      midiComponent.updateLFOs(listener, 0)
      expect(lfoState.value).toBeCloseTo(0, 1)

      // Test sine wave at phase 0.25 (90 degrees)
      lfoState.phase = 0.25
      midiComponent.updateLFOs(listener, 0)
      expect(lfoState.value).toBeCloseTo(0.5, 1)
    })

    it('should add and remove LFOs', () => {
      expect(listener.lfos).toHaveLength(1)

      midiComponent.addLFO(listener)
      expect(listener.lfos).toHaveLength(2)
      expect(midiComponent.lfoStates[listener.id]).toHaveLength(2)

      midiComponent.removeLFO(listener, 1)
      expect(listener.lfos).toHaveLength(1)
      expect(midiComponent.lfoStates[listener.id]).toHaveLength(1)
    })

    it('should not remove last LFO', () => {
      midiComponent.removeLFO(listener, 0)
      expect(listener.lfos).toHaveLength(1)
    })
  })

})
