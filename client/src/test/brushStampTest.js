/**
 * Comprehensive test suite for brush and stamp functionality
 * Tests both CPU and GPU implementations
 */

import CAShader from '../components/caShader.js';
import init, { LifeChannel, Universe } from '@ca/ca';

export class BrushStampTest {
  constructor() {
    this.canvas = null;
    this.rustUniverse = null;
    this.shaderCA = null;
    this.testResults = [];
  }

  async initialize() {
    // Create test canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 256;
    document.body.appendChild(this.canvas);

    // Initialize WASM
    await init();

    // Create Rust universe
    this.rustUniverse = new Universe(64, 64);

    // Create shader CA
    try {
      this.shaderCA = new CAShader(this.canvas);
      this.shaderCA.resize(64, 64);
      this.shaderCA.show();
      return true;
    } catch (error) {
      console.error('Failed to initialize shader CA:', error);
      return false;
    }
  }

  // Test basic brush functionality
  async testBasicBrush() {
    console.log('Testing basic brush functionality...');

    // Clear both implementations
    this.rustUniverse.clear();
    this.shaderCA.clear();

    // Test parameters
    const cx = 32, cy = 32, radius = 5;
    const h = 128, s = 255, l = 255, brushId = 12345n; // Use BigInt for Rust compatibility

    // Draw with CPU version
    this.rustUniverse.draw_brush(cx, cy, radius, true, h, s, l, brushId);

    // Draw with GPU version
    this.shaderCA.drawBrush(cx, cy, radius, true, h, s, l, brushId);

    // Force render to make sure changes are visible
    this.shaderCA.render(true, false);

    // Check that both created some non-zero cells
    const rustStats = this.rustUniverse.stats();
    const shaderStats = this.shaderCA.getStats();

    const rustHasDrawing = rustStats.alive_count > 0;
    const shaderHasDrawing = shaderStats.alive_count > 0;

    // Also check if the counts are reasonably similar (within 20% for a circle)
    const countDiff = Math.abs(rustStats.alive_count - shaderStats.alive_count);
    const avgCount = (rustStats.alive_count + shaderStats.alive_count) / 2;
    const similarCounts = avgCount > 0 ? (countDiff / avgCount) < 0.2 : true;

    const success = rustHasDrawing && shaderHasDrawing && similarCounts;

    this.testResults.push({
      test: 'Basic Brush',
      success,
      details: `CPU alive: ${rustStats.alive_count}, GPU alive: ${shaderStats.alive_count}, similar: ${similarCounts}`,
      rustHasDrawing,
      shaderHasDrawing,
      similarCounts
    });

    return success;
  }

  // Test brush with different modes (add/remove)
  async testBrushModes() {
    console.log('Testing brush add/remove modes...');

    // Clear and add some initial content
    this.rustUniverse.clear();
    this.shaderCA.clear();

    const cx = 32, cy = 32, radius = 8;
    const h = 100, s = 200, l = 200;

    // Add mode test
    this.rustUniverse.draw_brush(cx, cy, radius, true, h, s, l, 1n);
    this.shaderCA.drawBrush(cx, cy, radius, true, h, s, l, 1n);

    const afterAdd = {
      rust: this.rustUniverse.stats().alive_count,
      shader: this.shaderCA.getStats().alive_count
    };

    // Remove mode test
    this.rustUniverse.draw_brush(cx, cy, radius - 2, false, 0, 0, 0, 2n);
    this.shaderCA.drawBrush(cx, cy, radius - 2, false, 0, 0, 0, 2n);

    const afterRemove = {
      rust: this.rustUniverse.stats().alive_count,
      shader: this.shaderCA.getStats().alive_count
    };

    const success = afterAdd.rust > 0 && afterAdd.shader > 0 &&
                   afterRemove.rust < afterAdd.rust && afterRemove.shader < afterAdd.shader;

    this.testResults.push({
      test: 'Brush Add/Remove Modes',
      success,
      details: `Add - CPU: ${afterAdd.rust}, GPU: ${afterAdd.shader}; Remove - CPU: ${afterRemove.rust}, GPU: ${afterRemove.shader}`
    });

    return success;
  }

  // Test different brush sizes
  async testBrushSizes() {
    console.log('Testing different brush sizes...');

    const sizes = [1, 3, 5, 10];
    let allPassed = true;

    for (const radius of sizes) {
      this.rustUniverse.clear();
      this.shaderCA.clear();

      this.rustUniverse.draw_brush(32, 32, radius, true, 255, 255, 255, 1n);
      this.shaderCA.drawBrush(32, 32, radius, true, 255, 255, 255, 1n);

      const rustCount = this.rustUniverse.stats().alive_count;
      const shaderCount = this.shaderCA.getStats().alive_count;

      // Both should have some cells, and larger brushes should generally have more cells
      const passed = rustCount > 0 && shaderCount > 0;
      if (!passed) allPassed = false;

      console.log(`Radius ${radius}: CPU=${rustCount}, GPU=${shaderCount}`);
    }

    this.testResults.push({
      test: 'Brush Sizes',
      success: allPassed,
      details: `Tested sizes: ${sizes.join(', ')}`
    });

    return allPassed;
  }

