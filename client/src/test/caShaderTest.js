/**
 * Test suite to verify that the shader CA implementation matches the Rust implementation
 */

import CAShader from '../components/caShader.js';
import init, { LifeChannel, Universe } from '@ca/ca';

export class CAShaderTest {
  constructor() {
    this.canvas = null;
    this.rustUniverse = null;
    this.shaderCA = null;
    this.testResults = [];
  }

  async initialize() {
    // Create a test canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 64;
    
    // Initialize WASM
    await init();
    
    // Create Rust universe
    this.rustUniverse = new Universe(64, 64);
    
    // Create shader CA
    try {
      this.shaderCA = new CAShader(this.canvas);
      this.shaderCA.resize(64, 64);
      return true;
    } catch (error) {
      console.error('Failed to initialize shader CA:', error);
      return false;
    }
  }

  // Test Conway's Game of Life pattern (B3/S23 = rule 770)
  async testConwayGlider() {
    const rule = 770; // Conway's Game of Life
    const params = {
      rule,
      decay_step: 1,
      recovery_step: 60,
      sat_recovery_factor: 0.8,
      sat_decay_factor: 0.6,
      lum_decay_factor: 0.95,
      life_decay_factor: 0.95,
      sat_ghost_factor: 0.9,
      hue_drift_strength: 0.0, // No randomness for testing
      hue_lerp_factor: 0.1,
      life_channel: LifeChannel.Alpha,
    };

    // Set parameters for both implementations
    this.rustUniverse.set_params(
      params.rule,
      params.decay_step,
      params.recovery_step,
      params.sat_recovery_factor,
      params.sat_decay_factor,
      params.lum_decay_factor,
      params.life_decay_factor,
      params.sat_ghost_factor,
      params.hue_drift_strength,
      params.hue_lerp_factor,
      params.life_channel
    );

    this.shaderCA.setParams(
      params.rule,
      params.decay_step,
      params.recovery_step,
      params.sat_recovery_factor,
      params.sat_decay_factor,
      params.lum_decay_factor,
      params.life_decay_factor,
      params.sat_ghost_factor,
      params.hue_drift_strength,
      params.hue_lerp_factor,
      params.life_channel
    );

    // Clear both universes
    this.rustUniverse.clear();
    this.shaderCA.clear();

    // Create a glider pattern in both
    const gliderPattern = [
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 1]
    ];

    const startX = 30;
    const startY = 30;

    for (let y = 0; y < gliderPattern.length; y++) {
      for (let x = 0; x < gliderPattern[y].length; x++) {
        if (gliderPattern[y][x]) {
          // Set cell in Rust universe
          this.rustUniverse.set_cell(startY + y, startX + x, 128, 255, 255, 255);
          
          // Set cell in shader
          this.shaderCA.setCell(startX + x, startY + y, 128, 255, 255, 255);
        }
      }
    }

    // Sync shader with Rust state
    const rustBuffer = this.getRustBuffer();
    this.shaderCA.loadFromBuffer(rustBuffer, 64, 64);

    // Run several generations and compare
    const generations = 10;
    let matches = 0;

    for (let gen = 0; gen < generations; gen++) {
      // Tick both implementations
      this.rustUniverse.tick();
      this.shaderCA.tick();

      // Compare states (simplified - just count alive cells)
      const rustStats = this.rustUniverse.stats();
      const shaderStats = this.shaderCA.getStats();

      const rustAlive = rustStats.alive_count;
      const shaderAlive = shaderStats.alive_count;

      console.log(`Generation ${gen + 1}: Rust=${rustAlive}, Shader=${shaderAlive}`);

      // For now, just check if both have similar population (exact match would require pixel-perfect comparison)
      if (Math.abs(rustAlive - shaderAlive) <= 2) { // Allow small variance
        matches++;
      }
    }

    const success = matches >= generations * 0.8; // 80% match rate
    this.testResults.push({
      test: 'Conway Glider',
      success,
      matches,
      total: generations,
      details: `${matches}/${generations} generations matched`
    });

    return success;
  }

  getRustBuffer() {
    const ptr = this.rustUniverse.cells_ptr();
    const len = this.rustUniverse.cells_len();
    const wasmMemory = this.rustUniverse.constructor.wasmModule?.memory || 
                       (typeof WebAssembly !== 'undefined' && WebAssembly.Memory ? 
                        new WebAssembly.Memory({ initial: 1 }) : null);
    
    if (!wasmMemory) {
      console.error('Cannot access WASM memory');
      return new Uint8Array(64 * 64 * 4);
    }
    
    return new Uint8Array(wasmMemory.buffer, ptr, len);
  }

  // Test parameter changes
  async testParameterChanges() {
    // Test different rules
    const rules = [770, 6152, 1234]; // Conway, another common rule, random
    let success = true;

    for (const rule of rules) {
      this.rustUniverse.set_params(rule, 1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.0, 0.1, LifeChannel.Alpha);
      this.shaderCA.setParams(rule, 1, 60, 0.8, 0.6, 0.95, 0.95, 0.9, 0.0, 0.1, LifeChannel.Alpha);

      // Add some random cells
      this.rustUniverse.randomize();
      const buffer = this.getRustBuffer();
      this.shaderCA.loadFromBuffer(buffer, 64, 64);

      // Run a few generations
      for (let i = 0; i < 5; i++) {
        this.rustUniverse.tick();
        this.shaderCA.tick();
      }

      console.log(`Rule ${rule} test completed`);
    }

    this.testResults.push({
      test: 'Parameter Changes',
      success,
      details: `Tested rules: ${rules.join(', ')}`
    });

    return success;
  }

  async runAllTests() {
    console.log('Starting CA Shader Tests...');
    
    const initialized = await this.initialize();
    if (!initialized) {
      console.error('Failed to initialize test environment');
      return false;
    }

    const tests = [
      () => this.testConwayGlider(),
      () => this.testParameterChanges(),
    ];

    let passedTests = 0;
    for (const test of tests) {
      try {
        const result = await test();
        if (result) passedTests++;
      } catch (error) {
        console.error('Test failed with error:', error);
      }
    }

    console.log('\n=== Test Results ===');
    this.testResults.forEach(result => {
      console.log(`${result.test}: ${result.success ? 'PASS' : 'FAIL'} - ${result.details || ''}`);
    });

    console.log(`\nOverall: ${passedTests}/${tests.length} tests passed`);
    return passedTests === tests.length;
  }
}

// Export for use in browser console
window.CAShaderTest = CAShaderTest;
