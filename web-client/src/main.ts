// index.js  ── Conway’s Game of Life driver for the “life.wasm” module.
// Added keyboard controls:  
//   '-' / '='  → decrease / increase `decay_step`  
//   '[' / ']'  → decrease / increase `recovery_step`

import './style.css'
import init, { Universe } from '@ca/ca';

(async () => {
  const mousePosition = { x: 0, y: 0 };
  const dpr = window.devicePixelRatio || 1;

  // ── 1 ◂ Load WebAssembly and get its exports ──────────────────────────────
  const wasm   = await init();   // raw exports
  const memory = wasm.memory;    // Memory export

  // Universe dimensions = current viewport
  const uWidth  = Math.floor(window.innerWidth);
  const uHeight = Math.floor(window.innerHeight);

  const universe = new Universe(uWidth, uHeight);
  universe.randomize();

  // Runtime‑tweakable life‑cycle parameters (default from Rust)
  let decayStep    = 1;
  let recoveryStep = 1;
  let satRecoveryFactor = 0.8;
  let satDecayFactor = 0.5;
  let lumDecayFactor = 0.95;
  let satGhostFactor = 0.9;
  let hueDriftStrength = 0.01;
  let hueLerpFactor = 0.1;
  let brushRadius = 40;
  let stampImageData = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;


  // Canvas & WebGL bootstrapping ────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  const panel = document.createElement('div');
  const info = document.createElement('div');
  const indv = document.createElement('div');
  panel.className = 'panel';
  let controls = {
    colorPicker:       { tag: 'input', props: { type: 'color', oninput: updateColors } },
    brushSize:         { tag: 'input', props: { type: 'range', min: 1, max: 200, value: brushRadius, oninput: (e) => { brushRadius = parseInt(e.target.value); updateInfo(); } }},
    randomize:         { tag: 'button', innerHTML: 'Randomize', props: { onclick: () => { universe.randomize(); updateInfo(); }}},
    pause:             { tag: 'button', innerHTML: 'Pause', props: { onclick: () => { paused = !paused; if (!paused) render(); updateInfo(); }}},
    clear:             { tag: 'button', innerHTML: 'Clear', props: { onclick: () => { universe.clear(); updateInfo(); }}},
    setGrid:           { tag: 'button', innerHTML: 'Set', props: { onclick: () => { universe.set_grid(currentColorH, currentColorS, currentColorL); updateInfo(); }}},
    decaySlider:       { tag: 'input', props: { type: 'range', min: 1, max: 500, value: decayStep, oninput: (e) => { decayStep = parseInt(e.target.value); updateInfo(); }}},
    recoverySlider:    { tag: 'input', props: { type: 'range', min: 1, max: 500, value: recoveryStep, oninput: (e) => { recoveryStep = parseInt(e.target.value); updateInfo(); }}},
    satRecoveryFactor: { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: satRecoveryFactor, oninput: (e) => { satRecoveryFactor = parseFloat(e.target.value); updateInfo(); }}},
    satDecayFactor:    { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: satDecayFactor, oninput: (e) => { satDecayFactor = parseFloat(e.target.value); updateInfo(); }}},
    lumDecayFactor:    { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: lumDecayFactor, oninput: (e) => { lumDecayFactor = parseFloat(e.target.value); updateInfo(); }}},
    satGhostFactor:    { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: satGhostFactor, oninput: (e) => { satGhostFactor = parseFloat(e.target.value); updateInfo(); }}},
    hueDriftStrength:  { tag: 'input', props: { type: 'range', min: 0.0, max: 0.2, step: 0.001, value: hueDriftStrength, oninput: (e) => { hueDriftStrength = parseFloat(e.target.value); updateInfo(); }}},
    hueLerpFactor:     { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: hueLerpFactor, oninput: (e) => { hueLerpFactor = parseFloat(e.target.value); updateInfo(); }}},
    imageUpload:       { tag: 'input', props: { type: 'file', accept: 'image/*', onchange: handleImageUpload }},
  };
  controls = createControls(controls);
  Object.values(controls).forEach((control) => {panel.appendChild(control);})
  panel.appendChild(info);
  panel.appendChild(indv);


  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      stampImageData = ctx.getImageData(0, 0, img.width, img.height);
      console.log(`Loaded stamp image: ${img.width}×${img.height}`);
    };
    img.src = URL.createObjectURL(file);
  }
  function addBrushRadius(n) {
    brushRadius += n;
    if (brushRadius < 1) { brushRadius = 1; }
  }
  function updateInfo() {
    info.innerHTML = `
      Brush: ${brushRadius}<br>
      Decay Step: ${decayStep}, Recovery Step: ${recoveryStep}<br>
      Sat Recovery: ${satRecoveryFactor.toFixed(2)}, Sat Decay: ${satDecayFactor.toFixed(2)}<br>
      Lum Decay: ${lumDecayFactor.toFixed(2)}, Sat Ghost: ${satGhostFactor.toFixed(2)}<br>
      Hue Drift: ${hueDriftStrength.toFixed(3)}, Hue Lerp: ${hueLerpFactor.toFixed(2)}
    `;
  }
  function updateIndv(cells) {
    if (!cells) {
      const ptr = universe.cells_ptr();
      const len = universe.cells_len();
      cells = new Uint8Array(memory.buffer, ptr, len);
    }

    const col = mousePosition.x;
    const row = mousePosition.y;

    if (col >= universe.width() || row >= universe.height()) {
      indv.innerHTML = `I: out of bounds`;
      return;
    }

    const offset = universe.index(row, col);
    const byteIndex = offset * 3;

    indv.innerHTML = `I: H:${cells[byteIndex]} S:${cells[byteIndex + 1]} L:${cells[byteIndex + 2]}`;
  }
  function createControls(controls) {
    const elements = {};
    for (const [key, config] of Object.entries(controls)) {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.gap = '0.5em';

      const label = document.createElement('label');
      label.textContent = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

      const el = document.createElement(config.tag);
      if (config.innerHTML) el.innerHTML = config.innerHTML;
      if (config.props) {
        for (const [prop, value] of Object.entries(config.props)) {
          el[prop] = value;
        }
      }

      container.appendChild(label);
      container.appendChild(el);
      elements[key] = container;
    }
    return elements;
  }

  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      // colour shortcuts & actions (existing)
      case 'c':  universe.clear();    break;
      case 'r':  universe.randomize(); break;
      case 'h':  panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; break;
      case 'p':  paused = !paused; if(!paused){render();} break;
      case 's':  render(); break;
      default:
        return; // quit for keys we don’t handle
    }
  });

  document.querySelector('#app')!.appendChild(canvas);
  document.querySelector('#app')!.appendChild(panel);

  panel.addEventListener('mousedown', (e) => {
    if (e.target !== panel) return; // Only drag from panel background
    isDragging = true;
    dragOffsetX = e.clientX - panel.offsetLeft;
    dragOffsetY = e.clientY - panel.offsetTop;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = `${e.clientX - dragOffsetX}px`;
    panel.style.top = `${e.clientY - dragOffsetY}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });


  function updateColors(e) {
    const hsl = hexToHSL(e.srcElement.value);
    console.log(hsl)
    currentColorH = hsl.h;
    currentColorS = hsl.s;
    currentColorL = hsl.l;
  }
  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h, s, l };
  }
  function hexToHSL(hex) {
    hex = hex.replace("#", "");

    let r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 255),  // hue: 0–255
      s: Math.round(s * 255),  // saturation: 0–255
      l: Math.round(l * 255),  // luminance: 0–255
    };
  }


  function setCanvasSize() {
    canvas.width  = universe.width()  * dpr;
    canvas.height = universe.height() * dpr;
    canvas.style.width  = `${universe.width()}px`;
    canvas.style.height = `${universe.height()}px`;
  }
  setCanvasSize();

  const gl = canvas.getContext('webgl');
  if (!gl) throw new Error('WebGL not supported');

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getMouseCellPosition(event) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    mousePosition.x = Math.floor((event.clientX - rect.left) * scaleX / dpr);
    mousePosition.y = Math.floor((event.clientY - rect.top)  * scaleY / dpr);
    updateIndv();
  }

  function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  function drawAtMouse() {
    const { x, y } = mousePosition;

    if (!stampImageData) {
      universe.draw_brush(x, y, brushRadius, drawMode === 'add', currentColorH, currentColorS, currentColorL);
      return;
    }

    const w = stampImageData.width;
    const h = stampImageData.height;
    const data = stampImageData.data;

    const cells = new Uint8Array(memory.buffer, universe.cells_ptr(), universe.cells_len());

    for (let sy = 0; sy < h; sy++) {
      const uy = y + sy - Math.floor(h / 2);
      if (uy < 0 || uy >= universe.height()) continue;

      for (let sx = 0; sx < w; sx++) {
        const ux = x + sx - Math.floor(w / 2);
        if (ux < 0 || ux >= universe.width()) continue;

        const i = (sy * w + sx) * 4;
        const r = data[i]     / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const a = data[i + 3] / 255;

        if (a <= 0.001) continue; // Fully transparent — skip

        const { h, s, l } = rgbToHsl(r, g, b);
        const targetH = Math.round(h * 255);
        const targetS = Math.round(s * 255);
        const targetL = Math.round(l * 255);

        const offset = universe.index(ux, uy) * 3;
        const oldH = cells[offset];
        const oldS = cells[offset + 1];
        const oldL = cells[offset + 2];

        let newH, newS, newL;

        if (a >= 0.999) {
          // Fully opaque — direct overwrite
          newH = targetH;
          newS = targetS;
          newL = targetL;
        } else {
          // Blend based on alpha
          const lerp = (a, b, t) => a * (1 - t) + b * t;
          newH = Math.round(lerp(oldH, targetH, a));
          newS = Math.round(lerp(oldS, targetS, a));
          newL = Math.round(lerp(oldL, targetL, a));
        }

        universe.set_cell(uy, ux, newH, newS, newL);
      }
    }




  }

  function setGrid(h, s, l) {
    universe.set_grid(h, s, l);
  }

    

  // ── Interaction State ────────────────────────────────────────────────────
  let paused = false;
  let drawing      = false;
  let drawMode     = 'add'; // 'add' | 'erase'
  let currentColorH = 255;
  let currentColorS = 255;
  let currentColorL = 128;

  // ── Event listeners ──────────────────────────────────────────────────────
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    drawMode = e.button === 2 ? 'erase' : 'add';
    drawing  = true;
    drawAtMouse();
  });
  canvas.addEventListener('mouseup',   () => drawing = false);
  canvas.addEventListener('mouseleave',() => drawing = false);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window .addEventListener('mousemove', getMouseCellPosition);

 
  // Resize: grow universe if viewport expands
  window.addEventListener('resize', () => {
    const newW = Math.floor(window.innerWidth);
    const newH = Math.floor(window.innerHeight);
    if (newW > universe.width() || newH > universe.height()) {
      universe.resize(Math.max(newW, universe.width()), Math.max(newH, universe.height()));
      setCanvasSize();
    }
  });

  // ── WebGL setup (buffers, shaders, uniforms) ─────────────────────────────
  const vsSource = `
attribute vec2 a_position;
varying vec2 v_texcoord;
void main() {
  v_texcoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

  const fsSource = `
precision mediump float;

uniform sampler2D u_texture;
varying vec2 v_texcoord;


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
  vec3 hsl = texture2D(u_texture, vec2(v_texcoord.x, 1.0 - v_texcoord.y)).rgb;
  
  gl_FragColor = vec4(hsl2rgb(vec3(hsl.z, hsl.y, hsl.x)), 1.0);
}`;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER,   vsSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  // Quad geometry
  const posLoc = gl.getAttribLocation(program, 'a_position');
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  +1, -1,  -1, +1,
    -1, +1,  +1, -1,  +1, +1
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Texture setup
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const uTex = gl.getUniformLocation(program, 'u_texture');
  gl.uniform1i(uTex, 0);

  // ── Main render loop ─────────────────────────────────────────────────────
  function render() {
    if (drawing) drawAtMouse();

    // Propagate user‑defined parameters into WASM before each tick
    universe.set_params(
      decayStep,
      recoveryStep,
      satRecoveryFactor,
      satDecayFactor,
      lumDecayFactor,
      satGhostFactor,
      hueDriftStrength,
      hueLerpFactor,
    );

    universe.tick();

    // Fetch the raw HSL buffer from WASM memory
    const ptr = universe.cells_ptr();
    const len = universe.cells_len();
    const cells = new Uint8Array(memory.buffer, ptr, len);

    // Upload texture & draw
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, universe.width(), universe.height(), 0, gl.RGB, gl.UNSIGNED_BYTE, cells);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    updateIndv(cells);
    if (!paused) {
      requestAnimationFrame(render);
    }
  }
  updateInfo();
  render();
})();
