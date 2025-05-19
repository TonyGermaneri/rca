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
  let brushRadius = 40;

  // Canvas & WebGL bootstrapping ────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  document.querySelector('#app')!.appendChild(canvas);

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
  }

  function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  function drawAtMouse() {
    const { x, y } = mousePosition;
    if (x >= 0 && x < universe.width() && y >= 0 && y < universe.height()) {
      universe.draw_brush(x, y, brushRadius, drawMode === 'add', currentColor, 255, 255);
    }
  }

  // ── Interaction State ────────────────────────────────────────────────────
  let drawing      = false;
  let drawMode     = 'add'; // 'add' | 'erase'
  let currentColor = 255;   // 255, 200, 100

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

  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      // colour shortcuts & actions (existing)
      case '1':  currentColor = 100; break;
      case '2':  currentColor = 200; break;
      case '3':  currentColor = 255; break;
      case 'c':  universe.clear();    break;
      case 'r':  universe.randomize(); break;

      // ── NEW: life‑cycle tuning shortcuts ──────────────────────────────
      case '-':
      case '_': // Shift + '-'
        decayStep = Math.max(1, decayStep - 1);
        console.info(`decay_step → ${decayStep}`);
        break;
      case '=':
      case '+': // Shift + '='
        decayStep = Math.min(255, decayStep + 1);
        console.info(`decay_step → ${decayStep}`);
        break;
      case '[':
        recoveryStep = Math.max(1, recoveryStep - 1);
        console.info(`recovery_step → ${recoveryStep}`);
        break;
      case ']':
        recoveryStep = Math.min(255, recoveryStep + 1);
        console.info(`recovery_step → ${recoveryStep}`);
        break;
      default:
        return; // quit for keys we don’t handle
    }
  });

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
  
  // gl_FragColor = vec4(hsl2rgb(hsl), 1.0);
  gl_FragColor = vec4(hsl2rgb(vec3(hsl.z, hsl.y, hsl.x)), 1.0);  // Hue only (red channel)
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
    universe.set_params(decayStep, recoveryStep);
    universe.tick();

    // Fetch the raw HSL buffer from WASM memory
    const ptr = universe.cells_ptr();
    const len = universe.cells_len();
    const cells = new Uint8Array(memory.buffer, ptr, len);

    // Upload texture & draw
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, universe.width(), universe.height(), 0, gl.RGB, gl.UNSIGNED_BYTE, cells);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }

  render();
})();
