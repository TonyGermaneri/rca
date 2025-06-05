# Shader-based Cellular Automata Implementation

This document describes the WebGL2 shader implementation of the Rust cellular automata that runs exactly like the CPU version.

## Overview

The shader implementation (`client/src/components/caShader.js`) provides a GPU-accelerated version of the cellular automata that replicates the exact logic from the Rust implementation in `src/lib.rs`.

## Features

### Exact Rust Implementation Match
- **18-bit Rule System**: Supports the same B0-B8/S0-S8 birth/survival rules
- **HSLA Color Model**: Full 4-channel hue, saturation, luminance, alpha processing
- **Life Channels**: Configurable life channel (Hue, Saturation, Luminance, or Alpha)
- **Complex State Transitions**: All 4 state transition cases from the Rust version
- **Circular Hue Averaging**: Proper circular averaging using sin/cos for hue values
- **Parameter Matching**: All 11 LifeParams exactly replicated

### Performance Benefits
- **GPU Acceleration**: Runs on graphics card for massive parallelization
- **Real-time Processing**: Can handle larger grids at higher frame rates
- **Double Buffering**: Efficient ping-pong rendering between textures

### Seamless Integration
- **Drop-in Replacement**: Toggle between CPU and GPU modes without restart
- **State Synchronization**: Automatic sync when switching between modes
- **Same API**: Identical interface to the Rust version

## Usage

### Basic Setup
```javascript
import CAShader from './caShader.js';

// Create shader instance
const caShader = new CAShader(canvas);
caShader.resize(width, height);

// Set parameters (matching Rust LifeParams)
caShader.setParams(
  rule,                 // 18-bit birth/survival mask
  decay_step,          // Decay step size
  recovery_step,       // Recovery step size
  sat_recovery_factor, // Saturation recovery factor
  sat_decay_factor,    // Saturation decay factor
  lum_decay_factor,    // Luminance decay factor
  life_decay_factor,   // Life decay factor
  sat_ghost_factor,    // Saturation ghost factor
  hue_drift_strength,  // Hue drift randomness
  hue_lerp_factor,     // Hue interpolation factor
  life_channel         // Life channel (0=Hue, 1=Sat, 2=Lum, 3=Alpha)
);
```

### Running the Simulation
```javascript
// Initialize with random state
caShader.randomize();

// Or load from existing buffer
caShader.loadFromBuffer(buffer, width, height);

// Advance one generation
caShader.tick();

// Render to canvas
caShader.render(useAlpha, useRGB);
```

### UI Integration
The shader version is integrated into the existing UI:

1. **Toggle Button**: CPU/GPU button in the control panel
2. **Automatic Fallback**: Falls back to CPU if WebGL2 not supported
3. **Parameter Sync**: All parameter changes apply to both versions
4. **State Sync**: Switching modes preserves the current CA state

## Technical Implementation

### Shader Architecture
- **Compute Shader**: Fragment shader that processes CA logic
- **Render Shader**: Fragment shader for display with HSL→RGB conversion
- **Double Buffering**: Two textures for ping-pong rendering
- **Float Textures**: RGBA32F textures for precise calculations

### Key Algorithms Replicated

#### Neighbor Calculation
```glsl
// 8-neighbor Moore neighborhood with toroidal wrapping
vec2 offsets[8] = vec2[8](
  vec2(-1.0, -1.0), vec2(-1.0,  0.0), vec2(-1.0,  1.0),
  vec2( 0.0, -1.0),                    vec2( 0.0,  1.0),
  vec2( 1.0, -1.0), vec2( 1.0,  0.0), vec2( 1.0,  1.0)
);
```

#### Rule Application
```glsl
// 18-bit birth/survival rule
float bit_index = live_neighbors + (currently_alive ? 9.0 : 0.0);
bool next_alive = mod(floor(u_rule / pow(2.0, bit_index)), 2.0) == 1.0;
```

#### Hue Circular Averaging
```glsl
// Circular averaging using trigonometry
float angle = neighbor.r * TAU_DIV_255;
sin_sum += sin(angle);
cos_sum += cos(angle);
float mean_angle = atan(sin_sum, cos_sum);
```

### State Transitions
The shader implements all 4 state transition cases:

1. **Alive → Alive**: Cell survives, saturation recovery
2. **Alive → Dead**: Cell dies, decay applied to all channels
3. **Dead → Alive**: Cell born, inherits averaged neighbor properties
4. **Dead → Dead**: Cell stays dead, ghost decay applied

## Performance Considerations

### Memory Usage
- **Texture Memory**: 2 × width × height × 16 bytes (RGBA32F)
- **GPU Memory**: Automatically managed by WebGL
- **Bandwidth**: Efficient with minimal CPU↔GPU transfers

### Optimization Features
- **Nearest Neighbor Filtering**: No interpolation for exact pixel values
- **Toroidal Wrapping**: Hardware texture wrapping for edge cases
- **Batch Processing**: All cells processed in parallel

## Browser Compatibility

### Requirements
- **WebGL2**: Required for float textures and advanced features
- **EXT_color_buffer_float**: For rendering to float textures
- **Modern Browsers**: Chrome 56+, Firefox 51+, Safari 15+

### Fallback Behavior
- Automatically detects WebGL2 support
- Falls back to CPU version if unavailable
- Graceful error handling with console warnings

## Testing

### Verification Methods
1. **Conway's Game of Life**: Test known patterns (gliders, oscillators)
2. **Parameter Sweep**: Test different rule sets and parameters
3. **State Comparison**: Compare CPU vs GPU results
4. **Performance Benchmarks**: Measure frame rates and memory usage

### Test Suite
```javascript
// Run automated tests
import { CAShaderTest } from './test/caShaderTest.js';
const tester = new CAShaderTest();
await tester.runAllTests();
```

## Troubleshooting

### Common Issues
1. **WebGL2 Not Supported**: Check browser compatibility
2. **Float Texture Errors**: Verify EXT_color_buffer_float extension
3. **Performance Issues**: Check GPU memory and reduce grid size
4. **Sync Problems**: Ensure proper buffer format when switching modes

### Debug Tools
- Browser DevTools → Graphics tab
- WebGL Inspector extensions
- Console logging for shader compilation errors

## Future Enhancements

### Potential Improvements
1. **Compute Shaders**: Use WebGPU compute shaders when available
2. **Statistics Readback**: GPU-based histogram calculation
3. **Multi-pass Rendering**: Complex effects and post-processing
4. **Texture Compression**: Reduce memory usage for large grids

### WebGPU Migration
The current WebGL2 implementation can be migrated to WebGPU for:
- True compute shaders
- Better performance
- More advanced GPU features
- Cross-platform compatibility

## Conclusion

The shader implementation provides a high-performance, GPU-accelerated version of the cellular automata that maintains perfect compatibility with the Rust CPU version. Users can seamlessly switch between CPU and GPU modes while enjoying the benefits of parallel processing for larger, more complex simulations.