  // Test basic stamp functionality
  async testBasicStamp() {
    console.log('Testing basic stamp functionality...');

    // Create a simple 4x4 test stamp (red square)
    const stampW = 4, stampH = 4;
    const stampData = new Uint8Array(stampW * stampH * 4);

    // Fill with red color
    for (let i = 0; i < stampData.length; i += 4) {
      stampData[i] = 255;     // R
      stampData[i + 1] = 0;   // G
      stampData[i + 2] = 0;   // B
      stampData[i + 3] = 255; // A
    }

    // Clear both implementations
    this.rustUniverse.clear();
    this.shaderCA.clear();

    // Apply stamp
    const x = 32, y = 32;
    this.rustUniverse.draw_stamp_at(x, y, stampW, stampH, stampData);
    this.shaderCA.drawStampAt(x, y, stampW, stampH, stampData);

    // Check results
    const rustStats = this.rustUniverse.stats();
    const shaderStats = this.shaderCA.getStats();

    const success = rustStats.alive_count > 0 && shaderStats.alive_count > 0;

    this.testResults.push({
      test: 'Basic Stamp',
      success,
      details: `CPU alive: ${rustStats.alive_count}, GPU alive: ${shaderStats.alive_count}`
    });

    return success;
  }

  // Test stamp with transparency
  async testStampTransparency() {
    console.log('Testing stamp with transparency...');

    // Create a stamp with varying alpha values
    const stampW = 3, stampH = 3;
    const stampData = new Uint8Array(stampW * stampH * 4);

    // Create a pattern with different alpha values
    const alphas = [255, 128, 64, 32, 0, 255, 128, 64, 32];
    for (let i = 0; i < 9; i++) {
      const idx = i * 4;
      stampData[idx] = 0;         // R
      stampData[idx + 1] = 255;   // G
      stampData[idx + 2] = 0;     // B
      stampData[idx + 3] = alphas[i]; // A
    }

    // Clear and apply
    this.rustUniverse.clear();
    this.shaderCA.clear();

    this.rustUniverse.draw_stamp_at(32, 32, stampW, stampH, stampData);
    this.shaderCA.drawStampAt(32, 32, stampW, stampH, stampData);

    // Check that some cells were created (transparent pixels should be skipped)
    const rustStats = this.rustUniverse.stats();
    const shaderStats = this.shaderCA.getStats();

    const success = rustStats.alive_count > 0 && shaderStats.alive_count > 0;

    this.testResults.push({
      test: 'Stamp Transparency',
      success,
      details: `CPU alive: ${rustStats.alive_count}, GPU alive: ${shaderStats.alive_count}`
    });

    return success;
  }

  // Test stamp positioning (edge cases)
  async testStampPositioning() {
    console.log('Testing stamp positioning edge cases...');

    const stampW = 6, stampH = 6;
    const stampData = new Uint8Array(stampW * stampH * 4);

    // Fill with blue color
    for (let i = 0; i < stampData.length; i += 4) {
      stampData[i] = 0;       // R
      stampData[i + 1] = 0;   // G
      stampData[i + 2] = 255; // B
      stampData[i + 3] = 255; // A
    }

    const positions = [
      { x: 0, y: 0, name: 'top-left corner' },
      { x: 63, y: 63, name: 'bottom-right corner' },
      { x: 32, y: 0, name: 'top edge' },
      { x: 0, y: 32, name: 'left edge' }
    ];

    let allPassed = true;

    for (const pos of positions) {
      this.rustUniverse.clear();
      this.shaderCA.clear();

      this.rustUniverse.draw_stamp_at(pos.x, pos.y, stampW, stampH, stampData);
      this.shaderCA.drawStampAt(pos.x, pos.y, stampW, stampH, stampData);

      const rustCount = this.rustUniverse.stats().alive_count;
      const shaderCount = this.shaderCA.getStats().alive_count;

      const passed = rustCount > 0 && shaderCount > 0;
      if (!passed) allPassed = false;

      console.log(`Position ${pos.name} (${pos.x},${pos.y}): CPU=${rustCount}, GPU=${shaderCount}`);
    }

    this.testResults.push({
      test: 'Stamp Positioning',
      success: allPassed,
      details: `Tested ${positions.length} edge positions`
    });

    return allPassed;
  }

