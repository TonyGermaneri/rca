export function v4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      var r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8); // eslint-disable-line
      return v.toString(16);
  });
}

export function getDataUrlFromImg(img) {
  var c = document.createElement('canvas');
  c.height = img.naturalHeight;
  c.width = img.naturalWidth;
  var ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL();
}

export function hslaToRgbaFlatArray(hslaBuffer) {
  const length = hslaBuffer.length;
  const rgbaBuffer = new Uint8Array(length); // same size, because both are 4 bytes per pixel

  for (let i = 0; i < length; i += 4) {
    const h = hslaBuffer[i] / 255;       // Hue, normalized [0,1]
    const s = hslaBuffer[i + 1] / 255;   // Saturation [0,1]
    const l = hslaBuffer[i + 2] / 255;   // Lightness [0,1]
    const a = hslaBuffer[i + 3];         // Alpha remains 0–255

    const {r, g, b} = rgbaToHsla(h, s, l, 0);

    rgbaBuffer[i] = r;
    rgbaBuffer[i + 1] = g;
    rgbaBuffer[i + 2] = b;
    rgbaBuffer[i + 3] = a;
  }

  return rgbaBuffer;
}

export function newId() {
  const high = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
  const low = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
  return (high << 32n) | low;
}

export function getRandomColor() {
  const r = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  const g = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  const b = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  const a = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${a}`;
}

export function hexToHsla(hex) {
  hex = hex.replace('#', '');
  let r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
  let g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
  let b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
  let a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 255;
  return rgbaToHsla(r, g, b, a);
}

export function hexToHslaU8(hex) {
  return hslaToHslaU8(hexToHsla(hex));
}

export function hslaToHslaU8(hsla) {
  return {
    h: Math.floor(hsla.h / 360 * 255),
    s: Math.floor(hsla.s / 100 * 255), 
    l: Math.floor(hsla.l / 100 * 255),
    a: Math.floor(hsla.a / 100 * 255)
  }
}

export function rgbaToHsla(r, g, b, a) {
  r /= 255; g /= 255; b /= 255; a /= 255;
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
  return { h: h * 360, s: s * 100, l: l * 100, a: a * 100 };
}

export function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function getRandomFloatInclusive(min, max) {
  return Math.random() * (max - min) + min;
}
