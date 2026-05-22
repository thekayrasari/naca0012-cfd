// ============================================================
// COLORMAP — Color Palette LUT Generation
// ============================================================

// Live color LUTs (precomputed 32-bit pixel data, 256 entries each)
var velocityLUT = new Uint32Array(256);
var pressureLUT = new Uint32Array(256);
var vorticityLUT = new Uint32Array(256);

/**
 * Precompute all three color LUTs (velocity, pressure, vorticity)
 * for the current canvas theme. Called on init and theme change.
 */
function generateLUTs() {
  // Helper: pack RGBA into 32-bit Little Endian (ABGR for ImageData)
  function rgbTo32(r, g, b, a) {
    if (a === undefined) a = 255;
    return (a << 24) | (b << 16) | (g << 8) | r;
  }

  for (var i = 0; i < 256; i++) {
    var t = i / 255;

    // 1. Velocity Heatmap (Cool to Hot)
    if (simState.canvasTheme === 'light') {
      // Light background style: White/Grey -> Teal -> Blue -> Indigo
      var r = Math.round(240 - 200 * t);
      var g = Math.round(245 - 140 * t);
      var b = Math.round(250 - 50 * t);
      velocityLUT[i] = rgbTo32(r, g, b);
    } else {
      // Dark theme: Dark Blue -> Cyan -> Green -> Yellow -> Red
      var r = 0, g = 0, b = 0;
      if (t < 0.25) {
        b = Math.round(t * 4 * 255);
      } else if (t < 0.5) {
        g = Math.round((t - 0.25) * 4 * 255);
        b = 255;
      } else if (t < 0.75) {
        r = Math.round((t - 0.5) * 4 * 255);
        g = 255;
        b = Math.round((0.75 - t) * 4 * 255);
      } else {
        r = 255;
        g = Math.round((1.0 - t) * 4 * 255);
      }
      velocityLUT[i] = rgbTo32(r, g, b);
    }

    // 2. Pressure (Diverging: Low=Blue, Mid=Neutral, High=Red)
    if (simState.canvasTheme === 'light') {
      // Light: Deep Blue -> Light Blue/Grey -> Deep Red
      if (t < 0.5) {
        var nt = t * 2;
        var r = Math.round(30 + 215 * nt);
        var g = Math.round(58 + 187 * nt);
        var b = Math.round(138 + 112 * nt);
        pressureLUT[i] = rgbTo32(r, g, b);
      } else {
        var nt = (t - 0.5) * 2;
        var r = Math.round(245 + 10 * nt);
        var g = Math.round(245 - 200 * nt);
        var b = Math.round(250 - 210 * nt);
        pressureLUT[i] = rgbTo32(r, g, b);
      }
    } else {
      // Dark: Blue -> Dark Indigo -> Red
      if (t < 0.5) {
        var nt = t * 2;
        var r = Math.round(30 * (1 - nt));
        var g = Math.round(58 * (1 - nt));
        var b = Math.round(255 - 230 * nt);
        pressureLUT[i] = rgbTo32(r, g, b);
      } else {
        var nt = (t - 0.5) * 2;
        var r = Math.round(25 + 230 * nt);
        var g = 10;
        var b = Math.round(25 * (1 - nt));
        pressureLUT[i] = rgbTo32(r, g, b);
      }
    }

    // 3. Vorticity (Diverging: Negative=Cyan/Blue, Mid=Neutral, Positive=Orange/Red)
    if (simState.canvasTheme === 'light') {
      // Light theme
      if (t < 0.5) {
        var nt = t * 2; // 0 to 1
        var r = Math.round(2 + 240 * nt);
        var g = Math.round(132 + 113 * nt);
        var b = Math.round(199 + 51 * nt);
        vorticityLUT[i] = rgbTo32(r, g, b);
      } else {
        var nt = (t - 0.5) * 2; // 0 to 1
        var r = Math.round(242 + 13 * nt);
        var g = Math.round(245 - 188 * nt);
        var b = Math.round(250 - 220 * nt);
        vorticityLUT[i] = rgbTo32(r, g, b);
      }
    } else {
      // Dark theme
      if (t < 0.5) {
        var nt = t * 2;
        var r = 0;
        var g = Math.round(130 * nt);
        var b = Math.round(100 + 155 * nt);
        vorticityLUT[i] = rgbTo32(r, g, b);
      } else {
        var nt = (t - 0.5) * 2;
        var r = Math.round(100 + 155 * nt);
        var g = Math.round(130 * (1 - nt));
        var b = 0;
        vorticityLUT[i] = rgbTo32(r, g, b);
      }
    }
  }
}