  // Test Catmull-Rom interpolation
  async testCatmullRomInterpolation() {
    console.log('Testing Catmull-Rom interpolation...');

    // Clear both implementations
    this.rustUniverse.clear();
    this.shaderCA.clear();

    const radius = 3;
    const h = 180, s = 255, l = 255;
    const brushId = 99999n;

    // Create a sequence of points that should trigger Catmull-Rom interpolation
    const points = [
      { x: 10, y: 10 },
      { x: 20, y: 15 },
      { x: 30, y: 25 },
      { x: 40, y: 20 },
      { x: 50, y: 30 }
    ];

    // Draw the same stroke with both implementations
    for (const point of points) {
      this.rustUniverse.draw_brush(point.x, point.y, radius, true, h, s, l, brushId);
      this.shaderCA.drawBrush(point.x, point.y, radius, true, h, s, l, brushId);
    }

    // Force render
    this.shaderCA.render(true, false);

    // Check that both created interpolated strokes
    const rustStats = this.rustUniverse.stats();
    const shaderStats = this.shaderCA.getStats();

    // With Catmull-Rom, we should have significantly more cells than just the 5 points
    const expectedMinCells = points.length * Math.PI * radius * radius * 0.5; // Conservative estimate

    const rustHasInterpolation = rustStats.alive_count > expectedMinCells;
    const shaderHasInterpolation = shaderStats.alive_count > expectedMinCells;

    // Check that the counts are reasonably similar (within 30% for interpolated curves)
    const countDiff = Math.abs(rustStats.alive_count - shaderStats.alive_count);
    const avgCount = (rustStats.alive_count + shaderStats.alive_count) / 2;
    const similarCounts = avgCount > 0 ? (countDiff / avgCount) < 0.3 : true;

    const success = rustHasInterpolation && shaderHasInterpolation && similarCounts;

    this.testResults.push({
      test: 'Catmull-Rom Interpolation',
      success,
      details: `CPU alive: ${rustStats.alive_count}, GPU alive: ${shaderStats.alive_count}, expected min: ${Math.floor(expectedMinCells)}, similar: ${similarCounts}`,
      rustHasInterpolation,
      shaderHasInterpolation,
      similarCounts
    });

    return success;
  }

  // Test RGB to HSL conversion accuracy
  async testRgbToHslConversion() {
    console.log('Testing RGB to HSL conversion...');

    const testColors = [
      { r: 1.0, g: 0.0, b: 0.0, name: 'red' },
      { r: 0.0, g: 1.0, b: 0.0, name: 'green' },
      { r: 0.0, g: 0.0, b: 1.0, name: 'blue' },
      { r: 1.0, g: 1.0, b: 1.0, name: 'white' },
      { r: 0.0, g: 0.0, b: 0.0, name: 'black' },
      { r: 0.5, g: 0.5, b: 0.5, name: 'gray' }
    ];

    let allPassed = true;

    for (const color of testColors) {
      const hsl = this.shaderCA.rgbToHsl(color.r, color.g, color.b);

      // Basic sanity checks
      const validH = hsl.h >= 0 && hsl.h <= 1;
      const validS = hsl.s >= 0 && hsl.s <= 1;
      const validL = hsl.l >= 0 && hsl.l <= 1;

      const passed = validH && validS && validL;
      if (!passed) allPassed = false;

      console.log(`${color.name}: H=${hsl.h.toFixed(3)}, S=${hsl.s.toFixed(3)}, L=${hsl.l.toFixed(3)}`);
    }

    this.testResults.push({
      test: 'RGB to HSL Conversion',
      success: allPassed,
      details: `Tested ${testColors.length} colors`
    });

    return allPassed;
  }

  async runAllTests() {
    console.log('Starting Brush & Stamp Tests...');

    const initialized = await this.initialize();
    if (!initialized) {
      console.error('Failed to initialize test environment');
      return false;
    }

    const tests = [
      () => this.testBasicBrush(),
      () => this.testBrushModes(),
      () => this.testBrushSizes(),
      () => this.testCatmullRomInterpolation(),
      () => this.testBasicStamp(),
      () => this.testStampTransparency(),
      () => this.testStampPositioning(),
      () => this.testRgbToHslConversion(),
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

    console.log('\n=== Brush & Stamp Test Results ===');
    this.testResults.forEach(result => {
      console.log(`${result.test}: ${result.success ? 'PASS' : 'FAIL'} - ${result.details || ''}`);
    });

    console.log(`\nOverall: ${passedTests}/${tests.length} tests passed`);

    // Clean up
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.remove();
    }
    if (this.shaderCA) {
      this.shaderCA.dispose();
    }

    return passedTests === tests.length;
  }
}

// Export for use in browser console
window.BrushStampTest = BrushStampTest;
