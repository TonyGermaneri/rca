export default function glSetup(canvas) {
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
  uniform bool u_alpha;
  uniform bool u_use_RBG;
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
    vec3 rgb;

    float hue = hsl.r;
    float sat = hsl.g;
    float lum = hsl.b;

    if (u_use_RBG) {
      rgb = vec3(hue, sat, lum);
    } else {
      rgb = hsl2rgb(vec3(hue, sat, lum));
    }

    if (u_alpha) {
      gl_FragColor = vec4(rgb, hsl.a);
    } else {
      gl_FragColor = vec4(rgb, 1.0);
    }
  }`;

    const gl = canvas.getContext('webgl');
    const program = gl.createProgram();

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    }

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

    // rendering options
    const glAlpha = gl.getUniformLocation(program, 'u_alpha');
    const glUseRGB = gl.getUniformLocation(program, 'u_use_RBG');

    return (tWidth, tHeight, vWidth, vHeight, useAlpha, useRGB, buffer, offsetX = 0, offsetY = 0) => {
      gl.uniform1i(glAlpha, useAlpha ? 1 : 0);
      gl.uniform1i(glUseRGB, useRGB ? 1 : 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tWidth, tHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      gl.viewport(offsetX, offsetY, vWidth, vHeight);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}