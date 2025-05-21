// index.js  ── Conway’s Game of Life driver for the “life.wasm” module.
// Added keyboard controls:  
//   '-' / '='  → decrease / increase `decay_step`  
//   '[' / ']'  → decrease / increase `recovery_step`
// 6152 770 
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
  // universe.randomize();

  let svgShapes;
  let backgroundImageData = null;
  let backgroundMode = 'stretch';
  let controlIds = [];
  let controls;
  let t = 0;
  let ruleChange = 0;
  let rotateHue = false;
  let autoRotate = false;
  let stampOnRotate = false;
  let u32max = 4294967295;
  let shapeColor = '#2F3E4E';
  let shapeSizeX = 0.1;
  let shapeSizeY = 0.1;
  let backgroundColor = '#2F3E4E';
  let brushColor = '#FF0000';
  let rule = getRandomIntInclusive(0, u32max);
  let decayStep  = Math.random() > 0.5 ? 1 : getRandomIntInclusive(0, 500);
  let recoveryStep = getRandomIntInclusive(0, 500);
  let satRecoveryFactor = 0.8;
  let satDecayFactor = 0.5;
  let lumDecayFactor = 0.95;
  let lifeDecayFactor = 0.95;
  let satGhostFactor = 0.9;
  let hueDriftStrength = 0.1;
  let hueLerpFactor = 0.1;
  let hueAmplitude = 0.01;
  let saturationAmplitude = 0.01;
  let ruleChangeRate = 0.1;
  let brushRadius = 40;
  let brushMode = "brush";
  let stampImageData = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  let paused = false;
  let drawing      = false;
  let drawMode     = 'add'; // 'add' | 'erase'
  let currentColorH = 0;
  let currentColorS = 255;
  let currentColorL = 127;

  // Canvas & WebGL bootstrapping ────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  const panel = document.createElement('div');
  const info = document.createElement('div');
  const indv = document.createElement('div');
  const hint = document.createElement('div');
  panel.className = 'panel';
  panel.style.display = 'none';
  hint.innerHTML = "Press H to show controls";
  hint.className = "hint";
  window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      // colour shortcuts & actions (existing)
      case 'arrowup':  e.preventDefault(); rule += 1; document.getElementById('rule_input').value = rule;   break;
      case 'arrowdown':  e.preventDefault(); rule -= 1; document.getElementById('rule_input').value = rule;   break;
      case 'c':  universe.clear();    break;
      case 'b':  setBackgroundImage();    break;
      case 'a':  universe.randomize(); break;
      case 'r':  randomizeParams(); break;
      case 'h':  panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; break;
      case 'p':  paused = !paused; if(!paused){render();} break;
      case 's':  render(); break;
      default:
        return; // quit for keys we don’t handle
    }
  });


  function updateShapes() {
    // this totally doesn't work
    const width = shapeSizeX * window.innerWidth;
    const height = shapeSizeY * window.innerHeight;

    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height) * 0.1; // scale shapes to fit within canvas

    svgShapes = {
      circle: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${centerX}" cy="${centerY}" r="${size / 2}" fill="${shapeColor}"/>
      </svg>`,

      square: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${centerX - size / 2}" y="${centerY - size / 2}" width="${size}" height="${size}" fill="${shapeColor}"/>
      </svg>`,

      triangle: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <polygon fill="${shapeColor}" points="
          ${centerX},${centerY - size / 2}
          ${centerX + size / 2},${centerY + size / 2}
          ${centerX - size / 2},${centerY + size / 2}
        "/>
      </svg>`,

      star: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <polygon fill="${shapeColor}" points="
          ${centerX},${centerY - size * 0.5}
          ${centerX + size * 0.11},${centerY - size * 0.15}
          ${centerX + size * 0.38},${centerY - size * 0.15}
          ${centerX + size * 0.16},${centerY + size * 0.07}
          ${centerX + size * 0.24},${centerY + size * 0.34}
          ${centerX},${centerY + size * 0.18}
          ${centerX - size * 0.24},${centerY + size * 0.34}
          ${centerX - size * 0.16},${centerY + size * 0.07}
          ${centerX - size * 0.38},${centerY - size * 0.15}
          ${centerX - size * 0.11},${centerY - size * 0.15}
        "/>
      </svg>`,

      hexagon: `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <polygon fill="${shapeColor}" points="
          ${centerX},${centerY - size * 0.5}
          ${centerX + size * 0.433},${centerY - size * 0.25}
          ${centerX + size * 0.433},${centerY + size * 0.25}
          ${centerX},${centerY + size * 0.5}
          ${centerX - size * 0.433},${centerY + size * 0.25}
          ${centerX - size * 0.433},${centerY - size * 0.25}
        "/>
      </svg>`
    };
  }
  updateShapes();

  handleBuiltInImageChange(svgShapes.circle);

  let controlSet = {
    rule:                { tag: 'input', props: { id: 'rule_input', type: 'number', value: rule, oninput: (e) => { rule = parseInt(e.target.value); } } },
    randomize:           { tag: 'button', innerHTML: 'Randomize', props: { onclick: randomizeParams }},
    shapeColor:          { tag: 'input', props: { type: 'color', oninput: (e) => { shapeColor = e.target.value; updateShapes(); }, value: backgroundColor } },
    brushColor:          { tag: 'input', props: { type: 'color', oninput: updateColors, value: brushColor } },
    backgroundColor:     { tag: 'input', props: { type: 'color', oninput: (e) => { backgroundColor = e.target.value; document.body.style.backgroundColor = backgroundColor; }, value: backgroundColor } },
    brushSize:           { tag: 'input', props: { type: 'range', min: 1, max: 200, value: brushRadius, oninput: (e) => { brushRadius = parseInt(e.target.value);  } }},
    pause:               { tag: 'input', props: { type: 'checkbox', onclick: (e) => { paused = e.target.checked; if (!paused) { render(); } }}},
    clear:               { tag: 'button', innerHTML: 'Clear', props: { onclick: () => { universe.clear();  }}},
    setColor:            { tag: 'button', innerHTML: 'Set', props: { onclick: () => { universe.set_grid(currentColorH, currentColorS, currentColorL);  }}},
    decaySlider:         { tag: 'input', props: { type: 'range', min: 1, max: 500, value: decayStep, oninput: (e) => { decayStep = parseInt(e.target.value);  }}},
    recoverySlider:      { tag: 'input', props: { type: 'range', min: 1, max: 500, value: recoveryStep, oninput: (e) => { recoveryStep = parseInt(e.target.value);  }}},
    
    satRecoveryFactor:   { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: satRecoveryFactor, oninput: (e) => { satRecoveryFactor = parseFloat(e.target.value);  }}},
    satDecayFactor:      { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: satDecayFactor, oninput: (e) => { satDecayFactor = parseFloat(e.target.value);  }}},
    lumDecayFactor:      { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: lumDecayFactor, oninput: (e) => { lumDecayFactor = parseFloat(e.target.value);  }}},
    lifeDecayFactor:     { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: lifeDecayFactor, oninput: (e) => { lifeDecayFactor = parseFloat(e.target.value);  }}},
    satGhostFactor:      { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: satGhostFactor, oninput: (e) => { satGhostFactor = parseFloat(e.target.value);  }}},
    bgHueAmplitude:      { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: hueAmplitude, oninput: (e) => { hueAmplitude = parseFloat(e.target.value);  }}},
    bgSatAmplitude:      { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: saturationAmplitude, oninput: (e) => { saturationAmplitude = parseFloat(e.target.value);  }}},
    hueDriftStrength:    { tag: 'input', props: { type: 'range', min: 0.0, max: 0.2, step: 0.001, value: hueDriftStrength, oninput: (e) => { hueDriftStrength = parseFloat(e.target.value);  }}},
    hueLerpFactor:       { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: hueLerpFactor, oninput: (e) => { hueLerpFactor = parseFloat(e.target.value);  }}},
    ruleChangeRate:      { tag: 'input', props: { type: 'range', min: 0.0, max: 1.0, step: 0.01, value: ruleChangeRate, oninput: (e) => { ruleChangeRate = parseFloat(e.target.value);  }}},
    autoRotate:          { tag: 'input', props: { type: 'checkbox', onclick: (e) => { autoRotate = e.target.checked; if (!autoRotate) { render(); } }}},
    rotateHue:          { tag: 'input', props: { type: 'checkbox', onclick: (e) => { rotateHue = e.target.checked; if (!rotateHue) { render(); } }}},
    stampOnRotate:       { tag: 'input', props: { type: 'checkbox', onclick: (e) => { stampOnRotate = e.target.checked; if (!stampOnRotate) { render(); } }}},
    brushImageUpload:    { tag: 'input', props: { type: 'file', accept: 'image/*', onchange: handleImageUpload }},
    brushMode: {
      tag: 'select',
      props: {
        onchange: (e) => { brushMode = e.target.value; }
      },
      children: [
        { tag: 'option', props: { value: 'brush' }, innerHTML: 'Brush' },
        { tag: 'option', props: { value: 'stamp' }, innerHTML: 'Stamp' },
      ]
    },
    builtInImages: {
      tag: 'select',
      props: {
        onchange: handleBuiltInImageChange
      },
      children: [
        { tag: 'option', props: { value: null }, innerHTML: 'None' },
        { tag: 'option', props: { value: svgShapes.circle }, innerHTML: 'Circle Shape' },
        { tag: 'option', props: { value: svgShapes.square }, innerHTML: 'Square Shape' },
        { tag: 'option', props: { value: svgShapes.triangle }, innerHTML: 'Triangle Shape' },
        { tag: 'option', props: { value: svgShapes.hexagon }, innerHTML: 'Hexagon Shape' }
      ]
    },
    imageUpload: {
      tag: 'input',
      props: {
        type: 'file',
        accept: 'image/*',
        onchange: handleBackgroundImageUpload
      }
    },

    backgroundModeSelect: {
      tag: 'select',
      props: {
        onchange: handleBackgroundModeChange
      },
      children: [
        { tag: 'option', props: { value: 'stretch' }, innerHTML: 'Stretch' },
        { tag: 'option', props: { value: 'full' }, innerHTML: 'Full' },
        { tag: 'option', props: { value: 'repeat' }, innerHTML: 'Repeat' },
        { tag: 'option', props: { value: 'center' }, innerHTML: 'Center' }
      ]
    },

    setBackgroundButton: {
      tag: 'button',
      props: {
        onclick: setBackgroundImage
      },
      innerHTML: 'Set Image'
    }
  };

  function handleBuiltInImageChange(e) {
    const url = e.target ? e.target.value : e;
    if (!url) { return; }
    const img = new Image();
    img.onload = () => {
      backgroundImageData = img;
      setBackgroundImage();
    };
    img.src = "data:image/svg+xml;utf8," + encodeURIComponent(url);
  }

  function getRandomColor() {
    const r = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const g = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const b = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  function randomizeParams() {

    universe.clear();

    if (stampOnRotate) {
      var svgKeys = Object.keys(svgShapes);
      var svgKey = svgKeys[getRandomIntInclusive(0, svgKeys.length - 1)];
      handleBuiltInImageChange(svgShapes[svgKey]);
    }

    backgroundColor = getRandomColor();
    document.getElementById('backgroundColor').value = backgroundColor;
    document.body.style.backgroundColor = backgroundColor;

    brushColor = '#FF0000';

    rule = getRandomIntInclusive(
      parseInt(controlSet.rule.props.min ?? 0),
      parseInt(controlSet.rule.props.max ?? u32max)
    );
    document.getElementById('rule_input').value = rule;


    decayStep  = Math.random() > 0.5 ? 1 : getRandomIntInclusive(0, 500);
    document.getElementById('decaySlider').value = decayStep;

    recoveryStep = getRandomIntInclusive(
      parseInt(controlSet.recoverySlider.props.min),
      parseInt(controlSet.recoverySlider.props.max)
    );
    document.getElementById('recoverySlider').value = recoveryStep;

    satRecoveryFactor = parseFloat(
      (Math.random() * (controlSet.satRecoveryFactor.props.max - controlSet.satRecoveryFactor.props.min) + parseFloat(controlSet.satRecoveryFactor.props.min)).toFixed(2)
    );
    document.getElementById('satRecoveryFactor').value = satRecoveryFactor;

    satDecayFactor = parseFloat(
      (Math.random() * (controlSet.satDecayFactor.props.max - controlSet.satDecayFactor.props.min) + parseFloat(controlSet.satDecayFactor.props.min)).toFixed(2)
    );
    document.getElementById('satDecayFactor').value = satDecayFactor;

    lumDecayFactor = parseFloat(
      (Math.random() * (controlSet.lumDecayFactor.props.max - controlSet.lumDecayFactor.props.min) + parseFloat(controlSet.lumDecayFactor.props.min)).toFixed(2)
    );
    document.getElementById('lumDecayFactor').value = lumDecayFactor;

    lifeDecayFactor = parseFloat(
      (Math.random() * (controlSet.lifeDecayFactor.props.max - controlSet.lifeDecayFactor.props.min) + parseFloat(controlSet.lifeDecayFactor.props.min)).toFixed(2)
    );
    document.getElementById('lifeDecayFactor').value = lifeDecayFactor;

    satGhostFactor = parseFloat(
      (Math.random() * (controlSet.satGhostFactor.props.max - controlSet.satGhostFactor.props.min) + parseFloat(controlSet.satGhostFactor.props.min)).toFixed(2)
    );
    document.getElementById('satGhostFactor').value = satGhostFactor;

    hueDriftStrength = parseFloat(
      (Math.random() * (controlSet.hueDriftStrength.props.max - controlSet.hueDriftStrength.props.min) + parseFloat(controlSet.hueDriftStrength.props.min)).toFixed(3)
    );
    document.getElementById('hueDriftStrength').value = hueDriftStrength;

    hueLerpFactor = parseFloat(
      (Math.random() * (controlSet.hueLerpFactor.props.max - controlSet.hueLerpFactor.props.min) + parseFloat(controlSet.hueLerpFactor.props.min)).toFixed(2)
    );
    document.getElementById('hueLerpFactor').value = hueLerpFactor;

    hueAmplitude = parseFloat(
      (Math.random() * (controlSet.bgHueAmplitude.props.max - controlSet.bgHueAmplitude.props.min) + parseFloat(controlSet.bgHueAmplitude.props.min)).toFixed(2)
    );
    document.getElementById('bgHueAmplitude').value = hueAmplitude;

    saturationAmplitude = parseFloat(
      (Math.random() * (controlSet.bgSatAmplitude.props.max - controlSet.bgSatAmplitude.props.min) + parseFloat(controlSet.bgSatAmplitude.props.min)).toFixed(2)
    );
    document.getElementById('bgSatAmplitude').value = saturationAmplitude;

    ruleChangeRate = parseFloat(
      (Math.random() * (controlSet.ruleChangeRate.props.max - controlSet.ruleChangeRate.props.min) + parseFloat(controlSet.ruleChangeRate.props.min)).toFixed(2)
    );
    document.getElementById('ruleChangeRate').value = ruleChangeRate;


    universe.clear();
    if (backgroundImageData) {
      setBackgroundImage();
    } else {
      universe.randomize();
    }

    
  }

  controlIds = Object.keys(controlSet);
  controls = createControls(controlSet);
  Object.values(controls).forEach((control) => {panel.appendChild(control);})
  panel.appendChild(info);
  panel.appendChild(indv);


  updateInfo()

  function handleBackgroundImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        backgroundImageData = img;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }


  function handleBackgroundModeChange(event) {
    backgroundMode = event.target.value;
  }

  function setBackgroundImage() {
    if (!backgroundImageData) {
      alert("Please upload a background image first.");
      return;
    }

    const universeWidth = universe.width();
    const universeHeight = universe.height();

    // Create a temporary canvas to draw and extract image data
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');

    let drawWidth, drawHeight;
    let offsetX = 0, offsetY = 0;

    switch (backgroundMode) {
      case 'stretch':
        drawWidth = universeWidth;
        drawHeight = universeHeight;
        tempCanvas.width = drawWidth;
        tempCanvas.height = drawHeight;
        ctx.drawImage(backgroundImageData, 0, 0, drawWidth, drawHeight);
        break;

      case 'full': {
        const scale = Math.max(universeWidth / backgroundImageData.width, universeHeight / backgroundImageData.height);
        drawWidth = backgroundImageData.width * scale;
        drawHeight = backgroundImageData.height * scale;
        offsetX = (universeWidth - drawWidth) / 2;
        offsetY = (universeHeight - drawHeight) / 2;
        tempCanvas.width = universeWidth;
        tempCanvas.height = universeHeight;
        ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(backgroundImageData, offsetX, offsetY, drawWidth, drawHeight);
        break;
      }

      case 'center':
        drawWidth = backgroundImageData.width;
        drawHeight = backgroundImageData.height;
        tempCanvas.width = drawWidth;
        tempCanvas.height = drawHeight;
        ctx.drawImage(backgroundImageData, 0, 0);
        offsetX = (universeWidth - drawWidth) / 2;
        offsetY = (universeHeight - drawHeight) / 2;
        break;

      case 'repeat':
        tempCanvas.width = universeWidth;
        tempCanvas.height = universeHeight;
        const pattern = ctx.createPattern(backgroundImageData, 'repeat');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, universeWidth, universeHeight);
        drawWidth = universeWidth;
        drawHeight = universeHeight;
        break;

      default:
        console.warn('Unknown background mode:', backgroundMode);
        return;
    }

    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = new Uint8Array(imageData.data.buffer);

    const cx = Math.floor((offsetX || 0) + drawWidth / 2);
    const cy = Math.floor((offsetY || 0) + drawHeight / 2);

    universe.draw_stamp_at(cx, cy, imageData.width, imageData.height, data);
  }

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
      32bit HLSA Rust Cellular Automata<br>
      h: Hide this dialog<br>
      Arrow Up: Next Rule<br>
      Arrow Up: Previous Rule<br>
      c: Clear<br>
      b: Set Background Image<br>
      a: Set Random Pixels<br>
      r: Randomize Params<br>
      p: Pause simluation<br>
      s: Step forward (when paused)
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

      el.id = key;
      if (config.innerHTML) {
        el.innerHTML = config.innerHTML;
      }

      if (config.props) {
        for (const [prop, value] of Object.entries(config.props)) {
          el[prop] = value;
        }
      }

      if (Array.isArray(config.children)) {
        for (const childConfig of config.children) {
          const child = document.createElement(childConfig.tag);

          if (childConfig.innerHTML) {
            child.innerHTML = childConfig.innerHTML;
          }

          if (childConfig.props) {
            for (const [prop, value] of Object.entries(childConfig.props)) {
              child[prop] = value;
            }
          }

          el.appendChild(child);
        }
      }

      container.appendChild(label);
      container.appendChild(el);
      elements[key] = container;
    }

    return elements;
  }

  function rotateHueSaturation(hexColor, time, hueAmplitude = 30, saturationAmplitude = 20) {
    // Convert hex to RGB
    function hexToRgb(hex) {
      hex = hex.replace(/^#/, '');
      if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
      }
      const bigint = parseInt(hex, 16);
      return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
      };
    }

    // Convert RGB to HSL
    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      return { h: h * 360, s: s * 100, l: l * 100 };
    }

    // Convert HSL to RGB
    function hslToRgb(h, s, l) {
      h /= 360; s /= 100; l /= 100;
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      let r, g, b;

      if (s === 0) {
        r = g = b = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }

      return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
      };
    }

    // Convert RGB to hex
    function rgbToHex(r, g, b) {
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    const { r, g, b } = hexToRgb(hexColor);
    let { h, s, l } = rgbToHsl(r, g, b);

    // Apply sine wave modulation
    const sine = Math.sin(time);
    h = (h + hueAmplitude * sine) % 360;
    if (h < 0) h += 360;

    s = s + saturationAmplitude * sine;
    s = Math.max(0, Math.min(100, s));

    const { r: r2, g: g2, b: b2 } = hslToRgb(h, s, l);
    return rgbToHex(r2, g2, b2);
  }


  document.querySelector('#app').appendChild(canvas);
  document.querySelector('#app').appendChild(panel);
  document.querySelector('#app').appendChild(hint);

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


    if (brushMode === "stamp") {
      if (!stampImageData) { return; }

      const w = stampImageData.width;
      const h = stampImageData.height;
      const data = stampImageData.data;

      universe.draw_stamp_at(x, y, w, h, data);
    }

    if (brushMode === "brush") {
      // cx: u32, cy: u32, radius: u32, add_mode: bool, h: u8, s: u8, l: u8
      universe.draw_brush(x, y, brushRadius, true, currentColorH, currentColorS, currentColorL);
    }

  }



  function setGrid(h, s, l) {
    universe.set_grid(h, s, l);
  }

    



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
  vec4 hsl = texture2D(u_texture, vec2(v_texcoord.x, 1.0 - v_texcoord.y)).rgba;

  float hue = hsl.r;
  float sat = hsl.g;
  float lum = hsl.b;

  vec3 rgb = hsl2rgb(vec3(hue, sat, lum)); 

  gl_FragColor = vec4(rgb, hsl.a);
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
    t += 0.01;
    if (drawing) drawAtMouse();

    ruleChange += ruleChangeRate;

    if (rotateHue) {
      backgroundColor = rotateHueSaturation(backgroundColor, t, hueAmplitude, saturationAmplitude);
      document.body.style.backgroundColor = backgroundColor;
    }

    if (autoRotate) {
      if (ruleChange > 100) {
        rule = getRandomIntInclusive(0, u32max);
        document.getElementById('rule_input').value = rule;
        ruleChange = 0;
      }

      if (stampOnRotate) {
        universe.clear();
        if (backgroundImageData) {
          setBackgroundImage();
        } else {
          universe.randomize();
        }
      }
    }

    // Propagate user‑defined parameters into WASM before each tick
    universe.set_params(
      rule,
      decayStep,
      recoveryStep,
      satRecoveryFactor,
      satDecayFactor,
      lumDecayFactor,
      lifeDecayFactor,
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, universe.width(), universe.height(), 0, gl.RGBA, gl.UNSIGNED_BYTE, cells);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    updateIndv(cells);
    if (!paused) {
      requestAnimationFrame(render);
    }
  }
  
  render();
})();
