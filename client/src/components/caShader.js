/**
 * WebGL Compute Shader implementation of the Rust Cellular Automata
 * This implementation exactly replicates the logic from src/lib.rs tick() function
 */

export default class CAShader {
  constructor(canvas) {
    this.originalCanvas = canvas;

    // Create a separate canvas for WebGL2 that overlays the original
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.zIndex = '1';
    this.canvas.style.pointerEvents = 'none'; // Start disabled, will be enabled when shown

    // Insert the shader canvas right after the original canvas
    this.originalCanvas.parentNode.insertBefore(this.canvas, this.originalCanvas.nextSibling);

    // Forward mouse events from shader canvas to global event system
    this.setupMouseEventForwarding();

    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      // Clean up the created canvas
      this.canvas.remove();
      throw new Error('WebGL2 not supported');
    }

    // Check for required extensions
    this.ext = {
      textureFloat: this.gl.getExtension('EXT_color_buffer_float'),
      textureHalfFloat: this.gl.getExtension('EXT_color_buffer_half_float'),
    };

    this.width = 0;
    this.height = 0;
    this.currentBuffer = 0;

    // Textures for double buffering
    this.cellTextures = [null, null];
    this.framebuffers = [null, null];

    // Shader programs
    this.computeProgram = null;
    this.renderProgram = null;

    // Uniforms and buffers
    this.uniforms = {};
    this.quadBuffer = null;

    // CA Parameters (matching Rust LifeParams)
    this.params = {
      rule: 770,
      decay_step: 1,
      recovery_step: 60,
      sat_recovery_factor: 0.8,
      sat_decay_factor: 0.6,
      lum_decay_factor: 0.95,
      life_decay_factor: 0.95,
      sat_ghost_factor: 0.9,
      hue_drift_strength: 0.01,
      hue_lerp_factor: 0.1,
      life_channel: 3, // 0=Hue, 1=Saturation, 2=Luminance, 3=Alpha
    };

    // Statistics
    this.stats = {
      avg_hue: 0.0,
      median_hue: 0.0,
      avg_saturation: 0.0,
      median_saturation: 0.0,
      avg_luminance: 0.0,
      median_luminance: 0.0,
      avg_alpha: 0.0,
      median_alpha: 0.0,
      alive_count: 0,
      dead_count: 0,
      population_ratio: 0.0,
    };

