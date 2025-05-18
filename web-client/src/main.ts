// index.js  ── Conway’s Game of Life driver for the “life.wasm” module.

import './style.css'
import init, { Universe } from '@ca/ca';

(async () => {

  const mousePosition = { x: 0, y: 0 };
  const dpr = window.devicePixelRatio || 1;
  // ── 1 ◂ Load WebAssembly and get its exports ──────────────────────────────
  const wasm   = await init();   // ← returns the raw exports object
  const memory = wasm.memory;        //   grab the Memory export

  const uWidth  = Math.floor(window.innerWidth);
  const uHeight = Math.floor(window.innerHeight);

  const universe = new Universe(uWidth, uHeight);
  universe.randomize();

  const width  = universe.width();
  const height = universe.height();

  // Setup WebGL
  const canvas = document.createElement("canvas");
  document.querySelector("#app")!.appendChild(canvas);
  
  function setCanvasSize() {
    canvas.width  = universe.width() * dpr;
    canvas.height = universe.height() * dpr;
    canvas.style.width  = `${universe.width()}px`;
    canvas.style.height = `${universe.height()}px`;
  }

  setCanvasSize();

  const gl = canvas.getContext("webgl");
  if (!gl) throw new Error("WebGL not supported");

  function getMouseCellPosition(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX / dpr);
    const y = Math.floor((event.clientY - rect.top)  * scaleY / dpr);
    mousePosition.x = x;
    mousePosition.y = y;
  }
  function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  function drawBrush(x, y, radius = 2) {
    const value = drawMode === "add" ? currentColor : 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;

        if (
          nx >= 0 && nx < universe.width() &&
          ny >= 0 && ny < universe.height()
        ) {
          universe.set_cell(ny, nx, getRandomIntInclusive(0, 255), getRandomIntInclusive(0, 255), value);
        }
      }
    }
  }
  function drawAtMouse(event) {
    const { x, y } = mousePosition;
    if (
      x >= 0 && x < universe.width() &&
      y >= 0 && y < universe.height()
    ) {
      drawBrush(x, y, 20); // brush size configurable
    }
  }
  function flipY(y) {
    return universe.height() - y - 1;
  }
  function isValidPosition({ x, y }) {
    return (
      x >= 0 && x < universe.width() &&
      y >= 0 && y < universe.height()
    );
  }
  let drawing = false;
  let drawMode = "add"; // "add" or "erase"
  let currentColor = 255; // can be 255, 200, 100 for different types

  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault(); // prevent context menu
    drawMode = e.button === 2 ? "erase" : "add";
    drawing = true;
    drawAtMouse(e);
  });
  window.addEventListener("mousemove", getMouseCellPosition);
  window.addEventListener("keydown", (e) => {
    if (e.key === "1") currentColor = 100;
    if (e.key === "2") currentColor = 200;
    if (e.key === "3") currentColor = 255;
    if (e.key === "c") universe.clear();
    if (e.key === "r") universe.randomize();
  });
  

  canvas.addEventListener("mouseup", () => drawing = false);
  canvas.addEventListener("mouseleave", () => drawing = false);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());


  

  window.addEventListener("resize", () => {
    const newWidth  = Math.floor(window.innerWidth);
    const newHeight = Math.floor(window.innerHeight);

    const oldWidth  = universe.width();
    const oldHeight = universe.height();

    if (newWidth > oldWidth || newHeight > oldHeight) {
      universe.resize(
        Math.max(newWidth, oldWidth),
        Math.max(newHeight, oldHeight)
      );


      setCanvasSize();

    }
  });



  // Shaders
  const vsSource = `

attribute vec2 a_position;
varying vec2 v_texcoord;
void main() {
v_texcoord = a_position * 0.5 + 0.5;
gl_Position = vec4(a_position, 0.0, 1.0);
}

  `;
  const fsSource = `

precision mediump float;

uniform sampler2D u_texture;
uniform float u_luminance_strength; // ← new uniform
varying vec2 v_texcoord;

// Convert HSL to RGB
vec3 hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = mix(0.9, 0.5, hsl.z);

    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float hp = h * 6.0;
    float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));

    vec3 rgb = vec3(0.0);
    if      (0.0 <= hp && hp < 1.0) rgb = vec3(c, x, 0.0);
    else if (1.0 <= hp && hp < 2.0) rgb = vec3(x, c, 0.0);
    else if (2.0 <= hp && hp < 3.0) rgb = vec3(0.0, c, x);
    else if (3.0 <= hp && hp < 4.0) rgb = vec3(0.0, x, c);
    else if (4.0 <= hp && hp < 5.0) rgb = vec3(x, 0.0, c);
    else if (5.0 <= hp && hp < 6.0) rgb = vec3(c, 0.0, x);

    float m = l - c / 2.0;
    return rgb + vec3(m);
}

void main() {
  vec3 hsl = texture2D(u_texture, vec2(v_texcoord.x, 1.0 - v_texcoord.y)).rgb;

  if (hsl.z < 0.05) discard;

  vec3 rgb = hsl2rgb(hsl);
  gl_FragColor = vec4(rgb, 1.0);
}

  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  // Geometry
  const posLoc = gl.getAttribLocation(program, "a_position");
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, +1, -1, -1, +1,
    -1, +1, +1, -1, +1, +1
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Set unpack alignment
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const uTex = gl.getUniformLocation(program, "u_texture");
  gl.uniform1i(uTex, 0);
  const uLuminanceStrength = gl.getUniformLocation(program, "u_luminance_strength");
  gl.uniform1f(uLuminanceStrength, 0.5); 

  // Main loop
  function render() {
    
    if (drawing) { drawAtMouse(mousePosition); }



    gl.uniform1f(uLuminanceStrength, 0.1);

    // After updating the universe
    universe.tick();

    // Retrieve updated pointer and length
    const width = universe.width();
    const height = universe.height();
    const ptr = universe.cells_ptr();
    const len = universe.cells_len();
    const cells = new Uint8Array(memory.buffer, ptr, len);

    // Upload texture
    gl.texImage2D(
      gl.TEXTURE_2D, 0,
      gl.RGB,
      width, height, 0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      cells
    );

    // Draw fullscreen quad
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }

  render();
})();