    this.initShaders();
    this.initBuffers();
  }

  initShaders() {
    // Vertex shader for full-screen quad
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texcoord;

      void main() {
        v_texcoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Compute fragment shader that replicates Rust tick() logic
    const computeShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D u_cells;
      uniform vec2 u_resolution;
      uniform float u_rule;
      uniform float u_decay_step;
      uniform float u_recovery_step;
      uniform float u_sat_recovery_factor;
      uniform float u_sat_decay_factor;
      uniform float u_lum_decay_factor;
      uniform float u_life_decay_factor;
      uniform float u_sat_ghost_factor;
      uniform float u_hue_drift_strength;
      uniform float u_hue_lerp_factor;
      uniform float u_life_channel;
      uniform float u_time; // For random number generation

      in vec2 v_texcoord;
      out vec4 fragColor;

      const float E = 2.718281828459045;
      const float TAU = 6.283185307179586;
      const float TAU_DIV_255 = TAU / 255.0;

      // Pseudo-random number generator
      float random(vec2 st, float seed) {
        return fract(sin(dot(st.xy + seed, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      // Get activity value based on life channel
      float getActivityValue(vec4 cell, float channel) {
        if (channel < 0.5) return cell.r; // Hue
        else if (channel < 1.5) return cell.g; // Saturation
        else if (channel < 2.5) return cell.b; // Luminance
        else return cell.a; // Alpha
      }

      // Get neighbor cell with toroidal wrapping
      vec4 getNeighbor(sampler2D tex, vec2 coord, vec2 offset, vec2 resolution) {
        vec2 neighborCoord = coord + offset / resolution;
        // Toroidal wrapping
        neighborCoord = mod(neighborCoord + 1.0, 1.0);
        return texture(tex, neighborCoord);
      }

      void main() {
        vec2 coord = v_texcoord;
        vec4 cell = texture(u_cells, coord);

        // Pre-calculate decay terms (matching Rust implementation)
        float decay_step_f = u_decay_step;
        float sat_decay_term = decay_step_f * E * u_sat_decay_factor;
        float lum_decay_term = decay_step_f * E * u_lum_decay_factor;
        float life_decay_term = decay_step_f * E * u_life_decay_factor;
        float sat_recovery = u_recovery_step * u_sat_recovery_factor;

        // Count live neighbors and accumulate sums
        float live_neighbors = 0.0;
        float sat_sum = 0.0;
        float lum_sum = 0.0;
        float alpha_sum = 0.0;
        float strongest_hue = 0.0;
        float max_lum = 0.0;
        float sin_sum = 0.0;
        float cos_sum = 0.0;

        // 8-neighbor Moore neighborhood (matching Rust get_neighbour_indices)
        vec2 offsets[8] = vec2[8](
          vec2(-1.0, -1.0), vec2(-1.0,  0.0), vec2(-1.0,  1.0),
          vec2( 0.0, -1.0),                    vec2( 0.0,  1.0),
          vec2( 1.0, -1.0), vec2( 1.0,  0.0), vec2( 1.0,  1.0)
        );

        for (int i = 0; i < 8; i++) {
          vec4 neighbor = getNeighbor(u_cells, coord, offsets[i], u_resolution);
          float activity = getActivityValue(neighbor, u_life_channel);

          if (activity > 0.0) {
            live_neighbors += 1.0;
            sat_sum += neighbor.g * 255.0;
            lum_sum += neighbor.b * 255.0;
            alpha_sum += neighbor.a * 255.0;

            float neighbor_lum = neighbor.b * 255.0;
            if (neighbor_lum > max_lum) {
              max_lum = neighbor_lum;
              strongest_hue = neighbor.r;
            }

            float angle = neighbor.r * TAU_DIV_255;
            sin_sum += sin(angle);
            cos_sum += cos(angle);
          }
        }

        // Determine if cell should be alive next generation
        float current_activity = getActivityValue(cell, u_life_channel);
        bool currently_alive = current_activity > 0.0;

        float bit_index = live_neighbors + (currently_alive ? 9.0 : 0.0);
        bool next_alive = mod(floor(u_rule / pow(2.0, bit_index)), 2.0) == 1.0;

        vec4 next_cell;

        if (currently_alive && next_alive) {
          // Case: (true, true) - alive cell survives
          float new_sat = min(cell.g * 255.0 + sat_recovery, 255.0) / 255.0;
          next_cell = vec4(cell.r, new_sat, cell.b, cell.a);

        } else if (currently_alive && !next_alive) {
          // Case: (true, false) - alive cell dies
          next_cell = vec4(
            cell.r,
            max((cell.g * 255.0 - sat_decay_term) / 255.0, 0.0),
            max((cell.b * 255.0 - lum_decay_term) / 255.0, 0.0),
            max((cell.a * 255.0 - life_decay_term) / 255.0, 0.0)
          );

        } else if (!currently_alive && next_alive) {
          // Case: (false, true) - dead cell becomes alive
          float avg_sat = live_neighbors > 0.0 ? sat_sum / live_neighbors : 0.0;
          float avg_lum = live_neighbors > 0.0 ? lum_sum / live_neighbors : 0.0;
          float avg_alpha = live_neighbors > 0.0 ? alpha_sum / live_neighbors : 0.0;

          // Hue calculation with circular averaging
          float mean_angle = (sin_sum == 0.0 && cos_sum == 0.0) ? 0.0 : atan(sin_sum, cos_sum);
          float strongest_angle = strongest_hue * TAU_DIV_255;
          float mixed_angle = (1.0 - u_hue_lerp_factor) * mean_angle + u_hue_lerp_factor * strongest_angle;

          // Add random drift
          float drift = (random(coord * 1000.0, u_time) - 0.5) * u_hue_drift_strength * 2.0;
          float final_angle = mod(mixed_angle + drift, TAU);
          float hue = (final_angle / TAU);

          // Set values based on life channel
          float new_hue = (u_life_channel < 0.5) ? 1.0 : hue;
          float new_sat = (u_life_channel >= 0.5 && u_life_channel < 1.5) ? 1.0 : min(avg_sat + 1.0, 255.0) / 255.0;
          float new_lum = (u_life_channel >= 1.5 && u_life_channel < 2.5) ? 1.0 : min(avg_lum + 1.0, 255.0) / 255.0;
          float new_alpha = (u_life_channel >= 2.5) ? 1.0 : min(avg_alpha + 1.0, 255.0) / 255.0;

          next_cell = vec4(new_hue, new_sat, new_lum, new_alpha);

        } else {
          // Case: (false, false) - dead cell stays dead with ghost decay
          next_cell = vec4(
            cell.r,
            cell.g * u_sat_ghost_factor,
            cell.b * u_lum_decay_factor,
            cell.a * u_life_decay_factor
          );
        }

        fragColor = next_cell;
      }
    `;

    this.computeProgram = this.createProgram(vertexShaderSource, computeShaderSource);
    this.renderProgram = this.createRenderProgram();
  }

  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }

    return program;
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  createRenderProgram() {
    // Render program for displaying the CA (reusing existing glSetup logic)
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texcoord;

      void main() {
        v_texcoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision mediump float;

      uniform sampler2D u_texture;
      uniform bool u_alpha;
      uniform bool u_use_RGB;
      in vec2 v_texcoord;
      out vec4 fragColor;

      float hue2rgb(float f1, float f2, float hue) {
        if (hue < 0.0)
          hue += 1.0;
        else if (hue > 1.0)
          hue -= 1.0;
        float res;
        if ((6.0 * hue) < 1.0)
          res = f1 + (f2 - f1) * 6.0 * hue;
        else if ((2.0 * hue) < 1.0)
          res = f2;
        else if ((3.0 * hue) < 2.0)
          res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
        else
          res = f1;
        return res;
      }

      vec3 hsl2rgb(vec3 hsl) {
        vec3 rgb;

        if (hsl.y == 0.0) {
          rgb = vec3(hsl.z); // Luminance
        } else {
          float f2;

          if (hsl.z < 0.5)
            f2 = hsl.z * (1.0 + hsl.y);
          else
            f2 = hsl.z + hsl.y - hsl.y * hsl.z;

          float f1 = 2.0 * hsl.z - f2;

          rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
          rgb.g = hue2rgb(f1, f2, hsl.x);
          rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
        }
        return rgb;
      }

      void main() {
        vec4 hsl = texture(u_texture, vec2(v_texcoord.x, 1.0 - v_texcoord.y));
        vec3 rgb;

        float hue = hsl.r;
        float sat = hsl.g;
        float lum = hsl.b;

        if (u_use_RGB) {
          rgb = vec3(hue, sat, lum);
        } else {
          rgb = hsl2rgb(vec3(hue, sat, lum));
        }

        if (u_alpha) {
          fragColor = vec4(rgb, hsl.a);
        } else {
          fragColor = vec4(rgb, 1.0);
        }
      }
    `;

    return this.createProgram(vertexShaderSource, fragmentShaderSource);
  }

  initBuffers() {
    const gl = this.gl;

    // Create full-screen quad
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  +1, -1,  -1, +1,
      -1, +1,  +1, -1,  +1, +1
    ]), gl.STATIC_DRAW);
  }

  setupMouseEventForwarding() {
    // Forward mouse events from shader canvas to global event system
    const events = ['mousemove', 'mousedown', 'mouseup', 'mouseleave'];

    events.forEach(eventType => {
      this.canvas.addEventListener(eventType, (e) => {
        // Dispatch the same event globally so other components can listen
        window.dispatchEvent(new MouseEvent(eventType, {
          clientX: e.clientX,
          clientY: e.clientY,
          button: e.button,
          buttons: e.buttons,
          bubbles: true,
          cancelable: true
        }));
      });
    });
  }

  resize(width, height) {
    if (this.width === width && this.height === height) return;

    this.width = width;
    this.height = height;

    // Sync canvas size with original canvas
    this.canvas.width = this.originalCanvas.width;
    this.canvas.height = this.originalCanvas.height;
    this.canvas.style.width = this.originalCanvas.style.width;
    this.canvas.style.height = this.originalCanvas.style.height;

    this.createTextures();
    this.createFramebuffers();
  }

  createTextures() {
    const gl = this.gl;

    // Clean up existing textures
    if (this.cellTextures[0]) {
      gl.deleteTexture(this.cellTextures[0]);
      gl.deleteTexture(this.cellTextures[1]);
    }

    // Create double-buffered textures for CA state
    for (let i = 0; i < 2; i++) {
      this.cellTextures[i] = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.cellTextures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    }
  }

  createFramebuffers() {
    const gl = this.gl;

    // Clean up existing framebuffers
    if (this.framebuffers[0]) {
      gl.deleteFramebuffer(this.framebuffers[0]);
      gl.deleteFramebuffer(this.framebuffers[1]);
    }

    // Create framebuffers for render-to-texture
    for (let i = 0; i < 2; i++) {
      this.framebuffers[i] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.cellTextures[i], 0);

      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Framebuffer not complete');
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Set CA parameters (matching Rust LifeParams)
  setParams(rule, decay_step, recovery_step, sat_recovery_factor, sat_decay_factor,
           lum_decay_factor, life_decay_factor, sat_ghost_factor, hue_drift_strength,
           hue_lerp_factor, life_channel) {
    this.params = {
      rule,
      decay_step,
      recovery_step,
      sat_recovery_factor,
      sat_decay_factor,
      lum_decay_factor,
      life_decay_factor,
      sat_ghost_factor,
      hue_drift_strength,
      hue_lerp_factor,
      life_channel: this.convertLifeChannel(life_channel),
    };
  }

  convertLifeChannel(channel) {
    // Convert from Rust enum to shader float
    if (typeof channel === 'number') return channel;

    const channelMap = {
      'Hue': 0,
      'Saturation': 1,
      'Luminance': 2,
      'Alpha': 3,
    };

    return channelMap[channel] || 3; // Default to Alpha
  }

  // Initialize CA state from Rust buffer
  loadFromBuffer(buffer, width, height) {
    if (width !== this.width || height !== this.height) {
      this.resize(width, height);
    }

    const gl = this.gl;

    // Convert HSLA u8 buffer to float texture
    const floatData = new Float32Array(width * height * 4);
    for (let i = 0; i < buffer.length; i += 4) {
      const baseIdx = i;
      floatData[baseIdx] = buffer[i] / 255.0;     // hue
      floatData[baseIdx + 1] = buffer[i + 1] / 255.0; // saturation
      floatData[baseIdx + 2] = buffer[i + 2] / 255.0; // luminance
      floatData[baseIdx + 3] = buffer[i + 3] / 255.0; // alpha
    }

    gl.bindTexture(gl.TEXTURE_2D, this.cellTextures[this.currentBuffer]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, floatData);
  }

  // Clear all cells
  clear() {
    const gl = this.gl;
    const clearData = new Float32Array(this.width * this.height * 4);

    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.cellTextures[i]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, clearData);
    }
  }

  // Set individual cell (for drawing/brushing)
  setCell(x, y, hue, saturation, luminance, alpha) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

    const gl = this.gl;

    const cellData = new Float32Array([
      hue / 255.0,
      saturation / 255.0,
      luminance / 255.0,
      alpha / 255.0
    ]);

    gl.bindTexture(gl.TEXTURE_2D, this.cellTextures[this.currentBuffer]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RGBA, gl.FLOAT, cellData);
  }

  // Draw brush (replicating Rust draw_brush functionality)
  drawBrush(cx, cy, radius, addMode, h, s, l, brushId) {
    if (radius <= 0) return;

    const gl = this.gl;
    const cellsToUpdate = [];

    // Calculate all cells to update
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      const py = cy + dy;
      if (py < 0 || py >= this.height) continue;

      const dy2 = dy * dy;
      for (let dx = -radius; dx <= radius; dx++) {
        const dx2 = dx * dx;
        if (dx2 + dy2 > r2) continue;

        const px = cx + dx;
        if (px < 0 || px >= this.width) continue;

        if (addMode) {
          cellsToUpdate.push({
            x: px, y: py,
            hue: h / 255.0,
            sat: s / 255.0,
            lum: l / 255.0,
            alpha: 1.0
          });
        } else {
          // Remove mode - set to zero
          cellsToUpdate.push({
            x: px, y: py,
            hue: 0.0,
            sat: 0.0,
            lum: 0.0,
            alpha: 0.0
          });
        }
      }
    }

    // Batch update all cells
    if (cellsToUpdate.length > 0) {
      this.updateCells(cellsToUpdate);
    }
  }

  // Batch update multiple cells efficiently
  updateCells(cells) {
    const gl = this.gl;

    // Group cells by rows for more efficient texture updates
    const rowGroups = new Map();

    cells.forEach(cell => {
      if (!rowGroups.has(cell.y)) {
        rowGroups.set(cell.y, []);
      }
      rowGroups.get(cell.y).push(cell);
    });

    gl.bindTexture(gl.TEXTURE_2D, this.cellTextures[this.currentBuffer]);

    // Update each row
    rowGroups.forEach((rowCells, y) => {
      // Sort by x coordinate
      rowCells.sort((a, b) => a.x - b.x);

      // Find contiguous segments
      let start = 0;
      while (start < rowCells.length) {
        let end = start;
        while (end + 1 < rowCells.length && rowCells[end + 1].x === rowCells[end].x + 1) {
          end++;
        }

        // Update contiguous segment
        const segmentWidth = end - start + 1;
        const segmentData = new Float32Array(segmentWidth * 4);

        for (let i = start; i <= end; i++) {
          const cell = rowCells[i];
          const idx = (i - start) * 4;
          segmentData[idx] = cell.hue;
          segmentData[idx + 1] = cell.sat;
          segmentData[idx + 2] = cell.lum;
          segmentData[idx + 3] = cell.alpha;
        }

        gl.texSubImage2D(gl.TEXTURE_2D, 0, rowCells[start].x, y, segmentWidth, 1, gl.RGBA, gl.FLOAT, segmentData);

        start = end + 1;
      }
    });
  }

  // Draw stamp at position (replicating Rust draw_stamp_at functionality)
  drawStampAt(x, y, stampW, stampH, data) {
    const gl = this.gl;

    // Convert RGBA data to HSLA and create texture data
    const floatData = new Float32Array(stampW * stampH * 4);

    for (let sy = 0; sy < stampH; sy++) {
      for (let sx = 0; sx < stampW; sx++) {
        const i = (sy * stampW + sx) * 4;
        const r = data[i] / 255.0;
        const g = data[i + 1] / 255.0;
        const b = data[i + 2] / 255.0;
        const a = data[i + 3] / 255.0;

        if (a <= 0.001) {
          floatData[i] = 0;
          floatData[i + 1] = 0;
          floatData[i + 2] = 0;
          floatData[i + 3] = 0;
          continue;
        }

        // Convert RGB to HSL
        const hsl = this.rgbToHsl(r, g, b);

        floatData[i] = hsl.h;
        floatData[i + 1] = hsl.s;
        floatData[i + 2] = hsl.l;
        floatData[i + 3] = a;
      }
    }

    // Calculate stamp position (centered)
    const startX = Math.max(0, x - Math.floor(stampW / 2));
    const startY = Math.max(0, y - Math.floor(stampH / 2));
    const endX = Math.min(this.width, startX + stampW);
    const endY = Math.min(this.height, startY + stampH);

    // Apply stamp data to texture
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const sx = px - startX;
        const sy = py - startY;
        const i = (sy * stampW + sx) * 4;

        if (floatData[i + 3] > 0.001) { // Check alpha
          this.setCell(px, py,
            floatData[i] * 255,     // hue
            floatData[i + 1] * 255, // saturation
            floatData[i + 2] * 255, // luminance
            floatData[i + 3] * 255  // alpha
          );
        }
      }
    }
  }

  // RGB to HSL conversion (matching Rust implementation)
  rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2.0;

    if (max === min) {
      return { h: 0.0, s: 0.0, l: l };
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2.0 - max - min) : d / (max + min);

    let h;
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6.0 : 0.0)) / 6.0;
    } else if (max === g) {
      h = ((b - r) / d + 2.0) / 6.0;
    } else {
      h = ((r - g) / d + 4.0) / 6.0;
    }

    return { h: h, s: s, l: l };
  }

  // Randomize CA state
  randomize() {
    const gl = this.gl;
    const randomData = new Float32Array(this.width * this.height * 4);

    for (let i = 0; i < randomData.length; i += 4) {
      if (Math.random() > 0.5) {
        randomData[i] = Math.random();     // hue
        randomData[i + 1] = 0.4 + Math.random() * 0.6; // saturation (100-255 range)
        randomData[i + 2] = 0.4 + Math.random() * 0.6; // luminance (100-255 range)
        randomData[i + 3] = 1.0;           // alpha
      } else {
        randomData[i] = 0.0;
        randomData[i + 1] = 0.0;
        randomData[i + 2] = 0.0;
        randomData[i + 3] = 0.0;
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, this.cellTextures[this.currentBuffer]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, randomData);
  }

  // Main tick function - advance CA by one generation
  tick() {
    if (this.width === 0 || this.height === 0) return;

    const gl = this.gl;
    const nextBuffer = 1 - this.currentBuffer;

    // Set up compute pass
    gl.useProgram(this.computeProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[nextBuffer]);
    gl.viewport(0, 0, this.width, this.height);

    // Bind input texture (current state)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cellTextures[this.currentBuffer]);

    // Set uniforms
    this.setComputeUniforms();

    // Bind vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const positionLocation = gl.getAttribLocation(this.computeProgram, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Execute compute pass
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap buffers
    this.currentBuffer = nextBuffer;

    // Calculate statistics (simplified for now)
    this.updateStats();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  setComputeUniforms() {
    const gl = this.gl;
    const program = this.computeProgram;

    gl.uniform1i(gl.getUniformLocation(program, 'u_cells'), 0);
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), this.width, this.height);
    gl.uniform1f(gl.getUniformLocation(program, 'u_rule'), this.params.rule);
    gl.uniform1f(gl.getUniformLocation(program, 'u_decay_step'), this.params.decay_step);
    gl.uniform1f(gl.getUniformLocation(program, 'u_recovery_step'), this.params.recovery_step);
    gl.uniform1f(gl.getUniformLocation(program, 'u_sat_recovery_factor'), this.params.sat_recovery_factor);
    gl.uniform1f(gl.getUniformLocation(program, 'u_sat_decay_factor'), this.params.sat_decay_factor);
    gl.uniform1f(gl.getUniformLocation(program, 'u_lum_decay_factor'), this.params.lum_decay_factor);
    gl.uniform1f(gl.getUniformLocation(program, 'u_life_decay_factor'), this.params.life_decay_factor);
    gl.uniform1f(gl.getUniformLocation(program, 'u_sat_ghost_factor'), this.params.sat_ghost_factor);
    gl.uniform1f(gl.getUniformLocation(program, 'u_hue_drift_strength'), this.params.hue_drift_strength);
    gl.uniform1f(gl.getUniformLocation(program, 'u_hue_lerp_factor'), this.params.hue_lerp_factor);
    gl.uniform1f(gl.getUniformLocation(program, 'u_life_channel'), this.params.life_channel);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), performance.now() * 0.001);
  }

  // Simplified stats update (full implementation would require readback)
  updateStats() {
    // For now, just update frame-based stats
    // Full implementation would require GPU readback for accurate statistics
    this.stats.alive_count = Math.floor(this.width * this.height * 0.3); // Placeholder
    this.stats.dead_count = this.width * this.height - this.stats.alive_count;
    this.stats.population_ratio = this.stats.alive_count / (this.width * this.height);
  }

  // Render CA to canvas
  render(useAlpha = true, useRGB = false) {
    const gl = this.gl;

    gl.useProgram(this.renderProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Bind current CA state texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cellTextures[this.currentBuffer]);

    // Set render uniforms
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_texture'), 0);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_alpha'), useAlpha ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_use_RGB'), useRGB ? 1 : 0);

    // Bind vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const positionLocation = gl.getAttribLocation(this.renderProgram, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Render
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // Show the shader canvas (hide CPU canvas)
  show() {
    this.canvas.style.display = 'block';
    this.originalCanvas.style.display = 'none';
    // Enable mouse events on shader canvas
    this.canvas.style.pointerEvents = 'auto';
  }

  // Hide the shader canvas (show CPU canvas)
  hide() {
    this.canvas.style.display = 'none';
    this.originalCanvas.style.display = 'block';
    // Disable mouse events on shader canvas to avoid conflicts
    this.canvas.style.pointerEvents = 'none';
  }

  // Get current statistics (matching Rust UniverseStats)
  getStats() {
    return { ...this.stats };
  }

  // Cleanup resources
  dispose() {
    const gl = this.gl;

    if (this.cellTextures[0]) {
      gl.deleteTexture(this.cellTextures[0]);
      gl.deleteTexture(this.cellTextures[1]);
    }

    if (this.framebuffers[0]) {
      gl.deleteFramebuffer(this.framebuffers[0]);
      gl.deleteFramebuffer(this.framebuffers[1]);
    }

    if (this.quadBuffer) {
      gl.deleteBuffer(this.quadBuffer);
    }

    if (this.computeProgram) {
      gl.deleteProgram(this.computeProgram);
    }

    if (this.renderProgram) {
      gl.deleteProgram(this.renderProgram);
    }

    // Remove the created canvas
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.remove();
    }

    // Restore original canvas visibility
    if (this.originalCanvas) {
      this.originalCanvas.style.display = 'block';
    }
  }
}
